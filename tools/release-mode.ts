import { execFileSync } from 'node:child_process'
import { appendFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

// Explicit tag metadata keeps tag-triggered releases to one workflow run.
// An ordinary/lightweight tag always retains the full CI gate.
export const DEVELOPMENT_RELEASE_MESSAGE = 'SkellySpeak development release: skip CI suite'

export function skipReleaseChecks(event: string, ref: string, annotation: string, manualSkip: string): boolean {
  if (!ref.startsWith('refs/tags/')) throw new Error('Release must run on an existing version tag.')
  if (event === 'workflow_dispatch') return manualSkip === 'true'
  if (event === 'push') return annotation.trim() === DEVELOPMENT_RELEASE_MESSAGE
  throw new Error(`Unsupported release event: ${event}`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const ref = process.env.GITHUB_REF ?? ''
  const objectType = execFileSync('git', ['cat-file', '-t', ref], { encoding: 'utf8' }).trim()
  const annotation = objectType === 'tag'
    ? execFileSync('git', ['for-each-ref', '--format=%(contents)', ref], { encoding: 'utf8' }) : ''
  const skip = skipReleaseChecks(process.env.GITHUB_EVENT_NAME ?? '', ref, annotation, process.env.SKIP_TESTS ?? '')
  if (!process.env.GITHUB_OUTPUT) throw new Error('GITHUB_OUTPUT is required')
  appendFileSync(process.env.GITHUB_OUTPUT, `skip_checks=${skip}\n`)
  console.log(skip ? 'Development release: CI suite bypassed; builds, signing and artifact verification remain required.' : 'Full release: CI suite required.')
}
