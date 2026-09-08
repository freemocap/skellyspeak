/** Reward arrivals highlight both the domain arm and its progress bar. */
export function pulseRewardDomain(scope: HTMLElement, domainId: string): Animation[] {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  return Array.from(scope.querySelectorAll('[data-reward-domain]'))
    .filter(element => element.getAttribute('data-reward-domain') === domainId)
    .map(element => element.animate([
      { filter: 'brightness(1)' },
      { filter: 'brightness(1.8) drop-shadow(0 0 8px currentColor)', offset: .3 },
      { filter: 'brightness(1.8) drop-shadow(0 0 8px currentColor)', offset: .65 },
      { filter: 'brightness(1)' },
    ], { duration: reduced ? 0 : 800, easing: 'ease-out' }))
}
