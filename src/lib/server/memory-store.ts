import { getScenarioById, listScenarios as listBuiltInScenarios } from "@/lib/scenarios";
import type {
  RoleplayMessage,
  Scenario,
  RoleplaySession,
  SessionDetail,
  TeacherMessage
} from "@/lib/types";
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

type MemoryState = {
  customScenarios: Scenario[];
  sessions: RoleplaySession[];
  messages: RoleplayMessage[];
  teacherMessages: TeacherMessage[];
};

function nowIso() {
  return new Date().toISOString();
}

function requireOwnedSession(
  state: MemoryState,
  userId: string,
  sessionId: string
): RoleplaySession {
  const session = state.sessions.find(
    (candidate) => candidate.id === sessionId && candidate.user_id === userId
  );
  if (!session) {
    throw new Response("Session not found", { status: 404 });
  }
  return session;
}

function toDetail(state: MemoryState, session: RoleplaySession): SessionDetail {
  return {
    ...session,
    messages: state.messages
      .filter((message) => message.session_id === session.id)
      .sort((a, b) => a.created_at.localeCompare(b.created_at)),
    teacher_messages: state.teacherMessages
      .filter((message) => message.session_id === session.id)
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
  };
}

function getScenarioForUser(
  state: MemoryState,
  userId: string,
  scenarioId: string
): Scenario | null {
  return (
    getScenarioById(scenarioId) ??
    state.customScenarios.find(
      (scenario) => scenario.id === scenarioId && scenario.user_id === userId
    ) ??
    null
  );
}

