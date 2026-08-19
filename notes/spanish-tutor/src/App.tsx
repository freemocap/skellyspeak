import { useState } from "react";
import { Chat } from "./components/Chat";
import { MechanicsPanel } from "./components/MechanicsPanel";
import { Composer } from "./components/Composer";
import { sendMessage } from "./api";
import type { ChatTurn, TurnResult } from "./types";

export default function App() {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [lastResult, setLastResult] = useState<TurnResult | undefined>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  async function handleSend(text: string) {
    setError(undefined);
    setTurns((t) => [...t, { role: "user", text }]);
    setBusy(true);
    try {
      const result = await sendMessage(text);
      setTurns((t) => [...t, { role: "assistant", text: result.reply, result }]);
      setLastResult(result);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">Spanish&nbsp;<span>Tutor</span></div>
        <div className="model">gemma&nbsp;4&nbsp;e4b · local</div>
      </header>
      <main className="layout">
        <section className="conversation">
          <Chat turns={turns} busy={busy} />
          {error && <div className="error">Backend error: {error}</div>}
          <Composer onSend={handleSend} busy={busy} />
        </section>
        <MechanicsPanel turn={lastResult} />
      </main>
    </div>
  );
}
