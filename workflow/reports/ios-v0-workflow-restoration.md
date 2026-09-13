# Restore v0 iOS distribution

## Finding

Release v1.21.1, run 34772400503, iOS job 103765015119, successfully built,
archived and exported the signed IPA. The replacement verifier then failed:

> Could not extract value, error: No value at that key path or invalid key path: com.apple.developer.team-identifier

The helper passed a dotted entitlement name to plutil as a key path. This is
not evidence that archive/export failed or that the signature had the wrong team.
The previous signing-style fix got the workflow through export.

## Implemented

By explicit user request, restored the reference application's entire
`ios-distribute.yml` workflow. The reference is adapted only for Node 24 and the user-requested ordering:
TestFlight depends on successful release attachment. Manual TestFlight dispatch
requires a release tag.

The restored sequence stages the keychain/profile, injects manual signing,
writes ExportOptions, invokes Tauri's App Store export, checks the signature and
codesign TeamIdentifier, then uploads the artifact. Separate jobs attach the IPA
to its matching release and upload/process it in TestFlight. Tag and manual
triggers, cleanup and pinned actions are retained. No archived app is run.

Removed the integrated iOS job, its publication gate and unused TypeScript
signing helper. Desktop/Android publication and iOS distribution are independent,
as in v0. Updated release output and active design/documentation.

## Verification

- `npm run ios:check`: passed.
- `npm run ios:test`: passed. Executes the actual workflow verification shell
  with ZIP fixtures and macOS plutil. Accepts a valid fixture; rejects wrong
  team, bundle, build, debug entitlement, missing microphone text and signature
  failure. Codesign alone is substituted; these tests do not perform signing.
- actionlint 1.7.12 on both changed workflows: passed.
- Reference workflow differences: Node version and release-before-TestFlight dependency.
- `git diff --check`: passed.

## External configuration and remaining verification

Read-only GitHub configuration-name inspection found all three iOS signing
secrets. It found no repository variables and no APPSTORE_API_PRIVATE_KEY secret.
The restored TestFlight job requires APPSTORE_ISSUER_ID, APPSTORE_API_KEY_ID,
APPSTORE_USES_NON_EXEMPT_ENCRYPTION repository variables and the
APPSTORE_API_PRIVATE_KEY secret. Without those it will explicitly fail its
configuration check; IPA build/attachment can still proceed. Do not infer the
export-compliance declaration or reuse an unrelated password as an API key.

No commit, push, tag mutation or workflow dispatch was performed. A fresh
GitHub signed run and Apple acceptance remain unverified. Rerunning the existing
tag's old workflow will not execute these source changes.
