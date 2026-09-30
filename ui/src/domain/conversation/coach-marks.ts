import type { CoachDecision, CoachIssue, CoachIssueSeverity, CoachObservationView } from '../../generated/contracts'

/** How serious a flagged phrase is: `error` is wrong, `partial` is not quite right. */
export type CoachMarkSeverity = CoachIssueSeverity

/** One phrase of the learner's message the coach flagged. */
export type CoachFlag = CoachIssue

/** Where a flagged phrase sits in the message, in UTF-16 offsets. */
export interface CoachMark { start: number; end: number; severity: CoachMarkSeverity }

/** The native correctable issues, including corrections selected for disclosure.
 * Skill evidence alone never flags wording as wrong. Each quote counts once; a quote
 * flagged both ways counts as an error. */
export function coachFlags(feedback: CoachObservationView | undefined, decision: CoachDecision | undefined): CoachFlag[] {
  const flags = new Map<string, CoachMarkSeverity>()
  const add = (quote: string, severity: CoachMarkSeverity): void => {
    const text = quote.trim()
    if (!text) return
    if (flags.get(text) === 'error') return
    flags.set(text, severity)
  }
  if (decision?.shown) add(decision.shown.quote, 'error')
  for (const correction of feedback?.corrections ?? []) add(correction.quote, 'error')
  for (const issue of feedback?.issues ?? []) add(issue.quote, issue.severity)
  return [...flags].map(([quote, severity]) => ({ quote, severity }))
}

/** Places each flag at its first exact occurrence in the message. A quote the
 * message does not contain verbatim is still a flag but gets no mark. Where
 * marks overlap, the error wins the shared characters. */
export function coachMarks(source: string, flags: CoachFlag[]): CoachMark[] {
  const severity: (CoachMarkSeverity | null)[] = new Array<CoachMarkSeverity | null>(source.length).fill(null)
  for (const flag of flags) {
    const start = source.indexOf(flag.quote)
    if (start < 0) continue
    for (let index = start; index < start + flag.quote.length; index++)
      if (severity[index] !== 'error') severity[index] = flag.severity
  }
  const marks: CoachMark[] = []
  for (let index = 0; index < source.length; index++) {
    const current = severity[index]
    if (current === null) continue
    const last = marks.at(-1)
    if (last && last.end === index && last.severity === current) last.end = index + 1
    else marks.push({ start: index, end: index + 1, severity: current })
  }
  return marks
}
