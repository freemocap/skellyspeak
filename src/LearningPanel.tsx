import { useState, useEffect, useRef } from "react";
import type { Conversation, ConversationSnapshot } from "./contracts";
import type { Run } from "./useDirectory";
import { ErrorNotice } from "./Fields";

export function LearningPanel({
  conversation,
  chat,
  run,
  busy,
  error,
  connection,
  editPartner,
}: {
  conversation: Conversation | undefined;
  chat: ConversationSnapshot | null;
  run: Run;
  busy: boolean;
  error: string | null;
  connection: () => void;
  editPartner: () => void;
}) {
  const [tab, setTab] = useState<"Lesson" | "Analysis">("Lesson");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [height, setHeight] = useState(240);
  const [collapsed, setCollapsed] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const draft = conversation ? (drafts[conversation.id] ?? "") : "";
  const pending = chat?.turns.some((t) => t.state === "pending");
  const coachTurn = chat?.turns.find((t) =>
    t.operations.some((o) => o.kind === "coach_reply"),
  );
  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest" });
  }, [chat?.coachMessages.length]);
  const ask = async () => {
    if (!conversation || !draft.trim() || busy || pending) return;
    if (!chat?.connection.configured) {
      connection();
      return;
    }
    const receipt = await run({
      kind: "askCoach",
      conversationId: conversation.id,
      text: draft,
      expectedRevision: conversation.revision,
    });
    if (receipt)
      setDrafts((previous) =>
        previous[conversation.id] === draft
          ? { ...previous, [conversation.id]: "" }
          : previous,
      );
  };
  return (
    <aside className="learning-panel" aria-label="Lesson and coach">
      <div className="panel-tabs" role="tablist" aria-label="Learning panel">
        {(["Lesson", "Analysis"] as const).map((item) => (
          <button
            key={item}
            role="tab"
            aria-selected={tab === item}
            onClick={() => setTab(item)}
          >
            {item}
          </button>
        ))}
      </div>
      <div className="lesson-content">
        {tab === "Lesson" ? (
          <>
            <div className="lesson-heading">
              <h2>Lesson</h2>
              <button
                className="quiet"
                onClick={editPartner}
                disabled={!conversation}
              >
                Partner
              </button>
            </div>
            <p className="lesson-meta">
              {conversation?.settings.difficulty ?? "Balanced"} ·{" "}
              {conversation?.languageId.toUpperCase()}
            </p>
            <div className="lesson-section">
              <h3>Conversation practice</h3>
              <p>
                Talk with your partner. Ask your coach below for help
                understanding a message or putting a reply into words.
              </p>
            </div>
            <div className="lesson-section">
              <h3>Understand the exchange</h3>
              <p className="lesson-meta">
                Ask the coach about a word, phrase, or the latest reply.
              </p>
            </div>
          </>
        ) : (
          <p className="center-note">
            Detailed word and skill analysis is not connected yet. Your coach
            can explain the conversation below.
          </p>
        )}
      </div>
      <section
        className={`coach-dock ${collapsed ? "is-collapsed" : ""}`}
        style={{ height: collapsed ? 52 : height }}
        aria-label="Coach panel"
      >
        <div
          className="coach-resizer"
          role="separator"
          tabIndex={0}
          aria-label="Resize coach panel"
          aria-orientation="horizontal"
          aria-valuemin={120}
          aria-valuemax={500}
          aria-valuenow={height}
          onPointerDown={(e) => e.currentTarget.setPointerCapture(e.pointerId)}
          onPointerMove={(e) => {
            if (e.currentTarget.hasPointerCapture(e.pointerId)) {
              setCollapsed(false);
              setHeight(
                Math.max(
                  120,
                  Math.min(500, window.innerHeight - e.clientY - 22),
                ),
              );
            }
          }}
          onPointerUp={(e) =>
            e.currentTarget.releasePointerCapture(e.pointerId)
          }
          onKeyDown={(e) => {
            if (e.key === "ArrowUp" || e.key === "ArrowDown") {
              e.preventDefault();
              setHeight((h) =>
                Math.max(
                  120,
                  Math.min(500, h + (e.key === "ArrowUp" ? 24 : -24)),
                ),
              );
            }
          }}
        />
        <div className="coach-thread-head">
          <button
            className="coach-collapse"
            aria-expanded={!collapsed}
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? "▸" : "▾"} Talk to your coach
          </button>
        </div>
        {!collapsed && (
          <>
            <div
              className="coach-thread"
              aria-label="Coach conversation"
              aria-live="polite"
            >
              {!chat?.coachMessages.length && (
                <p className="lesson-meta">
                  Ask about the conversation, or ask for help saying something.
                  Your partner doesn't see this thread.
                </p>
              )}
              {chat?.coachMessages.map((message) => (
                <div
                  key={message.id}
                  className={`coach-msg ${message.role === "user" ? "user" : "coach"}`}
                  dir="auto"
                >
                  {message.text}
                </div>
              ))}
              {coachTurn?.state === "pending" && (
                <p role="status">Coach is replying…</p>
              )}
              <ErrorNotice error={error} />
              {coachTurn?.state === "failed" && (
                <div role="alert">
                  {coachTurn.attempts.find((a) => a.error)?.error}
                  <button
                    disabled={busy}
                    onClick={() =>
                      void run({
                        kind: "controlTurn",
                        turnId: coachTurn.id,
                        control: "retry",
                      })
                    }
                  >
                    Retry coach reply
                  </button>
                </div>
              )}
              <div ref={end} />
            </div>
            <form
              className="coach-input-row"
              onSubmit={(e) => {
                e.preventDefault();
                void ask();
              }}
            >
              <textarea
                className="coach-input"
                rows={2}
                aria-label="Message your coach"
                placeholder="Ask your coach…"
                value={draft}
                disabled={!conversation}
                onChange={(e) => {
                  if (conversation)
                    setDrafts({ ...drafts, [conversation.id]: e.target.value });
                }}
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter" &&
                    !e.shiftKey &&
                    !e.nativeEvent.isComposing
                  ) {
                    e.preventDefault();
                    void ask();
                  }
                }}
              />
              <button
                className="coach-send"
                aria-label="Send to coach"
                disabled={!conversation || busy || pending || !draft.trim()}
              >
                ↑
              </button>
            </form>
          </>
        )}
      </section>
    </aside>
  );
}
