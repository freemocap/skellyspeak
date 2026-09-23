import { spawnSync } from 'node:child_process'

export const developmentIdentifier = 'com.freemocap.skellyspeak'

export function signingIdentity(identity = process.env.SKELLYSPEAK_SIGNING_IDENTITY ?? 'SkellySpeak Local Development'): string {
  if (identity === '-') throw new Error('Ad-hoc signing cannot preserve Keychain permission across rebuilds. Select a certificate identity.')
  const result = spawnSync('/usr/bin/security', ['find-identity', '-p', 'codesigning'], { encoding: 'utf8' })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`Could not inspect signing identities: ${result.stderr}`)
  const matches = [...result.stdout.matchAll(/\) ([A-F0-9]{40}) "([^"]+)"/g)]
    .filter(match => match[1] === identity || match[2] === identity)
  const fingerprints = [...new Set(matches.map(match => match[1]!))]
  if (fingerprints.length !== 1) throw new Error(`Expected one signing identity for "${identity}"; found ${fingerprints.length}. Set SKELLYSPEAK_SIGNING_IDENTITY to an existing code-signing certificate name or SHA-1 fingerprint. No unsigned app will be launched.`)
  return fingerprints[0]!
}

export function developmentRequirement(fingerprint: string): string {
  if (!/^[A-F0-9]{40}$/.test(fingerprint)) throw new Error('Invalid signing certificate fingerprint.')
  return `identifier "${developmentIdentifier}" and certificate leaf = H"${fingerprint.toLowerCase()}"`
}

/** A stable certificate-bound identity, never an executable hash or an ACL bypass. */
export function ensureDevelopmentSignature(executable: string, fingerprint: string): 'reused' | 'signed' {
  const requirement = developmentRequirement(fingerprint)
  const verifyArgs = ['--verify', '--strict', '-R', `=${requirement}`, executable]
  const verified = spawnSync('/usr/bin/codesign', verifyArgs, { encoding: 'utf8' })
  if (verified.error) throw verified.error
  const displayed = spawnSync('/usr/bin/codesign', ['--display', '--requirements', '-', executable], { encoding: 'utf8' })
  if (displayed.error) throw displayed.error
  const expected = `designated => ${requirement}`
  if (verified.status === 0 && `${displayed.stdout}\n${displayed.stderr}`.split('\n').includes(expected)) return 'reused'
  const sign = spawnSync('/usr/bin/codesign', ['--force', '--sign', fingerprint,
    '--identifier', developmentIdentifier, '--requirements', `=${expected}`, '--timestamp=none', executable], { stdio: 'inherit' })
  if (sign.error) throw sign.error
  if (sign.status !== 0) throw new Error(`Development signing failed (${sign.signal ?? sign.status}). No unsigned app will be launched.`)
  const check = spawnSync('/usr/bin/codesign', verifyArgs, { stdio: 'inherit' })
  if (check.error) throw check.error
  if (check.status !== 0) throw new Error('Development signature verification failed. The app will not launch.')
  return 'signed'
}
