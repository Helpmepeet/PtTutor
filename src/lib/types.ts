export type ScenarioCategory = "daily" | "work" | "social";
export type ScenarioFeedbackMode = "light" | "standard" | "strict";
export type ActorLevel = "easy" | "standard" | "challenging";

export type Scenario = {
  id: string;
  name: string;
  description: string;
  category: ScenarioCategory;
  icon: string;
  feedback_mode: ScenarioFeedbackMode;
  source: "built_in" | "custom";
  user_id?: string | null;
  created_at?: string;
  starter: "actor" | "user";
  starter_prompts?: string[];
  actor_role: string;
  actor_setting: string;
  actor_personality: string;
  scenario_context: string;
  user_role: string;
  starter_instruction: string;
};

export type MessageRole = "user" | "actor";
export type TeacherMessageRole = "user" | "teacher";

export type MarkerCategory =
  | "grammar"
  | "word_choice"
  | "preposition"
  | "tone"
  | "style";

export type MarkerSeverity = "major" | "minor" | "suggestion";

export type ReviewMarker = {
  id: string;
  span_text: string;
  category: MarkerCategory;
  severity: MarkerSeverity;
  wrong: string;
  fix: string;
  why: string;
  alternatives: string[];
};

export type ReviewerOutput = {
  markers: ReviewMarker[];
  native_rewrite: string;
};

export type RoleplayMessage = {
  id: string;
  session_id: string;
  role: MessageRole;
  content: string;
  created_at: string;
  client_message_id?: string | null;
  parent_user_message_id?: string | null;
  narrations?: string[] | null;
  reviewer_output?: ReviewerOutput | null;
  actor_status?: "pending" | "succeeded" | "failed" | "skipped" | null;
  reviewer_status?: "pending" | "succeeded" | "failed" | null;
  actor_error?: string | null;
  reviewer_error?: string | null;
  actor_retry_count?: number;
  reviewer_retry_count?: number;
};

export type TeacherMessage = {
  id: string;
  session_id: string;
  role: TeacherMessageRole;
  content: string;
  created_at: string;
};

export type RoleplaySession = {
  id: string;
  user_id: string;
  scenario_id: string;
  title: string;
  latest_user_message?: string | null;
  started_at: string;
  last_message_at: string;
  created_at: string;
  actor_provider_thread_id?: string | null;
  reviewer_provider_thread_id?: string | null;
  teacher_provider_thread_id?: string | null;
  actor_level: ActorLevel;
  reviewer_feedback_mode: ScenarioFeedbackMode;
};

export type SessionDetail = RoleplaySession & {
  messages: RoleplayMessage[];
  teacher_messages: TeacherMessage[];
};

export type RateLimitWindow = {
  used_percent: number;
  window_minutes: number | null;
  resets_at: number | null;
};

export type UsageSnapshot = {
  primary: RateLimitWindow | null; // ~5 hours
  secondary: RateLimitWindow | null; // ~7 days
  captured_at: number;
};
