import { ErrorNotice } from '../../../components/feedback/ErrorNotice'
import { useState } from 'react'
import { useI18n } from '../../../components/localization/i18n'
import { ToolbarIcon } from '../../../components/controls/ToolbarIcon'
import { useOnboardingStore } from '../../../state/settings/onboarding'
import { nativeError } from '../../../platform/ipc/workspace'

/** The step follows real conversation state: nothing said yet, a reply to read, then feedback on the learner's own message. */
export function guideStep(hasReply: boolean, hasLearnerTurn: boolean): 0 | 1 | 2 {
  return hasLearnerTurn ? 2 : hasReply ? 1 : 0
}

/** First-conversation guide above the composer. Its buttons perform the step;
 * it never starts work by itself or moves focus. */
export function GettingStartedGuide({ hasReply, hasLearnerTurn, canRecord, onRecord, onOpenCoach }: {
  hasReply: boolean; hasLearnerTurn: boolean; canRecord: boolean; onRecord: () => void; onOpenCoach: () => void
}) {
  const tr = useI18n()
  const shown = useOnboardingStore(state => state.preferences?.onboardingHelp ?? false)
  const busy = useOnboardingStore(state => state.busy)
  const [error, setError] = useState('')
  if (!shown) return null
  const step = guideStep(hasReply, hasLearnerTurn)
  const steps = [
    { label: tr('Say something'), text: tr('Record or type a message, or let your partner start.') },
    { label: tr('Read the reply'), text: tr('Tap a word for its meaning. Word by word shows the whole sentence.') },
    { label: tr('See your feedback'), text: tr('Coach shows what worked and what to change.') },
  ]
  const current = steps[step]
  return <section className="getting-started" data-step={step} aria-label={tr('Getting started')}>
    <div className="getting-started-head">
      <ToolbarIcon name="idea" size={17} />
      <h2>{current.label}</h2>
      <button type="button" className="getting-started-hide" aria-label={tr('Hide getting started')} disabled={busy} onClick={() => {
        setError('')
        void useOnboardingStore.getState().showHelp(false).catch(reason => setError(nativeError(reason)))
      }}><ToolbarIcon name="close" size={15} /></button>
    </div>
    <p>{current.text}</p>
    <div className="getting-started-actions">
      {step < 2
        ? <button type="button" className="btn primary" disabled={!canRecord} onClick={onRecord}><ToolbarIcon name="mic" size={15} />{tr('Record')}</button>
        : <button type="button" className="btn primary" onClick={onOpenCoach}><ToolbarIcon name="idea" size={15} />{tr('Open Coach')}</button>}
    </div>
    <ol className="getting-started-steps">
      {steps.map(({ label }, index) => <li key={label} data-state={index < step ? 'done' : index === step ? 'current' : 'todo'} aria-current={index === step ? 'step' : undefined}>
        <span className="getting-started-dot" aria-hidden="true">{index < step ? <ToolbarIcon name="check" size={11} /> : tr.number(index + 1)}</span>{label}
      </li>)}
    </ol>
    {error && <ErrorNotice as="p" error={error}>{error}</ErrorNotice>}
  </section>
}
