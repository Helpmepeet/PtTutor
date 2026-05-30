import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getScenarioById, listScenarios as listBuiltInScenarios } from "@/lib/scenarios";
import type { InsightRow } from "@/lib/insights";
import type {
  RoleplayMessage,
  ReviewerOutput,
  Scenario,
  RoleplaySession,
  TeacherMessage
} from "@/lib/types";
import type { AuthenticatedUser } from "./auth";
import { serverEnv } from "./env";
import {
  defaultSessionTitle,
  type CreateActorMessageInput,
  type CreateSessionInput,
  type CreateTeacherMessageInput,
  type CreateUserMessageInput,
  type RoleplayStore,
  type UpdateSessionInput,
  type UpdateUserMessageInput
} from "./store";

function createServiceClient(): SupabaseClient {
  return createClient(
    serverEnv.NEXT_PUBLIC_SUPABASE_URL,
    serverEnv.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        persistSession: false
      }
    }
  );
}

const SUPABASE_PAGE_SIZE = 1000;
const SUPABASE_IN_FILTER_BATCH_SIZE = 200;

async function ensureUser(supabase: SupabaseClient, user: AuthenticatedUser) {
  const { error } = await supabase.from("users").upsert({
    id: user.id,
    email: user.email,
    name: user.name,
    avatar_url: user.avatar_url
  });
  if (error) {
    throw new Response(error.message, { status: 500 });
  }
}

function assertSupabase<T>(data: T | null, error: { message: string } | null): T {
  if (error) {
    throw new Response(error.message, { status: 500 });
  }
  if (!data) {
    throw new Response("Not found", { status: 404 });
  }
  return data;
}

