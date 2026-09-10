import { useRecorder } from "./useRecorder";
import { useState, useEffect, useRef } from "react";
import type {
  Conversation,
  Partner,
  Language,
  PracticeSettings,
} from "./contracts";
import type { useChat } from "./useChat";
import type { Run } from "./useDirectory";
import { Field, LanguageSelect, ErrorNotice } from "./Fields";

export function ConversationView({
  conversation,
  chat,
  connection,
  partner,
  languages,
  busy,
  run,
  error,
  back,
  create,
  draft,
  setDraft,
  remove,
}: {
  conversation: Conversation;
  chat: ReturnType<typeof useChat>;
  connection: () => void;
  partner: Partner;
  languages: Language[];
  busy: boolean;
  run: Run;
  error: string | null;
  back: () => void;
  create: () => void;
  draft: string;
  setDraft: (value: string) => void;
  remove: () => void;
}) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const recorder = useRecorder(conversation.id, (text) =>
    setDraft(draft.trim() ? `${draft.trimEnd()} ${text}` : text),
  );
  const snapshot = chat.snapshot;
  const pendingTurn = snapshot?.turns.find((turn) => turn.state === "pending");
  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest" });
  }, [snapshot?.messages.length]);
  const send = async () => {
    if (!snapshot || busy || pendingTurn || !draft.trim()) return;
    const submitted = draft;
    const receipt = await run({
      kind: "sendMessage",
      conversationId: conversation.id,
      text: submitted,
      expectedRevision: conversation.revision,
    });
    if (receipt && draft === submitted) setDraft("");
  };
  const partnerTurn = snapshot?.turns.find((t) =>
    t.operations.some((o) => o.kind === "partner_reply"),
  );
  return (
    <section className="conversation-view">
      <div className="chat-head">
        <div className="conversation-title">
          <strong>
            {languages.find((l) => l.id === conversation.languageId)?.name}
          </strong>
          <small>
            {partner.details.name} · {conversation.settings.difficulty}
          </small>
        </div>
        <div className="chat-heading-actions">
          <button className="quiet" onClick={back} title="Conversations">
            ☰
          </button>
          <button
            className="quiet"
            disabled={busy || recorder.recording || recorder.busy}
            onClick={create}
            aria-label="New conversation"
            title="New conversation"
          >
            ＋
          </button>
          <button
            className="quiet"
            aria-label="Settings & voice"
            aria-expanded={settingsOpen}
            onClick={() => setSettingsOpen(!settingsOpen)}
          >
            ⚙
          </button>
        </div>
      </div>
      {settingsOpen && (
        <SettingsForm
          key={conversation.id}
          conversation={conversation}
          languages={languages}
          busy={busy}
          run={run}
          error={error}
        />
      )}
      {conversation.archived && (
        <div className="notice">
          This conversation is archived. Restore it in conversation settings to
          resume.
        </div>
      )}
      <ErrorNotice error={chat.error} />
      {chat.error && <button onClick={chat.reload}>Reload conversation</button>}
      <div className="message-stream" aria-label="Messages">
        {chat.isOlder && <button onClick={chat.latest}>Latest messages</button>}
        {!snapshot && !chat.error && <p role="status">Loading conversation…</p>}
        {snapshot?.hasOlder && (
          <button onClick={chat.older}>Earlier messages</button>
        )}
        {snapshot?.messages.length === 0 && (
          <p className="chat-empty">Record a message or start typing.</p>
        )}
        {snapshot?.messages.map((message) => (
          <article key={message.id} className={`message ${message.role}`}>
            <span className="message-speaker">
              {message.role === "user" ? "You" : partner.details.name}
            </span>
            <p dir="auto">{message.text}</p>
          </article>
        ))}
        {pendingTurn && (
          <p className="small muted" role="status">
            {snapshot?.connection.paused || pendingTurn.paused
              ? "Reply paused. Open the toolbar AI panel to step or resume."
              : "Preparing reply…"}
          </p>
        )}
        {partnerTurn &&
          ["failed", "unknown", "cancelled", "invalidated"].includes(
            partnerTurn.state,
          ) && (
            <p className="notice" role="status">
              {partnerTurn.attempts.find((a) => a.error)?.error ??
                `Reply ${partnerTurn.state}.`}
              {partnerTurn.state === "failed" && (
                <button
                  disabled={busy}
                  onClick={() =>
                    void run({
                      kind: "controlTurn",
                      turnId: partnerTurn.id,
                      control: "retry",
                    })
                  }
                >
                  Retry reply
                </button>
              )}
              <button onClick={connection}>Account & connection</button>
            </p>
          )}
        <div ref={end} />
      </div>
      <div className="composer">
        <ErrorNotice error={recorder.error} />
        {recorder.error && (
          <button className="text-button" onClick={connection}>
            AI access settings
          </button>
        )}
        {recorder.busy && (
          <p className="composer-activity" role="status">
            Processing audio…
          </p>
        )}
        {recorder.recording && (
          <svg
            className="voice-wave"
            viewBox="0 0 500 44"
            preserveAspectRatio="none"
            role="img"
            aria-label="Live microphone waveform"
          >
            <polyline
              fill="none"
              stroke="#bd3038"
              strokeWidth="1.5"
              points={recorder.wave
                .map((v, i) => `${i * 2},${22 - v * 20}`)
                .join(" ")}
            />
          </svg>
        )}
        {!snapshot?.connection.configured && (
          <button className="text-button" onClick={connection}>
            Configure AI access to send messages
          </button>
        )}
        <form
          className="crow"
          onSubmit={(e) => {
            e.preventDefault();
            if (snapshot?.connection.configured) void send();
            else connection();
          }}
        >
          <input
            className="message-input"
            autoFocus
            aria-label="Message"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={20000}
            disabled={conversation.archived}
            placeholder={`Write in ${languages.find((l) => l.id === conversation.languageId)?.name}…`}
            spellCheck={false}
          />
          {recorder.recording && (
            <button
              type="button"
              onClick={() => void recorder.cancel()}
              className="mic-cancel"
              aria-label="Discard recording"
            >
              Discard
            </button>
          )}
          <button
            type="button"
            className={`mic ${recorder.recording ? "recording" : ""}`}
            onClick={() => {
              void recorder.toggle();
            }}
            disabled={
              recorder.busy || busy || !!pendingTurn || conversation.archived
            }
            aria-label={
              recorder.recording
                ? "Stop and transcribe recording"
                : "Record audio"
            }
          >
            <span aria-hidden="true">{recorder.recording ? "■" : "●"}</span>
            {recorder.recording ? "Stop" : "Record"}
          </button>
          <button
            className="send"
            aria-label="Send"
            disabled={
              busy ||
              !!pendingTurn ||
              recorder.recording ||
              recorder.busy ||
              !draft.trim() ||
              conversation.archived ||
              !!chat.error
            }
          >
            ↑
          </button>
        </form>
      </div>
      {settingsOpen && (
        <footer className="partner-footer">
          <button className="text-button danger" onClick={remove}>
            Delete conversation
          </button>
        </footer>
      )}
    </section>
  );
}

