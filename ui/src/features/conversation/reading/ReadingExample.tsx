import { MixedText } from '../../../components/reading/MixedText'
import { ReadingPassage } from './ReadingPassage'

/** Saved grammar examples may combine source, reading aid and meaning in one field. */
export function ReadingExample({ text, compact = false }: { text: string; compact?: boolean }) {
  const parts = /^(.+?)\s*\(([^()]*)\)\s*[-–—]\s*(.+)$/su.exec(text)
  // Unstructured prose must not acquire the direction and scale of its first word.
  if (!parts) return <p dir="auto"><MixedText text={text} /></p>
  return <ReadingPassage key={text} compact={compact} text={parts[1].trim()}
    romanization={parts[2]} translation={parts[3]} />
}
