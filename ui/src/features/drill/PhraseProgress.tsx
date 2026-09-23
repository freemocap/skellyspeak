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
export function PhraseProgress({ attempts }: { attempts: DrillAttemptView[] }) {
  const tr = useI18n()
  const progress = phraseProgress(attempts, SUMMARISED_TAKES)
  if (!progress) return null
  const percent = (ratio: number | null) => ratio === null ? tr("—") : tr("{value0}%", { value0: String(Math.round(ratio * 100)) })
  const outcome = { same: tr("same"), substituted: tr("letters differ"), missing: tr("not heard") }
  const x = (index: number) => progress.ratios.length === 1 ? SPARK_WIDTH / 2 : 6 + index * (SPARK_WIDTH - 12) / (progress.ratios.length - 1)
  const y = (ratio: number) => SPARK_HEIGHT - 4 - ratio * (SPARK_HEIGHT - 8)
  // A take that could not be measured breaks the line rather than joining its neighbours.
  const runs = progress.ratios.reduce<string[][]>((lines, ratio, index) => {
    if (ratio === null) return [...lines, []]
    lines[lines.length - 1].push(`${x(index)},${y(ratio)}`)
    return lines
  }, [[]]).filter(line => line.length)
  const last = progress.ratios.length - 1
  const columns = `6rem repeat(${progress.words[0]?.outcomes.length ?? 0}, minmax(0, 1fr))`

  return (
    <section className="drill-progress" aria-label={tr("This phrase")}>
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

      <div className="drill-word-grid">
        {progress.words.map((word, row) => <div key={row} className="drill-word-row" role="img" style={{ gridTemplateColumns: columns }}
          aria-label={tr("{value0}: heard exactly in {value1} of {value2} takes", {
            value0: word.word, value1: String(word.outcomes.length - word.misses), value2: String(word.outcomes.length),
          })}>
          <bdi className="drill-word-grid-label" aria-hidden="true">{word.word}</bdi>
          {word.outcomes.map((kind, column) => <span key={column} className="drill-word-cell" data-outcome={kind}
            title={`${word.word}: ${outcome[kind]}`} aria-hidden="true" />)}
        </div>)}
      </div>
      <p className="drill-word-legend" aria-hidden="true">
        <span data-outcome="same">{outcome.same}</span>
        <span data-outcome="substituted">{outcome.substituted}</span>
        <span data-outcome="missing">{outcome.missing}</span>
      </p>
      {progress.trouble && <p className="drill-trouble">{tr("Most often different: {value0}, in {value1} of {value2} takes.", {
        value0: progress.trouble.word, value1: String(progress.trouble.misses), value2: String(progress.trouble.outcomes.length),
      })}</p>}
      {progress.excluded > 0 && <p className="drill-progress-note">{tr("{value0} older takes were compared against a different split of the phrase and are left out of the word grid.", { value0: String(progress.excluded) })}</p>}
    </section>
  )
}
