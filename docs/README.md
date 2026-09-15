# Documentation

The repository has three application layers: [UI](../ui/), [native](../native/),
and [server](../server/). Their internal organization is unchanged by the top-level move.

See the [top-level move verification](top-level-layout-verification.md) for checks
and remaining limits.

## Status

- This repository map and the layer READMEs describe the new folder layout.
- `website/` contains the existing documentation website, moved intact. Its prose
  has **not been audited against current code**. It mixes implemented behavior,
  proposals, and obsolete descriptions. In particular, its architecture page
  describes nonexistent modules and JSON persistence; current native code uses SQLite.
- `website/docs/coaching-plan.md`, `coaching-work-plan.md`, and
  `coaching-contracts.md` retain their designated planning role. A plan is not
  evidence that its behavior has been implemented.
- [Historical notes](../old/notes/) are preserved for reference. They are likely
  outdated and are not current specifications or working instructions.

Do not promote a claim to current documentation merely by moving it. The next
content audit should separate verified guides, decisions/proposals, and historical
material, checking claims against source and relevant verification.

## Website commands

From the repository root:

```sh
npm ci --prefix docs/website
npm run docs:test
npm run build --prefix docs/website
```

A local build does not publish the website. Deployment requires explicit authorization.
