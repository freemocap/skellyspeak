# Documentation image-parser mitigation

The docs dependency tree pins `image-size@2.0.2`. The ICNS and HEIF/JXL parsers have published infinite-loop advisories with no patched release currently listed: [ICNS](https://github.com/advisories/GHSA-w3rx-r6r6-pgpr), [HEIF/JXL](https://github.com/advisories/GHSA-5p2g-fcmc-qvqq). This repository applies a local bounds fix. **npm audit continues to report the upstream advisories**; the patch does not change dependency metadata or suppress audit findings.

`npm ci` runs `image-size-patch.mts --apply`. It accepts only reviewed original or already-patched SHA256 fingerprints for all 20 emitted CJS/ESM files containing the affected routines. Unknown versions or source changes fail installation. The same bounds changes cover independently bundled memory and `fromFile` exports; disabling types only in the memory entry would not protect Docusaurus.

The patch rejects box headers shorter than eight bytes and box sizes below eight bytes. ICNS entries must include an eight-byte header, advance by at least eight bytes, and fit both the declared file and the supplied input. These checks make the affected iteration offsets strictly increase. They are targeted parser bounds fixes, not a general image decoder sandbox. Zero-size boxes and truncated ICNS entries now fail instead of being partially accepted.

The package build/start scripts verify fingerprints before Docusaurus runs. The Docusaurus config independently invokes verification, protecting direct CLI calls. This also works with `npm --ignore-scripts run build`: skipping installation hooks does not bypass the command's explicit check. The check verifies that the MDX loader resolves the inspected `fromFile` package. Node 22.18 or newer is required for native TypeScript tooling; CI uses Node 24.

Checks:

```sh
npm run security:check --prefix skellyspeak-docs
npm run security:test --prefix skellyspeak-docs
npm run docs:test
npm run typecheck --prefix skellyspeak-docs
npm run build --prefix skellyspeak-docs
```

Security tests use killable child processes with deadlines for hostile ICNS, JXL and HEIF buffers through all four public memory/file and CJS/ESM combinations. Valid parser fixtures and PNG/SVG dimensions remain covered. Additional tests verify idempotence, source/version drift refusal, reproduction from original release fingerprints, and build refusal when installation scripts were skipped.

When an upstream fix is available, inspect its bounds behavior and replay the hostile fixtures before updating the pin. Replace the local patch only once both advisories are addressed. Remove the hash manifest, installer/check hooks and config gate together; retain hostile-input regression coverage and the separate docs dependency audit. Do not regenerate fingerprints simply to make a dependency update pass.
