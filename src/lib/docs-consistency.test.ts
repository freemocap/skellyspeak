import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const REPOSITORY_ROOT = fileURLToPath(new URL('../../', import.meta.url))

function readRepositoryFile(path: string): string {
  return readFileSync(`${REPOSITORY_ROOT}${path}`, { encoding: 'utf8' })
}

const CURRENT_DOCUMENTS = [
  'README.md',
  'skellyspeak-docs/docs/overview.md',
  'skellyspeak-docs/docs/architecture.md',
  'skellyspeak-docs/docs/ontology.md',
  'skellyspeak-docs/docs/status.md',
  'skellyspeak-docs/docs/platforms.md',
  'skellyspeak-docs/docs/hosted-api.md',
  'skellyspeak-docs/docs/privacy.md',
  'skellyspeak-docs/docs/future-work.md',
  'skellyspeak-docs/docs/coach.md',
  'skellyspeak-docs/docs/observability.md',
] as const

describe('current documentation', () => {
  it('does not preserve known superseded claims', () => {
    const content = CURRENT_DOCUMENTS
      .map((path: string): string => readRepositoryFile(path))
      .join('\n')
    const supersededClaims: RegExp[] = [
      /v0\.1\.0/i,
      /32 commands/i,
      /iOS unscaffolded/i,
      /csp:\s*null/i,
      /keys plaintext/i,
      /any persistence of chat/i,
      /no component tests/i,
      /deploy config is placeholder/i,
      /src-tauri\/src\/prompts\.rs/i,
    ]

    for (const claim of supersededClaims) {
      expect(content, `superseded documentation claim: ${claim}`).not.toMatch(claim)
    }
  })

  it('does not duplicate the application version in current prose', () => {
    const cargoManifest = readRepositoryFile('src-tauri/Cargo.toml')
    const version = cargoManifest.match(/^version = "([^"]+)"$/m)?.[1]
    if (version === undefined) {
      throw new Error('src-tauri/Cargo.toml does not contain a package version.')
    }

    for (const path of CURRENT_DOCUMENTS) {
      expect(readRepositoryFile(path), `${path} duplicates app version ${version}`).not.toContain(
        `v${version}`
      )
    }
  })

  it('lists every registered language in the README', () => {
    const registry = readRepositoryFile('src-tauri/src/languages.rs')
    const names = [...registry.matchAll(/^\s+name: "([^"]+)",$/gm)].map(
      (match: RegExpMatchArray): string => match[1]
    )
    if (names.length === 0) {
      throw new Error('src-tauri/src/languages.rs does not declare any language names.')
    }

    const readme = readRepositoryFile('README.md')
    for (const name of names) {
      expect(readme, `README is missing registered language ${name}`).toContain(name)
    }
  })

  it('keeps release notes consistent with the signing jobs', () => {
    const workflow = readRepositoryFile('.github/workflows/release.yml')
    expect(workflow).not.toContain('Desktop builds are **unsigned**')
    expect(workflow).not.toContain('The Android APK is debug-signed')
  })
})
