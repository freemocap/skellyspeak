# iOS release recovery — 2026-09-12

## Finding

Read-only Git history identifies `988206e` (`chkpt - refactor`) as the removal
of `.github/workflows/ios-distribute.yml`. Both distribution and simulator
workflows survive under `old/skellyspeak-app-v0/.github/workflows/`, outside
GitHub's active workflow directory. The active Release job graph included only
desktop and Android before this change.

Read-only GitHub inspection confirmed that published v1.1.1 has no `.ipa` asset.
The repository still has secret names `IOS_CERTIFICATE_P12`,
`IOS_CERTIFICATE_PASSWORD`, and `IOS_PROVISION_PROFILE`. Secret contents were
not read; presence does not establish certificate/profile validity.

## Implemented source

- Release builds an App Store IPA alongside desktop and Android. The iOS job
  verifies, retains an Actions artifact, and attaches `SkellySpeak_X.Y.Z.ipa`
  to the shared draft. Publication depends on iOS and checks its asset name.
- Normal CI compiles/links an unsigned ARM64 iOS simulator app, including
  frontend assets and opaque icon preparation, without signing credentials.
- A TypeScript helper stamps the Cargo marketing version and workflow
  run/attempt build number before scaffolding, stages a temporary keychain,
  validates the profile, replaces app-target signing settings, and supplies
  explicit export options. Export must preserve the stamped versions.
- Verification checks exactly one IPA/app, code signature, team, application,
  both versions, microphone description, debugger entitlement and embedded
  App Store provisioning profile. Missing or invalid values fail the job.
- Cleanup restores the keychain search list and removes staged credentials.
  No automatic App Store Connect upload or review submission is added.

## Reference review

The archived workflow was reviewed for the concrete signing and export failures
it addressed, against the approved Tauri/platform design. Adopted principles are
recorded in DESIGN.md: existing distribution identity, profile validation,
temporary credential ownership, opaque RGB icons, and explicit manual-signing
and export settings. The replacement has one release owner and uses active root
source/configuration. It neither runs the archived application nor copies the
archived workflow wholesale. The old independent tag workflow and automatic
TestFlight path are not active requirements for this manual-upload artifact.

Tauri's signing contract requires a distribution certificate and matching App
Store profile [@tauriIosSigning]. Explicit `ExportOptions.plist` profile mapping
addresses the documented quoted-setting reader failure [@tauriIosExport15741].

## Local verification

- `npm run ios:check`: passed.
- `npm run ios:test`: five tests passed, covering build-number bounds, invalid
  profiles, replacement/idempotence of signing settings, actual CLI version
  stamping/mismatch rejection, and required release gate/attachment wiring.
- actionlint 1.7.12: both edited workflows passed (`-shellcheck=`; ShellCheck
  was unavailable). The downloaded binary matched its release checksum.
- Both workflow files parsed with Ruby YAML; `git diff --check` passed.
- Icon helper executed against a temporary copy of the real 512×512 logo;
  output retained its dimensions and `sips` reported `hasAlpha: no`.
- Native `plutil` extraction was checked with a synthetic date/entitlement
  fixture; returned date, JSON dictionary and raw boolean match helper parsing.
- `npm run build`: passed, with the existing Vite chunk-size advisory.

## Outstanding verification and release action

This Mac's selected developer directory is CommandLineTools, not full Xcode.
No signed IPA or simulator build was executed locally, and no GitHub workflow,
release, Git write, or Apple upload was performed. Full app tests were not rerun
for these packaging-only edits; unrelated concurrent application work remains
outside this report's verification scope.

The user must include this source change in a new release. The first GitHub
run must prove simulator linking, certificate/profile validity, signed archive
and export, and attachment/publication. Then upload the resulting IPA to App
Store Connect and verify Apple processing. Native iOS behavior remains a separate
device check. Rerunning the original v1.1.1 workflow cannot execute this fix;
published releases remain protected from overwrite.