export function createMemoryStore(state?: MemoryState): RoleplayStore {
  const memory = state ?? {
    customScenarios: [],
    sessions: [],
    messages: [],
    teacherMessages: []
  };

  return {
    async listScenarios(userId) {
      return [
        ...listBuiltInScenarios(),
        ...memory.customScenarios.filter(
          (scenario) => scenario.user_id === userId
        )
      ];
    },

    async getScenario(userId, scenarioId) {
      return getScenarioForUser(memory, userId, scenarioId);
    },

    async createScenario(user, input) {
      const timestamp = nowIso();
      const scenario: Scenario = {
        id: crypto.randomUUID(),
        user_id: user.id,
        source: "custom",
        created_at: timestamp,
        ...input
      };
      memory.customScenarios.push(scenario);
      return scenario;
    },

    async listSessions(userId) {
      return memory.sessions
        .filter((session) => session.user_id === userId)
        .map((session) => {
          const latestUserMessage = [...memory.messages]
            .reverse()
            .find(
              (message) =>
                message.session_id === session.id && message.role === "user"
            );
          return {
            ...session,
            latest_user_message: latestUserMessage?.content ?? null
          };
        })
        .sort((a, b) => b.last_message_at.localeCompare(a.last_message_at));
    },

    async createSession({ user, scenarioId, actorLevel }: CreateSessionInput) {
      const scenario = getScenarioForUser(memory, user.id, scenarioId);
      if (!scenario) {
        throw new Response("Scenario not found", { status: 404 });
      }
      const timestamp = nowIso();
      const session: RoleplaySession = {
        id: crypto.randomUUID(),
        user_id: user.id,
        scenario_id: scenarioId,
        title: defaultSessionTitle(scenario.name),
        started_at: timestamp,
        last_message_at: timestamp,
        created_at: timestamp,
        actor_provider_thread_id: null,
        reviewer_provider_thread_id: null,
        teacher_provider_thread_id: null,
        actor_level: actorLevel ?? "standard",
        reviewer_feedback_mode: scenario.feedback_mode ?? "standard"
      };
      memory.sessions.push(session);
      return toDetail(memory, session);
    },

    async getSession(userId, sessionId) {
      const session = memory.sessions.find(
        (candidate) => candidate.id === sessionId && candidate.user_id === userId
      );
      return session ? toDetail(memory, session) : null;
    },

    async getSessionForMessage(userId, messageId) {
      const message = memory.messages.find(
        (candidate) => candidate.id === messageId && candidate.role === "user"
      );
      if (!message) return null;
      const session = memory.sessions.find(
        (candidate) =>
          candidate.id === message.session_id && candidate.user_id === userId
      );
      return session ? { session: toDetail(memory, session), message } : null;
    },

    async updateSession(userId, sessionId, input: UpdateSessionInput) {
      const session = requireOwnedSession(memory, userId, sessionId);
      if (input.title !== undefined) session.title = input.title;
      if (input.reviewer_feedback_mode !== undefined) session.reviewer_feedback_mode = input.reviewer_feedback_mode;
      return session;
    },

    async deleteSession(userId, sessionId) {
      requireOwnedSession(memory, userId, sessionId);
      memory.sessions = memory.sessions.filter(
        (session) => session.id !== sessionId
      );
      memory.messages = memory.messages.filter(
        (message) => message.session_id !== sessionId
      );
      memory.teacherMessages = memory.teacherMessages.filter(
        (message) => message.session_id !== sessionId
      );
    },

    async createUserMessage(userId, input: CreateUserMessageInput) {
      const session = requireOwnedSession(memory, userId, input.sessionId);
      const existing = memory.messages.find(
        (message) =>
          message.session_id === input.sessionId &&
          message.client_message_id === input.clientMessageId
      );
      if (existing) {
        return existing;
      }
      const timestamp = nowIso();
      const message: RoleplayMessage = {
        id: crypto.randomUUID(),
        session_id: input.sessionId,
        role: "user",
        content: input.content,
        created_at: timestamp,
        client_message_id: input.clientMessageId,
        parent_user_message_id: null,
        reviewer_output: null,
        actor_status: "pending",
        reviewer_status: "pending",
        actor_error: null,
        reviewer_error: null,
        actor_retry_count: 0,
        reviewer_retry_count: 0
      };
      memory.messages.push(message);
      session.last_message_at = timestamp;
      return message;
    },

    async createActorMessage(userId, input: CreateActorMessageInput) {
      const session = requireOwnedSession(memory, userId, input.sessionId);
      const existing = input.parentUserMessageId
        ? memory.messages.find(
            (message) =>
              message.role === "actor" &&
              message.parent_user_message_id === input.parentUserMessageId
          )
        : null;
      if (existing) {
        existing.content = input.content;
        existing.narrations = input.narrations ?? null;
        return existing;
      }
      const timestamp = nowIso();
      const message: RoleplayMessage = {
        id: crypto.randomUUID(),
        session_id: input.sessionId,
        role: "actor",
        content: input.content,
        created_at: timestamp,
        client_message_id: null,
        parent_user_message_id: input.parentUserMessageId ?? null,
        narrations: input.narrations ?? null
      };
      memory.messages.push(message);
      session.last_message_at = timestamp;
      return message;
    },

    async updateUserMessage(userId, messageId, input: UpdateUserMessageInput) {
      const message = memory.messages.find(
        (candidate) => candidate.id === messageId && candidate.role === "user"
      );
      if (!message) {
        throw new Response("Message not found", { status: 404 });
      }
      requireOwnedSession(memory, userId, message.session_id);
      Object.assign(message, input);
      return message;
    },

    async createTeacherMessage(userId, input: CreateTeacherMessageInput) {
      const session = requireOwnedSession(memory, userId, input.sessionId);
      const timestamp = nowIso();
      const message: TeacherMessage = {
        id: crypto.randomUUID(),
        session_id: input.sessionId,
        role: input.role,
        content: input.content,
        created_at: timestamp
      };
      memory.teacherMessages.push(message);
      session.last_message_at = timestamp;
      return message;
    }
  };
}

const globalForStore = globalThis as typeof globalThis & {
  __ptTutorMemoryStore?: RoleplayStore;
};

export function getGlobalMemoryStore(): RoleplayStore {
  globalForStore.__ptTutorMemoryStore ??= createMemoryStore();
  return globalForStore.__ptTutorMemoryStore;
}
