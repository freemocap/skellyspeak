# iOS v1.2.0 export failure

The failed release run was
https://github.com/freemocap/skellyspeak/actions/runs/34757057912 at `0ac4eaf`.
The iOS build reached successful app signing, then failed at IPA export with
`Unknown "signingStyle" specified "manual". Must be either automatic or manual.`
Android and desktop succeeded; the final publication job was skipped.

## Cause and fix

`signingProject` serialized all pbxproj settings with JSON quoting, including
`CODE_SIGN_STYLE = "Manual"`. Tauri CLI 2.11.4's `synchronize_project_config`
lowercases the raw token without stripping its quotes. Its build code then merges
computed export values over the supplied ExportOptions.plist. The resulting
signingStyle therefore contains literal quote characters. See
[@tauriIosStyle2114] for the exact upstream source version.

The helper now emits the enum as `CODE_SIGN_STYLE = Manual;`. Other strings,
including certificate names, remain quoted. No signing identities, secrets,
provisioning rules, release versions or publication gates were changed.

## Verification and remaining release step

Seven iOS helper tests pass, including a regression reproducing Tauri's raw-token
conversion and an Apple plutil parse proving both app configurations retain the
correct style, certificate and profile. TypeScript checking passes. A focused
native bibliography validation test also passes.

Signed IPA export has not been rerun. This is a local source fix, not a published
release. Rerunning the old tag would still execute the broken helper. Include the
fix in a new authorized release; do not move or silently replace the existing tag.
No Git writes, workflow dispatch, credential access or publication were performed.
