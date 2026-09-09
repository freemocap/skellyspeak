import { useEffect, useRef, useState } from 'react'

interface TopicFieldProps {
  topics: readonly string[]
  value: string
  onChange: (v: string) => void
}

/// Sentinel for the "type your own" entry. Not a real topic and never stored —
/// picking it swaps the select for a text box.
const CUSTOM = '__custom__'

/// Topic steering: preset dropdown, or anything you care to type.
///
/// The typed value is held locally and applied only on Enter (or the ✓, or
/// leaving the field). It is NOT applied per keystroke, because changing the
/// topic steers the live conversation — the tutor is told about it and works
/// the next reply toward it. Committing as you type would send half-written
/// topics: pause after "cook" while typing "cooking pasta" and the tutor is
/// steered toward "cook".
///
/// The text box appears only once custom is chosen. This sits in the compact
/// steer row above the composer, where a permanently visible input would crowd
/// out the level and dice controls.
export function TopicField({ topics, value, onChange }: TopicFieldProps) {
  const isPreset = topics.includes(value)
  const [custom, setCustom] = useState(() => !!value && !isPreset)
  const [draft, setDraft] = useState(value)
  const inputRef = useRef<HTMLInputElement | null>(null)
  // What has actually been applied. Tracked separately from `value` because
  // the parent re-renders a beat later: comparing against the stale prop let
  // one keypress apply the same topic twice.
  const applied = useRef(value)
  // Escape blurs the field, and blurring applies the draft — so the abandon
  // has to say so, or Escape commits the very thing it is cancelling.
  const abandoning = useRef(false)

  // A topic set from elsewhere — the dice, or a preset — replaces the draft.
  useEffect(() => {
    applied.current = value
    setDraft(value)
  }, [value])

  const commit = () => {
    const next = draft.trim()
    if (next === applied.current) return
    applied.current = next
    onChange(next)
  }

  if (custom) {
    const dirty = draft.trim() !== value
    return (
      <span className="steer-topic-custom">
        <input
          ref={inputRef}
          className={`steer-select topic${dirty ? ' unapplied' : ''}`}
          type="text"
          value={draft}
          placeholder="Your own topic — press Enter"
          autoFocus
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              commit()
              inputRef.current?.blur()
            }
            if (e.key === 'Escape') {
              e.preventDefault()
              abandoning.current = true
              setDraft(value)
              inputRef.current?.blur()
            }
          }}
          // Leaving the field applies it too: having typed a topic and clicked
          // away, the surprising outcome is the one where nothing happened.
          onBlur={() => {
            if (abandoning.current) {
              abandoning.current = false
              return
            }
            commit()
          }}
          aria-label="Custom conversation topic"
          title="Type a topic and press Enter — the tutor steers the conversation toward it"
        />
        <button
          type="button"
          className="steer-dice"
          title={dirty ? 'Apply this topic' : 'Topic applied'}
          aria-label="Apply this topic"
          disabled={!dirty}
          onMouseDown={(e) => e.preventDefault()} // keep focus so onBlur does not double-fire
          onClick={commit}
        >
          ✓
        </button>
        <button
          type="button"
          className="steer-dice"
          title="Back to the topic list"
          aria-label="Back to the topic list"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            setCustom(false)
            // Leaving a typed topic in place would keep steering the
            // conversation toward something the list no longer shows.
            setDraft('')
            if (applied.current !== '') {
              applied.current = ''
              onChange('')
            }
          }}
        >
          ✕
        </button>
      </span>
    )
  }

  return (
    <select
      className="steer-select topic"
      value={value}
      onChange={(e) => {
        if (e.target.value === CUSTOM) {
          setCustom(true)
          setDraft('')
          return
        }
        onChange(e.target.value)
      }}
      aria-label="Conversation topic"
      title="Topic steering — the tutor works the conversation toward this"
    >
      <option value="">Topic: anything</option>
      {topics.map((tp) => (
        <option key={tp} value={tp}>
          {tp}
        </option>
      ))}
      <option value={CUSTOM}>✎ Your own topic…</option>
    </select>
  )
}
