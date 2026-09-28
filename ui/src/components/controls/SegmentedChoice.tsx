/** One of a few options, shown as joined buttons with the chosen one raised.
 * Each option is `[value, label, tooltip?, disabled?]`; `disabled` on the group
 * disables every option. The group is named by `label`; where a visible label
 * sits is the caller's layout. */
export function SegmentedChoice<T extends string>({ label, value, options, disabled, onChange }: {
  label: string; value: T; options: readonly (readonly [T, string, string?, boolean?])[]; disabled?: boolean; onChange: (value: T) => void
}) {
  return <div className="segmented" role="radiogroup" aria-label={label}>
    {options.map(([option, text, title, optionDisabled]) => <button key={option} type="button" role="radio" aria-checked={value === option} title={title}
      disabled={disabled || optionDisabled} onClick={() => onChange(option)}>{text}</button>)}
  </div>
}