export function createSupabaseStore(): RoleplayStore {
  const supabase = createServiceClient();

  async function listCustomScenarios(userId: string): Promise<Scenario[]> {
    const { data, error } = await supabase
      .from("custom_scenarios")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    return assertSupabase<Scenario[]>(data, error).map((scenario) => ({
      ...scenario,
      source: "custom"
    }));
  }

  async function getScenarioForUser(
    userId: string,
    scenarioId: string
  ): Promise<Scenario | null> {
    const builtIn = getScenarioById(scenarioId);
    if (builtIn) return builtIn;

    const { data, error } = await supabase
      .from("custom_scenarios")
      .select("*")
      .eq("id", scenarioId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) {
      throw new Response(error.message, { status: 500 });
    }
    return data ? ({ ...data, source: "custom" } as Scenario) : null;
  }

  return {
    async listScenarios(userId) {
      return [...listBuiltInScenarios(), ...(await listCustomScenarios(userId))];
    },

    async getScenario(userId, scenarioId) {
      return getScenarioForUser(userId, scenarioId);
    },

    async createScenario(user, input) {
      await ensureUser(supabase, user);
      const { data, error } = await supabase
        .from("custom_scenarios")
        .insert({
          user_id: user.id,
          ...input
        })
        .select("*")
        .single();
      const scenario = assertSupabase<Scenario>(data, error);
      return { ...scenario, source: "custom" };
    },

    async listSessions(userId) {
      const { data, error } = await supabase
        .from("sessions")
        .select("*")
        .eq("user_id", userId)
        .order("last_message_at", { ascending: false });
      const sessions = assertSupabase<RoleplaySession[]>(data, error);
      if (sessions.length === 0) return sessions;

      const { data: messages, error: messagesError } = await supabase
        .from("messages")
        .select("session_id, content, created_at")
        .in(
          "session_id",
          sessions.map((session) => session.id)
        )
        .eq("role", "user")
        .order("created_at", { ascending: false });
      if (messagesError) {
        throw new Response(messagesError.message, { status: 500 });
      }

      const latestBySession = new Map<string, string>();
      for (const message of messages ?? []) {
        if (!latestBySession.has(message.session_id)) {
          latestBySession.set(message.session_id, message.content);
        }
      }

      return sessions.map((session) => ({
        ...session,
        latest_user_message: latestBySession.get(session.id) ?? null
      }));
    },

    async createSession(input: CreateSessionInput) {
      await ensureUser(supabase, input.user);
      const scenario = await getScenarioForUser(input.user.id, input.scenarioId);
      if (!scenario) {
        throw new Response("Scenario not found", { status: 404 });
      }
      const { data, error } = await supabase
        .from("sessions")
        .insert({
          user_id: input.user.id,
          scenario_id: input.scenarioId,
          title: defaultSessionTitle(scenario.name),
          actor_level: input.actorLevel ?? "standard",
          reviewer_feedback_mode: scenario.feedback_mode ?? "standard"
        })
        .select("*")
        .single();
      return {
        ...assertSupabase<RoleplaySession>(data, error),
        messages: [],
        teacher_messages: []
      };
    },

    async getSession(userId, sessionId) {
      const { data: session, error } = await supabase
        .from("sessions")
        .select("*")
        .eq("id", sessionId)
        .eq("user_id", userId)
        .maybeSingle();
      if (error) {
        throw new Response(error.message, { status: 500 });
      }
      if (!session) {
        return null;
      }

      const [{ data: messages, error: messagesError }, { data: teacher, error: teacherError }] =
        await Promise.all([
          supabase
            .from("messages")
            .select("*")
            .eq("session_id", sessionId)
            .order("created_at", { ascending: true }),
          supabase
            .from("teacher_messages")
            .select("*")
            .eq("session_id", sessionId)
            .order("created_at", { ascending: true })
        ]);

      if (messagesError) {
        throw new Response(messagesError.message, { status: 500 });
      }
      if (teacherError) {
        throw new Response(teacherError.message, { status: 500 });
      }

      return {
        ...(session as RoleplaySession),
        messages: (messages ?? []) as RoleplayMessage[],
        teacher_messages: (teacher ?? []) as TeacherMessage[]
      };
    },

    async getSessionForMessage(userId, messageId) {
      const { data: message, error } = await supabase
        .from("messages")
        .select("*")
        .eq("id", messageId)
        .eq("role", "user")
        .maybeSingle();
      if (error) {
        throw new Response(error.message, { status: 500 });
      }
      if (!message) {
        return null;
      }
      const session = await this.getSession(userId, message.session_id);
      return session
        ? { session, message: message as RoleplayMessage }
        : null;
    },

    async getInsightRows(userId): Promise<InsightRow[]> {
      const sessions: { id: string; scenario_id: string }[] = [];
      for (let from = 0; ; from += SUPABASE_PAGE_SIZE) {
        const { data, error } = await supabase
          .from("sessions")
          .select("id, scenario_id")
          .eq("user_id", userId)
          .order("id", { ascending: true })
          .range(from, from + SUPABASE_PAGE_SIZE - 1);
        if (error) {
          throw new Response(error.message, { status: 500 });
        }
        sessions.push(...(data ?? []));
        if (!data || data.length < SUPABASE_PAGE_SIZE) break;
      }
      if (sessions.length === 0) return [];

      const sessionScenario = new Map(
        sessions.map((session) => [session.id, session.scenario_id])
      );
      const messages: {
        id: string;
        session_id: string;
        content: string;
        reviewer_output: ReviewerOutput;
        created_at: string;
      }[] = [];
      for (let i = 0; i < sessions.length; i += SUPABASE_IN_FILTER_BATCH_SIZE) {
        const sessionIds = sessions
          .slice(i, i + SUPABASE_IN_FILTER_BATCH_SIZE)
          .map((session) => session.id);
        for (let from = 0; ; from += SUPABASE_PAGE_SIZE) {
          const { data, error } = await supabase
            .from("messages")
            .select("id, session_id, content, reviewer_output, created_at")
            .in("session_id", sessionIds)
            .eq("role", "user")
            .not("reviewer_output", "is", null)
            .order("created_at", { ascending: true })
            .order("id", { ascending: true })
            .range(from, from + SUPABASE_PAGE_SIZE - 1);
          if (error) {
            throw new Response(error.message, { status: 500 });
          }
          messages.push(...((data ?? []) as typeof messages));
          if (!data || data.length < SUPABASE_PAGE_SIZE) break;
        }
      }
      messages.sort(
        (a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id)
      );

      const scenarioIds = [...new Set(sessionScenario.values())];
      const nameById = new Map<string, string>();
      const customIds: string[] = [];
      for (const id of scenarioIds) {
        const builtIn = getScenarioById(id);
        if (builtIn) {
          nameById.set(id, builtIn.name);
        } else {
          customIds.push(id);
        }
      }
      if (customIds.length > 0) {
        for (let i = 0; i < customIds.length; i += SUPABASE_IN_FILTER_BATCH_SIZE) {
          const { data: customScenarios, error: customError } = await supabase
            .from("custom_scenarios")
            .select("id, name")
            .eq("user_id", userId)
            .in("id", customIds.slice(i, i + SUPABASE_IN_FILTER_BATCH_SIZE));
          if (customError) {
            throw new Response(customError.message, { status: 500 });
          }
          for (const scenario of customScenarios ?? []) {
            nameById.set(scenario.id, scenario.name);
          }
        }
      }

      return messages.map((message) => {
        const scenarioId = sessionScenario.get(message.session_id);
        return {
          content: message.content,
          reviewer_output: message.reviewer_output,
          scenario_name: scenarioId ? nameById.get(scenarioId) ?? "Practice" : "Practice"
        };
      });
    },

    async updateSession(userId, sessionId, input: UpdateSessionInput) {
      const patch: Record<string, unknown> = {};
      if (input.title !== undefined) patch.title = input.title;
      if (input.reviewer_feedback_mode !== undefined) patch.reviewer_feedback_mode = input.reviewer_feedback_mode;
      const { data, error } = await supabase
        .from("sessions")
        .update(patch)
        .eq("id", sessionId)
        .eq("user_id", userId)
        .select("*")
        .single();
      return assertSupabase<RoleplaySession>(data, error);
    },

    async deleteSession(userId, sessionId) {
      const { error } = await supabase
        .from("sessions")
        .delete()
        .eq("id", sessionId)
        .eq("user_id", userId);
      if (error) {
        throw new Response(error.message, { status: 500 });
      }
    },

    async createUserMessage(userId, input: CreateUserMessageInput) {
      const session = await this.getSession(userId, input.sessionId);
      if (!session) {
        throw new Response("Session not found", { status: 404 });
      }
      const existing = session.messages.find(
        (message) => message.client_message_id === input.clientMessageId
      );
      if (existing) {
        return existing;
      }
      const { data, error } = await supabase
        .from("messages")
        .insert({
          session_id: input.sessionId,
          role: "user",
          content: input.content,
          client_message_id: input.clientMessageId,
          actor_status: "pending",
          reviewer_status: "pending"
        })
        .select("*")
        .single();
      await supabase
        .from("sessions")
        .update({ last_message_at: new Date().toISOString() })
        .eq("id", input.sessionId);
      return assertSupabase<RoleplayMessage>(data, error);
    },

    async createActorMessage(userId, input: CreateActorMessageInput) {
      const session = await this.getSession(userId, input.sessionId);
      if (!session) {
        throw new Response("Session not found", { status: 404 });
      }
      const existing = input.parentUserMessageId
        ? session.messages.find(
            (message) =>
              message.role === "actor" &&
              message.parent_user_message_id === input.parentUserMessageId
          )
        : null;
      if (existing) {
        const { data, error } = await supabase
          .from("messages")
          .update({
            content: input.content,
            narrations: input.narrations ?? null
          })
          .eq("id", existing.id)
          .select("*")
          .single();
        return assertSupabase<RoleplayMessage>(data, error);
      }
      const { data, error } = await supabase
        .from("messages")
        .insert({
          session_id: input.sessionId,
          role: "actor",
          content: input.content,
          parent_user_message_id: input.parentUserMessageId ?? null,
          narrations: input.narrations ?? null
        })
        .select("*")
        .single();
      return assertSupabase<RoleplayMessage>(data, error);
    },

    async updateUserMessage(userId, messageId, input: UpdateUserMessageInput) {
      const { data, error } = await supabase
        .from("messages")
        .update(input)
        .eq("id", messageId)
        .eq("role", "user")
        .select("*")
        .single();
      const message = assertSupabase<RoleplayMessage>(data, error);
      const session = await this.getSession(userId, message.session_id);
      if (!session) {
        throw new Response("Session not found", { status: 404 });
      }
      return message;
    },

    async createTeacherMessage(userId, input: CreateTeacherMessageInput) {
      const session = await this.getSession(userId, input.sessionId);
      if (!session) {
        throw new Response("Session not found", { status: 404 });
      }
      const { data, error } = await supabase
        .from("teacher_messages")
        .insert({
          session_id: input.sessionId,
          role: input.role,
          content: input.content
        })
        .select("*")
        .single();
      return assertSupabase<TeacherMessage>(data, error);
    }
  };
}
