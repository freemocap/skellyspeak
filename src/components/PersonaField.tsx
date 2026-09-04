import { useCallback, useEffect, useState } from 'react'
import { isTauri, listPersonas, type Persona } from '../lib/tauri'
import { reportFault } from '../lib/faults'
import { PersonaModal } from './PersonaModal'

/// Matches `personas::SURPRISE` in the core, which resolves it from the chat id.
const SURPRISE = 'surprise'

interface PersonaFieldProps {
  value: string
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
export function PersonaField({ value, onChange }: PersonaFieldProps) {
  const [personas, setPersonas] = useState<Persona[] | null>(null)
  const [open, setOpen] = useState(false)

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

  // No list, no picker — rendering an empty select would invite someone to
  // pick a partner that does not exist.
  if (!personas) return null

  // The stored id can name a persona that has since been deleted. The core
  // treats that as "pick someone", and the picker has to say the same thing
  // rather than showing a blank select.
  const selected = personas.some((p) => p.id === value) ? value : SURPRISE

  return (
    <>
      <div className="steer-row persona-row">
        <label className="persona-label" htmlFor="persona-select">
          Persona:
        </label>
        <select
          id="persona-select"
          className="steer-select persona"
          value={selected}
          onChange={(e) => onChange(e.target.value)}
          title="Who you are practising with. Changing this starts a new conversation — the current one is archived."
        >
          <option value={SURPRISE}>Surprise me — someone new each conversation</option>
          {personas.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
              {p.builtin ? '' : ' (yours)'}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="steer-dice persona-open"
          onClick={() => setOpen(true)}
          title="Read who you are talking to, or write your own persona"
          aria-label="Open the persona panel"
        >
          ⚙
        </button>
      </div>
      {open && (
        <PersonaModal
          personas={personas}
          selectedId={selected}
          onClose={() => setOpen(false)}
          onChanged={refresh}
          onUse={onChange}
        />
      )}
    </>
  )
}
