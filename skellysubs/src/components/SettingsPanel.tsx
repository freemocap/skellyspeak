import { useState } from "react";
import type { ApiFormat, ProviderConfig, ProviderSettings } from "../types";

function ProviderSection({
  title,
  cfg,
  onChange,
  allowAnthropic,
}: {
  title: string;
  cfg: ProviderConfig;
  onChange: (patch: Partial<ProviderConfig>) => void;
  allowAnthropic?: boolean;
}) {
  return (
    <section className="provider">
      <h3>{title}</h3>
      <div className="field-row">
        <label>
          <input
            type="radio"
            checked={cfg.mode === "local"}
            onChange={() => onChange({ mode: "local" })}
          />
          Local
        </label>
        <label>
          <input
            type="radio"
            checked={cfg.mode === "remote"}
            onChange={() => onChange({ mode: "remote" })}
          />
          Remote API
        </label>
      </div>

      {cfg.mode === "remote" && (
        <>
          <label className="field">
            <span>Format</span>
            <select
              value={cfg.format}
              onChange={(e) => onChange({ format: e.target.value as ApiFormat })}
            >
              <option value="openai">OpenAI-compatible</option>
              {allowAnthropic && <option value="anthropic">Anthropic</option>}
            </select>
          </label>
          <label className="field">
            <span>Base URL</span>
            <input
              value={cfg.baseUrl}
              onChange={(e) => onChange({ baseUrl: e.target.value })}
              placeholder="https://openrouter.ai/api/v1"
            />
          </label>
          <label className="field">
            <span>Model</span>
            <input
              value={cfg.model}
              onChange={(e) => onChange({ model: e.target.value })}
            />
          </label>
        </>
      )}
    </section>
  );
}

export function SettingsPanel({
  initial,
  onSave,
  onClose,
}: {
  initial: ProviderSettings;
  onSave: (s: ProviderSettings) => void;
  onClose: () => void;
}) {
  const [s, setS] = useState<ProviderSettings>(initial);

  function setSharedKey(key: string) {
    setS((prev) => ({
      ...prev,
      llm: { ...prev.llm, apiKey: key },
      stt: { ...prev.stt, apiKey: key },
    }));
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
        <div className="settings-head">
          <h2>Providers</h2>
          <button className="close-btn" onClick={onClose}>
            ×
          </button>
        </div>

        <label className="field shared-key">
          <span>OpenRouter API key (shared — LLM + transcription)</span>
          <input
            type="password"
            value={s.llm.apiKey}
            placeholder="sk-or-v1-…"
            onChange={(e) => setSharedKey(e.target.value)}
          />
          <small>One key covers both. Get one at openrouter.ai/keys</small>
        </label>

        <ProviderSection
          title="LLM (tutor)"
          cfg={s.llm}
          onChange={(patch) =>
            setS((prev) => ({ ...prev, llm: { ...prev.llm, ...patch } }))
          }
          allowAnthropic
        />
        <ProviderSection
          title="Transcription"
          cfg={s.stt}
          onChange={(patch) =>
            setS((prev) => ({ ...prev, stt: { ...prev.stt, ...patch } }))
          }
        />

        <div className="settings-actions">
          <button onClick={onClose}>Cancel</button>
          <button className="primary" onClick={() => onSave(s)}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
