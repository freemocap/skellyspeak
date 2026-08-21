import type { ChatTurn } from "../types";

export function Chat({
  turns,
  busy,
  streamText,
  onSend,
}: {
  turns: ChatTurn[];
  busy: boolean;
  streamText: string;
  onSend: (t: string) => void;
}) {
  return (
    <div className="chat">
      {turns.length === 0 && (
        <div className="empty">Habla con tu tutor. Escribe algo para empezar.</div>
      )}
      {turns.map((t, i) => (
        <div key={i}>
          <div className={"bubble " + t.role}>
            <div className="bubble-text">{t.text}</div>
            {t.role === "assistant" && t.reply?.target_phrase && (
              <div className="phrase">
                {t.reply.target_phrase}
                {t.reply.romanization && <span className="rom"> ({t.reply.romanization})</span>}
              </div>
            )}
            {t.role === "assistant" && t.reply?.explanation && (
              <div className="explanation">{t.reply.explanation}</div>
            )}
          </div>
          {t.role === "assistant" && t.turn?.suggestions?.length > 0 && (
            <div className="suggestions">
              {t.turn.suggestions.map((s, j) => (
                <button
                  key={j}
                  className="suggestion"
                  onClick={() => onSend(s.es)}
                  title={s.en + " — " + s.note}
                >
                  <span className="sugg-es">{s.es}</span>
                  <span className="sugg-en">{s.en}</span>
                  <span className="sugg-note">{s.note}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
      {busy && (
        <div className="bubble assistant">
          <div className="bubble-text">{streamText || "…"}</div>
        </div>
      )}
    </div>
  );
}
