# Credential handling

Decision: retain the operating system credential store for saved provider keys and
hosted sessions. No plaintext-file alternative, custom encryption scheme or
session-only storage mode is implemented. A session-only default was discussed
and withdrawn; it was not a recommendation established by the cited guidance.

## Authoritative guidance and its application

- [Apple: Using the keychain to manage user secrets](https://developer.apple.com/documentation/security/using-the-keychain-to-manage-user-secrets)
  describes storing, retrieving, updating and deleting application credentials.
  SkellySpeak uses platform credential APIs, with its own service namespace and
  opaque entry IDs. This is not a request to enumerate unrelated passwords.
- [Apple: Access control lists](https://developer.apple.com/documentation/security/access-control-lists)
  describes access approval for individual macOS keychain items. Repeated prompts
  need investigation of the requesting executable and item access controls. Do not
  disable access controls or grant all applications access to resolve a prompt.
- [Groq: Security onboarding](https://console.groq.com/docs/production-readiness/security-onboarding)
  recommends environment variables or a secret-management system, prohibits
  embedding keys in frontend bundles, and requires verified TLS for provider traffic.
  Provider requests originate in Rust. No application-owned provider key is shipped
  to clients; own-key mode uses the learner's independently supplied credential.
- [OWASP: Secrets management](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)
  covers least privilege, revocation, safe logging and minimizing plaintext lifetime.
  These are requirements to apply to the relevant deployment; the guide does not
  mandate a six-character mask or session-only desktop storage.

## Implemented boundary

Keys enter through password inputs. Saved values are not returned to React, and
there is no Show/Hide control. Settings report only whether a key is saved.
SQLite holds opaque credential references, not full keys or prefix/suffix copies.
Rust uses zeroizing buffers for credential reads; this reduces plaintext lifetime
but does not promise erasure of every allocation made by the UI, IPC or HTTP stack.
Provider error bodies and authorization headers are not exposed in diagnostics.

Hosted, OpenRouter, Groq and custom credentials remain distinct. Explicit no-auth
custom endpoints send no Authorization header even if a custom key is saved.
Provider requests use HTTPS with certificate validation. Custom endpoints require
HTTPS except intentionally configured loopback HTTP. Redirects are refused.
The loopback transport exception is an application design decision for local
services, not a claim that the provider guidance endorses plaintext remote traffic.

New credential writes have persisted cleanup intents. In-progress native writes
are excluded from concurrent cleanup; failed/orphaned writes remain recoverable
on restart. Changing a credential revokes affected unpublished work.

## Verification limits

Automated tests cover route/credential isolation, no-auth requests, redirects,
redacted errors and saved-key UI behavior. They do not establish the requesting
native executable's effective Keychain access controls. The signed development
launcher is available; repeated prompts still need native verification. Do not
claim certification or complete security compliance from passing these tests.

## Validation messages

Known input-format errors identify the correctable problem (for example, internal
whitespace). Other format failures use “Invalid API key.” Provider rejection does
not speculate about key ownership or account state. Network and rate-limit failures
remain distinct from rejection. Never include the submitted key or raw provider
response in these messages. These choices apply
[W3C error-suggestion guidance](https://www.w3.org/WAI/WCAG21/Understanding/error-suggestion.html)
and [OWASP error-handling guidance](https://cheatsheetseries.owasp.org/cheatsheets/Error_Handling_Cheat_Sheet.html).
An unsaved entry can be cleared without deleting a saved credential; saved-key
removal requires confirmation.
