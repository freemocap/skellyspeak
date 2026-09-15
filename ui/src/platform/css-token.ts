/// The value a design token resolves to, for the few consumers that cannot read
/// `var()` themselves: canvas drawing and Web Animations keyframes. Everything
/// else references the token in CSS. Throws when the token is missing, so a
/// renamed token fails at first use instead of painting nothing.
export function cssToken(name: `--${string}`): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  if (!value) throw new Error(`Design token ${name} is not defined; declare it in src/styles/tokens.css`)
  return value
}
