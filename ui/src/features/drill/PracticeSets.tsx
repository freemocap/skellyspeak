import { useEffect, useId, useRef, useState } from 'react'
import { ErrorNotice } from '../../components/feedback/ErrorNotice'
import { ToolbarIcon } from '../../components/controls/ToolbarIcon'
import { difficultyLabel } from '../../components/controls/DifficultySelect'
import { TargetMessage } from '../../components/reading/TargetMessage'
import { useI18n } from '../../components/localization/i18n'
import { messageKey } from '../../domain/localization'
import { errorMessage } from '../../platform/diagnostics/error-details'
import { previewPracticeSet, getPracticeSets } from '../../platform/ipc/practice-sets'
import { languageFor } from '../../platform/ipc/tauri'
import type { PracticeSet, DrillGenerationPreview, PracticeSetSummary, ReadingScope } from '../../generated/contracts'

const CONTENT = {
  absolute_zero: { description: messageKey('Single words and simple phrases'), action: messageKey('Add {value0} absolute zero phrases') },
  beginner: { description: messageKey('Everyday short phrases'), action: messageKey('Add {value0} beginner phrases') },
  intermediate: { description: messageKey('Fuller sentences to ask and explain'), action: messageKey('Add {value0} intermediate phrases') },
  advanced: { description: messageKey('Longer, more natural speech'), action: messageKey('Add {value0} advanced phrases') },
  social: { description: messageKey('Greetings, thanks and everyday social exchanges'), action: messageKey('Add {value0} social phrases') },
  idiomatic: { description: messageKey('Idioms and familiar sayings'), action: messageKey('Add {value0} idiomatic phrases') },
} satisfies Record<PracticeSet, { description: string; action: string }>
const LEVELS = ['absolute_zero', 'beginner', 'intermediate', 'advanced'] as const

/** Shared local-set actions. The first visit shows samples; the general dialog
 * uses a compact row of the same actions above its generation controls. */
export function PracticeSets({ scope, layout, disabled = false, onPreview, onBusyChange }: {
  scope: ReadingScope
  layout: 'cards' | 'buttons'
  disabled?: boolean
  onPreview: (result: DrillGenerationPreview) => Promise<void>
  onBusyChange?: (busy: boolean) => void
}) {
  const tr = useI18n()
  const described = useId()
  const language = languageFor(scope.language, scope.variety ?? undefined)
  if (!language) throw new Error(`No language configuration for ${scope.language}.`)
  const [sets, setSets] = useState<PracticeSetSummary[] | null>(null)
  const [pending, setPending] = useState<PracticeSet | null>(null)
  const [failure, setFailure] = useState<{ set: PracticeSet | null; error: unknown } | null>(null)
  const [retry, setRetry] = useState(0)
  const alive = useRef(true)
  const adding = useRef(false)
  useEffect(() => () => onBusyChange?.(false), [onBusyChange])
  useEffect(() => {
    alive.current = true
    let current = true
    setSets(null)
    void getPracticeSets(scope.language, scope.variety).then(data => {
      if (!current) return
      if (!Array.isArray(data) || data.length !== Object.keys(CONTENT).length || new Set(data.map(entry => entry.set)).size !== Object.keys(CONTENT).length
        || data.some(entry => !Object.hasOwn(CONTENT, entry.set) || entry.count < 8 || !entry.sample)) {
        throw new Error('The language configuration did not return all complete practice sets.')
      }
      setSets(data)
      setFailure(null)
    }).catch(error => { if (current) setFailure({ set: null, error }) })
    return () => { current = false; alive.current = false }
  }, [scope.language, scope.variety, retry])

  const add = async (set: PracticeSet) => {
    if (adding.current || disabled) return
    adding.current = true
    setPending(set); setFailure(null)
    onBusyChange?.(true)
    try {
      const preview = await previewPracticeSet(scope, set)
      if (!alive.current) return
      await onPreview(preview)
    } catch (error) {
      if (alive.current) setFailure({ set, error })
    } finally {
      adding.current = false
      if (alive.current) { setPending(null); onBusyChange?.(false) }
    }
  }

  const button = ({ set, count }: PracticeSetSummary) => <button type="button"
    className={`btn outline${layout === 'cards' ? ' drill-starter-action' : ''}`}
    disabled={disabled || pending !== null} aria-describedby={layout === 'cards' ? `${described}-${set}` : undefined}
    onClick={() => void add(set)}>
    <ToolbarIcon name="deck-add" size={17} />{tr(CONTENT[set].action, { value0: count })}
  </button>

  return <section className={`drill-bundled drill-bundled-${layout}`}>
    {!sets && !failure && <p role="status">{tr('Loading…')}</p>}
    {failure && <ErrorNotice as="p" error={failure.error} onRetry={() => failure.set === null ? setRetry(value => value + 1) : add(failure.set)}>
      {errorMessage(failure.error)}
    </ErrorNotice>}
    {sets && (layout === 'cards'
      ? <ul className="drill-starter-levels">{sets.map(summary => <li key={summary.set}
        className="drill-starter-level">
        <div className="drill-starter-about">
          <header className="drill-starter-head">
            <h3>{summary.set === 'social' || summary.set === 'idiomatic' ? <ToolbarIcon name="deck-add" size={17} /> : <LevelBars level={summary.set} />}
              {tr(summary.set === 'social' ? 'Social phrases' : summary.set === 'idiomatic' ? 'Idiomatic phrases' : difficultyLabel(summary.set))}</h3>
            <p id={`${described}-${summary.set}`}>{tr(CONTENT[summary.set].description)}</p>
          </header>
          <div className="drill-starter-sample">
            <TargetMessage provenance={null} addToDrill={false} layout="compact" text={summary.sample} segments={[]}
              segmentsKey={`practice-${scope.language}-${scope.variety}-${summary.set}`} translation={null} romanization={null} pronunciation={null}
              translateLabel={null} segmentsPending={false} lookupWords status={null} annotation={null} speech={null} analysis={null}
              focused={false} rtl={language.direction === 'rtl'} />
          </div>
        </div>
        <div className="drill-starter-do">{button(summary)}</div>
      </li>)}</ul>
      : <div className="drill-bundled-groups">{[LEVELS, ['social', 'idiomatic'] as const].map((group, index) =>
        <div key={index} className="drill-bundled-buttons">{group.map(set => {
          const summary = sets.find(entry => entry.set === set)!
          return <span key={set}>{button(summary)}</span>
        })}</div>)}</div>)}
    {pending !== null && <p role="status">{tr('Adding phrases…')}</p>}
  </section>
}

function LevelBars({ level }: { level: typeof LEVELS[number] }) {
  const filled = LEVELS.indexOf(level) + 1
  return <span className="drill-starter-bars" aria-hidden="true">
    {LEVELS.map((entry, index) => <span key={entry} data-filled={index < filled} />)}
  </span>
}
