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
  const event = process.env.GITHUB_EVENT_NAME ?? ''
  // Validate the event/ref before using it as a fetch refspec.
  skipReleaseChecks(event, ref, '', process.env.SKIP_TESTS ?? '')
  let annotation = ''
  if (event === 'push') {
    // actions/checkout can replace an annotated local tag with the event's
    // peeled commit. Fetch the actual remote tag into a separate private ref;
    // never rewrite the release tag, and never infer metadata from a commit.
    const metadataRef = 'refs/skellyspeak-release/metadata'
    const git = (...args: string[]) => execFileSync('git', args, { encoding: 'utf8', timeout: 60000 }).trim()
    git('fetch', '--no-tags', '--no-write-fetch-head', 'origin', `+${ref}:${metadataRef}`)
    if (git('rev-parse', `${metadataRef}^{commit}`) !== git('rev-parse', 'HEAD')) {
      throw new Error('Remote release tag does not match the checked-out commit.')
    }
    if (git('cat-file', '-t', metadataRef) === 'tag') {
      annotation = git('for-each-ref', '--format=%(contents)', metadataRef)
    }
  }
  const skip = skipReleaseChecks(process.env.GITHUB_EVENT_NAME ?? '', ref, annotation, process.env.SKIP_TESTS ?? '')
  if (!process.env.GITHUB_OUTPUT) throw new Error('GITHUB_OUTPUT is required')
  appendFileSync(process.env.GITHUB_OUTPUT, `skip_checks=${skip}\n`)
  console.log(skip ? 'Development release: CI suite bypassed; builds, signing and artifact verification remain required.' : 'Full release: CI suite required.')
}
