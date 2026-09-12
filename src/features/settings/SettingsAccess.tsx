import { InfoTip } from '../../ui/InfoTip'
import { useEffect, useRef, useState } from 'react'
import { invoke } from '../../platform/ipc/native'
import type { AccessSettings, ConnectionConfig, ConnectionRoute, CustomEndpoint, HostedAccount } from '../../contracts'

const CUSTOM_CHAT_MODEL = 'google/gemini-2.5-flash'
const CUSTOM_TRANSCRIPTION_MODEL = 'whisper-large-v3'

const message = (error: unknown): string => error instanceof Error ? error.message :
  typeof error === 'object' && error !== null && 'message' in error ? String(error.message) : String(error)

/** Native configuration owns route and credential revisions. Secrets are write-only. */
export function SettingsAccess({ onBusyChange, onChanged }: {
  onBusyChange: (busy: boolean) => void
  onChanged: () => Promise<void>
}) {
  const [connection, setConnection] = useState<ConnectionConfig | null>(null)
  const [access, setAccess] = useState<AccessSettings | null>(null)
  const [endpoint, setEndpoint] = useState<CustomEndpoint | null>(null)
  const [models, setModels] = useState({ standardModel: '', fastModel: '' })
  const [keys, setKeys] = useState({ openrouter: '', groq: '', custom: '' })
  const [dirty, setDirty] = useState<'openrouter' | 'groq' | 'custom' | null>(null)
  const [editingField, setEditingField] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState('')
  const [checks, setChecks] = useState<Record<string, 'valid' | 'invalid' | 'checking'>>({})
  const [account, setAccount] = useState<HostedAccount | null>(null)
  const [removing, setRemoving] = useState<'openrouter' | 'groq' | 'custom' | null>(null)
  const writing = useRef(false)
  const savedDraft = useRef<{ endpoint: CustomEndpoint; models: typeof models } | null>(null)

  async function read() {
    const [nextConnection, nextAccess] = await Promise.all([
      invoke<ConnectionConfig>('get_connection'), invoke<AccessSettings>('get_access_settings'),
    ])
    const custom = nextAccess.custom
    setConnection(nextConnection); setAccess(nextAccess)
    const displayedEndpoint = { ...custom,
      standardModel: custom.standardModel || CUSTOM_CHAT_MODEL,
      fastModel: custom.fastModel || CUSTOM_CHAT_MODEL,
      transcriptionModel: custom.transcriptionModel || CUSTOM_TRANSCRIPTION_MODEL }
    setEndpoint(displayedEndpoint)
    savedDraft.current = { endpoint: displayedEndpoint, models: { standardModel: nextConnection.standardModel, fastModel: nextConnection.fastModel } }
    setModels({ standardModel: nextConnection.standardModel, fastModel: nextConnection.fastModel })
  }
  useEffect(() => { void read().catch(error => setError(message(error))) }, [])
  useEffect(() => { onBusyChange(busy || dirty !== null); return () => onBusyChange(false) }, [busy, dirty, onBusyChange])

  useEffect(() => {
    const saved = savedDraft.current
    if (!dirty || busy || !saved) return
    const changed = keys[dirty].trim() !== '' || (dirty === 'custom'
      ? JSON.stringify(endpoint) !== JSON.stringify(saved.endpoint)
      : dirty === 'openrouter' && JSON.stringify(models) !== JSON.stringify(saved.models))
    if (!changed) { setDirty(null); setError(null) }
  }, [dirty, busy, keys, endpoint, models])

  function discard() {
    const saved = savedDraft.current
    if (busy || !saved) return
    setEndpoint(saved.endpoint); setModels(saved.models)
    setKeys({ openrouter: '', groq: '', custom: '' })
    setDirty(null); setError(null); setStatus('Changes discarded'); setEditingField(false)
  }

  async function run(action: () => Promise<void>) {
    if (writing.current) return
    writing.current = true; setBusy(true); setError(null); setStatus('')
    try { await action() }
    catch (error) { setError(message(error)) }
    finally { writing.current = false; setBusy(false) }
  }
  async function save(provider: 'openrouter' | 'groq' | 'custom', removeKey = false) {
    if (!connection || !access || !endpoint) throw new Error('AI access has not loaded.')
    if (provider === 'openrouter') {
      if (removeKey) await invoke('disconnect', { expectedRevision: connection.revision })
      else await invoke('save_connection', {
        expectedRevision: connection.revision, apiKey: keys.openrouter.trim() || null, ...models,
      })
    } else {
      await invoke('save_access_settings', {
        expectedRevision: access.revision, custom: provider === 'custom' ? endpoint : null,
        apiKey: removeKey ? null : keys[provider].trim() || null, removeKey,
      })
    }
    setKeys(current => ({ ...current, [provider]: '' })); setDirty(null); setRemoving(null)
    await read(); await onChanged(); setStatus('Saved')
  }
  useEffect(() => {
    if (!dirty || busy || editingField || error) return
    const timer = setTimeout(() => void run(() => save(dirty)), 500)
    return () => clearTimeout(timer)
  }, [dirty, keys, endpoint, models, editingField, busy, error])

  function edit(provider: 'openrouter' | 'groq' | 'custom') { setChecks(current => { const next = { ...current }; delete next[provider]; return next }); setDirty(provider); setError(null); setStatus('') }
  async function check(provider: 'openrouter' | 'groq' | 'custom') {
    if (!connection || !access) throw new Error('AI access has not loaded.')
    setChecks(current => ({ ...current, [provider]: 'checking' }))
    try {
      if (provider === 'openrouter') {
        await invoke('verify_openrouter_key', { apiKey: null, expectedRevision: connection.revision })
      } else {
        let current = access
        if (provider === 'custom' && access.customUrlIsUnsavedDefault) {
          if (!endpoint) throw new Error('Custom endpoint has not loaded.')
          current = await invoke<AccessSettings>('save_access_settings', {
            expectedRevision: access.revision, custom: endpoint, apiKey: null, removeKey: false,
          })
          setAccess(current)
          await onChanged()
        }
        await invoke<string>('check_access', { expectedRevision: current.revision, custom: provider === 'custom' })
      }
      setChecks(current => ({ ...current, [provider]: 'valid' }))
    } catch (error) {
      setChecks(current => ({ ...current, [provider]: 'invalid' }))
      throw error
    }
  }

  function credential(provider: 'openrouter' | 'groq' | 'custom', label: string, configured: boolean) {
    return <div className="form-row">
      <label htmlFor={`access-${provider}`}>{label}</label>
      <div className="key-row">
        <input id={`access-${provider}`} className="key-input" type="password" autoComplete="off"
          value={keys[provider]} placeholder={configured ? 'Saved — enter replacement' : label}
          disabled={busy || (dirty !== null && dirty !== provider)}
          onFocus={() => setEditingField(true)} onBlur={() => setEditingField(false)}
          onChange={event => { setKeys(current => ({ ...current, [provider]: event.target.value })); edit(provider) }} />
        {configured && <button type="button" className="access-key-status" disabled={busy || dirty !== null}
          aria-label={`Delete ${label}`} title="Saved key · delete" onClick={() => setRemoving(provider)}>
          <span className="access-key-saved" aria-hidden="true">•</span><span className="access-key-delete" aria-hidden="true">×</span>
        </button>}
        {configured && <button type="button" className={`access-key-check ${checks[provider] ?? ''}`}
          disabled={busy || dirty !== null} aria-label={provider === 'custom' ? 'Check connection' : `Check ${label}`}
          title={checks[provider] === 'valid' ? 'Validated' : checks[provider] === 'invalid' ? 'Validation failed' : 'Check credential'}
          onClick={() => void run(() => check(provider))}>{checks[provider] === 'valid' ? '✓' : checks[provider] === 'invalid' ? '×' : checks[provider] === 'checking' ? '…' : '↻'}</button>}
      </div>
      {removing === provider && <div role="alert">
        <p>Delete the saved {label}?</p>
        <button type="button" className="btn danger" disabled={busy} onClick={() => void run(() => save(provider, true))}>Delete key</button>
        <button type="button" className="btn" disabled={busy} onClick={() => setRemoving(null)}>Cancel</button>
      </div>}
    </div>
  }
  if (!connection || !access || !endpoint) return <div role="status">
    {error ? <><p role="alert">{error}</p><button className="btn" onClick={() => void run(read)}>Retry AI access</button></> : 'Loading AI access…'}
  </div>
  const locked = busy || dirty !== null
  const routes: { id: ConnectionRoute; label: string }[] = [
    { id: 'hosted', label: 'Hosted sign-in' }, { id: 'openrouter', label: 'API keys' }, { id: 'custom', label: 'Custom URL' },
  ]
  return <section className="account-settings">
    <div className="access-tabs" role="tablist" aria-label="Use for AI requests" onKeyDown={event => {
      const tabs = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'))
      const index = tabs.indexOf(document.activeElement as HTMLButtonElement)
      const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length : event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : null
      if (next !== null) { event.preventDefault(); tabs[next]?.focus() }
    }}>
      {routes.map(route => <button key={route.id} id={`access-tab-${route.id}`} type="button" role="tab"
        aria-selected={connection.route === route.id} aria-controls={`access-panel-${route.id}`}
        tabIndex={connection.route === route.id ? 0 : -1} disabled={locked} onClick={() => {
          if (connection.route === route.id) return
          void run(async () => {
            await invoke('select_route', { expectedRevision: connection.revision, route: route.id })
            await read(); await onChanged()
          })
        }}><span className="access-route-indicator" aria-hidden="true" />{route.label}</button>)}
    </div>
    <div className="access-route-panel" role="tabpanel" id={`access-panel-${connection.route}`}
      aria-labelledby={`access-tab-${connection.route}`} tabIndex={0}>
    {connection.route === 'hosted' && <div className="form-row">
      <label>SkellySpeak account</label><p>{connection.signedIn ? connection.email : 'Not signed in'}</p>
      <button className="btn" disabled={locked} onClick={() => void run(async () => {
        if (connection.signedIn) { await invoke('hosted_sign_out', { expectedRevision: connection.revision }); setAccount(null) }
        else setAccount(await invoke<HostedAccount>('hosted_sign_in'))
        await read(); await onChanged()
      })}>{connection.signedIn ? 'Sign out' : 'Sign in with Google'}</button>
      {connection.signedIn && <button className="btn" disabled={locked} onClick={() => void run(async () => setAccount(await invoke<HostedAccount>('hosted_account')))}>Refresh account</button>}
      {account && <p>{account.usedUsd.toFixed(4)} / {account.limitUsd.toFixed(4)} USD · {account.tokensToday} tokens · {account.requestsToday} requests</p>}
    </div>}
    {connection.route === 'openrouter' && <>
      {credential('openrouter', 'OpenRouter API key', connection.ownKeyConfigured)}
      {credential('groq', 'Groq API key', access.groqKeyConfigured)}
      <details><summary>Models</summary>{(['standardModel', 'fastModel'] as const).map(key =>
        <div className="form-row" key={key}><label htmlFor={`access-${key}`}>{key === 'standardModel' ? 'Standard model' : 'Fast model'}</label>
          <input id={`access-${key}`} className="field" value={models[key]} onFocus={() => setEditingField(true)} onBlur={() => setEditingField(false)} disabled={busy || (dirty !== null && dirty !== 'openrouter')}
            onChange={event => { setModels(current => ({ ...current, [key]: event.target.value })); edit('openrouter') }} /></div>)}</details>
    </>}
    {connection.route === 'custom' && <>
      <div className="form-row"><label htmlFor="access-url">Server address</label>
        <input id="access-url" className="field" value={endpoint.baseUrl} onFocus={() => setEditingField(true)} onBlur={() => setEditingField(false)} disabled={busy}
          placeholder="https://your-server.example/v1" onChange={event => { setEndpoint({ ...endpoint, baseUrl: event.target.value }); edit('custom') }} />
        <InfoTip>Self-hosted SkellySpeak server. Include /v1. HTTPS is required except on loopback.</InfoTip>
      </div>
      <div className="form-row check-row"><label className="check-label"><input type="checkbox" checked={endpoint.bearerAuth} disabled={busy}
        onChange={event => { setEndpoint({ ...endpoint, bearerAuth: event.target.checked }); edit('custom') }} />Use server session token</label></div>
      {credential('custom', 'Server session token', access.customKeyConfigured)}
      <details><summary>Models</summary>{(['standardModel', 'fastModel', 'transcriptionModel'] as const).map(key =>
        <div className="form-row" key={key}><label htmlFor={`custom-${key}`}>{key === 'standardModel' ? 'Standard model' : key === 'fastModel' ? 'Fast model' : 'Transcription model'}</label>
          <input id={`custom-${key}`} className="field" value={endpoint[key] ?? ''} disabled={busy}
            onFocus={() => setEditingField(true)}
            onBlur={() => { setEndpoint(current => current && ({ ...current, [key]: current[key]?.trim() || (key === 'transcriptionModel' ? CUSTOM_TRANSCRIPTION_MODEL : CUSTOM_CHAT_MODEL) })); setEditingField(false) }}
            onChange={event => { setEndpoint({ ...endpoint, [key]: event.target.value }); edit('custom') }} /></div>)}</details>
      {!access.customKeyConfigured && <button className="btn" disabled={locked} onClick={() => void run(() => check('custom'))}>Check connection</button>}
    </>}
    </div>
    {dirty && <div className="access-pending"><span role="status">{busy ? 'Saving…' : editingField ? 'Editing — saves when you leave the field' : 'Unsaved changes'}</span><button type="button" className="btn" disabled={busy} title="Discard unsaved edits; saved credentials are kept" onClick={discard}>Discard changes</button></div>}
    {error && <div role="alert">{error}{dirty && <button className="btn" disabled={busy} onClick={() => void run(() => save(dirty))}>Retry save</button>}</div>}
    {status && <p role="status">{status}</p>}
  </section>
}
