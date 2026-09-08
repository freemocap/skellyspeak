import { useCallback, useEffect, useState } from 'react'
import { invoke, isTauri, listPersonas, type Persona, type ConversationPartner } from '../lib/tauri'
import { reportFault } from '../lib/faults'
import { personaLabel } from '../lib/personaLabel'
import { PersonaModal } from './PersonaModal'

/// Matches `personas::SURPRISE` in the core, which resolves it from the chat id.
const SURPRISE = 'surprise'
const NONE = '__none__'

interface PersonaFieldProps {
  chatId: string | null
  /// Called with the chosen id. The caller starts a new conversation: the
  /// person you are mid-sentence with cannot turn into somebody else.
  onChange: (id: string) => void
}

/// Who the learner is talking to, and the way in to the persona editor.
///
/// The list comes from the core, which owns the personas because it builds the
/// prompt from them. A hardcoded copy here would be a second definition and
/// would go stale the first time a character is added — or the first time the
/// learner writes one.
export function PersonaField({ chatId, onChange }: PersonaFieldProps) {
  const [personas, setPersonas] = useState<Persona[] | null>(null)
  const [rolling, setRolling] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState<'details' | 'custom' | null>(null)
  const [saved, setSaved] = useState<{ chatId: string; partner: ConversationPartner } | null>(null)
  const partner = saved?.chatId === chatId ? saved.partner : null
  useEffect(() => {
    if (!isTauri || !chatId) return
    let active = true
    void invoke<ConversationPartner>('get_conversation_partner', { chatId }).then((p) => {
      if (active) setSaved({ chatId, partner: p })
    }).catch((e: unknown) => reportFault('Loading active partner', e))
    return () => { active = false }
  }, [chatId, open])

  const refresh = useCallback(async () => {
    if (!isTauri) return
    try {
      const list = await listPersonas()
      setPersonas(list.personas)
      // A personas file that could not be read reaches the screen. Their own
      // characters are missing and they are owed the reason.
      for (const fault of list.faults) reportFault('Personas', fault)
    } catch (e) {
      reportFault('Loading conversation partners', e)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  if (!personas || (chatId && !partner)) return null
  const selected = partner?.persona.id ?? NONE

  return (
    <section className="persona-config" aria-label="Persona settings">
      <div className="steer-row persona-row">
      <label className="persona-toggle"><input type="checkbox" checked={selected !== NONE} disabled={rolling} onChange={(event) => onChange(event.target.checked ? SURPRISE : NONE)} /> Persona</label>

      <>
        <select
          id="persona-select"
          aria-label="Partner:"
          className="steer-select persona"
          disabled={rolling}
          value={partner ? '__current__' : '__choose__'}
          onChange={(e) => { if (e.target.value === '__custom__') setOpen('custom'); else onChange(e.target.value) }}
          title="Who you are practising with. Changing this starts a new conversation — the current one is archived."
        >
          {partner ? <option value="__current__">{personaLabel(partner.persona)} (current conversation)</option>
            : <option value="__choose__" disabled>Choose a partner (new conversation)</option>}
          <option value={NONE}>No persona (new conversation)</option>
          <option value={SURPRISE}>Surprise me (new conversation)</option>
          <option value="__custom__">Custom persona…</option>
          {personas.map((p) => (
            <option key={p.id} value={p.id}>
              {personaLabel(p)}
              {p.builtin ? '' : ' (yours)'}
            </option>
          ))}
        </select>

        <button type="button" className="steer-dice" disabled={rolling || !chatId} aria-label="Reroll persona" title="Choose a different persona and start a new conversation" onClick={() => {
          setRolling(true); setError(null)
          void invoke<Persona>('reroll_persona', { chatId }).then((p) => onChange(p.id)).catch((e: unknown) => setError(String(e))).finally(() => setRolling(false))
        }}>🎲</button>
        <button
          type="button"
          className="steer-dice persona-open"
          disabled={!partner}
          onClick={() => setOpen('details')}
          title="Read who you are talking to, or write your own persona"
          aria-label="Open the persona panel"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m16 3 5 5L8 21H3v-5Z" /><path d="m14 5 5 5M3 16l5 5" /></svg>
        </button>
      </>
      </div>
      {error && <p role="alert">{error}</p>}

      {open && partner && (
        <PersonaModal
          startCreating={open === 'custom'}
          personas={personas}
          selectedId={selected}
          partner={partner}
          onClose={() => setOpen(null)}
          onChanged={refresh}
          onUse={onChange}
        />
      )}
    </section>
  )
}
