import { invoke } from "@tauri-apps/api/core";
import { errorMessage } from "./directory";
import { useCallback, useState } from "react";
import type { AccountState } from "./useAccount";
import { ErrorNotice } from "./Fields";
import { ConnectionForm } from "./ConnectionForm";

export function AccountSettings({
  state,
  onBusyChange,
}: {
  state: AccountState;
  onBusyChange: (busy: boolean) => void;
}) {
  const { config, account } = state;
  const [connectionBusy, setConnectionBusy] = useState(false);
  const connectionActivity = useCallback(
    (busy: boolean) => {
      setConnectionBusy(busy);
      onBusyChange(busy);
    },
    [onBusyChange],
  );
  const reset = new Date();
  reset.setUTCHours(24, 0, 0, 0);
  return (
    <section className="account-settings">
      <h3>AI access</h3>
      <p className="field-note">
        Sign in to use the hosted allowance. Your conversations stay on this
        device.
      </p>
      <ErrorNotice error={state.error} />
      {!config ? (
        <button onClick={() => void state.refresh()}>Load account</button>
      ) : (
        <>
          <label className="field">
            <span>Connection</span>
            <select
              value={config.route}
              disabled={state.busy || state.signingIn || connectionBusy}
              onChange={(e) =>
                void state.route(e.target.value as "hosted" | "openrouter")
              }
            >
              <option value="hosted">Hosted · Sign in with Google</option>
              <option value="openrouter">Own OpenRouter API key</option>
            </select>
          </label>
          {config.route === "hosted" && (
            <div className="hosted-models">
              <h3>Models</h3>
              <dl>
                <dt>Standard · partner replies</dt>
                <dd>{config.standardModel}</dd>
                <dt>Fast · smaller tasks</dt>
                <dd>No active assignments</dd>
              </dl>
              <p className="field-note">
                Hosted models are authorized by the service. Task routing never
                silently substitutes another model.
              </p>
            </div>
          )}
          {config.route === "hosted" && (
            <>
              {config.signedIn && <ServiceDiagnostics key={config.revision} />}
              {config.signedIn ? (
                <div className="signed-account">
                  <strong>{account?.name || config.email}</strong>
                  <span>{config.email}</span>
                </div>
              ) : (
                <p>Not signed in.</p>
              )}
              {account && (
                <>
                  <div className="allowance-heading">
                    <strong>
                      ${account.usedUsd.toFixed(3)} / $
                      {account.limitUsd.toFixed(2)}
                    </strong>
                    <span>
                      used today
                      {account.customLimit ? " · custom allowance" : ""}
                    </span>
                  </div>
                  <progress
                    aria-label="Daily hosted allowance used"
                    max={Math.max(account.limitUsd, 0.001)}
                    value={Math.min(account.usedUsd, account.limitUsd)}
                  />
                  <dl className="account-metrics">
                    <dt>Tokens today</dt>
                    <dd>{account.tokensToday.toLocaleString()}</dd>
                    <dt>AI requests today</dt>
                    <dd>{account.requestsToday.toLocaleString()}</dd>
                    <dt>Remaining allowance</dt>
                    <dd>${account.remainingUsd.toFixed(3)}</dd>
                    <dt>Estimated requests remaining</dt>
                    <dd>
                      ≈ {account.estimatedRequestsRemaining.toLocaleString()}
                    </dd>
                    <dt>Estimated tokens remaining</dt>
                    <dd>
                      {account.requestsToday
                        ? `≈ ${account.estimatedTokensRemaining.toLocaleString()}`
                        : "Insufficient usage"}
                    </dd>
                    <dt>Daily reset</dt>
                    <dd>
                      {reset.toLocaleTimeString([], {
                        hour: "numeric",
                        minute: "2-digit",
                      })}{" "}
                      local · {account.resets}
                    </dd>
                  </dl>
                  <p className="field-note">
                    Allowance is metered in dollars. Remaining requests and
                    tokens are estimates, not guaranteed quotas.
                  </p>
                </>
              )}
              <div className="account-actions">
                {!config.signedIn && (
                  <button
                    className="google-signin"
                    disabled={state.signingIn || state.busy}
                    onClick={() => void state.signIn()}
                  >
                    <b aria-hidden="true">G</b>
                    {state.signingIn
                      ? "Waiting for Google…"
                      : "Sign in with Google"}
                  </button>
                )}
                {state.signingIn && (
                  <button onClick={() => void state.cancel()}>
                    Cancel sign-in
                  </button>
                )}
                {config.signedIn && (
                  <>
                    <button
                      disabled={state.busy}
                      onClick={() => void state.refresh()}
                    >
                      Refresh allowance
                    </button>
                    <button
                      disabled={state.busy}
                      onClick={() => void state.signOut()}
                    >
                      Sign out
                    </button>
                  </>
                )}
              </div>
              {state.signingIn && (
                <p role="status" className="field-note">
                  Complete sign-in in your system browser. Return here when
                  finished.
                </p>
              )}
            </>
          )}
          {config.route === "openrouter" && (
            <ConnectionForm
              onBusyChange={connectionActivity}
              onChanged={state.refresh}
            />
          )}
        </>
      )}
    </section>
  );
}

function ServiceDiagnostics() {
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  return (
    <details>
      <summary>Service diagnostics</summary>
      <button
        disabled={busy}
        onClick={() => {
          setBusy(true);
          setReport(null);
          setError(null);
          void invoke<string>("hosted_diagnostics")
            .then(setReport)
            .catch((e) => setError(errorMessage(e)))
            .finally(() => setBusy(false));
        }}
      >
        {busy ? "Checking…" : "Check service status"}
      </button>
      <ErrorNotice error={error} />
      {report && (
        <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
          {report}
        </pre>
      )}
    </details>
  );
}
