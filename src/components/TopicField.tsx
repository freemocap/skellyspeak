import { useRef, useState } from 'react'

interface TopicFieldProps {
  topics: readonly string[]
  value: string
  onChange: (v: string) => void
}

/// Sentinel for the "type your own" entry. Not a real topic, and never stored
/// — picking it swaps the select for a text box.
const CUSTOM = '__custom__'

/// Topic steering: preset dropdown plus anything you care to type.
///
/// The text box appears only once custom is chosen, because this sits in the
/// compact steer row above the composer and a permanently visible input would
/// crowd out the level and dice controls. Follows the same preset-or-custom
/// shape as `DialectField`.
export function TopicField({ topics, value, onChange }: TopicFieldProps) {
  const isPreset = topics.includes(value)
  const [custom, setCustom] = useState(() => !!value && !isPreset)
  const inputRef = useRef<HTMLInputElement | null>(null)

  if (custom) {
    return (
      <span className="steer-topic-custom">
        <input
          ref={inputRef}
          className="steer-select topic"
          type="text"
          value={value}
          placeholder="Your own topic…"
          autoFocus
          onChange={(e) => onChange(e.target.value)}
          aria-label="Custom conversation topic"
          title="Topic steering — the tutor works the conversation toward this"
        />
        <button
          type="button"
          className="steer-dice"
          title="Back to the topic list"
          aria-label="Back to the topic list"
          onClick={() => {
            setCustom(false)
            // Leaving a half-typed topic in place would keep steering the
            // conversation toward something the list no longer shows.
            onChange('')
          }}
        >
          ↩
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
          onChange('')
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
