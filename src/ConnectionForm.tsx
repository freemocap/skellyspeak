import { KeyBadge } from "./KeyBadge";
import {
  useEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { invoke } from "@tauri-apps/api/core";
import type { ConnectionConfig } from "./contracts";
import { Field, ErrorNotice } from "./Fields";
import { errorMessage } from "./directory";

export function ConnectionForm({
  onBusyChange,
  onChanged,
  children,
  disabled = false,
  modelsOpen,
  onModelsOpenChange,
}: {
  children?: ReactNode;
  disabled?: boolean;
  modelsOpen?: boolean;
  onModelsOpenChange?: (open: boolean) => void;
  onBusyChange: (busy: boolean) => void;
  onChanged: () => Promise<void>;
}) {
  const [config, setConfig] = useState<ConnectionConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [key, setKey] = useState("");
  const [standard, setStandard] = useState("");
  const [fast, setFast] = useState("");
  const [check, setCheck] = useState<"idle" | "checking" | "valid" | "invalid">(
    "idle",
  );
  const [detail, setDetail] = useState("");
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);
  const writing = useRef(false);
  const sequence = useRef(0);
  const adopt = (value: ConnectionConfig) => {
    setConfig(value);
    setStandard(value.standardModel);
    setFast(value.fastModel);
  };
  const load = () => {
    setError(null);
    void invoke<ConnectionConfig>("get_connection")
      .then(adopt)
      .catch((e) => setError(errorMessage(e)));
  };
  useEffect(load, []);
  useEffect(() => {
    onBusyChange(busy || dirty);
    return () => onBusyChange(false);
  }, [busy, dirty, onBusyChange]);
  // Verify edits after typing stops; stale responses cannot validate a newer key.
  useEffect(() => {
    const request = ++sequence.current;
    setCheck("idle");
    setDetail("");
    if (!config) return;
    if (!key.trim()) {
      if (config.ownKeyConfigured) void verifySaved(config);
      return () => {
        ++sequence.current;
      };
    }
    const timer = setTimeout(() => {
      setCheck("checking");
      void invoke("verify_openrouter_key", {
        apiKey: key.trim(),
        expectedRevision: config.revision,
      })
        .then(() => {
          if (sequence.current === request) {
            setCheck("valid");
            setDetail("Key accepted by OpenRouter · not yet saved");
          }
        })
        .catch((e) => {
          if (sequence.current === request) {
            setCheck("invalid");
            setDetail(errorMessage(e));
          }
        });
    }, 600);
    return () => {
      clearTimeout(timer);
      ++sequence.current;
    };
  }, [key, config?.revision]);
  const verifySaved = async (value: ConnectionConfig) => {
    const request = ++sequence.current;
    setCheck("checking");
    setDetail("Checking saved key…");
    try {
      await invoke("verify_openrouter_key", {
        apiKey: null,
        expectedRevision: value.revision,
      });
      if (request === sequence.current) {
        setCheck("valid");
        setDetail("Saved key accepted by OpenRouter");
      }
    } catch (e) {
      if (request === sequence.current) {
        setCheck("invalid");
        setDetail(errorMessage(e));
      }
    }
  };
  const save = useCallback(async () => {
    if (!config || writing.current || !dirty) return;
    writing.current = true;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const value = await invoke<ConnectionConfig>("save_connection", {
        expectedRevision: config.revision,
        apiKey: key.trim() || null,
        standardModel: standard.trim(),
        fastModel: fast.trim(),
      });
      adopt(value);
      setKey("");
      setSaved(true);
      setDirty(false);
      await onChanged();
      // Verification has its own result: a network failure must not imply that saving failed.
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
      writing.current = false;
    }
  }, [config, dirty, key, standard, fast, onChanged]);
  useEffect(() => {
    if (!dirty || busy || error) return;
    const timer = setTimeout(() => void save(), 500);
    return () => clearTimeout(timer);
  }, [dirty, busy, error, save]);
  const edited = () => {
    setDirty(true);
    setSaved(false);
    setError(null);
  };
  return (
    <div className="connection-settings">
      <ErrorNotice error={error} />
      {!config ? (
        <button onClick={load}>Load connection settings</button>
      ) : (
        <>
          <form
            className="api-key-row"
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <fieldset disabled={busy || disabled} className="connection-fields">
              <label className="field" htmlFor="openrouter-key">
                <span>OpenRouter API key</span>
                <small id="openrouter-purpose">Chat & coaching</small>
              </label>
              <div className="secret-control">
                <input
                  id="openrouter-key"
                  aria-label="OpenRouter API key"
                  aria-describedby="openrouter-purpose"
                  name="apiKey"
                  type="password"
                  value={key}
                  onChange={(e) => {
                    setKey(e.target.value);
                    edited();
                  }}
                  placeholder={
                    config.ownKeyConfigured
                      ? "Key saved · enter a replacement"
                      : "sk-or-…"
                  }
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  required={!config.ownKeyConfigured}
                  maxLength={4096}
                />
                <KeyBadge
                  state={check}
                  label="OpenRouter API key"
                  detail={detail}
                  configured={config.ownKeyConfigured}
                  disabled={busy || disabled || (!key && dirty)}
                  onClear={
                    key
                      ? () => {
                          ++sequence.current;
                          setKey("");
                          setError(null);
                          setSaved(false);
                          setCheck("idle");
                          setDetail("");
                          setDirty(
                            standard !== config.standardModel ||
                              fast !== config.fastModel,
                          );
                          document.getElementById("openrouter-key")?.focus();
                        }
                      : undefined
                  }
                  onRemove={() => {
                    setBusy(true);
                    setError(null);
                    void invoke<ConnectionConfig>("disconnect", {
                      expectedRevision: config.revision,
                    })
                      .then(async (value) => {
                        adopt(value);
                        setKey("");
                        setDirty(false);
                        setSaved(false);
                        await onChanged();
                      })
                      .catch((e) => setError(errorMessage(e)))
                      .finally(() => setBusy(false));
                  }}
                />
              </div>
              {check === "invalid" && (
                <p className="key-status invalid" role="alert">
                  {detail}
                </p>
              )}
              <div className="key-row-footer">
                <p className="field-note" role="status">
                  {error
                    ? "Changes not saved"
                    : busy || dirty
                      ? "Saving…"
                      : saved
                        ? "All changes saved"
                        : "Settings save automatically"}
                </p>
                {error && (
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      void save();
                    }}
                  >
                    Retry save
                  </button>
                )}
              </div>
            </fieldset>
          </form>
          {children}
          <p className="access-footnote">
            Stored in the system credential store. Provider charges apply.
          </p>
          <details
            className="access-disclosure"
            open={modelsOpen}
            onToggle={(event) => onModelsOpenChange?.(event.currentTarget.open)}
          >
            <summary>
              <span>Models</span>
            </summary>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void save();
              }}
            >
              <fieldset
                className="connection-fields"
                disabled={busy || disabled}
              >
                <Field label="Standard model · Partner and coach replies">
                  <input
                    name="standardModel"
                    value={standard}
                    required
                    maxLength={160}
                    onChange={(e) => {
                      setStandard(e.target.value);
                      edited();
                    }}
                  />
                </Field>
                <Field label="Fast model · Smaller tasks">
                  <input
                    name="fastModel"
                    value={fast}
                    required
                    maxLength={160}
                    onChange={(e) => {
                      setFast(e.target.value);
                      edited();
                    }}
                  />
                </Field>
                <p className="field-note">
                  Fast has no active assignments yet. Key verification checks
                  authentication; model access and available credits are checked
                  when you send.
                </p>
              </fieldset>
            </form>
          </details>
        </>
      )}
    </div>
  );
}
