import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { serverEnv, supabaseServerConfigured } from "../env";
import type { UsageSnapshot } from "./usage";

// Per-user persistence for Codex OAuth tokens + usage snapshots, keyed by
// user_id. Two backends:
//   - Supabase (codex_credentials table) when configured — for real per-user
//     production use.
//   - Local JSON file fallback when Supabase is NOT configured — for local
//     single-user testing without a database. The demo user links one account.

export type PersistedTokens = {
  access_token: string;
  refresh_token: string;
  account_id: string | null;
  expires_at: number; // epoch ms
};

type Backend = {
  loadTokens(userId: string): Promise<PersistedTokens | null>;
  saveTokens(userId: string, tokens: PersistedTokens): Promise<void>;
  loadUsageSnapshot(userId: string): Promise<UsageSnapshot | null>;
  saveUsageSnapshot(userId: string, snapshot: UsageSnapshot): Promise<void>;
};

// --- Supabase backend ---------------------------------------------------------

function supabaseBackend(): Backend {
  const client = createClient(
    serverEnv.NEXT_PUBLIC_SUPABASE_URL,
    serverEnv.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );

  return {
    async loadTokens(userId) {
      const { data, error } = await client
        .from("codex_credentials")
        .select("access_token, refresh_token, account_id, expires_at")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw new Error(`Failed to load Codex credentials: ${error.message}`);
      if (!data) return null;
      return {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        account_id: data.account_id,
        expires_at: new Date(data.expires_at).getTime()
      };
    },
    async saveTokens(userId, tokens) {
      const { error } = await client.from("codex_credentials").upsert({
        user_id: userId,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        account_id: tokens.account_id,
        expires_at: new Date(tokens.expires_at).toISOString(),
        updated_at: new Date().toISOString()
      });
      if (error) throw new Error(`Failed to save Codex credentials: ${error.message}`);
    },
    async loadUsageSnapshot(userId) {
      const { data, error } = await client
        .from("codex_credentials")
        .select("usage_snapshot")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw new Error(`Failed to load usage snapshot: ${error.message}`);
      return (data?.usage_snapshot as UsageSnapshot | null) ?? null;
    },
    async saveUsageSnapshot(userId, snapshot) {
      // update (not upsert): a snapshot must never create a row without tokens.
      const { error } = await client
        .from("codex_credentials")
        .update({
          usage_snapshot: snapshot,
          usage_captured_at: new Date(snapshot.captured_at).toISOString()
        })
        .eq("user_id", userId);
      if (error) throw new Error(`Failed to save usage snapshot: ${error.message}`);
    }
  };
}

// --- Local file backend (no Supabase) ----------------------------------------

type FileRow = { tokens?: PersistedTokens; usage?: UsageSnapshot };
type FileShape = Record<string, FileRow>;

function fileBackend(): Backend {
  const path = isAbsolute(serverEnv.CODEX_TOKEN_FILE)
    ? serverEnv.CODEX_TOKEN_FILE
    : resolve(process.cwd(), serverEnv.CODEX_TOKEN_FILE);

  const read = async (): Promise<FileShape> => {
    try {
      return JSON.parse(await readFile(path, "utf8")) as FileShape;
    } catch {
      return {};
    }
  };
  const write = async (data: FileShape) => {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, JSON.stringify(data, null, 2), { mode: 0o600 });
  };

  return {
    async loadTokens(userId) {
      return (await read())[userId]?.tokens ?? null;
    },
    async saveTokens(userId, tokens) {
      const data = await read();
      data[userId] = { ...data[userId], tokens };
      await write(data);
    },
    async loadUsageSnapshot(userId) {
      return (await read())[userId]?.usage ?? null;
    },
    async saveUsageSnapshot(userId, snapshot) {
      const data = await read();
      // Mirror the Supabase semantics: only attach usage to a linked user.
      if (!data[userId]?.tokens) return;
      data[userId] = { ...data[userId], usage: snapshot };
      await write(data);
    }
  };
}

function backend(): Backend {
  return supabaseServerConfigured() ? supabaseBackend() : fileBackend();
}

export function loadTokens(userId: string): Promise<PersistedTokens | null> {
  return backend().loadTokens(userId);
}

export function saveTokens(userId: string, tokens: PersistedTokens): Promise<void> {
  return backend().saveTokens(userId, tokens);
}

export function saveUsageSnapshot(
  userId: string,
  snapshot: UsageSnapshot
): Promise<void> {
  return backend().saveUsageSnapshot(userId, snapshot);
}

export function loadUsageSnapshot(userId: string): Promise<UsageSnapshot | null> {
  return backend().loadUsageSnapshot(userId);
}