export function SettingsForm({
  conversation,
  languages,
  busy,
  run,
  error,
}: {
  conversation: Conversation;
  languages: Language[];
  busy: boolean;
  run: Run;
  error: string | null;
}) {
  const [settings, setSettings] = useState<PracticeSettings>(
    conversation.settings,
  );
  const [title, setTitle] = useState(conversation.title);
  const [base, setBase] = useState(conversation);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsFailed, setSettingsFailed] = useState(false);
  const settingsWrite = useRef(false);
  const saveSettings = async (next: PracticeSettings) => {
    if (settingsWrite.current || busy) return;
    settingsWrite.current = true;
    setSavingSettings(true);
    setSettingsFailed(false);
    try {
      const receipt = await run({
        kind: "updateSettings",
        conversationId: conversation.id,
        expectedRevision: base.settingsRevision,
        settings: next,
      });
      if (receipt)
        setBase((current) => ({
          ...current,
          settings: next,
          settingsRevision: current.settingsRevision + 1,
          revision: current.revision + 1,
        }));
      else setSettingsFailed(true);
    } finally {
      settingsWrite.current = false;
      setSavingSettings(false);
    }
  };
  const update = <K extends keyof PracticeSettings>(
    key: K,
    value: PracticeSettings[K],
  ) => {
    const next = { ...settings, [key]: value };
    setSettings(next);
    void saveSettings(next);
  };
  const language = languages.find(
    (item) => item.id === conversation.languageId,
  );
  return (
    <div className="settings-panel">
      {base.revision !== conversation.revision && (
        <div className="notice">
          The saved conversation changed. Your form is preserved. Saved
          difficulty: {conversation.settings.difficulty}.{" "}
          <button
            type="button"
            onClick={() => {
              setBase(conversation);
              setSettings(conversation.settings);
              setTitle(conversation.title);
            }}
          >
            Load saved values
          </button>
        </div>
      )}
      <fieldset className="connection-fields" disabled={busy || savingSettings}>
        <h3>Practice preferences</h3>
        <p className="small muted">Saved only for this conversation.</p>
        <div className="form-grid">
          <Field label="Difficulty">
            <select
              value={settings.difficulty}
              onChange={(e) =>
                update(
                  "difficulty",
                  e.target.value as PracticeSettings["difficulty"],
                )
              }
            >
              <option value="gentle">Gentle</option>
              <option value="balanced">Balanced</option>
              <option value="challenging">Challenging</option>
            </select>
          </Field>
          <Field label="Explanation language">
            <LanguageSelect
              languages={languages}
              value={settings.explanationLanguage}
              onChange={(value) => update("explanationLanguage", value)}
            />
          </Field>
          <Field label="Variety">
            <select
              value={settings.varietyId}
              onChange={(e) => update("varietyId", e.target.value)}
            >
              {language?.varieties.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Composing help">
            <select
              value={settings.composingHelp}
              onChange={(e) =>
                update(
                  "composingHelp",
                  e.target.value as PracticeSettings["composingHelp"],
                )
              }
            >
              <option value="minimal">Minimal</option>
              <option value="balanced">Balanced</option>
              <option value="generous">Generous</option>
            </select>
          </Field>
          <Field label="Coach proactivity">
            <select
              value={settings.coachProactivity}
              onChange={(e) =>
                update(
                  "coachProactivity",
                  e.target.value as PracticeSettings["coachProactivity"],
                )
              }
            >
              <option value="on_request">On request</option>
              <option value="occasional">Occasional</option>
              <option value="frequent">Frequent</option>
            </select>
          </Field>
        </div>
        <div className="check-row">
          {(["translation", "pronunciation", "romanization"] as const).map(
            (key) => (
              <label className="check" key={key}>
                <input
                  type="checkbox"
                  checked={settings[key]}
                  onChange={(e) => update(key, e.target.checked)}
                />
                {key.charAt(0).toUpperCase() + key.slice(1)}
              </label>
            ),
          )}
        </div>
        <ErrorNotice error={error} />
        <p role="status" className="field-note">
          {savingSettings
            ? "Saving…"
            : settingsFailed
              ? "Changes not saved"
              : "Practice settings save automatically"}
        </p>
        {settingsFailed && (
          <button onClick={() => void saveSettings(settings)}>
            Retry save
          </button>
        )}
      </fieldset>
      <hr />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run({
            kind: "updateConversation",
            conversationId: conversation.id,
            expectedRevision: base.revision,
            title,
            archived: base.archived,
          }).then((receipt) => {
            if (receipt)
              setBase((current) => ({
                ...current,
                title,
                revision: current.revision + 1,
              }));
          });
        }}
      >
        <Field label="Conversation title">
          <input
            required
            maxLength={100}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </Field>
        <div className="form-actions">
          <button disabled={busy}>Save title</button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              void run({
                kind: "updateConversation",
                conversationId: conversation.id,
                expectedRevision: base.revision,
                title: base.title,
                archived: !base.archived,
              }).then((receipt) => {
                if (receipt)
                  setBase((current) => ({
                    ...current,
                    archived: !current.archived,
                    revision: current.revision + 1,
                  }));
              });
            }}
          >
            {conversation.archived
              ? "Restore conversation"
              : "Archive conversation"}
          </button>
        </div>
      </form>
    </div>
  );
}
