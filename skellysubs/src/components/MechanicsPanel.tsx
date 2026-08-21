import type { Feature, TutorTurn } from "../types";

const FEATURE_ORDER = ["Mood", "Tense", "Person", "Number", "Gender", "VerbForm"];

function featureLabel(f: Feature): string {
  const map: Record<string, Record<string, string>> = {
    Tense: { Pres: "present", Past: "past", Fut: "future", Imp: "imperfect" },
    Mood: {
      Ind: "indicative",
      Sub: "subjunctive",
      Imp: "imperative",
      Cnd: "conditional",
    },
    Person: {
      "1": "1st person (I)",
      "2": "2nd person (you)",
      "3": "3rd person (he/she/it)",
    },
    Number: { Sing: "singular", Plur: "plural" },
    Gender: { Masc: "masculine", Fem: "feminine" },
    VerbForm: {
      Fin: "conjugated",
      Inf: "infinitive",
      Part: "participle",
      Ger: "gerund",
    },
  };
  const m = map[f.key];
  if (m && m[f.value]) return m[f.value];
  return f.key + " " + f.value;
}

function gColor(key: string): string {
  const m: Record<string, string> = {
    Mood: "g-mood",
    Tense: "g-tense",
    Person: "g-person",
    Number: "g-number",
    Gender: "g-gender",
    VerbForm: "g-verbform",
  };
  return m[key] ?? "g-other";
}

function posClass(pos: string): string {
  const m: Record<string, string> = {
    VERB: "pos-verb",
    AUX: "pos-verb",
    NOUN: "pos-noun",
    PROPN: "pos-noun",
    PRON: "pos-pron",
    ADJ: "pos-adj",
    ADV: "pos-adv",
    DET: "pos-det",
    ADP: "pos-adp",
    CCONJ: "pos-conj",
    SCONJ: "pos-conj",
    INTJ: "pos-intj",
    NUM: "pos-num",
    PUNCT: "pos-punct",
  };
  return m[pos] ?? "pos-other";
}

export function MechanicsPanel({ turn }: { turn?: TutorTurn }) {
  if (!turn) {
    return (
      <aside className="panel">
        <div className="panel-empty">
          Say something to start.
          <br />
          Grammar mechanics will appear here as they come up.
        </div>
      </aside>
    );
  }

  const byToken = new Map<number, Feature[]>();
  for (const f of turn.analysis.features) {
    const arr = byToken.get(f.token_index) ?? [];
    arr.push(f);
    byToken.set(f.token_index, arr);
  }
  for (const arr of byToken.values()) {
    arr.sort((a, b) => FEATURE_ORDER.indexOf(a.key) - FEATURE_ORDER.indexOf(b.key));
  }
  const notes = [...byToken.entries()].sort((a, b) => a[0] - b[0]);

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
          <p className="card-contrast">
            <span>vs English</span> {c.contrast}
          </p>
        </div>
      ))}

      {turn.new_words.length > 0 && (
        <div className="newwords">
          <div className="panel-kick">New words (i+1)</div>
          <div className="chips">
            {turn.new_words.map((w) => (
              <span className="chip" key={w}>
                {w}
              </span>
            ))}
          </div>
        </div>
      )}

      {notes.length > 0 && (
        <div className="grammar">
          <div className="panel-kick">Grammar in your reply</div>
          {notes.map(([idx, fs]) => {
            const tok = turn.analysis.tokens[idx];
            if (!tok) return null;
            return (
              <div className="grammar-note" key={idx}>
                <b>{tok.text}</b>
                <span className="grammar-labels">
                  {fs.map((f, j) => (
                    <span className={"grammar-chip " + gColor(f.key)} key={j}>
                      {featureLabel(f)}
                    </span>
                  ))}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {turn.analysis.tokens.length > 0 && (
        <div className="gloss">
          <div className="panel-kick">Word by word</div>
          <div className="gloss-row">
            {turn.analysis.tokens.map((t, i) => (
              <span className={"tok " + posClass(t.pos)} key={i} title={t.pos + " · " + t.lemma}>
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
