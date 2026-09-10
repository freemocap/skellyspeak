import type { ConversationSnapshot } from "./contracts";
import type { Run } from "./useDirectory";

export function ExecutionPanel({
  snapshot,
  run,
  busy,
}: {
  snapshot: ConversationSnapshot | null;
  run: Run;
  busy: boolean;
}) {
  if (!snapshot) return <p>Select a conversation to inspect its execution.</p>;
  return (
    <section className="execution-panel" aria-label="Execution graph">
      <div className="section-heading">
        <h3>Execution</h3>
        <button
          disabled={busy}
          onClick={() =>
            void run({ kind: "setPaused", paused: !snapshot.connection.paused })
          }
        >
          {snapshot.connection.paused ? "Resume all" : "Pause all"}
        </button>
      </div>
      <p className="small muted">
        {snapshot.connection.route === "hosted" ? "Hosted" : "OpenRouter"} ·
        Standard: {snapshot.connection.standardModel}
      </p>
      {snapshot.connection.paused && (
        <p role="status">App-wide pause: no new operation starts.</p>
      )}
      {snapshot.holds.map((hold) => (
        <div key={hold.id} className="attempt">
          <p role="alert">
            {hold.route} access held: {hold.error.message}
            {hold.error.refusal?.retryAt != null &&
              ` Earliest recovery: ${new Date(hold.error.refusal.retryAt * 1000).toLocaleString()}.`}
          </p>
          <p>
            After correcting the cause, recover access. Queued turns stay
            paused.
          </p>
          <button
            disabled={busy}
            onClick={() =>
              void run({
                kind: "recoverAiAccess",
                holdId: hold.id,
                expectedGeneration: hold.generation,
              })
            }
          >
            Recover access
          </button>
        </div>
      ))}
      {snapshot.transcriptionAttempts.map((attempt) => (
        <div key={attempt.id} className="attempt">
          <p>Transcription · {attempt.state}</p>
          <p>
            {attempt.route} · {attempt.model} · Usage unavailable
          </p>
          <small>
            {attempt.startedAt}
            {attempt.finishedAt ? ` → ${attempt.finishedAt}` : ""}
          </small>
          {attempt.error && <p role="alert">{attempt.error}</p>}
        </div>
      ))}
      {snapshot.turns.length === 0 && <p>No turns submitted.</p>}
      {snapshot.turns.map((turn) => (
        <article key={turn.id} className="turn-inspection">
          <header>
            <code>
              {turn.id.slice(0, 8)} · {turn.route}
            </code>
            <strong>{turn.state}</strong>
          </header>
          <ol className="operation-graph">
            {turn.operations.map((operation) => (
              <li key={operation.id}>
                <span>
                  {operation.kind.replaceAll("_", " ")} · v
                  {operation.contractVersion}
                </span>
                <small>
                  {operation.role} · {operation.state}
                </small>
                <small>
                  {operation.dependencies.length
                    ? `After ${operation.dependencies.map((id) => turn.operations.find((o) => o.id === id)?.kind).join(", ")}`
                    : "Accepted message"}
                </small>
              </li>
            ))}
          </ol>
          {["pending", "assisting"].includes(turn.state) && (
            <div className="execution-controls">
              <button
                disabled={busy}
                onClick={() =>
                  void run({
                    kind: "controlTurn",
                    turnId: turn.id,
                    control: turn.paused ? "resume" : "pause",
                  })
                }
              >
                {turn.paused ? "Resume" : "Pause"}
              </button>
              <button
                disabled={
                  busy || snapshot.connection.paused || Boolean(turn.hold)
                }
                onClick={() =>
                  void run({
                    kind: "controlTurn",
                    turnId: turn.id,
                    control: "step",
                  })
                }
              >
                Step
              </button>
              <button
                disabled={busy}
                onClick={() =>
                  void run({
                    kind: "controlTurn",
                    turnId: turn.id,
                    control: "cancel",
                  })
                }
              >
                Cancel
              </button>
            </div>
          )}
          {turn.hold && (
            <p role="alert">
              Queued work held: {turn.hold.message}
              {turn.hold.refusal?.retryAt != null &&
                ` Earliest retry: ${new Date(turn.hold.refusal.retryAt * 1000).toLocaleString()}.`}
              {
                " Recover held access first, then explicitly Resume or Retry. Existing requests may finish."
              }
            </p>
          )}
          {turn.attempts.map((attempt) => (
            <div className="attempt" key={attempt.id}>
              <code>
                {attempt.id.slice(0, 8)} · {attempt.state}
              </code>
              <p>
                {attempt.requestedModel}
                {attempt.actualModel ? ` → ${attempt.actualModel}` : ""}
              </p>
              {attempt.requestedModel !== "local" && (
                <p>
                  Tokens in / out: {attempt.inputTokens ?? "unknown"} /{" "}
                  {attempt.outputTokens ?? "unknown"}
                </p>
              )}
              <p>
                {attempt.startedAt}
                {attempt.finishedAt ? ` → ${attempt.finishedAt}` : ""}
              </p>
              {attempt.providerId && <p>Provider ID: {attempt.providerId}</p>}
              {attempt.error && <p role="alert">{attempt.error}</p>}
            </div>
          ))}
          {(turn.state === "failed" || turn.state === "unknown") && (
            <details>
              <summary>Retry reply</summary>
              <p className="small">
                Another attempt can incur another charge, even if the earlier
                outcome is unknown. The learner message is not duplicated.
              </p>
              <button
                disabled={busy}
                onClick={() =>
                  void run({
                    kind: "controlTurn",
                    turnId: turn.id,
                    control: "retry",
                  })
                }
              >
                Retry with possible additional cost
              </button>
            </details>
          )}
        </article>
      ))}
    </section>
  );
}
