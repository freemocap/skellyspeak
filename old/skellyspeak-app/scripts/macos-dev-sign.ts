import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'

if (process.platform !== 'darwin') throw new Error('Development bundle signing requires macOS.')
const identity = process.env.SKELLYSPEAK_SIGNING_IDENTITY
if (!identity?.trim() || identity === '-') throw new Error('Set SKELLYSPEAK_SIGNING_IDENTITY to a certificate identity from security find-identity -v -p codesigning. Ad-hoc signing does not preserve Keychain approval across rebuilds.')
function run(command: string, args: string[]): void {
  const result = spawnSync(command, args, { stdio: 'inherit' })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`${command} failed with status ${result.status}`)
}
const bundle = resolve('src-tauri/target/debug/bundle/macos/SkellySpeak Dev.app')
run('codesign', ['--force', '--sign', identity, '--identifier', 'com.freemocap.skellyspeak.dev', bundle])
run('codesign', ['--verify', '--strict', '--verbose=2', bundle])
run('codesign', ['--display', '--requirements', '-', bundle])
