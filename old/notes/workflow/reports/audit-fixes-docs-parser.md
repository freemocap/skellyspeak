# A12 documentation parser mitigation — 12 September 2026

Implemented a narrow local bounds patch for the pinned `image-size@2.0.2` dependency. Upstream still lists no patched release for [GHSA-w3rx-r6r6-pgpr](https://github.com/advisories/GHSA-w3rx-r6r6-pgpr) and [GHSA-5p2g-fcmc-qvqq](https://github.com/advisories/GHSA-5p2g-fcmc-qvqq). This is a local mitigation, not a clean upstream dependency audit.

The TypeScript postinstall checks recorded SHA256 fingerprints, then applies ICNS entry bounds and shared box-header/minimum-length bounds to all 20 relevant CJS/ESM bundles. This includes the independently bundled `fromFile` path Docusaurus actually calls. Build/start commands explicitly verify patched hashes; the Docusaurus config repeats verification for direct CLI use. Unknown source, version or MDX package resolution fails closed. A skipped postinstall cannot silently run an unpatched build.

The dependency override remains 2.0.2, and the lockfile retains its real upstream package identity/integrity. No advisory is ignored or removed. Docs now require Node >=22.18 for native TypeScript scripts; existing CI uses Node 24. Root `docs:test` also runs the new parser security suite.

Verification:

- Docs production build passed, with the mitigation checked before compilation and in config loading.
- Existing docs tests: 28 passed.
- Parser/security tests: seven passed. 104 parser subprocesses cover hostile zero-length ICNS/JXL/HEIF, all ICNS entry lengths zero through seven and truncated headers, valid headers and PNG/SVG through CJS/ESM memory/file APIs. Each process has a two-second timeout.
- Security tests also cover source/version drift, idempotence, reconstruction from every original release hash and a real `npm --ignore-scripts run build` blocked before Docusaurus when mitigation is absent.
- Docs TypeScript check and standalone mitigation verification passed.

A lockfile-only offline npm operation refreshed root metadata and printed its generic zero-vulnerability summary. That offline summary is **not** treated as advisory verification or evidence that A12 disappeared. The two live GitHub advisories remain the upstream status source. No deployment or Git writes occurred.

Limitations: these targeted bounds checks address the identified loops; they are not a complete image-parser security review or worker sandbox. Malformed zero-size boxes and truncated ICNS records fail instead of being accepted. See `skellyspeak-docs/scripts/README.md` for maintenance/removal criteria and exact checks.
