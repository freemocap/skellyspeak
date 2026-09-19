import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../../../components/localization/i18n'
import { useOnboardingStore } from '../../../state/settings/onboarding'
import { useSessionStore } from '../../../state/session/session'
import { nativeError } from '../../../platform/ipc/workspace'
import { SettingsAccess } from '../access/SettingsAccess'
import { LanguageSetup } from './LanguageSetup'

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
  return <main className="onboarding-page">
    <section className="onboarding-sheet" aria-busy={busy}>
      <div ref={heading} tabIndex={-1}><p className="field-note">{tr('Setup {step} of 2', { step: access ? 2 : 1 })}</p></div>
      {access ? <>
        <h1>{tr('AI access')}</h1>
        <p>{tr('Connect for conversations and feedback, or set up access later.')}</p>
        <SettingsAccess onBusyChange={setAccessBusy} onChanged={useSessionStore.getState().refresh} />
        <p className="field-note">{tr('Voice availability depends on your AI access settings. Microphone permission is requested when you record.')}</p>
        <div className="onboarding-actions">
          <button className="btn" disabled={busy} onClick={() => void run(useOnboardingStore.getState().back)}>{tr('Back')}</button>
          <button className="btn primary" disabled={busy || !connection?.configured} onClick={() => void run(() => useOnboardingStore.getState().finish(false))}>{tr('Continue')}</button>
          <button className="btn" disabled={busy} onClick={() => void run(() => useOnboardingStore.getState().finish(true))}>{tr('Set up later')}</button>
        </div>
      </> : <LanguageSetup preferences={preferences} busy={busy} onSave={(...values) => void run(() => useOnboardingStore.getState().saveLanguages(...values))} />}
      {error && <p role="alert">{error}</p>}
    </section>
  </main>
}
