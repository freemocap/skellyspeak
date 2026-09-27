/** Older embedded WebViews need an ordinary fixed portal instead of the top layer. */
export function supportsPopover() {
  return typeof HTMLElement.prototype.showPopover === 'function'
    && typeof HTMLElement.prototype.hidePopover === 'function'
}
