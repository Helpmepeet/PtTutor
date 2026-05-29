"use client";

import type { Session } from "@supabase/supabase-js";
import type { DraftScenarioResponse } from "@/lib/scenario-input";
import type { RoleplaySession, Scenario, SessionDetail } from "@/lib/types";

export type ClientUser = {
  id: string;
  email: string;
  name: string;
};

export type ApiState = {
  session: Session | null;
  demoUser: ClientUser | null;
};

async function authHeaders(state: ApiState): Promise<HeadersInit> {
  const headers: Record<string, string> = {
    "content-type": "application/json"
  };

  if (state.session?.access_token) {
    headers.authorization = `Bearer ${state.session.access_token}`;
  } else if (state.demoUser) {
    headers["x-demo-user"] = state.demoUser.id;
  }

  return headers;
}

async function parseJson<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => ({}))) as T & {
    error?: string;
  };

  if (!response.ok) {
    throw new Error(body.error || response.statusText);
  }

  return body;
}

export async function apiGet<T>(path: string, state: ApiState): Promise<T> {
  const response = await fetch(path, {
    headers: await authHeaders(state)
  });
  return parseJson<T>(response);
}

export async function apiPost<T>(
  path: string,
  body: unknown,
  state: ApiState
): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers: await authHeaders(state),
    body: JSON.stringify(body)
  });
  return parseJson<T>(response);
}

export async function apiPatch<T>(
  path: string,
  body: unknown,
  state: ApiState
): Promise<T> {
  const response = await fetch(path, {
    method: "PATCH",
    headers: await authHeaders(state),
    body: JSON.stringify(body)
  });
  return parseJson<T>(response);
}

export async function apiDelete<T>(path: string, state: ApiState): Promise<T> {
  const response = await fetch(path, {
    method: "DELETE",
    headers: await authHeaders(state)
  });
  return parseJson<T>(response);
}

export type ScenariosResponse = { scenarios: Scenario[] };
export type CreateScenarioResponse = { scenario: Scenario };
export type { DraftScenarioResponse };
export type SessionsResponse = { sessions: RoleplaySession[] };
export type SessionResponse = { session: SessionDetail };

export type SSEEvent = {
  event: string;
  data: Record<string, unknown>;
};

export async function* apiPostSSE(
  path: string,
  body: unknown,
  state: ApiState
): AsyncGenerator<SSEEvent> {
  const response = await fetch(path, {
    method: "POST",
    headers: await authHeaders(state),
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    throw new Error(errorBody.error || response.statusText);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("No response body");
  }

  const decoder = new TextDecoder();
  let buffer = "";

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let sep: number;
    while ((sep = buffer.indexOf("\n\n")) !== -1) {
      const rawBlock = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);

      let eventName = "message";
      let dataStr = "";

      for (const line of rawBlock.split("\n")) {
        if (line.startsWith("event: ")) {
          eventName = line.slice(7).trim();
        } else if (line.startsWith("data: ")) {
          dataStr += line.slice(6);
        }
      }

      if (dataStr) {
        try {
          yield { event: eventName, data: JSON.parse(dataStr) };
        } catch {
          // Skip malformed JSON
        }
      }
    }
  }
}

