import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Snapshot } from "./contracts";
import { useDirectory, type Run } from "./useDirectory";
import { useChat } from "./useChat";
import { ExecutionPanel } from "./ExecutionPanel";
import { ErrorNotice } from "./Fields";
import { errorMessage } from "./directory";
import "./styles.css";

export function AiWorkspace({
  directory,
  run,
  busy,
  refresh,
}: {
  directory: Snapshot;
  run: Run;
  busy: boolean;
  refresh: () => Promise<void>;
}) {
  const [selected, setSelected] = useState("");
  const [scope, setScope] = useState("latest");
  const conversation =
    directory.conversations.find((c) => c.id === selected) ??
    directory.conversations[0];
  const chat = useChat(conversation?.id ?? null, refresh);
  const snapshot = chat.snapshot
    ? {
        ...chat.snapshot,
        turns:
          scope === "latest"
            ? chat.snapshot.turns.slice(0, 1)
            : chat.snapshot.turns,
      }
    : null;
  return (
    <div className="ai-workspace">
      <div className="activity-selection">
        <label>
          Conversation{" "}
          <select
            value={conversation?.id ?? ""}
            onChange={(e) => setSelected(e.target.value)}
          >
            {!directory.conversations.length && (
              <option value="">No conversations</option>
            )}
            {directory.conversations.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          Inspect{" "}
          <select value={scope} onChange={(e) => setScope(e.target.value)}>
            <option value="latest">Latest activity</option>
            <option value="retained">Recent retained turns</option>
          </select>
        </label>
        <span className="small muted">
          {chat.snapshot?.turns.filter((t) => t.state === "pending").length ??
            0}{" "}
          active turns
        </span>
      </div>
      <ErrorNotice error={chat.error} />
      {chat.error && <button onClick={chat.reload}>Reload activity</button>}
      <ExecutionPanel snapshot={snapshot} run={run} busy={busy} />
    </div>
  );
}
export function AiWindow() {
  const directory = useDirectory();
  return (
    <div className="ai-window">
      <header className="panel-heading">AI activity & tools</header>
      <ErrorNotice error={directory.error} />
      {directory.pending && (
        <button
          disabled={directory.busy}
          onClick={() => void directory.recover()}
        >
          Recover unconfirmed action
        </button>
      )}
      {directory.snapshot ? (
        <AiWorkspace
          directory={directory.snapshot}
          run={directory.run}
          busy={directory.busy}
          refresh={directory.refresh}
        />
      ) : (
        <p>Loading activity…</p>
      )}
    </div>
  );
}
export function AiDock({
  directory,
  run,
  busy,
  refresh,
  close,
}: {
  directory: Snapshot;
  run: Run;
  busy: boolean;
  refresh: () => Promise<void>;
  close: () => void;
}) {
  const [height, setHeight] = useState(40);
  const [error, setError] = useState<string | null>(null);
  return (
    <section
      className="ai-dock"
      style={{ height: `${height}dvh` }}
      aria-label="AI activity"
    >
      <div
        className="dock-resizer"
        role="separator"
        aria-label="Resize AI panel"
        aria-orientation="horizontal"
        aria-valuemin={20}
        aria-valuemax={75}
        aria-valuenow={height}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();
            setHeight((h) =>
              Math.min(75, Math.max(20, h + (e.key === "ArrowUp" ? 5 : -5))),
            );
          }
        }}
        onPointerDown={(e) => e.currentTarget.setPointerCapture(e.pointerId)}
        onPointerMove={(e) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId))
            setHeight(
              Math.min(
                75,
                Math.max(
                  20,
                  ((window.innerHeight - e.clientY) / window.innerHeight) * 100,
                ),
              ),
            );
        }}
        onPointerUp={(e) => e.currentTarget.releasePointerCapture(e.pointerId)}
      />
      <header className="dock-heading">
        <strong>AI activity</strong>
        <button
          onClick={() => {
            void invoke("open_ai_window")
              .then(close)
              .catch((e) => setError(errorMessage(e)));
          }}
        >
          Pop out ⧉
        </button>
        <button onClick={close} aria-label="Close AI panel">
          ×
        </button>
      </header>
      <ErrorNotice error={error} />
      <AiWorkspace
        directory={directory}
        run={run}
        busy={busy}
        refresh={refresh}
      />
    </section>
  );
}
