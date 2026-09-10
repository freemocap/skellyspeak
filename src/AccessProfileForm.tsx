import { KeyBadge } from "./KeyBadge";
import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { AccessSettings, CustomEndpoint } from "./contracts";
import { ErrorNotice, Field } from "./Fields";
import { errorMessage } from "./directory";

export function AccessProfileForm({
  custom,
  disabled = false,
  onBusyChange,
  onChanged,
}: {
  custom: boolean;
  disabled?: boolean;
  onBusyChange: (busy: boolean) => void;
  onChanged: () => Promise<void>;
}) {
  const [saved, setSaved] = useState<AccessSettings | null>(null);
  const [endpoint, setEndpoint] = useState<CustomEndpoint | null>(null);
  const [key, setKey] = useState("");
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [check, setCheck] = useState<{
    state: "idle" | "checking" | "valid" | "invalid";
    detail: string;
  }>({ state: "idle", detail: "" });
  const writing = useRef(false);
  const sequence = useRef(0);
  const load = useCallback(() => {
    void invoke<AccessSettings>("get_access_settings")
      .then((value) => {
        setSaved(value);
        setEndpoint({
          ...value.custom,
          standardModel:
            value.custom.standardModel || "google/gemini-2.5-flash",
          fastModel: value.custom.fastModel || "google/gemini-2.5-flash",
        });
      })
      .catch((e) => setError(errorMessage(e)));
  }, []);
  useEffect(load, [load]);
  useEffect(() => {
    onBusyChange(dirty || busy);
    return () => onBusyChange(false);
  }, [dirty, busy, onBusyChange]);
  const verify = useCallback(
    async (value: AccessSettings) => {
      const request = ++sequence.current;
      setCheck({ state: "checking", detail: "Checking connection…" });
      try {
        const detail = await invoke<string>("check_access", {
          expectedRevision: value.revision,
          custom,
        });
        if (request === sequence.current) setCheck({ state: "valid", detail });
      } catch (e) {
        if (request === sequence.current)
          setCheck({ state: "invalid", detail: errorMessage(e) });
      }
    },
    [custom],
  );
  useEffect(() => {
    if (!custom && saved?.groqKeyConfigured) void verify(saved);
    return () => {
      ++sequence.current;
    };
  }, [saved, custom, verify]);
  const save = useCallback(
    async (removeKey = false) => {
      if (!saved || !endpoint || writing.current) return;
      writing.current = true;
      setBusy(true);
      setError(null);
      try {
        const value = await invoke<AccessSettings>("save_access_settings", {
          expectedRevision: saved.revision,
          custom: custom ? endpoint : null,
          apiKey: removeKey ? null : key.trim() || null,
          removeKey,
        });
        ++sequence.current;
        setCheck({ state: "idle", detail: "" });
        setSaved(value);
        setEndpoint(value.custom);
        setKey("");
        setDirty(false);
        await onChanged();
      } catch (e) {
        setError(errorMessage(e));
      } finally {
        writing.current = false;
        setBusy(false);
      }
    },
    [saved, endpoint, custom, key, onChanged],
  );
  useEffect(() => {
    if (!dirty || busy || error) return;
    const timer = setTimeout(() => void save(), 700);
    return () => clearTimeout(timer);
  }, [dirty, busy, error, save]);
  const edit = () => {
    ++sequence.current;
    setCheck({ state: "idle", detail: "" });
    setDirty(true);
    setError(null);
  };
  const update = <K extends keyof CustomEndpoint>(
    name: K,
    value: CustomEndpoint[K],
  ) => {
    if (endpoint) setEndpoint({ ...endpoint, [name]: value });
    edit();
  };
  const configured = custom
    ? saved?.customKeyConfigured
    : saved?.groqKeyConfigured;
  const label = custom ? "Server session token" : "Groq API key";
  return (
    <section className={custom ? "custom-access" : "api-key-row"}>
      <ErrorNotice error={error} />
      {!saved || !endpoint ? (
        <button onClick={load}>Load connection settings</button>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <fieldset disabled={busy || disabled} className="connection-fields">
            {custom && (
              <>
                <Field label="API base URL">
                  <input
                    type="url"
                    placeholder="http://127.0.0.1:8765/v1"
                    value={endpoint.baseUrl}
                    onChange={(e) => update("baseUrl", e.target.value)}
                    autoCapitalize="none"
                    spellCheck={false}
                  />
                </Field>
                <p className="field-note">
                  SkellySpeak server API URL, including /v1. HTTPS, or HTTP on
                  loopback.
                </p>
                <Field label="Authentication">
                  <select
                    value={endpoint.bearerAuth ? "bearer" : "none"}
                    onChange={(e) =>
                      update("bearerAuth", e.target.value === "bearer")
                    }
                  >
                    <option value="none">No authentication</option>
                    <option value="bearer">Bearer session token</option>
                  </select>
                </Field>
              </>
            )}
            {(!custom || endpoint.bearerAuth) && (
              <>
                <label
                  className="field"
                  htmlFor={custom ? "custom-key" : "groq-key"}
                >
                  <span>{label}</span>
                  {!custom && (
                    <small id="groq-purpose">Voice transcription</small>
                  )}
                </label>
                <div className="secret-control">
                  <input
                    id={custom ? "custom-key" : "groq-key"}
                    aria-label={label}
                    aria-describedby={custom ? undefined : "groq-purpose"}
                    type="password"
                    value={key}
                    onChange={(e) => {
                      setKey(e.target.value);
                      edit();
                    }}
                    placeholder={
                      configured
                        ? "Key saved · enter a replacement"
                        : custom
                          ? "Bearer key"
                          : "gsk_…"
                    }
                    autoComplete="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    maxLength={4096}
                  />
                  <KeyBadge
                    state={check.state}
                    label={label}
                    detail={check.detail}
                    configured={!!configured}
                    disabled={busy || disabled || (!key && dirty)}
                    onClear={
                      key
                        ? () => {
                            ++sequence.current;
                            setKey("");
                            setError(null);
                            setCheck({ state: "idle", detail: "" });
                            setDirty(
                              custom &&
                                JSON.stringify(endpoint) !==
                                  JSON.stringify(saved.custom),
                            );
                            setSaved({ ...saved });
                            document
                              .getElementById(
                                custom ? "custom-key" : "groq-key",
                              )
                              ?.focus();
                          }
                        : undefined
                    }
                    onRemove={() => void save(true)}
                  />
                </div>
              </>
            )}
            <div className="key-row-footer">
              <p className="field-note" role="status">
                {error
                  ? "Changes not saved"
                  : dirty || busy
                    ? "Saving…"
                    : configured
                      ? "Key saved"
                      : "Not configured"}
              </p>
              <div className="account-actions">
                {error && (
                  <button type="button" onClick={() => void save()}>
                    Retry save
                  </button>
                )}
                {custom && (
                  <button
                    type="button"
                    disabled={dirty || check.state === "checking"}
                    onClick={() => void verify(saved)}
                  >
                    Check connection
                  </button>
                )}
              </div>
            </div>
            {custom && (
              <details className="access-disclosure">
                <summary>
                  <span>Models & voice</span>
                </summary>
                <div className="form-grid">
                  <Field label="Standard model · partner and coach">
                    <input
                      value={endpoint.standardModel}
                      onChange={(e) => update("standardModel", e.target.value)}
                      spellCheck={false}
                    />
                  </Field>
                  <Field label="Fast model · no active assignments">
                    <input
                      value={endpoint.fastModel}
                      onChange={(e) => update("fastModel", e.target.value)}
                      spellCheck={false}
                    />
                  </Field>
                </div>

                <div className="access-capabilities">
                  <p className="field-note">
                    Requires multipart POST /audio/transcriptions support.
                  </p>
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={endpoint.transcriptionModel !== null}
                      onChange={(e) =>
                        update(
                          "transcriptionModel",
                          e.target.checked ? "whisper-large-v3" : null,
                        )
                      }
                    />
                    Voice transcription
                  </label>
                  {endpoint.transcriptionModel !== null && (
                    <Field label="Transcription model">
                      <input
                        value={endpoint.transcriptionModel}
                        onChange={(e) =>
                          update("transcriptionModel", e.target.value)
                        }
                        spellCheck={false}
                      />
                    </Field>
                  )}
                </div>
              </details>
            )}
            {check.detail && (custom || check.state === "invalid") && (
              <p
                className={`key-status ${check.state}`}
                role={check.state === "invalid" ? "alert" : "status"}
              >
                {check.detail}
              </p>
            )}
          </fieldset>
        </form>
      )}
    </section>
  );
}
