import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { ProfileSnapshot, UsageSummary } from "./contracts";
import { ErrorNotice } from "./Fields";
import { errorMessage } from "./directory";
function Metrics({ data }: { data: UsageSummary }) {
  return (
    <dl className="profile-metrics">
      <dt>Saved conversations</dt>
      <dd>{data.conversations.toLocaleString()}</dd>
      <dt>Learner messages</dt>
      <dd>{data.learnerMessages.toLocaleString()}</dd>
      <dt>Partner messages</dt>
      <dd>{data.partnerMessages.toLocaleString()}</dd>
      <dt>Provider attempts</dt>
      <dd>{data.attempts.toLocaleString()}</dd>
      <dt>Reported input tokens</dt>
      <dd>{data.inputTokens.toLocaleString()}</dd>
      <dt>Reported output tokens</dt>
      <dd>{data.outputTokens.toLocaleString()}</dd>
      <dt>Attempts with unknown usage</dt>
      <dd>{data.unknownUsage.toLocaleString()}</dd>
    </dl>
  );
}
export function ProfilePanel() {
  const [snapshot, setSnapshot] = useState<ProfileSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [language, setLanguage] = useState("es");
  const [partner, setPartner] = useState("");
  const load = () => {
    setError(null);
    void invoke<ProfileSnapshot>("get_profile")
      .then(setSnapshot)
      .catch((e) => setError(errorMessage(e)));
  };
  useEffect(load, []);
  const selected = snapshot?.languages.find((item) => item.id === language);
  const person = snapshot?.partners.find((item) => item.id === partner);
  return (
    <div className="profile-panel">
      <div className="section-heading">
        <h3>Global app activity</h3>
        <button onClick={load}>Refresh</button>
      </div>
      <ErrorNotice error={error} />
      {snapshot && (
        <>
          <Metrics data={snapshot.global} />
          <p className="field-note">
            Retained local records. Unknown usage is excluded from token sums
            and counted separately. Hosted allowance is reported in Settings.
          </p>
          <h3>Language profile</h3>
          <nav className="profile-language-tabs" aria-label="Language profile">
            {snapshot.languages.map((item) => (
              <button
                key={item.id}
                aria-pressed={language === item.id}
                onClick={() => setLanguage(item.id)}
              >
                {item.label}
              </button>
            ))}
          </nav>
          {selected && (
            <>
              <Metrics data={selected} />
              <div className="evidence-unavailable">
                <strong>XP · CEFR · Skill domains</strong>
                <p>
                  No assessment projection is implemented. Activity totals do
                  not imply proficiency.
                </p>
              </div>
            </>
          )}
          <label className="field">
            <span>Conversation partner</span>
            <select
              value={partner}
              onChange={(e) => setPartner(e.target.value)}
            >
              <option value="">Select a partner</option>
              {snapshot.partners.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          {person && <Metrics data={person} />}
        </>
      )}
    </div>
  );
}
