import { BarChart3, Ellipsis, Lightbulb, LogOut, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { clsx } from "clsx";
import { useEffect, useRef, useState } from "react";
import type { RoleplaySession, Scenario } from "@/lib/types";

type UserSummary = {
  email?: string;
  label: string;
  name: string;
};

type SidebarProps = {
  activeSessionId?: string;
  busy: boolean;
  draftTitle: string;
  scenarios: Scenario[];
  sessions: RoleplaySession[];
  user: UserSummary;
  onDeleteSession: () => void;
  onNewChat: () => void;
  onRenameSession: () => void;
  onSelectSession: (sessionId: string) => void;
  onSignOut: () => void;
  onTitleChange: (value: string) => void;
};

function relativeDate(value: string) {
  const date = new Date(value);
  const now = new Date();
  const today = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  if (today) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function Sidebar({
  activeSessionId,
  busy,
  draftTitle,
  scenarios,
  sessions,
  user,
  onDeleteSession,
  onNewChat,
  onRenameSession,
  onSelectSession,
  onSignOut,
  onTitleChange
}: SidebarProps) {
  const [openMenuSessionId, setOpenMenuSessionId] = useState<string | null>(null);
  const actionsButtonRef = useRef<HTMLButtonElement>(null);
  const actionsMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!openMenuSessionId) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (actionsButtonRef.current?.contains(target)) return;
      if (actionsMenuRef.current?.contains(target)) return;

      setOpenMenuSessionId(null);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [openMenuSessionId]);

  return (
    <aside className="flex w-[240px] shrink-0 flex-col border-r border-border-subtle bg-surface lg:w-[260px]">
      <div className="border-b border-border-subtle p-4">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-full bg-brand text-sm font-semibold text-text-inverse">
            {user.name.slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {user.email ?? user.name}
            </p>
            <p className="text-xs text-text-muted">{user.label}</p>
          </div>
        </div>
        <button
          className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-[10px] bg-brand px-3 text-sm font-medium text-text-inverse transition-colors hover:bg-brand-hover disabled:opacity-40"
          data-testid="btn-new-chat"
          disabled={busy}
          onClick={onNewChat}
        >
          <Plus size={16} /> New Chat
        </button>
      </div>

      <nav
        aria-label="Chat history"
        className="min-h-0 flex-1 overflow-y-auto px-2 py-2"
      >
        {sessions.length === 0 ? (
          <div className="mt-8 text-center text-xs text-text-muted">
            No chats yet
          </div>
        ) : (
          sessions.map((session) => {
            const scenario = scenarios.find(
              (candidate) => candidate.id === session.scenario_id
            );
            const active = activeSessionId === session.id;
            const menuOpen = openMenuSessionId === session.id;
            return (
              <div key={session.id} className="relative mb-1">
                <div
                  className={clsx(
                    "group flex items-start gap-1 rounded-lg text-sm transition-colors hover:bg-surface-alt",
                    active && "bg-brand-subtle text-brand"
                  )}
                >
                  <button
                    className="flex min-w-0 flex-1 items-start gap-2 px-3 py-2.5 text-left"
                    data-testid={`history-item-${session.id}`}
                    onClick={() => onSelectSession(session.id)}
                  >
                    <span aria-hidden className="pt-0.5">
                      {scenario?.icon ?? "💬"}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">
                        {session.title}
                      </span>
                      <span
                        className={clsx(
                          "block truncate text-xs",
                          active ? "text-brand/75" : "text-text-secondary"
                        )}
                      >
                        {session.latest_user_message || "No messages yet"}
                      </span>
                      <span
                        className={clsx(
                          "block text-[11px]",
                          active ? "text-brand/60" : "text-text-muted"
                        )}
                      >
                        {relativeDate(session.last_message_at)}
                      </span>
                    </span>
                  </button>

                  {active ? (
                    <button
                      aria-expanded={menuOpen}
                      aria-label="Session actions"
                      className="mr-1 mt-2 rounded-lg p-1.5 text-text-secondary transition-colors hover:bg-surface hover:text-text-primary"
                      ref={actionsButtonRef}
                      onClick={() =>
                        setOpenMenuSessionId(menuOpen ? null : session.id)
                      }
                    >
                      <Ellipsis size={16} />
                    </button>
                  ) : null}
                </div>

                {active && menuOpen ? (
                  <div
                    ref={actionsMenuRef}
                    className="absolute right-1 top-10 z-20 w-[220px] rounded-lg border border-border-subtle bg-surface p-3 shadow-popover"
                  >
                    <label className="block text-xs font-medium text-text-secondary">
                      Chat title
                      <input
                        className="mt-1.5 w-full rounded-lg border border-border-subtle px-3 py-2 text-sm text-text-primary outline-none transition-colors focus:border-brand focus:ring-1 focus:ring-brand/20"
                        value={draftTitle}
                        onBlur={onRenameSession}
                        onChange={(event) => onTitleChange(event.target.value)}
                      />
                    </label>
                    <button
                      className="mt-3 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-error transition-colors hover:bg-error-bg"
                      onClick={() => {
                        setOpenMenuSessionId(null);
                        onDeleteSession();
                      }}
                    >
                      <Trash2 size={15} /> Delete chat
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </nav>

      <Link
        className="flex h-12 shrink-0 items-center gap-2 border-t border-border-subtle px-4 text-sm text-text-secondary transition-colors hover:text-text-primary"
        href="/insights"
      >
        <Lightbulb size={16} /> Your patterns
      </Link>

      <Link
        className="flex h-12 shrink-0 items-center gap-2 border-t border-border-subtle px-4 text-sm text-text-secondary transition-colors hover:text-text-primary"
        href="/usage"
      >
        <BarChart3 size={16} /> Usage
      </Link>

      <button
        className="flex h-[72px] shrink-0 items-center gap-2 border-t border-border-subtle px-4 text-sm text-text-secondary transition-colors hover:text-text-primary"
        onClick={onSignOut}
      >
        <LogOut size={16} /> Sign out
      </button>
    </aside>
  );
}
