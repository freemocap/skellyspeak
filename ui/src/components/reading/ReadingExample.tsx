import { MixedText } from './MixedText'
import { TargetMessage } from './TargetMessage'

/** Saved grammar examples may combine source, reading aid and meaning in one field. */
export function ReadingExample({ text, compact = false }: { text: string; compact?: boolean }) {
  const parts = /^(.+?)\s*\(([^()]*)\)\s*[-–—]\s*(.+)$/su.exec(text)
  // Unstructured prose must not acquire the direction and scale of its first word.
  if (!parts) return <p dir="auto"><MixedText text={text} /></p>
  const source = parts[1].trim()
  return <TargetMessage key={text} layout={compact ? 'compact' : 'passage'} text={source} segments={[]} segmentsKey={source} translation={parts[3]} romanization={parts[2]} pronunciation={null} translateLabel={null} segmentsPending={false} lookupWords status={null} annotation={null} speech={null} analysis={null} focused={false} rtl={false} />
}
