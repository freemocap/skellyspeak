import { TargetText } from './TargetText'
import { PhraseActions } from './PhraseActions'

/** A complete quoted phrase, never a name or a fragment of a larger message.
 * Inline markup keeps examples valid inside paragraphs, tables and quotations. */
export function TargetPhrase({ text, interactive = true, addToDrill = true }: { text: string; interactive?: boolean; addToDrill?: boolean }) {
  return <span className="target-phrase"><TargetText text={text} interactive={interactive} />
    {interactive && text.trim() && <PhraseActions text={text} addToDrill={addToDrill} />}
  </span>
}
