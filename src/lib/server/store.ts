import type {
  AuthenticatedUser,
} from "./auth";
import type {
  ActorLevel,
  RoleplayMessage,
  Scenario,
  ScenarioFeedbackMode,
  RoleplaySession,
  SessionDetail,
  TeacherMessage
} from "@/lib/types";
import type { InsightRow } from "@/lib/insights";
import type { NormalizedScenarioInput } from "@/lib/scenario-input";

export type CreateSessionInput = {
  user: AuthenticatedUser;
  scenarioId: string;
  actorLevel?: ActorLevel;
};

export type UpdateSessionInput = {
  title?: string;
  reviewer_feedback_mode?: ScenarioFeedbackMode;
};

export type CreateUserMessageInput = {
  sessionId: string;
  clientMessageId: string;
  content: string;
};

export type CreateActorMessageInput = {
  sessionId: string;
  parentUserMessageId?: string | null;
  content: string;
  narrations?: string[];
};

export type UpdateUserMessageInput = Partial<
  Pick<
    RoleplayMessage,
    | "reviewer_output"
    | "actor_status"
    | "reviewer_status"
    | "actor_error"
    | "reviewer_error"
    | "actor_retry_count"
    | "reviewer_retry_count"
  >
>;

export type CreateTeacherMessageInput = {
  sessionId: string;
  role: TeacherMessage["role"];
  content: string;
};

export type RoleplayStore = {
  listScenarios(userId: string): Promise<Scenario[]>;
  getScenario(userId: string, scenarioId: string): Promise<Scenario | null>;
  createScenario(
    user: AuthenticatedUser,
    input: NormalizedScenarioInput
  ): Promise<Scenario>;
  listSessions(userId: string): Promise<RoleplaySession[]>;
  createSession(input: CreateSessionInput): Promise<SessionDetail>;
  getSession(userId: string, sessionId: string): Promise<SessionDetail | null>;
  getSessionForMessage(
    userId: string,
    messageId: string
  ): Promise<{ session: SessionDetail; message: RoleplayMessage } | null>;
  getInsightRows(userId: string): Promise<InsightRow[]>;
  updateSession(
    userId: string,
    sessionId: string,
    input: UpdateSessionInput
  ): Promise<RoleplaySession>;
  deleteSession(userId: string, sessionId: string): Promise<void>;
  createUserMessage(
    userId: string,
    input: CreateUserMessageInput
  ): Promise<RoleplayMessage>;
  createActorMessage(
    userId: string,
    input: CreateActorMessageInput
  ): Promise<RoleplayMessage>;
  updateUserMessage(
    userId: string,
    messageId: string,
    input: UpdateUserMessageInput
  ): Promise<RoleplayMessage>;
  createTeacherMessage(
    userId: string,
    input: CreateTeacherMessageInput
  ): Promise<TeacherMessage>;
};

export function defaultSessionTitle(scenarioName: string, date = new Date()): string {
  return `${scenarioName} · ${date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric"
  })}`;
}
