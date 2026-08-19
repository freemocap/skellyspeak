import { useState } from "react";

export function Composer({ onSend, busy }: { onSend: (t: string) => void; busy: boolean }) {
  const [text, setText] = useState("");
  const submit = () => {
    const t = text.trim();
    if (!t || busy) return;
    onSend(t);
    setText("");
  };
  return (
    <div className="composer">
      <input
        value={text}
        placeholder="Escribe algo…"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        disabled={busy}
      />
      <button onClick={submit} disabled={busy}>Send</button>
    </div>
  );
}
