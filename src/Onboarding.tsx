import type { Learner } from "./contracts";
import type { Run } from "./useDirectory";

export function Onboarding({
  learner,
  run,
  busy,
}: {
  learner: Learner;
  run: Run;
  busy: boolean;
}) {
  const update = (onboarding: Learner["preferences"]["onboarding"]) => {
    void run({
      kind: "updateLearner",
      expectedRevision: learner.revision,
      name: learner.name,
      preferences: { ...learner.preferences, onboarding },
    });
  };
  return (
    <section className="onboarding" aria-label="Getting started">
      <div>
        <details>
          <summary>Start typing to chat · Quick guide</summary>
          <p className="small muted">
            Enter sends; Shift+Enter adds a line. Use the partner chooser to
            change who you talk to. Conversation settings and titles can be
            changed anytime. The right pane is for your coach and lesson. Replay
            this guide in Settings.
          </p>
        </details>
      </div>
      <div className="onboarding-actions">
        <button
          className="primary"
          disabled={busy}
          onClick={() => update("completed")}
        >
          Got it
        </button>
        <button
          className="text-button"
          disabled={busy}
          onClick={() => update("skipped")}
        >
          Skip introduction
        </button>
      </div>
    </section>
  );
}
