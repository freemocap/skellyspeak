import { invoke } from "@tauri-apps/api/core";
import { errorMessage } from "./directory";
import { useCallback, useState, useRef } from "react";
import type { AccountState } from "./useAccount";
import { ErrorNotice } from "./Fields";
import { AccessProfileForm } from "./AccessProfileForm";
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
  const [accessBusy, setAccessBusy] = useState(false);
  const tab = config?.route;
  const [modelsOpen, setModelsOpen] = useState(false);
  const activity = useRef({ access: false, connection: false });
  const accessActivity = useCallback(
    (busy: boolean) => {
      activity.current.access = busy;
      setAccessBusy(busy);
      onBusyChange(activity.current.access || activity.current.connection);
    },
    [onBusyChange],
  );
  const connectionActivity = useCallback(
    (busy: boolean) => {
      activity.current.connection = busy;
      setConnectionBusy(busy);
      onBusyChange(activity.current.access || activity.current.connection);
    },
    [onBusyChange],
  );
  const reset = new Date();
  reset.setUTCHours(24, 0, 0, 0);
  const routes = [
    { id: "hosted", label: "Hosted sign-in" },
    { id: "openrouter", label: "API keys" },
    { id: "custom", label: "Custom URL" },
  ] as const;
  const locked = state.busy || state.signingIn || connectionBusy || accessBusy;
  return (
    <section className="account-settings">
      <ErrorNotice error={state.error} />
      {!config ? (
        <button onClick={() => void state.refresh()}>Load AI access</button>
      ) : (
        <>
          <div
            className="access-tabs"
            role="tablist"
            aria-label="Use for AI requests"
            onKeyDown={(event) => {
              const tabs = Array.from(
                event.currentTarget.querySelectorAll<HTMLButtonElement>(
                  '[role="tab"]',
                ),
              );
              const index = tabs.indexOf(
                document.activeElement as HTMLButtonElement,
              );
              const next =
                event.key === "ArrowRight"
                  ? (index + 1) % tabs.length
                  : event.key === "ArrowLeft"
                    ? (index + tabs.length - 1) % tabs.length
                    : event.key === "Home"
                      ? 0
                      : event.key === "End"
                        ? tabs.length - 1
                        : null;
              if (next !== null) {
                event.preventDefault();
                tabs[next]?.focus();
              }
            }}
          >
            {routes.map((route) => (
              <button
                key={route.id}
                id={`access-tab-${route.id}`}
                type="button"
                role="tab"
                aria-selected={tab === route.id}
                aria-controls={`access-panel-${route.id}`}
                tabIndex={tab === route.id ? 0 : -1}
                disabled={locked}
                onClick={() => {
                  if (config.route !== route.id) void state.route(route.id);
                }}
              >
                <span className="access-route-indicator" aria-hidden="true" />
                {route.label}
              </button>
            ))}
          </div>
          <div
            className="access-route-panel"
            role="tabpanel"
            id={`access-panel-${tab}`}
            aria-labelledby={`access-tab-${tab}`}
            tabIndex={0}
          >
            {tab === "hosted" && (
              <>
                {config.signedIn ? (
                  <div className="hosted-identity">
                    <span className="connection-dot" aria-hidden="true" />
                    <div>
                      <strong>{account?.name || config.email}</strong>
                      {account?.name && <small>{config.email}</small>}
                    </div>
                    <button
                      className="text-button"
                      disabled={state.busy}
                      onClick={() => void state.signOut()}
                    >
                      Sign out
                    </button>
                  </div>
                ) : (
                  <div className="hosted-signin">
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
                    {state.signingIn && (
                      <>
                        <button onClick={() => void state.cancel()}>
                          Cancel sign-in
                        </button>
                        <p className="field-note" role="status">
                          Complete sign-in in your browser, then return here.
                        </p>
                      </>
                    )}
                  </div>
                )}
                {account && (
                  <div className="hosted-allowance">
                    <div className="allowance-heading">
                      <span>Today's allowance</span>
                      <strong>
                        ${account.usedUsd.toFixed(3)}{" "}
                        <span>/ ${account.limitUsd.toFixed(2)}</span>
                      </strong>
                    </div>
                    <progress
                      aria-label="Daily hosted allowance used"
                      max={Math.max(account.limitUsd, 0.001)}
                      value={Math.min(account.usedUsd, account.limitUsd)}
                    />
                    <p className="field-note">
                      ${account.remainingUsd.toFixed(3)} remaining · resets{" "}
                      {reset.toLocaleTimeString([], {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                      {account.customLimit ? " · custom allowance" : ""}
                    </p>
                    <details className="access-disclosure">
                      <summary>
                        <span>
                          Usage details
                          <small>Tokens, requests and estimates</small>
                        </span>
                      </summary>
                      <dl className="account-metrics">
                        <dt>Tokens today</dt>
                        <dd>{account.tokensToday.toLocaleString()}</dd>
                        <dt>AI requests today</dt>
                        <dd>{account.requestsToday.toLocaleString()}</dd>
                        <dt>Estimated requests remaining</dt>
                        <dd>
                          ≈{" "}
                          {account.estimatedRequestsRemaining.toLocaleString()}
                        </dd>
                        <dt>Estimated tokens remaining</dt>
                        <dd>
                          {account.requestsToday
                            ? `≈ ${account.estimatedTokensRemaining.toLocaleString()}`
                            : "Insufficient usage"}
                        </dd>
                        <dt>Daily reset</dt>
                        <dd>{account.resets}</dd>
                      </dl>
                      <p className="field-note">
                        Money is authoritative. Request and token estimates are
                        not guaranteed quotas.
                      </p>
                    </details>
                  </div>
                )}
                {config.signedIn && (
                  <button
                    className="text-button allowance-refresh"
                    disabled={state.busy}
                    onClick={() => void state.refresh()}
                  >
                    Refresh allowance
                  </button>
                )}
                <details className="access-disclosure">
                  <summary>
                    <span>
                      Service details
                      <small>
                        Models
                        {config.signedIn ? " and connection diagnostics" : ""}
                      </small>
                    </span>
                  </summary>
                  <dl>
                    <dt>Standard model</dt>
                    <dd>{config.standardModel}</dd>
                    <dt>Fast model</dt>
                    <dd>No active assignments</dd>
                  </dl>
                  {config.signedIn && (
                    <ServiceDiagnostics key={config.revision} />
                  )}
                </details>
              </>
            )}
            {tab === "openrouter" && (
              <>
                <ConnectionForm
                  key={config.revision}
                  disabled={accessBusy}
                  modelsOpen={modelsOpen}
                  onModelsOpenChange={setModelsOpen}
                  onBusyChange={connectionActivity}
                  onChanged={state.refresh}
                >
                  <AccessProfileForm
                    key={`keys:${config.revision}`}
                    custom={false}
                    disabled={connectionBusy}
                    onBusyChange={accessActivity}
                    onChanged={state.refresh}
                  />
                </ConnectionForm>
              </>
            )}
            {tab === "custom" && (
              <>
                <AccessProfileForm
                  key={`custom:${config.revision}`}
                  custom={true}
                  onBusyChange={accessActivity}
                  onChanged={state.refresh}
                />
              </>
            )}
          </div>
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
    <div className="service-diagnostics">
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
    </div>
  );
}
