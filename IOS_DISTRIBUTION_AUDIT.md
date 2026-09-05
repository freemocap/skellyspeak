# iOS distribution audit

Scope: `.github/workflows/ios-distribute.yml`, its signing and release flow,
and the iOS compilation failures in the supplied September 5, 2026 runner log.
This is a source review, not a full application penetration test. Live GitHub
repository settings and Apple account permissions have not been inspected.

## Build failure

The Rust compiler rejects the microphone bindings before the archive/export
finishes. Xcode exit 65 is the downstream result. The fixes use `block2::RcBlock`,
the actual `requestRecordPermission` method, nullable framework string constants,
and explicit unsafe calls required by objc2. Cargo.lock includes the Apple crates
and direct dependencies. AVAudioSession permission methods still emit Apple's
deprecation warnings; they are distinct from the compilation errors.

## Hardening applied

- The build job has read-only repository access and checkout does not persist
  credentials. Only the separate release attachment job has contents write access;
  it downloads the current run's artifact without executing repository code.
- Build actions are pinned to the exact commits recorded in the supplied log.
  This prevents tag movement, but does not independently attest those commits.
  Dependabot is configured to propose GitHub Actions updates.
- Shared Rust build caching is disabled for the signing job. iOS Rust checking
  runs before the signing secrets are loaded.
- Decoded credentials use restrictive file permissions. The generated keychain
  password is masked, decoded inputs are deleted promptly, and an always-run
  step deletes the keychain and installed profiles, including on build failure.
- Provisioning profiles must be unexpired App Store profiles for the expected
  team and bundle identifier, with debugger access disabled.
- Export verification performs `codesign --verify --deep --strict`, checks the
  team and bundle identifier, rejects debugger access, and requires a microphone
  usage description. Signature metadata alone is not treated as verification.
- Release tags must resolve to the source commit that produced the artifact.
  Release creation requires an existing tag. Upload refuses to overwrite an
  existing IPA. Artifact upload fails when no file exists.

## Remaining risks and setup

1. **High: signing secrets need repository-side access controls.** Manual dispatch
   can select another ref, and a tag can point at unreviewed code. Build scripts
   run in the same runner as the unlocked signing keychain. A malicious dependency
   can also persist a process until credentials arrive. Move the three iOS secrets
   into a protected GitHub environment, restrict its deployment refs, require a
   reviewer, and then reference that environment on `build-ipa`. Protect release
   tags and require review of workflow/dependency changes. Merely naming an
   environment in YAML does not configure these protections.
2. **Medium: the companion release workflow shares the release trust boundary.**
   `release.yml` still grants workflow-wide contents write, uses mutable action
   references, and interpolates `github.ref_name` into a shell script in its version
   check. It needs equivalent least-privilege and input-handling hardening. Its
   concurrent draft creation can race with iOS draft creation; a failed run should
   be inspected before retrying. Those jobs were not changed in this patch.
3. **Medium: signing assets remain accessible during the build.** Cleanup limits
   lifetime but cannot undo exfiltration or run after abrupt runner destruction.
   Keep using ephemeral hosted runners. Consider a separate signing-only job
   that never executes application/dependency build scripts if the threat model
   requires stronger isolation. Pinning actions and using npm/Cargo lockfiles do
   not establish that all dependencies are trustworthy.
4. **Release visibility:** attaching an IPA to an already published GitHub release
   exposes that binary to the release audience immediately. The embedded profile
   contains signing metadata; it does not contain the private signing key. Use
   TestFlight for tester delivery and keep GitHub assets private/draft if desired.

## Validation and next run

Windows `cargo check --offline --locked --manifest-path src-tauri/Cargo.toml --lib`
passes. Workflow YAML, all embedded Bash syntax, and embedded Python syntax were
validated. The exact downloaded objc2 0.3.2 / block2 0.6.2 sources were inspected.
Windows checking excludes the iOS module: macOS/Xcode compilation, signing,
export, and physical-device microphone permission/capture still need verification.

After committing the changes yourself, run **iOS distribute** on that commit with
`release_tag` empty first. This builds an Actions artifact without attaching it
to a GitHub release. Upload to App Store Connect/TestFlight is still manual.

References: [objc2 AVAudioSession bindings](https://docs.rs/objc2-avf-audio/latest/objc2_avf_audio/struct.AVAudioSession.html),
[GitHub Actions secure use](https://docs.github.com/en/actions/reference/security/secure-use).
