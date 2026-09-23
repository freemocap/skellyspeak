// Cargo's executable runner: Tauri still owns builds, watching and restarts.
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { developmentRequirement, ensureDevelopmentSignature, signingIdentity } from './macos-signing.ts'

/** Put Cargo configuration before application arguments, preserving both separators. */
export function signedDevArgs(args: string[], node: string, runner: string): string[] {
  const first = args.indexOf('--')
  const tauri = first < 0 ? args : args.slice(0, first)
  const rest = first < 0 ? [] : args.slice(first + 1)
  const second = rest.indexOf('--')
  const cargo = second < 0 ? rest : rest.slice(0, second)
  const app = second < 0 ? [] : rest.slice(second)
  const config = ['aarch64-apple-darwin', 'x86_64-apple-darwin'].flatMap(target =>
    ['--config', `target.${target}.runner=${JSON.stringify([node, runner])}`])
  return [...tauri, '--', ...cargo, ...config, ...app]
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    if (process.platform !== 'darwin') throw new Error('This executable runner requires macOS.')
    if (!process.execve) throw new Error('Node 24 with process.execve is required for native restart ownership.')
    const [binary, ...args] = process.argv.slice(2)
    if (!binary) throw new Error('Cargo did not supply an executable to sign.')
    const executable = resolve(binary)
    const fingerprint = signingIdentity()
    const action = ensureDevelopmentSignature(executable, fingerprint)
    console.error(`Development signature ${action}: ${developmentRequirement(fingerprint)}`)
    // Replace this process so Cargo/Tauri cancellation and exit status retain
    // their normal ownership; do not leave a separately spawned app behind.
    const environment = Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined))
    process.execve(executable, [executable, ...args], environment)
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}
