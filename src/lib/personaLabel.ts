import type { Persona } from './tauri'

export function personaLabel(persona: Persona): string {
  if (!persona.builtin) return persona.label
  const label = persona.label.replace(/^The /, '')
  return label.charAt(0).toUpperCase() + label.slice(1)
}
