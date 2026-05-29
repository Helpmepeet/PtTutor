import type { ActorLevel, RoleplaySession, Scenario, ScenarioFeedbackMode, SessionDetail } from "@/lib/types";
import type { CreateScenarioInput } from "@/lib/scenario-input";
import { ChatArea } from "@/components/chat/ChatArea";
import { CustomScenarioForm } from "@/components/scenarios/CustomScenarioForm";
import { ScenarioPicker } from "@/components/scenarios/ScenarioPicker";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { TopBar } from "@/components/shared/TopBar";
import { Sidebar } from "@/components/sidebar/Sidebar";
import { TeacherWidget } from "@/components/teacher/TeacherWidget";

type UserSummary = {
  email?: string;
  label: string;
  name: string;
};

type AppShellProps = {
  activeScenario?: Scenario;
  activeSession: SessionDetail | null;
  busy: boolean;
  deleteConfirmOpen: boolean;
  draftTitle: string;
  error: string;
  messageDraft: string;
  mode: "picker" | "create" | "chat";
  savedScenarioId?: string | null;
  scenarios: Scenario[];
  sessions: RoleplaySession[];
  streamingActorContent: string | null;
  streamingNarrations: string[];
  streamingTeacherContent: string | null;
  teacherDraft: string;
  teacherOpen: boolean;
  user: UserSummary;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
  onCancelScenarioCreate: () => void;
  onChangeReviewerMode: (mode: ScenarioFeedbackMode) => void;
  onCreateCustomScenario: (
    input: CreateScenarioInput,
    options: { startChat: boolean }
  ) => void;
  onCreateSession: (scenarioId: string, actorLevel: ActorLevel) => void;
  onDraftScenario: (prompt: string) => Promise<CreateScenarioInput>;
  onDeleteRequest: () => void;
  onMessageDraftChange: (value: string) => void;
  onNewChat: () => void;
  onStartScenarioCreate: () => void;
  onRename: () => void;
  onRetry: (messageId: string, target: "actor" | "reviewer" | "both") => void;
  onSelectSession: (sessionId: string) => void;
  onAskTeacher: (prefill: string) => void;
  onSendMessage: () => void;
  onSendStarter: (text: string) => void;
  onSignOut: () => void;
  onSkipActor: (messageId: string) => void;
  onTeacherDraftChange: (value: string) => void;
  onTeacherOpenChange: (open: boolean) => void;
  onTeacherSend: () => void;
  onTitleChange: (value: string) => void;
};

export function AppShell({
  activeScenario,
  activeSession,
  busy,
  deleteConfirmOpen,
  draftTitle,
  error,
  messageDraft,
  mode,
  savedScenarioId,
  scenarios,
  sessions,
  streamingActorContent,
  streamingNarrations,
  streamingTeacherContent,
  teacherDraft,
  teacherOpen,
  user,
  onCancelDelete,
  onCancelScenarioCreate,
  onChangeReviewerMode,
  onConfirmDelete,
  onCreateCustomScenario,
  onCreateSession,
  onDeleteRequest,
  onDraftScenario,
  onMessageDraftChange,
  onNewChat,
  onStartScenarioCreate,
  onRename,
  onAskTeacher,
  onRetry,
  onSelectSession,
  onSendMessage,
  onSendStarter,
  onSignOut,
  onSkipActor,
  onTeacherDraftChange,
  onTeacherOpenChange,
  onTeacherSend,
  onTitleChange
}: AppShellProps) {
  return (
    <main className="flex h-screen overflow-hidden bg-canvas text-text-primary">
      <Sidebar
        activeSessionId={activeSession?.id}
        busy={busy}
        draftTitle={draftTitle}
        scenarios={scenarios}
        sessions={sessions}
        user={user}
        onDeleteSession={onDeleteRequest}
        onNewChat={onNewChat}
        onRenameSession={onRename}
        onSelectSession={onSelectSession}
        onSignOut={onSignOut}
        onTitleChange={onTitleChange}
      />

      <section className="flex min-w-0 flex-1 flex-col">
        {mode !== "create" ? (
          <TopBar
            scenario={activeScenario}
            session={activeSession}
            onChangeReviewerMode={onChangeReviewerMode}
          />
        ) : null}

        {error ? (
          <div className="border-b border-error/20 bg-error-bg px-5 py-2.5 text-sm text-error">
            {error}
          </div>
        ) : null}

        {mode === "chat" && activeSession ? (
          <>
            <ChatArea
              busy={busy}
              draft={messageDraft}
              scenario={activeScenario}
              session={activeSession}
              streamingActorContent={streamingActorContent}
              streamingNarrations={streamingNarrations}
              onAskTeacher={onAskTeacher}
              onDraftChange={onMessageDraftChange}
              onRetry={onRetry}
              onSend={onSendMessage}
              onSendStarter={onSendStarter}
              onSkipActor={onSkipActor}
            />
            <TeacherWidget
              busy={busy}
              draft={teacherDraft}
              messages={activeSession.teacher_messages}
              open={teacherOpen}
              streamingContent={streamingTeacherContent}
              onDraftChange={onTeacherDraftChange}
              onOpenChange={onTeacherOpenChange}
              onSend={onTeacherSend}
            />
          </>
        ) : mode === "create" ? (
          <CustomScenarioForm
            busy={busy}
            onCancel={onCancelScenarioCreate}
            onDraftScenario={onDraftScenario}
            onSubmit={onCreateCustomScenario}
          />
        ) : (
          <ScenarioPicker
            busy={busy}
            savedScenarioId={savedScenarioId}
            scenarios={scenarios}
            onCreate={onCreateSession}
            onNewScenario={onStartScenarioCreate}
          />
        )}
      </section>

      <ConfirmDialog
        body="This will permanently remove the chat and all messages. This cannot be undone."
        confirmLabel="Delete"
        open={deleteConfirmOpen}
        title="Delete this chat?"
        onCancel={onCancelDelete}
        onConfirm={onConfirmDelete}
      />
    </main>
  );
}
