"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import type {
  ActorLevel,
  ReviewerOutput,
  RoleplayMessage,
  RoleplaySession,
  Scenario,
  ScenarioFeedbackMode,
  SessionDetail,
  TeacherMessage
} from "@/lib/types";
import {
  apiDelete,
  apiGet,
  apiPatch,
  apiPost,
  apiPostSSE,
  type ApiState,
  type CreateScenarioResponse,
  type DraftScenarioResponse,
  type ScenariosResponse,
  type SessionResponse,
  type SessionsResponse
} from "@/lib/client/api";
import type { CreateScenarioInput } from "@/lib/scenario-input";
import {
  createBrowserSupabase,
  supabaseBrowserConfigured
} from "@/lib/supabase/client";
import { AppShell } from "./AppShell";
import { ConnectAccountScreen } from "./ConnectAccountScreen";
import { LoginScreen } from "./LoginScreen";

const demoUser = {
  id: "local-demo-user",
  email: "demo@local.test",
  name: "Local Demo"
};

function readCodexRedirect(): { connected: boolean; error: string } {
  if (typeof window === "undefined") {
    return { connected: false, error: "" };
  }
  const params = new URLSearchParams(window.location.search);
  const oauthError = params.get("codex_error");
  return {
    connected: params.get("codex") === "connected",
    error: oauthError
      ? oauthError === "login_required"
        ? "Please sign in first, then connect your OpenAI account."
        : `Couldn't connect your OpenAI account: ${oauthError}`
      : ""
  };
}

