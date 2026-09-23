import { spawnSync } from 'node:child_process'

export const developmentIdentifier = 'com.freemocap.skellyspeak'
export const developmentTeam = 'U8LBJLBYPR'
// securityd's developer partition checks Apple certificate provenance as well as
// the Team ID. A self-signed certificate still falls back to a changing cdhash.
// https://github.com/apple-oss-distributions/Security/blob/main/securityd/src/clientid.cpp
export const teamPartitionRequirement = 'anchor apple generic and ((certificate 1[field.1.2.840.113635.100.6.2.1] and certificate leaf[field.1.2.840.113635.100.6.1.12]) or (certificate 1[field.1.2.840.113635.100.6.2.6] and certificate leaf[field.1.2.840.113635.100.6.1.13]))'

type Identity = { fingerprint: string; name: string; team: string }
export function selectSigningIdentity(identities: Identity[], requested?: string, team = developmentTeam): string {
  const matches = identities.filter(item => requested
    ? item.fingerprint === requested.toUpperCase() || item.name === requested
    : item.team === team && item.name.startsWith('Apple Development:'))
  if (matches.length !== 1) throw new Error(`Expected one Apple-issued signing identity for ${requested ?? `team ${team}`}; found ${matches.length}. Set SKELLYSPEAK_SIGNING_IDENTITY to an Apple Development or Developer ID Application certificate. Self-signed and ad-hoc identities cannot preserve Keychain partition authorization across rebuilds.`)
  return matches[0]!.fingerprint
}

export function signingIdentity(requested = process.env.SKELLYSPEAK_SIGNING_IDENTITY): string {
  const result = spawnSync('/usr/bin/security', ['find-identity', '-v', '-p', 'codesigning'], { encoding: 'utf8' })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`Could not inspect signing identities: ${result.stderr}`)
  const identities: Identity[] = []
  for (const match of result.stdout.matchAll(/\) ([A-F0-9]{40}) "([^"]+)"/g)) {
    const fingerprint = match[1]!
    const name = match[2]!
    if (!/^(Apple Development:|Developer ID Application:)/.test(name)) continue
    const certificate = spawnSync('/usr/bin/security', ['find-certificate', '-c', name, '-p'], { encoding: 'utf8' })
    if (certificate.error) throw certificate.error
    if (certificate.status !== 0) throw new Error(`Could not inspect public signing certificate: ${certificate.stderr}`)
    const subject = spawnSync('/usr/bin/openssl', ['x509', '-noout', '-subject', '-nameopt', 'RFC2253'], { input: certificate.stdout, encoding: 'utf8' })
    if (subject.error) throw subject.error
    if (subject.status !== 0) throw new Error(`Could not inspect signing certificate subject: ${subject.stderr}`)
    const team = subject.stdout.match(/(?:^|,)OU=([A-Z0-9]{10})(?:,|$)/)?.[1]
    if (team && !identities.some(item => item.fingerprint === fingerprint)) identities.push({ fingerprint, name, team })
  }
  return selectSigningIdentity(identities, requested, process.env.APPLE_DEVELOPMENT_TEAM ?? developmentTeam)
}

export function developmentRequirement(fingerprint: string): string {
  if (!/^[A-F0-9]{40}$/.test(fingerprint)) throw new Error('Invalid signing certificate fingerprint.')
  return `identifier "${developmentIdentifier}" and certificate leaf = H"${fingerprint.toLowerCase()}"`
}

export function signatureDetails(executable: string): { teamId: string; codeHash: string; requirement: string } {
  const result = spawnSync('/usr/bin/codesign', ['--display', '--requirements', '-', '--verbose=4', executable], { encoding: 'utf8' })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`Cannot inspect development signature: ${result.stderr}`)
  const output = `${result.stdout}\n${result.stderr}`
  const teamId = output.match(/^TeamIdentifier=([A-Z0-9]{10})$/m)?.[1]
  const codeHash = output.match(/^CDHash=([a-f0-9]+)$/m)?.[1]
  const requirement = output.match(/^designated => (.+)$/m)?.[1]
  if (!teamId || !codeHash || !requirement) throw new Error('Development signature has no stable Team ID or complete identity. Refusing a build that would repeat Keychain prompts.')
  return { teamId, codeHash, requirement }
}

function event(stage: string, details: Record<string, string | number> = {}) {
  console.error(JSON.stringify({ event: 'development_signing', stage, pid: process.pid, ...details }))
}

/** Validate BOTH the app requirement and securityd's stable team partition. */
export function ensureDevelopmentSignature(executable: string, fingerprint: string): 'reused' | 'signed' {
  const requirement = developmentRequirement(fingerprint)
  const verifyArgs = ['--verify', '--strict', '-R', `=(${requirement}) and (${teamPartitionRequirement})`, executable]
  event('verify_started')
  const verified = spawnSync('/usr/bin/codesign', verifyArgs, { encoding: 'utf8' })
  if (verified.error) throw verified.error
  if (verified.status === 0) {
    const details = signatureDetails(executable)
    if (details.requirement === requirement) {
      event('reused', { ...details, partition: `teamid:${details.teamId}` })
      return 'reused'
    }
  }
  event('sign_started', { certificate: fingerprint })
  const started = Date.now()
  const sign = spawnSync('/usr/bin/codesign', ['--force', '--sign', fingerprint,
    '--identifier', developmentIdentifier, '--requirements', `=designated => ${requirement}`, '--timestamp=none', executable], { stdio: 'inherit' })
  if (sign.error) throw sign.error
  if (sign.status !== 0) throw new Error(`Development signing failed (${sign.signal ?? sign.status}). No unsigned app will be launched.`)
  event('sign_finished', { durationMs: Date.now() - started })
  const check = spawnSync('/usr/bin/codesign', verifyArgs, { stdio: 'inherit' })
  if (check.error) throw check.error
  if (check.status !== 0) throw new Error('Development signature lacks verified Apple provenance and stable Keychain partition identity. The app will not launch.')
  const details = signatureDetails(executable)
  event('verified', { ...details, partition: `teamid:${details.teamId}` })
  return 'signed'
}
