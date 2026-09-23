import { ErrorNotice } from '../../../components/feedback/ErrorNotice'
import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../../../components/localization/i18n'
import { useOnboardingStore } from '../../../state/settings/onboarding'
import { useSessionStore } from '../../../state/session/session'
import { nativeError } from '../../../platform/ipc/workspace'
import { SettingsAccess } from '../access/SettingsAccess'
import { LanguageSetup } from './LanguageSetup'

/// First run: two steps, each one screen, with the app's own face on them.
///
/// The steps are real choices rather than a form to complete, so the shell gives
/// them room and says where the learner is. Everything shown before AI access
/// exists is bundled content.
export function OnboardingSetup() {
  const tr = useI18n()
  const preferences = useOnboardingStore(state => state.preferences)
  const saving = useOnboardingStore(state => state.busy)
  const connection = useSessionStore(state => state.connection)
  const [accessBusy, setAccessBusy] = useState(false)
  const [error, setError] = useState('')
  const heading = useRef<HTMLDivElement>(null)
  const access = preferences?.onboarding === 'in_progress'
  const busy = saving || accessBusy
  useEffect(() => { heading.current?.focus() }, [access])
  async function run(action: () => Promise<void>) {
    setError('')
    try { await action() } catch (reason) { setError(nativeError(reason)) }
  }
  if (!preferences) return null
  const step = access ? 2 : 1
  return <main className="onboarding-page">
    <section className="onboarding-sheet" aria-busy={busy}>
      <header className="onboarding-head">
        <p className="onboarding-wordmark"><img src="/skellyspeak-logo.png" alt="" width="28" height="28" />SkellySpeak</p>
        <div ref={heading} tabIndex={-1} className="onboarding-progress">
          {/* The rail says where you are; the text says it for anyone who cannot
              see the rail. */}
          <span className="sr-only">{tr('Setup {step} of 2', { step })}</span>
          <span className="onboarding-rail" aria-hidden="true">
            <span className="onboarding-rail-step" data-state={step > 1 ? 'done' : 'current'} />
            <span className="onboarding-rail-step" data-state={step > 1 ? 'current' : 'todo'} />
          </span>
        </div>
      </header>
      {access ? <>
        <h1>{tr('AI access')}</h1>
        <p>{tr('Connect for conversations and feedback, or set up access later.')}</p>
        <SettingsAccess onBusyChange={setAccessBusy} onChanged={useSessionStore.getState().refresh} />
        <p className="field-note">{tr('Voice availability depends on your AI access settings. Microphone permission is requested when you record.')}</p>
        <div className="onboarding-actions">
          <button className="btn primary" disabled={busy || !connection?.configured} onClick={() => void run(() => useOnboardingStore.getState().finish(false))}>{tr('Continue')}</button>
          <button className="btn" disabled={busy} onClick={() => void run(useOnboardingStore.getState().back)}>{tr('Back')}</button>
          <button className="btn" disabled={busy} onClick={() => void run(() => useOnboardingStore.getState().finish(true))}>{tr('Set up later')}</button>
        </div>
      </> : <LanguageSetup preferences={preferences} busy={busy} onSave={(...values) => void run(() => useOnboardingStore.getState().saveLanguages(...values))} />}
      {error && <ErrorNotice as="p" error={error}>{error}</ErrorNotice>}
    </section>
  </main>
}
