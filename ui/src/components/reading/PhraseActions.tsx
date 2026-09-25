import { TokenAudio } from './TokenAudio'
import { AddToDrillButton } from './AddToDrillButton'
import { useReadingScope } from './ReadingContext'

/** Actions belong to the exact displayed phrase and its captured language. */
export function PhraseActions({ text, addToDrill = true }: { text: string; addToDrill?: boolean }) {
  const scope = useReadingScope()
  if (!scope || !text.trim()) return null
  return <span className="target-phrase-actions"><TokenAudio text={text} />{addToDrill && <AddToDrillButton text={text} />}</span>
}
