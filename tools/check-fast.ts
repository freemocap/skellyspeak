import { spawnSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { resolve } from 'node:path'

export const repositoryRoot = resolve(import.meta.dirname, '..')
export interface Check { name: string; command: string; args: string[] }

/** No builds or network calls: use the installed dependencies and Rust formatter. */
export function fastChecks(root = repositoryRoot): Check[] {
  const node = (name: string, script: string, ...args: string[]): Check => ({
    name, command: process.execPath, args: [resolve(repositoryRoot, script), ...args],
  })
  return [
    { name: 'Rust formatting', command: 'cargo', args: ['fmt', '--manifest-path', resolve(root, 'native/Cargo.toml'), '--', '--check'] },
    node('Localization sources', 'tools/check-languages.ts', '--root', root),
    node('Localization usage', 'ui/tools/localization/usage.ts', '--root', root, '--check'),
    node('Diagnostic policy', 'tools/diagnostic-policy.ts', '--check'),
    node('Styles', 'ui/tools/check-styles.ts'),
    node('Validation tooling types', 'node_modules/typescript/bin/tsc', '-p', resolve(repositoryRoot, 'tools/tsconfig.validation.json')),
    { name: 'Validation regression tests', command: process.execPath, args: [
      '--test', ...readdirSync(resolve(repositoryRoot, 'ui/tools/localization'))
        .filter(file => file.endsWith('.test.ts')).sort()
        .map(file => resolve(repositoryRoot, 'ui/tools/localization', file)),
      resolve(repositoryRoot, 'tools/check-fast.test.ts'),
    ] },
  ]
}

export function runChecks(checks: Check[], cwd = repositoryRoot, log = console.log): number {
  const failures: string[] = []
  for (const check of checks) {
    log(`\nChecking ${check.name}…`)
    const result = spawnSync(check.command, check.args, { cwd, stdio: 'inherit', timeout: 120_000 })
    if (result.error || result.signal || result.status !== 0) {
      const reason = result.error?.message ?? (result.signal ? `signal ${result.signal}` : `exit ${result.status}`)
      failures.push(check.name)
      log(`FAILED: ${check.name} (${reason})`)
    }
  }
  log(failures.length ? `\nFast validation failed: ${failures.join(', ')}` : '\nFast validation passed.')
  return failures.length ? 1 : 0
}

if (import.meta.main) process.exitCode = runChecks(fastChecks())
