/// Copied UI provider identifiers; integration owns mapping to rebuild access routes.
/// Credential visibility below still follows the old controller and must be adapted
/// before this screen is connected. It does not authorize native credential use.

export const HOSTED = 'hosted'
export const CLOUD = 'cloud'
export const CUSTOM = 'custom'

/// The credentials a user can be asked for.
export type Credential = 'openrouter' | 'groq' | 'custom'

/// Legacy credential-field visibility, pending rebuild controller integration.
/// Custom URL means a self-hosted SkellySpeak server with its own session token;
/// it must not fall back to OpenRouter/Groq credentials. The current legacy branch
/// still displays those fields and is recorded as an integration mismatch.
export function usesCredential(mode: string, credential: Credential): boolean {
  switch (mode) {
    case HOSTED:
      return false
    case CLOUD:
      return credential !== 'custom'
    case CUSTOM:
      return true
    default:
      // An unrecognised mode is a bug, not a state to design around — but the
      // settings screen is where someone would go to fix it, so show
      // everything rather than presenting an empty panel.
      return true
  }
}

/// Does this failure mean "go to Settings and configure a provider"?
///
/// Every such message the core produces says so in words — "Add one in
/// Settings", "Open Settings and choose one under AI provider" — because it is
/// written for a person to read. Matching on that is more durable than listing
/// the messages here and letting the two drift apart.
export function needsProviderSetup(message: string): boolean {
  return /\bSettings\b/.test(message)
}
