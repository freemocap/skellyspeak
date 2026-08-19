import type { TurnResult } from "../types";

// The contextual grammar panel: shows the cards this reply triggered, the new
// words the sheltering pass introduced, and a token-by-token gloss of the reply.
export function MechanicsPanel({ turn }: { turn?: TurnResult }) {
  if (!turn) {
    return (
      <aside className="panel">
        <div className="panel-empty">Say something in Spanish (or English) to start.<br />
          Grammar mechanics will appear here as they come up.</div>
      </aside>
    );
  }
  return (
    <aside className="panel">
      <div className="panel-kick">Mechanics</div>

      {turn.cards.length === 0 && (
        <div className="panel-empty small">No new mechanic to flag this turn.</div>
      )}

      {turn.cards.map((c) => (
        <div className="card" key={c.id}>
          <div className="card-head">
            <span className="card-title">{c.title}</span>
            <span className="card-cefr">{c.cefr}</span>
          </div>
          <p className="card-expl">{c.explanation}</p>
          <p className="card-ex">{c.example}</p>
          <p className="card-contrast"><span>vs English</span> {c.contrast}</p>
        </div>
      ))}

      {turn.new_words.length > 0 && (
        <div className="newwords">
          <div className="panel-kick">New words (i+1)</div>
          <div className="chips">
            {turn.new_words.map((w) => <span className="chip" key={w}>{w}</span>)}
          </div>
        </div>
      )}

      {turn.analysis.tokens.length > 0 && (
        <div className="gloss">
          <div className="panel-kick">Word by word</div>
          <div className="gloss-row">
            {turn.analysis.tokens.map((t, i) => (
              <span className="tok" key={i} title={`${t.pos} · ${t.lemma}`}>
                <span className="tok-text">{t.text}</span>
                <span className="tok-gloss">{t.gloss}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}