export function RoleplayApp() {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const [authSession, setAuthSession] = useState<Session | null>(null);
  const [usingDemo, setUsingDemo] = useState(!supabaseBrowserConfigured());
  const [email, setEmail] = useState("");
  const [authNotice, setAuthNotice] = useState("");
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [sessions, setSessions] = useState<RoleplaySession[]>([]);
  const [activeSession, setActiveSession] = useState<SessionDetail | null>(null);
  const [appMode, setAppMode] = useState<"picker" | "create" | "chat">("picker");
  const [savedScenarioId, setSavedScenarioId] = useState<string | null>(null);
  const [messageDraft, setMessageDraft] = useState("");
  const [teacherOpen, setTeacherOpen] = useState(false);
  const [teacherDraft, setTeacherDraft] = useState("");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [draftTitle, setDraftTitle] = useState("");
  // Read the Codex OAuth redirect outcome (?codex=connected / ?codex_error=...)
  // once, synchronously, so we don't setState inside an effect.
  const initialCodex = useMemo(() => readCodexRedirect(), []);
  // null = unknown/not checked, true = OpenAI account linked, false = not linked
  const [codexLinked, setCodexLinked] = useState<boolean | null>(
    initialCodex.connected ? true : null
  );
  const [codexError, setCodexError] = useState(initialCodex.error);

  const apiState: ApiState = {
    session: authSession,
    demoUser: usingDemo ? demoUser : null
  };
  const isSignedIn = usingDemo || Boolean(authSession);

  async function refreshScenarios(nextState = apiState) {
    const response = await apiGet<ScenariosResponse>("/api/scenarios", nextState);
    setScenarios(response.scenarios);
  }

  async function refreshSessions(nextState = apiState) {
    const response = await apiGet<SessionsResponse>("/api/sessions", nextState);
    setSessions(response.sessions);
  }

  async function refreshCodexStatus(nextState = apiState) {
    try {
      const status = await apiGet<{ authenticated: boolean }>(
        "/api/codex/status",
        nextState
      );
      setCodexLinked(status.authenticated);
    } catch {
      setCodexLinked(false);
    }
  }

  async function loadSession(sessionId: string, nextState = apiState) {
    const response = await apiGet<SessionResponse>(
      `/api/sessions/${sessionId}`,
      nextState
    );
    setActiveSession(response.session);
    setDraftTitle(response.session.title);
    setAppMode("chat");
    setSavedScenarioId(null);
    setTeacherOpen(false);
    setMessageDraft("");
  }

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      try {
        if (supabase) {
          const { data } = await supabase.auth.getSession();
          if (cancelled) return;
          setAuthSession(data.session);
          if (data.session) {
            const nextState = { session: data.session, demoUser: null };
            await Promise.all([
              refreshScenarios(nextState),
              refreshSessions(nextState),
              refreshCodexStatus(nextState)
            ]);
          }
        } else {
          const nextState = { session: null, demoUser };
          await Promise.all([
            refreshScenarios(nextState),
            refreshSessions(nextState),
            refreshCodexStatus(nextState)
          ]);
        }
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Failed to load app");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    boot();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  // Clean the Codex redirect params from the URL so a refresh doesn't repeat
  // them. The outcome itself was captured synchronously into state above.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!initialCodex.connected && !initialCodex.error) return;
    window.history.replaceState({}, "", window.location.pathname);
  }, [initialCodex]);

  async function requestMagicLink() {
    setBusy(true);
    setError("");
    setAuthNotice("");
    try {
      const response = await fetch("/api/auth/magic-link", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email })
      });
      const body = (await response.json()) as { error?: string; demo?: boolean };
      if (!response.ok) throw new Error(body.error || "Unable to send magic link");

      if (body.demo) {
        setUsingDemo(true);
        const nextState = { session: null, demoUser };
        await Promise.all([
          refreshScenarios(nextState),
          refreshSessions(nextState)
        ]);
        setAuthNotice("Supabase is not configured. Continuing in local demo mode.");
      } else {
        setAuthNotice("Check your email for the magic link.");
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Auth failed");
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    if (supabase) await supabase.auth.signOut();
    setAuthSession(null);
    setCodexLinked(null);
    setCodexError("");
    const nextUsingDemo = !supabaseBrowserConfigured();
    setUsingDemo(nextUsingDemo);
    setActiveSession(null);
    setAppMode("picker");
    setSavedScenarioId(null);
    setTeacherOpen(false);
    if (nextUsingDemo) {
      const nextState = { session: null, demoUser };
      await Promise.all([
        refreshScenarios(nextState),
        refreshSessions(nextState)
      ]);
    } else {
      setScenarios([]);
      setSessions([]);
    }
  }

  async function createCustomScenario(
    input: CreateScenarioInput,
    options: { startChat: boolean }
  ) {
    setBusy(true);
    setError("");
    try {
      const scenarioResponse = await apiPost<CreateScenarioResponse>(
        "/api/scenarios",
        input,
        apiState
      );
      setScenarios((current) => [...current, scenarioResponse.scenario]);

      if (options.startChat) {
        const sessionResponse = await apiPost<SessionResponse>(
          "/api/sessions",
          { scenario_id: scenarioResponse.scenario.id },
          apiState
        );
        setActiveSession(sessionResponse.session);
        setDraftTitle(sessionResponse.session.title);
        setTeacherOpen(false);
        setAppMode("chat");
        setSavedScenarioId(null);
        await refreshSessions();
      } else {
        setActiveSession(null);
        setAppMode("picker");
        setSavedScenarioId(scenarioResponse.scenario.id);
      }
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not create scenario"
      );
    } finally {
      setBusy(false);
    }
  }

  async function draftScenario(prompt: string): Promise<CreateScenarioInput> {
    const response = await apiPost<DraftScenarioResponse>(
      "/api/scenarios/draft",
      { prompt },
      apiState
    );
    return response.scenario;
  }

  async function createSession(scenarioId: string, actorLevel: ActorLevel = "standard") {
    setBusy(true);
    setError("");
    try {
      const response = await apiPost<SessionResponse>(
        "/api/sessions",
        { scenario_id: scenarioId, actor_level: actorLevel },
        apiState
      );
      setActiveSession(response.session);
      setDraftTitle(response.session.title);
      setTeacherOpen(false);
      setAppMode("chat");
      setSavedScenarioId(null);
      await refreshSessions();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create chat");
    } finally {
      setBusy(false);
    }
  }

  async function changeReviewerMode(mode: ScenarioFeedbackMode) {
    if (!activeSession) return;
    try {
      const response = await apiPatch<{ session: RoleplaySession }>(
        `/api/sessions/${activeSession.id}`,
        { reviewer_feedback_mode: mode },
        apiState
      );
      setActiveSession((prev) => prev ? { ...prev, reviewer_feedback_mode: response.session.reviewer_feedback_mode } : prev);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update feedback level");
    }
  }

  async function renameActiveSession() {
    if (!activeSession || !draftTitle.trim()) return;
    const response = await apiPatch<{ session: RoleplaySession }>(
      `/api/sessions/${activeSession.id}`,
      { title: draftTitle.trim() },
      apiState
    );
    setActiveSession({ ...activeSession, title: response.session.title });
    await refreshSessions();
  }

  async function deleteActiveSession() {
    if (!activeSession) return;
    await apiDelete<{ ok: true }>(`/api/sessions/${activeSession.id}`, apiState);
    setDeleteConfirmOpen(false);
    setActiveSession(null);
    setAppMode("picker");
    setTeacherOpen(false);
    await refreshSessions();
  }

  // Ref to hold the latest streaming actor message content
  const streamingActorRef = useRef<string>("");
  const streamingNarrationsRef = useRef<string[]>([]);
  const [streamingActorContent, setStreamingActorContent] = useState<string | null>(null);
  const [streamingNarrations, setStreamingNarrations] = useState<string[]>([]);
  const [streamingTeacherContent, setStreamingTeacherContent] = useState<string | null>(null);

  async function sendContent(content: string) {
    if (!activeSession || !content.trim()) return;
    const clientMessageId = crypto.randomUUID();
    setBusy(true);
    setError("");

    const optimisticUserMessage: RoleplayMessage = {
      id: `optimistic-${clientMessageId}`,
      session_id: activeSession.id,
      role: "user",
      content,
      created_at: new Date().toISOString(),
      client_message_id: clientMessageId,
      actor_status: "pending",
      reviewer_status: "pending"
    };
    setActiveSession((prev) => {
      if (!prev) return prev;
      return { ...prev, messages: [...prev.messages, optimisticUserMessage] };
    });

    streamingActorRef.current = "";
    streamingNarrationsRef.current = [];
    setStreamingActorContent(null);
    setStreamingNarrations([]);

    try {
      const events = apiPostSSE(
        `/api/sessions/${activeSession.id}/messages`,
        { client_message_id: clientMessageId, content },
        apiState
      );

      let serverUserMessage: RoleplayMessage | null = null;

      for await (const { event, data } of events) {
        switch (event) {
          case "user_message": {
            serverUserMessage = data.message as RoleplayMessage;
            setActiveSession((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                messages: prev.messages.map((m) =>
                  m.id === optimisticUserMessage.id ? serverUserMessage! : m
                )
              };
            });
            break;
          }
          case "narration": {
            const narrationText = (data as { text: string }).text;
            streamingNarrationsRef.current = [...streamingNarrationsRef.current, narrationText];
            setStreamingNarrations([...streamingNarrationsRef.current]);
            break;
          }
          case "actor_delta": {
            const delta = (data as { text: string }).text;
            streamingActorRef.current += delta;
            setStreamingActorContent(streamingActorRef.current);
            break;
          }
          case "actor_done": {
            const actorMessage = data.message as RoleplayMessage;
            setStreamingActorContent(null);
            setStreamingNarrations([]);
            streamingActorRef.current = "";
            streamingNarrationsRef.current = [];
            setActiveSession((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                messages: [
                  ...prev.messages.map((m) =>
                    m.id === serverUserMessage?.id || m.id === optimisticUserMessage.id
                      ? { ...m, actor_status: "succeeded" as const, actor_error: null }
                      : m
                  ),
                  actorMessage
                ]
              };
            });
            break;
          }
          case "actor_error": {
            setStreamingActorContent(null);
            setStreamingNarrations([]);
            streamingActorRef.current = "";
            streamingNarrationsRef.current = [];
            const errorMsg = (data as { error: string }).error;
            setActiveSession((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                messages: prev.messages.map((m) =>
                  m.id === serverUserMessage?.id || m.id === optimisticUserMessage.id
                    ? { ...m, actor_status: "failed" as const, actor_error: errorMsg }
                    : m
                )
              };
            });
            break;
          }
          case "reviewer_done": {
            const reviewerOutput = data.reviewer_output as ReviewerOutput;
            setActiveSession((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                messages: prev.messages.map((m) =>
                  m.id === serverUserMessage?.id || m.id === optimisticUserMessage.id
                    ? {
                        ...m,
                        reviewer_status: "succeeded" as const,
                        reviewer_error: null,
                        reviewer_output: reviewerOutput
                      }
                    : m
                )
              };
            });
            break;
          }
          case "reviewer_error": {
            const errorMsg = (data as { error: string }).error;
            setActiveSession((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                messages: prev.messages.map((m) =>
                  m.id === serverUserMessage?.id || m.id === optimisticUserMessage.id
                    ? { ...m, reviewer_status: "failed" as const, reviewer_error: errorMsg }
                    : m
                )
              };
            });
            break;
          }
          case "session": {
            setActiveSession(data.session as SessionDetail);
            break;
          }
        }
      }

      await refreshSessions();
    } catch (caught) {
      setActiveSession((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          messages: prev.messages.filter((m) => m.id !== optimisticUserMessage.id)
        };
      });
      setStreamingActorContent(null);
      streamingActorRef.current = "";
      setMessageDraft(content);
      setError(caught instanceof Error ? caught.message : "Could not send message");
    } finally {
      setBusy(false);
    }
  }

  async function sendMessage() {
    const content = messageDraft.trim();
    if (!content) return;
    setMessageDraft("");
    await sendContent(content);
  }

  async function retryMessage(
    messageId: string,
    target: "actor" | "reviewer" | "both"
  ) {
    setBusy(true);
    setError("");
    try {
      const response = await apiPost<SessionResponse>(
        `/api/messages/${messageId}/retry`,
        { target },
        apiState
      );
      setActiveSession(response.session);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Retry failed");
    } finally {
      setBusy(false);
    }
  }

  async function skipActor(messageId: string) {
    setBusy(true);
    setError("");
    try {
      const response = await apiPost<SessionResponse>(
        `/api/messages/${messageId}/skip`,
        {},
        apiState
      );
      setActiveSession(response.session);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Skip failed");
    } finally {
      setBusy(false);
    }
  }

  function askTeacher(prefill: string) {
    setTeacherDraft(prefill);
    setTeacherOpen(true);
  }

  async function sendTeacherQuestion() {
    if (!activeSession || !teacherDraft.trim()) return;
    const question = teacherDraft.trim();
    setTeacherDraft("");
    setBusy(true);
    setError("");

    // Optimistically add user's teacher message
    const optimisticTeacherMessage: TeacherMessage = {
      id: `optimistic-teacher-${crypto.randomUUID()}`,
      session_id: activeSession.id,
      role: "user",
      content: question,
      created_at: new Date().toISOString()
    };
    setActiveSession((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        teacher_messages: [...prev.teacher_messages, optimisticTeacherMessage]
      };
    });

    // Reset streaming state
    setStreamingTeacherContent(null);

    try {
      const events = apiPostSSE(
        `/api/sessions/${activeSession.id}/teacher`,
        { question },
        apiState
      );

      for await (const { event, data } of events) {
        switch (event) {
          case "user_message": {
            // Replace optimistic message with server-confirmed one
            const serverMessage = data.message as TeacherMessage;
            setActiveSession((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                teacher_messages: prev.teacher_messages.map((m) =>
                  m.id === optimisticTeacherMessage.id ? serverMessage : m
                )
              };
            });
            break;
          }
          case "teacher_delta": {
            const delta = (data as { text: string }).text;
            setStreamingTeacherContent((prev) => (prev ?? "") + delta);
            break;
          }
          case "teacher_done": {
            const teacherMessage = data.message as TeacherMessage;
            setStreamingTeacherContent(null);
            setActiveSession((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                teacher_messages: [...prev.teacher_messages, teacherMessage]
              };
            });
            break;
          }
          case "teacher_error": {
            setStreamingTeacherContent(null);
            const errorMsg = (data as { error: string }).error;
            setError(errorMsg);
            break;
          }
          case "session": {
            const sessionData = data.session as SessionDetail;
            setActiveSession(sessionData);
            break;
          }
        }
      }
    } catch (caught) {
      // Remove optimistic teacher message on total failure
      setActiveSession((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          teacher_messages: prev.teacher_messages.filter(
            (m) => m.id !== optimisticTeacherMessage.id
          )
        };
      });
      setStreamingTeacherContent(null);
      setTeacherDraft(question);
      setError(
        caught instanceof Error ? caught.message : "Could not ask Teacher"
      );
    } finally {
      setBusy(false);
    }
  }

  const activeScenario = scenarios.find(
    (scenario) => scenario.id === activeSession?.scenario_id
  );

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-canvas">
        <div className="text-sm text-text-secondary">Loading coach...</div>
      </main>
    );
  }

  if (!isSignedIn) {
    return (
      <LoginScreen
        authNotice={authNotice}
        busy={busy}
        email={email}
        error={error}
        onEmailChange={setEmail}
        onSubmit={requestMagicLink}
      />
    );
  }

  // Gate roleplay behind linking an OpenAI account. In demo mode (no Supabase)
  // per-user linking isn't possible, so the connect screen explains that.
  if (!codexLinked) {
    return (
      <ConnectAccountScreen error={codexError} onSignOut={signOut} />
    );
  }

  return (
    <AppShell
      activeScenario={activeScenario}
      activeSession={activeSession}
      busy={busy}
      deleteConfirmOpen={deleteConfirmOpen}
      draftTitle={draftTitle}
      error={error}
      messageDraft={messageDraft}
      mode={appMode}
      savedScenarioId={savedScenarioId}
      scenarios={scenarios}
      sessions={sessions}
      streamingActorContent={streamingActorContent}
      streamingNarrations={streamingNarrations}
      streamingTeacherContent={streamingTeacherContent}
      teacherDraft={teacherDraft}
      teacherOpen={teacherOpen}
      user={{
        email: usingDemo ? undefined : authSession?.user.email ?? undefined,
        label: usingDemo ? "Local demo" : "Magic-link account",
        name: usingDemo ? demoUser.name : authSession?.user.email ?? "Learner"
      }}
      onCancelDelete={() => setDeleteConfirmOpen(false)}
      onConfirmDelete={deleteActiveSession}
      onCancelScenarioCreate={() => setAppMode("picker")}
      onChangeReviewerMode={changeReviewerMode}
      onCreateCustomScenario={createCustomScenario}
      onCreateSession={createSession}
      onDeleteRequest={() => setDeleteConfirmOpen(true)}
      onDraftScenario={draftScenario}
      onMessageDraftChange={setMessageDraft}
      onNewChat={() => {
        setActiveSession(null);
        setAppMode("picker");
        setSavedScenarioId(null);
        setTeacherOpen(false);
      }}
      onStartScenarioCreate={() => {
        setActiveSession(null);
        setAppMode("create");
        setSavedScenarioId(null);
        setTeacherOpen(false);
      }}
      onAskTeacher={askTeacher}
      onRename={renameActiveSession}
      onRetry={retryMessage}
      onSelectSession={loadSession}
      onSendMessage={sendMessage}
      onSendStarter={sendContent}
      onSignOut={signOut}
      onSkipActor={skipActor}
      onTeacherDraftChange={setTeacherDraft}
      onTeacherOpenChange={setTeacherOpen}
      onTeacherSend={sendTeacherQuestion}
      onTitleChange={setDraftTitle}
    />
  );
}
