import type { ChatTurn } from "../types";

export function Chat({ turns, busy }: { turns: ChatTurn[]; busy: boolean }) {
  return (
    <div className="chat">
      {turns.map((t, i) => (
        <div className={`bubble ${t.role}`} key={i}>
          {t.text}
        </div>
      ))}
      {busy && <div className="bubble assistant pending">…</div>}
    </div>
  );
}
