import { DetailDialog } from './DetailDialog'

export interface WordInsight {
  gloss: string
  lemma: string
  pos: string
  form: string
  role: string
  usage: string
}

function InsightRow({ k, v }: { k: string; v: string }) {
  if (!v.trim()) return null
  return (
    <div className="insight-row">
      <span className="k">{k}</span>
      <span className="v">{v}</span>
    </div>
  )
}

/** Read-only detail presentation. Request ownership belongs to the conversation controller. */
export function WordInsightModal({
  word,
  sentence,
  onClose,
  insight = null,
}: {
  word: string
  sentence: string
  onClose: () => void
  insight?: WordInsight | null
}) {
  return (
    <DetailDialog title={`Word: ${word}`} onClose={onClose}>
      <h2>{word}</h2>
        <p className="insight-sentence">{sentence}</p>
        {!insight && <p className="center-note">Word details are not connected yet.</p>}
        {insight && (
          <div className="insight-body">
            <InsightRow k="Meaning" v={insight.gloss} />
            <InsightRow k="Lemma" v={insight.lemma} />
            <InsightRow k="Part of speech" v={insight.pos} />
            <InsightRow k="Form" v={insight.form} />
            <InsightRow k="Role in sentence" v={insight.role} />
            <InsightRow k="Usage" v={insight.usage} />
          </div>
        )}
    </DetailDialog>
  )
}
