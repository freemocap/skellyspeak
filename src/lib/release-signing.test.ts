import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'

const workflow = readFileSync(new URL('../../.github/workflows/release.yml', import.meta.url), 'utf8')
const start = workflow.indexOf('          actual=$(sed')
const end = workflow.indexOf('          done <<< "$actual"', start)
if (start < 0 || end < 0) throw new Error('Release signer validation block is missing')
const validation = workflow.slice(start, end + '          done <<< "$actual"'.length)
  .replace('/tmp/apk-cert.txt', '<(printf "%s\\n" "$CERT_OUTPUT")')
const fingerprint = 'facb1ef49503b14d5cae0d54458c15cf5fe9fd499ce2bbaa116fdf7478ef4ad7'

function verify(output: string): string {
  return execFileSync('bash', ['-euo', 'pipefail', '-c', validation], {
    env: { ...process.env, expected: fingerprint, CERT_OUTPUT: output },
    encoding: 'utf8', stdio: 'pipe',
  })
}

it.each(['Signer #1', 'Signer (minSdkVersion=33, maxSdkVersion=2147483647)', 'V2 Signer:'])('accepts the matching certificate with label %s', label => {
  expect(() => verify(`${label} certificate SHA-256 digest: ${fingerprint}`)).not.toThrow()
})

it.each([
  '',
  'V2 Signer: certificate SHA-1 digest: 1234',
  'V2 Signer: certificate SHA-256 digest: malformed',
  `V2 Signer: certificate SHA-256 digest: ${'0'.repeat(64)}`,
  `V2 Signer: certificate SHA-256 digest: ${fingerprint}\nSigner #2 certificate SHA-256 digest: ${'0'.repeat(64)}`,
])('rejects missing, malformed, or mismatched signer fingerprints: %s', output => {
  expect(() => verify(output)).toThrow()
})
