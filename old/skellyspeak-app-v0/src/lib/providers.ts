/// AI provider modes, mirroring the `PROVIDER_*` constants in
/// `src-tauri/src/settings.rs`.
///
/// Which credentials a mode actually uses is decided in Rust, by
/// `chat_provider`, `stt_endpoint` and `tts_endpoint`. This module says the
/// same thing for the Settings screen, so a field is on screen exactly when
/// the backend would ask for it. Getting that wrong is not cosmetic: hiding a
/// field the resolver demands leaves the user told to add a key in Settings on
/// a screen that will not show them the box.

export const HOSTED = 'hosted'
export const CLOUD = 'cloud'
export const CUSTOM = 'custom'

/// The credentials a user can be asked for.
export type Credential = 'openrouter' | 'groq' | 'custom'

/// Does this provider mode use this credential?
///
/// - **hosted** — none. The service proxies chat, speech-to-text and speech,
///   authenticated by the session token, which the user never sees or types.
/// - **cloud** — OpenRouter for chat and for cloud speech; Groq for
///   speech-to-text, because OpenRouter does not serve Whisper.
/// - **custom** — their own server for chat, and *still* OpenRouter for cloud
///   speech and Groq for speech-to-text, because a local Ollama serves
///   neither.
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
