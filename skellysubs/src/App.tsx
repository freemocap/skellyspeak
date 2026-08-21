import { useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { Chat } from "./components/Chat";
import { Composer } from "./components/Composer";
import { MechanicsPanel } from "./components/MechanicsPanel";
import { SettingsPanel } from "./components/SettingsPanel";
import { ensureSttModel, getProviderSettings, sendMessage, setProviderSettings, startListening, sttStatus, stopListening } from "./api";
import { copyToClipboard, formatTurns } from "./share";
import type { ChatTurn, ProviderSettings, SttStatus, TutorTurn } from "./types";
import "./App.css";

export default function App() {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [lastTurn, setLastTurn] = useState<TutorTurn | undefined>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [copied, setCopied] = useState(false);

  const [stt, setStt] = useState<SttStatus | undefined>();
  const [sttBusy, setSttBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const listeningRef = useRef(false);
  const streamRef = useRef("");
  const [providers, setProviders] = useState<ProviderSettings | undefined>();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [streamText, setStreamText] = useState("");

  useEffect(() => {
    sttStatus().then(setStt).catch((e) => setError(String(e)));
    getProviderSettings().then(setProviders).catch((e) => setError(String(e)));
  }, []);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;
    listen<string>("tutor-stream-delta", (e) => {
      streamRef.current += e.payload;
      setStreamText((prev) => prev + e.payload);
    }).then((fn) => {
      if (disposed) fn();
      else unlisten = fn;
    });
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  async function prepareStt() {
    setError(undefined);
    setSttBusy(true);
    try {
      setStt(await ensureSttModel());
    } catch (e) {
      setError(String(e));
    } finally {
      setSttBusy(false);
    }
  }

  function handleMicDown() {
    if (!sttReady || listeningRef.current) return;
    setError(undefined);
    listeningRef.current = true;
    setListening(true);
    startListening().catch((e) => {
      listeningRef.current = false;
      setListening(false);
      setError(String(e));
    });
  }

  async function handleMicUp() {
    if (!listeningRef.current) return;
    listeningRef.current = false;
    setListening(false);
    try {
      const text = await stopListening();
      if (text.trim()) await handleSend(text.trim());
    } catch (e) {
      setError(String(e));
    }
  }

  async function handleSend(text: string) {
    setError(undefined);
    const history = turns.map((t) => ({ role: t.role, text: t.text }));
    setTurns((t) => [...t, { role: "user", text }]);
    setStreamText("");
    streamRef.current = "";
    setBusy(true);
    try {
      const turn = await sendMessage(text, history);
      setTurns((t) => [
        ...t,
        { role: "assistant", text: turn.reply.reply, reply: turn.reply, turn },
      ]);
      setLastTurn(turn);
      setStreamText("");
    } catch (e) {
      // Keep the streamed reply even if the grammar analysis failed.
      const partial = streamRef.current.trim();
      if (partial) {
        setTurns((t) => [...t, { role: "assistant", text: partial }]);
        setStreamText("");
      }
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleCopy() {
    await copyToClipboard(formatTurns(turns));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function handleSaveProviders(s: ProviderSettings) {
    try {
      await setProviderSettings(s);
      setProviders(s);
      setSettingsOpen(false);
    } catch (e) {
      setError(String(e));
    }
  }

  const sttLocal = providers?.stt.mode === "local";
  const sttReady = sttLocal ? !!stt?.loaded : true;
  const apiKey = providers?.llm.apiKey ?? "";
  const missingKey =
    (providers?.llm.mode === "remote" || providers?.stt.mode === "remote") &&
    !apiKey.trim();

  return (
    <main className="app">
      <header className="topbar">
        <span className="brand">SkellySubs · tutor</span>
        <span className="model">
          {providers?.llm.mode === "remote" ? "OpenRouter" : "local"} · Spanish
        </span>
        {sttLocal && !stt?.loaded && (
          <button className="stt-btn" onClick={prepareStt} disabled={sttBusy}>
            {sttBusy
              ? "Downloading…"
              : stt?.downloaded
                ? "Load voice"
                : "Set up voice (download model)"}
          </button>
        )}
        {missingKey && (
          <button
            className="stt-btn"
            onClick={() => setSettingsOpen(true)}
            title="Add your OpenRouter API key"
          >
            Add API key
          </button>
        )}
        <button className="settings-btn" onClick={() => setSettingsOpen(true)} title="Providers">
          ⚙
        </button>
        <button className="copy-btn" onClick={handleCopy}>
          {copied ? "Copied!" : "Copy all"}
        </button>
      </header>
      <div className="layout">
        <section className="conversation">
          <Chat turns={turns} busy={busy} streamText={streamText} onSend={handleSend} />
          {error && <div className="error">Backend error: {error}</div>}
          <Composer
            onSend={handleSend}
            onMicDown={handleMicDown}
            onMicUp={handleMicUp}
            busy={busy}
            listening={listening}
            sttReady={sttReady}
          />
        </section>
        <MechanicsPanel turn={lastTurn} />
      </div>
      {settingsOpen && providers && (
        <SettingsPanel
          initial={providers}
          onSave={handleSaveProviders}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </main>
  );
}
