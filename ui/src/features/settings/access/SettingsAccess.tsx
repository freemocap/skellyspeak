import { ErrorNotice } from '../../../components/feedback/ErrorNotice'
import { errorMessage as message } from '../../../platform/diagnostics/error-details'
import { useI18n } from '../../../components/localization/i18n'
import { ConnectionHealthPanel } from './ConnectionHealthPanel'
import { useConnectionHealth } from '../../../state/session/connection-health'
import { InfoTip } from '../../../components/controls/InfoTip'
import { useEffect, useRef, useState } from 'react'
import { invoke } from '../../../platform/ipc/native'
import type { AccessCheck, AccessSettings, ConnectionConfig, ConnectionRoute, CustomEndpoint, HostedAccount } from '../../../generated/contracts'



function credentialPreview(value: string): string {
  const chars = Array.from(value.trim())
  return chars.length > 10 ? `${chars.slice(0, 5).join('')}***${chars.slice(-5).join('')}` : '***'
}

/** Native configuration owns revisions and returns only masked saved credentials. */
export function SettingsAccess({ onBusyChange, onChanged, refreshKey = 0 }: {
  onBusyChange: (busy: boolean) => void
  onChanged: () => Promise<void>
  refreshKey?: number
}) {
  const tr = useI18n()
  const customHealth = useConnectionHealth(state => state.routes.custom)
  const [connection, setConnection] = useState<ConnectionConfig | null>(null)
  const [access, setAccess] = useState<AccessSettings | null>(null)
  const [endpoint, setEndpoint] = useState<CustomEndpoint | null>(null)
  const [keys, setKeys] = useState({ custom: '' })
  const [dirty, setDirty] = useState<'custom' | null>(null)
  const [editingField, setEditingField] = useState(false)
  const [busy, setBusy] = useState(false)
  const [signingIn, setSigningIn] = useState(false)
  const [cancellingSignIn, setCancellingSignIn] = useState(false)
  const pendingSignIn = useRef(false)
  const [localAvailable, setLocalAvailable] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState('')
  const [account, setAccount] = useState<HostedAccount | null>(null)
  const [removing, setRemoving] = useState<'custom' | null>(null)
  const writing = useRef(false)
  const savedDraft = useRef<{ endpoint: CustomEndpoint } | null>(null)

  useEffect(() => () => {
    if (pendingSignIn.current) {
      // The IPC adapter records cancellation failures even after this view closes.
      void invoke('cancel_sign_in').catch(() => {})
    }
  }, [])

  async function cancelSignIn() {
    setCancellingSignIn(true)
    try { await invoke('cancel_sign_in') }
    catch (error) { setError(message(error)) }
    finally { setCancellingSignIn(false) }
    // Keep the form locked until hosted_sign_in settles and releases its permit.
  }

  async function read() {
    const [nextConnection, nextAccess, local] = await Promise.all([
      invoke<ConnectionConfig>('get_connection'), invoke<AccessSettings>('get_access_settings'),
      invoke<boolean>('local_server_available'),
    ])
    setLocalAvailable(local)
    const custom = nextAccess.custom
    setConnection(nextConnection); setAccess(nextAccess)
    const displayedEndpoint = custom
    setEndpoint(displayedEndpoint)
    savedDraft.current = { endpoint: displayedEndpoint }
  }
  useEffect(() => { void read().catch(error => setError(message(error))) }, [refreshKey])
  useEffect(() => { onBusyChange(busy || dirty !== null); return () => onBusyChange(false) }, [busy, dirty, onBusyChange])

  useEffect(() => {
    const saved = savedDraft.current
    if (!dirty || busy || !saved) return
    const changed = keys[dirty].trim() !== '' || (dirty === 'custom' && JSON.stringify(endpoint) !== JSON.stringify(saved.endpoint))
    if (!changed) { setDirty(null); setError(null) }
  }, [dirty, busy, keys, endpoint])

  function discard() {
    const saved = savedDraft.current
    if (busy || !saved) return
    setEndpoint(saved.endpoint)
    setKeys({ custom: '' })
    setDirty(null); setError(null); setStatus('Changes discarded'); setEditingField(false)
  }

  async function run(action: () => Promise<void>) {
    if (writing.current) return
    writing.current = true; setBusy(true); setError(null); setStatus('')
    try { await action() }
    catch (error) { setError(message(error)) }
    finally { writing.current = false; setBusy(false) }
  }
  async function save(provider: 'custom', removeToken = false) {
    if (!connection || !access || !endpoint) throw new Error('AI access has not loaded.')
    await invoke('save_access_settings', {
      expectedRevision: access.revision, custom: endpoint,
      sessionToken: removeToken ? null : keys.custom.trim() || null, removeToken,
    })
    setKeys(current => ({ ...current, [provider]: '' }))
    setDirty(null); setRemoving(null)
    await read(); await onChanged(); setStatus('Saved')
  }
  useEffect(() => {
    if (!dirty || busy || editingField || error) return
    const timer = setTimeout(() => void run(() => save(dirty)), 500)
    return () => clearTimeout(timer)
  }, [dirty, keys, endpoint, editingField, busy, error])

  function edit(provider: 'custom') { setDirty(provider); setError(null); setStatus('') }
  async function check() {
    if (!connection || !access) throw new Error('AI access has not loaded.')
    let checkedRevision = access.revision
    useConnectionHealth.getState().begin('custom', checkedRevision)
    try {
      let current = access
      if (access.customUrlIsUnsavedDefault) {
        if (!endpoint) throw new Error('Custom endpoint has not loaded.')
        current = await invoke<AccessSettings>('save_access_settings', { expectedRevision: access.revision, custom: endpoint, sessionToken: null, removeToken: false })
        setAccess(current); await onChanged()
      }
      checkedRevision = current.revision
      const result = await invoke<AccessCheck>('check_access', { expectedRevision: current.revision })
      useConnectionHealth.getState().record('custom', current.revision, undefined, result)
    } catch (error) {
      useConnectionHealth.getState().record('custom', checkedRevision, error)
      throw error
    }
  }

  async function connectLocal() {
    if (!access) throw new Error('AI access has not loaded.')
    const saved = await invoke<AccessSettings>('connect_local_server', { expectedRevision: access.revision })
    setKeys(current => ({ ...current, custom: '' }))
    await read(); await onChanged()
    useConnectionHealth.getState().begin('custom', saved.revision)
    try {
      const result = await invoke<AccessCheck>('check_access', { expectedRevision: saved.revision })
      useConnectionHealth.getState().record('custom', saved.revision, undefined, result)
    } catch (error) {
      useConnectionHealth.getState().record('custom', saved.revision, error)
      throw error
    }
  }

  function credential(provider: 'custom', label: string, configured: boolean) {
    return <div className="form-row">
      <label htmlFor={`access-${provider}`}>{label}</label>
      <div className="key-row">
        <input data-reading-private id={`access-${provider}`} className="key-input" type="password" autoComplete="off"
          value={keys[provider]} placeholder={access?.credentialPreviews?.[provider] ?? (configured ? tr("Saved — enter replacement") : label)}
          disabled={busy || (dirty !== null && dirty !== provider)}
          onFocus={() => setEditingField(true)} onBlur={() => { setKeys(current => ({ ...current, [provider]: current[provider].trim() })); setEditingField(false) }}
          onChange={event => { setKeys(current => ({ ...current, [provider]: event.target.value.trim() })); edit(provider) }} />
        {configured && <button type="button" className="access-key-status" disabled={busy || dirty !== null}
          aria-label={tr("Delete {value0}", { value0: String(label) })} title={tr("Saved token · delete")} onClick={() => setRemoving(provider)}>
          <span className="access-key-saved" aria-hidden="true">•</span><span className="access-key-delete" aria-hidden="true">×</span>
        </button>}

      </div>
      {keys[provider].trim() && <output aria-label={tr('{label} preview', { label })}>{credentialPreview(keys[provider])}</output>}
      {removing === provider && <div role="alert">
        <p>{tr('Delete the saved {label}?', { label })}</p>
        <button type="button" className="btn danger" disabled={busy} onClick={() => void run(() => save(provider, true))}>{tr("Delete token")}</button>
        <button type="button" className="btn" disabled={busy} onClick={() => setRemoving(null)}>{tr("Cancel")}</button>
      </div>}
    </div>
  }
  if (!connection || !access || !endpoint) return <div role="status">
    {error ? <><ErrorNotice as="p" error={error}>{error}</ErrorNotice><button className="btn" onClick={() => void run(read)}>{tr("Retry AI access")}</button></> : tr("Loading AI access…")}
  </div>
  const locked = busy || dirty !== null
  const health = customHealth?.revision === access.revision && !dirty ? customHealth : undefined
  const healthLabel = health?.status === 'connected' ? tr('Connected') : health?.status === 'checking' ? tr('Checking…')
    : health?.status === 'disconnected' ? tr('Not connected') : tr('Not checked')
  const routes: { id: ConnectionRoute; label: string }[] = [
    { id: 'hosted', label: tr('Hosted sign-in') }, { id: 'custom', label: tr('Custom URL') },
  ]
  return <section className="account-settings">
    <p>{tr('AI access')}</p>
    <div className="access-tabs" role="tablist" aria-label={tr("AI access")} onKeyDown={event => {
      const tabs = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'))
      const index = tabs.indexOf(document.activeElement as HTMLButtonElement)
      const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length : event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : null
      if (next !== null) { event.preventDefault(); tabs[next]?.focus() }
    }}>
      {routes.map(route => <button key={route.id} id={`access-tab-${route.id}`} type="button" role="tab"
        aria-label={route.label} aria-selected={connection.route === route.id} aria-controls={`access-panel-${route.id}`}
        tabIndex={connection.route === route.id ? 0 : -1} disabled={locked} onClick={() => {
          if (connection.route === route.id) return
          void run(async () => {
            await invoke('select_route', { expectedRevision: connection.revision, route: route.id })
            await read(); await onChanged()
          })
        }}><span className="access-route-indicator" aria-hidden="true" />{route.label}
          {route.id === 'custom' && <span className="access-health" data-health={health?.status ?? 'unchecked'}>{healthLabel}</span>}</button>)}
    </div>
    <div className="access-route-panel" role="tabpanel" id={`access-panel-${connection.route}`}
      aria-labelledby={`access-tab-${connection.route}`} tabIndex={0}>
    {connection.route === 'hosted' && <div className="form-row">
      <label>{tr("SkellySpeak account")}</label><p>{connection.signedIn ? connection.email : tr("Not signed in")}</p>
      <button className="btn" disabled={locked} onClick={() => void run(async () => {
        if (connection.signedIn) { await invoke('hosted_sign_out', { expectedRevision: connection.revision }); setAccount(null) }
        else {
          pendingSignIn.current = true; setSigningIn(true)
          try { setAccount(await invoke<HostedAccount>('hosted_sign_in')) }
          finally { pendingSignIn.current = false; setSigningIn(false) }
        }
        await read(); await onChanged()
      })}>{connection.signedIn ? tr("Sign out") : tr("Sign in with Google")}</button>
      {signingIn && <>
        <p role="status">{tr("Waiting for sign-in to finish…")}</p>
        <button type="button" className="btn" disabled={cancellingSignIn} onClick={() => void cancelSignIn()}>{tr("Cancel sign-in")}</button>
      </>}
      {connection.signedIn && <button className="btn" disabled={locked} onClick={() => void run(async () => setAccount(await invoke<HostedAccount>('hosted_account')))}>{tr("Refresh account")}</button>}
      {account && <p>{tr.number(account.usedUsd, { minimumFractionDigits: 4, maximumFractionDigits: 4 })} / {tr.number(account.limitUsd, { minimumFractionDigits: 4, maximumFractionDigits: 4 })} {tr(" USD · ")}{tr.number(account.tokensToday)} {tr(" tokens · ")}{tr.number(account.requestsToday)} {tr(" requests")}</p>}
    </div>}
    {connection.route === 'custom' && <>
      {localAvailable && <button type="button" className="btn primary access-local-connect" disabled={locked}
        onClick={() => void run(connectLocal)}>{tr('Connect to local server')}</button>}
      {localAvailable && <button className="btn" disabled={locked} onClick={() => void run(async () => { await invoke('open_local_admin') })}>{tr('Open local admin')}</button>}
      <ConnectionHealthPanel health={health} bearerAuth={endpoint.bearerAuth} disabled={locked}
        onCheck={() => void run(() => check())} />
      <div className="form-row"><label htmlFor="access-url">{tr("Server address")}</label>
        <input id="access-url" className="field" value={endpoint.baseUrl} onFocus={() => setEditingField(true)} onBlur={() => setEditingField(false)} disabled={busy}
          data-reading-private placeholder={tr("https://your-server.example/v1")} onChange={event => { setEndpoint({ ...endpoint, baseUrl: event.target.value }); edit('custom') }} />
        <InfoTip>{tr("Self-hosted SkellySpeak server. Include /v1. HTTPS is required except on loopback.")}</InfoTip>
      </div>
      <div className="form-row check-row"><label className="check-label"><input type="checkbox" checked={endpoint.bearerAuth} disabled={busy}
        onChange={event => { setEndpoint({ ...endpoint, bearerAuth: event.target.checked }); edit('custom') }} />{tr("Use server session token")}</label></div>
      {credential('custom', tr('Server session token'), access.customKeyConfigured)}
    </>}
    </div>
    {dirty && <div className="access-pending"><span role="status">{busy ? tr("Saving…") : editingField ? tr("Editing — saves when you leave the field") : tr("Unsaved changes")}</span><button type="button" className="btn" disabled={busy} title={tr("Discard unsaved edits; saved credentials are kept")} onClick={discard}>{tr("Discard changes")}</button></div>}
    {error && <ErrorNotice as="div" error={error}>{error}{dirty && <button className="btn" disabled={busy} onClick={() => void run(() => save(dirty))}>{tr("Retry save")}</button>}</ErrorNotice>}
    {status && <p role="status">{tr(status)}</p>}
  </section>
}
