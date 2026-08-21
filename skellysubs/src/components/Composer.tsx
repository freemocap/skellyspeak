import { useState } from "react";

export function Composer({
  onSend,
  onMicDown,
  onMicUp,
  busy,
  listening,
  sttReady,
}: {
  onSend: (t: string) => void;
  onMicDown: () => void;
  onMicUp: () => void;
  busy: boolean;
  listening: boolean;
  sttReady: boolean;
}) {
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
      <button onClick={submit} disabled={busy}>
        Send
      </button>
      <button
        className={"mic" + (listening ? " listening" : "")}
        disabled={!sttReady || busy}
        title={sttReady ? "Hold to talk" : "Set up voice first"}
        onPointerDown={onMicDown}
        onPointerUp={onMicUp}
        onPointerLeave={onMicUp}
        onPointerCancel={onMicUp}
        onContextMenu={(e) => e.preventDefault()}
      >
        {listening ? "●" : "🎤"}
      </button>
    </div>
  );
}
