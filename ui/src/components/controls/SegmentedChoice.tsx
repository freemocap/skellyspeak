/** One of a few options, shown as joined buttons with the chosen one raised.
 * Each option is `[value, label, tooltip?]`. The group is named by `label`;
 * where a visible label sits is the caller's layout. */
export function SegmentedChoice<T extends string>({ label, value, options, disabled, onChange }: {
  label: string; value: T; options: readonly (readonly [T, string, string?])[]; disabled?: boolean; onChange: (value: T) => void
}) {
  return <div className="segmented" role="radiogroup" aria-label={label}>
    {options.map(([option, text, title]) => <button key={option} type="button" role="radio" aria-checked={value === option} title={title}
      disabled={disabled} onClick={() => onChange(option)}>{text}</button>)}
  </div>
}
