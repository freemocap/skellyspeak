// Run Tauri from its native project, independent of the caller's directory.
import { spawn, execFileSync } from 'node:child_process'
import { cpSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { installLinuxDevDesktop } from './linux-desktop.ts'
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
if (needsLinuxSetup(process.platform, args)) {
  ensureLinuxDependencies()
  installLinuxDevDesktop(root)
}
// ios init scaffolds Tauri's default icon. Apply our source artwork for local
// builds too, not only in the distribution workflow.
if (process.platform === 'darwin' && args[0] === 'ios' && ['build', 'dev'].includes(args[1] ?? '')) {
  const output = mkdtempSync(resolve(tmpdir(), 'skellyspeak-icons-'))
  try {
    execFileSync(process.execPath, [require.resolve('@tauri-apps/cli/tauri.js'), 'icon', resolve(root, 'ui/public/skellyspeak-logo.png'), '--output', output, '--ios-color', '#f3f1ea'], { cwd: resolve(root, 'native'), stdio: 'inherit' })
    const catalog = resolve(root, 'native/gen/apple/Assets.xcassets/AppIcon.appiconset')
    cpSync(resolve(output, 'ios'), catalog, { recursive: true })
    execFileSync('swift', [resolve(root, 'tools/ios-icons.swift'), catalog], { stdio: 'inherit' })
  } finally { rmSync(output, { recursive: true, force: true }) }
}
const child = spawn(process.execPath, [require.resolve('@tauri-apps/cli/tauri.js'), ...args], {
  cwd: resolve(root, 'native'),
  stdio: 'inherit',
})
child.on('error', error => { throw error })
child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal)
  else process.exitCode = code ?? 1
})
