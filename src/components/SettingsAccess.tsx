import { useEffect, useRef, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import type { AccessSettings, ConnectionConfig, ConnectionRoute, CustomEndpoint, HostedAccount } from '../contracts'

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
  const [editingKey, setEditingKey] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState('')
  const [account, setAccount] = useState<HostedAccount | null>(null)
  const [removing, setRemoving] = useState<'openrouter' | 'groq' | 'custom' | null>(null)
  const writing = useRef(false)

  async function read() {
    const [nextConnection, nextAccess] = await Promise.all([
      invoke<ConnectionConfig>('get_connection'), invoke<AccessSettings>('get_access_settings'),
    ])
    setConnection(nextConnection); setAccess(nextAccess); setEndpoint(nextAccess.custom)
    setModels({ standardModel: nextConnection.standardModel, fastModel: nextConnection.fastModel })
  }
  useEffect(() => { void read().catch(error => setError(message(error))) }, [])
  useEffect(() => { onBusyChange(busy || dirty !== null); return () => onBusyChange(false) }, [busy, dirty, onBusyChange])

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
    if (!dirty || busy || editingKey || error) return
    const timer = setTimeout(() => void run(() => save(dirty)), 500)
    return () => clearTimeout(timer)
  }, [dirty, keys, endpoint, models, editingKey, busy, error])

  function edit(provider: 'openrouter' | 'groq' | 'custom') { setDirty(provider); setError(null); setStatus('') }
  async function check(provider: 'openrouter' | 'groq' | 'custom') {
    if (!connection || !access) throw new Error('AI access has not loaded.')
    if (provider === 'openrouter') {
      await invoke('verify_openrouter_key', { apiKey: null, expectedRevision: connection.revision })
      setStatus('OpenRouter key valid')
    } else setStatus(await invoke<string>('check_access', { expectedRevision: access.revision, custom: provider === 'custom' }))
  }
  function credential(provider: 'openrouter' | 'groq' | 'custom', label: string, configured: boolean) {
    return <div className="form-row">
      <label htmlFor={`access-${provider}`}>{label}</label>
      <div className="key-row">
        <input id={`access-${provider}`} className="key-input" type="password" autoComplete="off"
          value={keys[provider]} placeholder={configured ? 'Saved — enter replacement' : label}
          disabled={busy || (dirty !== null && dirty !== provider)}
          onFocus={() => setEditingKey(true)} onBlur={() => setEditingKey(false)}
          onChange={event => { setKeys(current => ({ ...current, [provider]: event.target.value })); edit(provider) }} />
        <span aria-label={configured ? `${label} saved` : `${label} not saved`}>{configured ? 'Saved' : 'Not saved'}</span>
        {configured && <button type="button" className="btn tiny" disabled={busy || dirty !== null}
          onClick={() => setRemoving(provider)}>Delete key</button>}
      </div>
      {configured && <button type="button" className="btn tiny" disabled={busy || dirty !== null}
        onClick={() => void run(() => check(provider))}>{provider === 'custom' ? 'Check connection' : 'Check key'}</button>}
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
  return <>
    <div className="form-row"><label htmlFor="access-route">AI provider</label>
      <select id="access-route" value={connection.route} disabled={locked} onChange={event => {
        const route = event.target.value as ConnectionRoute
        void run(async () => {
          await invoke('select_route', { expectedRevision: connection.revision, route })
          await read(); await onChanged()
        })
      }}>
        <option value="hosted">Hosted sign-in</option><option value="openrouter">API keys</option>
        <option value="custom">Custom URL — self-hosted SkellySpeak server</option>
      </select>
    </div>
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
          <input id={`access-${key}`} className="field" value={models[key]} disabled={busy || (dirty !== null && dirty !== 'openrouter')}
            onChange={event => { setModels(current => ({ ...current, [key]: event.target.value })); edit('openrouter') }} /></div>)}</details>
    </>}
    {connection.route === 'custom' && <>
      <div className="form-row"><label htmlFor="access-url">Server address</label>
        <input id="access-url" className="field" value={endpoint.baseUrl} disabled={busy}
          placeholder="https://your-server.example/v1" onChange={event => { setEndpoint({ ...endpoint, baseUrl: event.target.value }); edit('custom') }} />
        <p className="field-note">Self-hosted SkellySpeak server. Include /v1. HTTPS is required except on loopback.</p>
      </div>
      <div className="form-row"><label className="check-label"><input type="checkbox" checked={endpoint.bearerAuth} disabled={busy}
        onChange={event => { setEndpoint({ ...endpoint, bearerAuth: event.target.checked }); edit('custom') }} />Use server session token</label></div>
      {credential('custom', 'Server session token', access.customKeyConfigured)}
      <details><summary>Models</summary>{(['standardModel', 'fastModel', 'transcriptionModel'] as const).map(key =>
        <div className="form-row" key={key}><label htmlFor={`custom-${key}`}>{key === 'standardModel' ? 'Standard model' : key === 'fastModel' ? 'Fast model' : 'Transcription model'}</label>
          <input id={`custom-${key}`} className="field" value={endpoint[key] ?? ''} disabled={busy}
            onChange={event => { setEndpoint({ ...endpoint, [key]: key === 'transcriptionModel' ? event.target.value || null : event.target.value }); edit('custom') }} /></div>)}</details>
      {!access.customKeyConfigured && <button className="btn" disabled={locked} onClick={() => void run(() => check('custom'))}>Check connection</button>}
    </>}
    {dirty && <p role="status">{busy ? 'Saving…' : 'Pending changes'}</p>}
    {error && <div role="alert">{error}{dirty && <button className="btn" disabled={busy} onClick={() => void run(() => save(dirty))}>Retry save</button>}</div>}
    {status && <p role="status">{status}</p>}
  </>
}
