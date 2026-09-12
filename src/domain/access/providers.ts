/// Does this failure mean "go to Settings and configure a provider"?
///
/// Every such message the core produces says so in words — "Add one in
/// Settings", "Open Settings and choose one under AI provider" — because it is
/// written for a person to read. Matching on that is more durable than listing
/// the messages here and letting the two drift apart.
export function needsProviderSetup(message: string): boolean {
  return /\bSettings\b/.test(message)
}
