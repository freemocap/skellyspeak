import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { getVersion } from "@tauri-apps/api/app";
import type { Learner, Preferences, Snapshot } from "./contracts";
import type { Run } from "./useDirectory";
import type { AccountState } from "./useAccount";
import { AccountSettings } from "./AccountSettings";
import { LanguageSelect, ErrorNotice } from "./Fields";

type Section = "reading" | "account" | "languages" | "shortcuts" | "about";
const sections: { id: Section; label: string; icon: string }[] = [
  { id: "reading", label: "Reading & display", icon: "Aa" },
  { id: "account", label: "AI access & models", icon: "◈" },
  { id: "languages", label: "Languages & learner", icon: "文" },
  { id: "shortcuts", label: "Keyboard shortcuts", icon: "⌘" },
  { id: "about", label: "About & onboarding", icon: "ⓘ" },
];
export function SettingsDialog({
  snapshot,
  run,
  busy,
  error,
  recovery,
  account,
  initial,
  close,
}: {
  snapshot: Snapshot;
  run: Run;
  busy: boolean;
  error: string | null;
  recovery: ReactNode;
  account: AccountState;
  initial: Section;
  close: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [section, setSection] = useState<Section>(initial);
  const [search, setSearch] = useState("");
  const [learner, setLearner] = useState<Learner>(snapshot.learner);
  const [dirty, setDirty] = useState(false);
  const [failed, setFailed] = useState(false);
  const [closeRequested, setCloseRequested] = useState(false);
  const [connectionBusy, setConnectionBusy] = useState(false);
  const saving = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [version, setVersion] = useState<string | null>(null);
  const [versionError, setVersionError] = useState<string | null>(null);
  useEffect(() => {
    dialog.current?.showModal();
    void getVersion()
      .then(setVersion)
      .catch(() => setVersionError("Could not read the application version."));
  }, []);
  const save = useCallback(async () => {
    if (saving.current || busy) return false;
    if (!dirty) return true;
    if (timer.current) clearTimeout(timer.current);
    saving.current = true;
    const receipt = await run({
      kind: "updateLearner",
      expectedRevision: learner.revision,
      name: learner.name,
      preferences: learner.preferences,
    });
    saving.current = false;
    if (!receipt) {
      setFailed(true);
      return false;
    }
    setLearner((current) => ({ ...current, revision: current.revision + 1 }));
    setDirty(false);
    setFailed(false);
    return true;
  }, [busy, dirty, learner, run]);
  useEffect(() => {
    if (dirty && !failed && !busy) {
      timer.current = setTimeout(() => void save(), 500);
    }
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [dirty, failed, busy, save]);
  const change = (patch: Partial<Preferences>) => {
    setLearner((current) => ({
      ...current,
      preferences: { ...current.preferences, ...patch },
    }));
    setDirty(true);
    setFailed(false);
  };
  const leave = () => setCloseRequested(true);
  useEffect(() => {
    if (
      !closeRequested ||
      busy ||
      connectionBusy ||
      account.signingIn ||
      account.busy
    )
      return;
    void save().then((ok) => {
      setCloseRequested(false);
      if (ok) close();
    });
  }, [
    closeRequested,
    busy,
    connectionBusy,
    account.signingIn,
    account.busy,
    save,
    close,
  ]);
  const rows: {
    id: string;
    section: Section;
    label: string;
    keywords: string;
    node: ReactNode;
  }[] = [
    {
      id: "size",
      section: "reading",
      label: "Text size",
      keywords: "font accessibility",
      node: (
        <label className="field">
          <span>Text size · {learner.preferences.textSize}%</span>
          <input
            type="range"
            min="75"
            max="150"
            step="5"
            value={learner.preferences.textSize}
            disabled={busy}
            onChange={(e) => change({ textSize: Number(e.target.value) })}
          />
        </label>
      ),
    },
    {
      id: "spacing",
      section: "reading",
      label: "Text spacing",
      keywords: "words density",
      node: (
        <label className="field">
          <span>Text spacing · {learner.preferences.textSpacing}px</span>
          <input
            type="range"
            min="0"
            max="12"
            step="1"
            value={learner.preferences.textSpacing}
            disabled={busy}
            onChange={(e) => change({ textSpacing: Number(e.target.value) })}
          />
        </label>
      ),
    },
    {
      id: "contrast",
      section: "reading",
      label: "Higher contrast",
      keywords: "accessibility",
      node: (
        <label className="check">
          <input
            type="checkbox"
            checked={learner.preferences.highContrast}
            disabled={busy}
            onChange={(e) => change({ highContrast: e.target.checked })}
          />
          Higher contrast
        </label>
      ),
    },
    {
      id: "account",
      section: "account",
      label: "Google sign-in, tokens and model settings",
      keywords: "api key provider allowance quota usage standard fast",
      node: (
        <AccountSettings state={account} onBusyChange={setConnectionBusy} />
      ),
    },
    {
      id: "name",
      section: "languages",
      label: "Learner name",
      keywords: "profile identity",
      node: (
        <label className="field">
          <span>Your name</span>
          <input
            maxLength={80}
            value={learner.name}
            disabled={busy}
            onChange={(e) => {
              setLearner({ ...learner, name: e.target.value });
              setDirty(true);
              setFailed(false);
            }}
          />
        </label>
      ),
    },
    {
      id: "language",
      section: "languages",
      label: "Explanation language",
      keywords: "native translation",
      node: (
        <>
          <label className="field">
            <span>Default explanation language</span>
            <LanguageSelect
              languages={snapshot.languages}
              value={learner.preferences.explanationLanguage}
              onChange={(value) => change({ explanationLanguage: value })}
            />
          </label>
          <p className="field-note">
            Used for a partner's first conversation. Each conversation keeps its
            own difficulty, language variety and reading aids.
          </p>
        </>
      ),
    },
    {
      id: "keys",
      section: "shortcuts",
      label: "Keyboard shortcuts",
      keywords: "hotkey reload settings profile ai",
      node: (
        <dl>
          <dt>Settings</dt>
          <dd>⌘ / Ctrl + ,</dd>
          <dt>AI panel</dt>
          <dd>⌘ / Ctrl + Shift + A</dd>
          <dt>Profile</dt>
          <dd>⌘ / Ctrl + Shift + P</dd>
          <dt>Reload app</dt>
          <dd>⌘ / Ctrl + R</dd>
          <dt>Close dialog / chooser</dt>
          <dd>Escape</dd>
        </dl>
      ),
    },
    {
      id: "about",
      section: "about",
      label: "Installed version",
      keywords: "release updates",
      node: (
        <>
          <h3>SkellySpeak {version && `v${version}`}</h3>
          <ErrorNotice error={versionError} />
          <p className="field-note">
            Local development build. Distribution updates and voice tools are
            not available yet.
          </p>
        </>
      ),
    },
    {
      id: "intro",
      section: "about",
      label: "Replay introduction",
      keywords: "tutorial onboarding help",
      node: (
        <button
          disabled={busy}
          onClick={() => change({ onboarding: "in_progress" })}
        >
          Replay introduction
        </button>
      ),
    },
  ];
  const query = search.trim().toLowerCase();
  const visible = rows.filter((row) =>
    query
      ? `${row.label} ${row.keywords}`.toLowerCase().includes(query)
      : row.section === section,
  );
  return (
    <dialog
      ref={dialog}
      className="settings-dialog"
      aria-label="Settings"
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < bounds.left ||
          event.clientX > bounds.right ||
          event.clientY < bounds.top ||
          event.clientY > bounds.bottom
        )
          leave();
      }}
      onCancel={(event) => {
        event.preventDefault();
        leave();
      }}
    >
      <aside className="settings-nav">
        <input
          type="search"
          aria-label="Search settings"
          placeholder="Search settings…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <nav>
          {sections.map((item) => (
            <button
              key={item.id}
              className={!query && section === item.id ? "active" : ""}
              aria-current={!query && section === item.id ? "page" : undefined}
              onClick={() => {
                setSearch("");
                setSection(item.id);
              }}
            >
              <span>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
      </aside>
      <main className="settings-content">
        <header className="settings-head">
          <h2>Settings</h2>
          <p>
            {query
              ? `${visible.length} matching settings`
              : sections.find((item) => item.id === section)?.label}
          </p>
        </header>
        <div className="settings-scroll">
          {recovery}
          <ErrorNotice error={error} />
          {failed && (
            <div className="notice">
              Changes were not saved.
              <button onClick={() => void save()}>Retry save</button>
              <button
                onClick={() => {
                  setLearner(snapshot.learner);
                  setDirty(false);
                  setFailed(false);
                }}
              >
                Load saved values
              </button>
            </div>
          )}
          {rows.map((row) => (
            <fieldset
              disabled={busy}
              className="settings-entry"
              key={row.id}
              hidden={!visible.includes(row)}
            >
              {query && <p className="eyebrow">{row.label}</p>}
              {row.node}
            </fieldset>
          ))}
          {!visible.length && <p>No settings match “{search}”.</p>}
        </div>
        <footer className="settings-footer">
          <span role="status">
            {failed
              ? "Not saved"
              : busy || dirty || connectionBusy
                ? "Saving…"
                : "Settings save automatically"}
          </span>
          <button onClick={leave}>Close</button>
        </footer>
      </main>
    </dialog>
  );
}
