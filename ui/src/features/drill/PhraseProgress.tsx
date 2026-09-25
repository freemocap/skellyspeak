import { useI18n } from '../../components/localization/i18n'
import { phraseProgress } from '../../domain/drill/progress'
import type { DrillAttemptView } from '../../generated/contracts'

/** How many of the newest takes the summary covers. */
const SUMMARISED_TAKES = 12
const SPARK_WIDTH = 300
const SPARK_HEIGHT = 48

/** The phrase across its recent takes: the measured match over time, and each
 * target word in every take, so a word that keeps going wrong stands out.
 *
 * Only loaded takes are summarised, and the card says how many. */
export function PhraseProgress({ attempts, compact = false, selectedId, onSelect, rtl = false }: {
  attempts: DrillAttemptView[]; rtl?: boolean; compact?: boolean; selectedId?: string; onSelect?: (id: string) => void
}) {
  const tr = useI18n()
  const progress = phraseProgress(attempts, compact ? SUMMARISED_TAKES : Math.max(1, attempts.length))
  if (!progress) return null
  const percent = (ratio: number | null) => ratio === null ? tr("—") : tr("{value0}%", { value0: String(Math.round(ratio * 100)) })
  const outcome = { same: tr("same"), substituted: tr("letters differ"), missing: tr("not heard"), extra: tr("extra") }
  const x = (index: number) => progress.ratios.length === 1 ? SPARK_WIDTH / 2 : 6 + index * (SPARK_WIDTH - 12) / (progress.ratios.length - 1)
  const y = (ratio: number) => SPARK_HEIGHT - 4 - ratio * (SPARK_HEIGHT - 8)
  // A take that could not be measured breaks the line rather than joining its neighbours.
  const runs = progress.ratios.reduce<string[][]>((lines, ratio, index) => {
    if (ratio === null) return [...lines, []]
    lines[lines.length - 1].push(`${x(index)},${y(ratio)}`)
    return lines
  }, [[]]).filter(line => line.length)
  const last = progress.ratios.length - 1
  const selected = selectedId ?? attempts[0]?.id

  return (
    <section className={`drill-progress${compact ? ' drill-progress-compact' : ''}`} aria-label={tr("This phrase")}>
      <div className="drill-progress-head">
        <h2>{tr("This phrase")}</h2>
        <span>{tr("Last {value0} takes", { value0: String(progress.takes.length) })}</span>
      </div>
      <dl className="drill-progress-stats">
        <div><dt>{tr("Best")}</dt><dd>{percent(progress.best)}</dd></div>
        <div><dt>{tr("Latest")}</dt><dd>{percent(progress.latest)}</dd></div>
        <div><dt>{tr("Last 3")}</dt><dd>{percent(progress.recentAverage)}</dd></div>
        <div><dt>{tr("Exact")}</dt><dd>{tr("{value0}/{value1}", { value0: String(progress.exact), value1: String(progress.takes.length) })}</dd></div>
      </dl>
      <svg className="drill-spark" viewBox={`0 0 ${SPARK_WIDTH} ${SPARK_HEIGHT}`} preserveAspectRatio="none" role="img"
        aria-label={tr("Transcript match by take, oldest to newest: {value0}", { value0: progress.ratios.map(percent).join(', ') })}>
        <line x1={0} x2={SPARK_WIDTH} y1={y(1)} y2={y(1)} className="drill-spark-rule" />
        <line x1={0} x2={SPARK_WIDTH} y1={y(0.5)} y2={y(0.5)} className="drill-spark-rule" />
        <line x1={0} x2={SPARK_WIDTH} y1={y(0)} y2={y(0)} className="drill-spark-rule" />
        {runs.map((line, index) => <polyline key={index} points={line.join(' ')} className="drill-spark-line" />)}
        {progress.ratios[last] !== null && <circle cx={x(last)} cy={y(progress.ratios[last])} r={3.5} className="drill-spark-point" />}
      </svg>

      {compact && onSelect && <div className="drill-recent-takes" aria-label={tr('Attempts')}>
        {progress.takes.slice(-6).reverse().map(take => <button type="button" key={take.id}
          aria-pressed={take.id === selectedId} onClick={() => onSelect(take.id)}
          aria-label={`${tr('Take {value0}', { value0: String(take.sequence) })} · ${percent(take.comparison.matchRatio)}`}
          title={tr.dateTime(new Date(take.createdAt))}>
          <span>#{String(take.sequence)}</span><strong>{percent(take.comparison.matchRatio)}</strong>
        </button>)}
      </div>}
      {!compact && <>
      <div className="drill-word-grid">
        {[...progress.takes].reverse().map(take => {
          const words = take.comparison.words.filter(word => word.kind !== 'extra')
          const scored = take.comparison.reliability?.accepted !== false
          return <button type="button" key={take.id} className="drill-word-row"
            aria-pressed={take.id === selected} onClick={() => onSelect?.(take.id)}
            aria-label={tr("Take {value0}", { value0: String(take.sequence) })}>
            <span className="drill-word-row-number">#{String(take.sequence)}</span>
            <span className="drill-word-row-cells" dir={rtl ? 'rtl' : 'ltr'}
              style={{ gridTemplateColumns: `repeat(${Math.max(1, words.length)}, minmax(0, 1fr))` }}>
              {words.map((word, index) => <span key={index} className="drill-word-cell"
                data-outcome={scored ? word.kind : undefined}
                title={`${word.target ?? ''}: ${scored ? outcome[word.kind] : tr("Not scored")}`}>
                <bdi>{word.target}</bdi>
              </span>)}
            </span>
            <span className="drill-word-row-score">{scored ? percent(take.comparison.matchRatio) : tr("Not scored")}</span>
          </button>
        })}
      </div>
      <p className="drill-word-legend" aria-hidden="true">
        <span data-outcome="same">{outcome.same}</span>
        <span data-outcome="substituted">{outcome.substituted}</span>
        <span data-outcome="missing">{outcome.missing}</span>
      </p>
      {progress.trouble && <p className="drill-trouble">{tr("Most often different: {value0}, in {value1} of {value2} takes.", {
        value0: progress.trouble.word, value1: String(progress.trouble.misses), value2: String(progress.trouble.outcomes.length),
      })}</p>}

      </>}
    </section>
  )
}
