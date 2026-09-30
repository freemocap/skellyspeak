/** A selectable bubble's selection ring: a line just outside the bubble that
 * follows its tail, drawn by the stream bubble's stylesheet while the bubble is
 * selected or has keyboard focus. It is decoration; the bubble itself carries
 * the selected state. */
export function SelectionRing() {
  return <span className="msg-selection" aria-hidden="true" />
}
