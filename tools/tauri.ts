// Run Tauri from its native project, independent of the caller's directory.
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ensureLinuxDependencies, needsLinuxSetup } from './linux-dependencies.ts'

const root = fileURLToPath(new URL('../', import.meta.url))
const require = createRequire(new URL('../ui/package.json', import.meta.url))
const args = process.argv.slice(2).map((argument, index, all) => {
  // Root commands and workflows name config files relative to the repository.
  if (all[index - 1] === '--config' && !argument.trimStart().startsWith('{')) {
    return resolve(root, argument)
  }
  if (all[0] === 'icon' && index === 1 && !argument.startsWith('-')) return resolve(root, argument)
  return argument
})
if (needsLinuxSetup(process.platform, args)) ensureLinuxDependencies()
const child = spawn(process.execPath, [require.resolve('@tauri-apps/cli/tauri.js'), ...args], {
  cwd: resolve(root, 'native'),
  stdio: 'inherit',
})
child.on('error', error => { throw error })
child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal)
  else process.exitCode = code ?? 1
})
