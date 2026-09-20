import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

// GTK supplies ATK, Cairo, Pango and GDK; WebKit supplies JavaScriptCore and Soup.
// https://v2.tauri.app/start/prerequisites/#linux
const requirements = [
  ['gtk+-3.0 >= 3.24', 'libgtk-3-dev'],
  ['webkit2gtk-4.1 >= 2.40', 'libwebkit2gtk-4.1-dev'],
  ['alsa >= 1.0', 'libasound2-dev'],
] as const

export function needsLinuxSetup(platform: string, args: string[]): boolean {
  return platform === 'linux' && args[0] === 'dev'
    && !args.some(arg => ['--help', '-h', '--target', '-t'].includes(arg)
      || arg.startsWith('--target=') || arg.startsWith('-t='))
}

export function isDebianFamily(osRelease: string): boolean {
  return osRelease.split('\n').some(line => {
    const match = /^(?:ID|ID_LIKE)=(.*)$/.exec(line)
    return match?.[1].replace(/["']/g, '').split(/\s+/)
      .some(id => ['debian', 'ubuntu', 'pop'].includes(id)) ?? false
  })
}

type Run = (command: string, args: string[], interactive?: boolean) => boolean
const run: Run = (command, args, interactive = false) => {
  const result = spawnSync(command, args, { stdio: interactive ? 'inherit' : 'ignore' })
  return !result.error && result.status === 0
}

export function ensureLinuxDependencies(
  osRelease = readFileSync('/etc/os-release', 'utf8'),
  interactive = Boolean(process.stdin.isTTY && process.stdout.isTTY && !process.env.CI),
  execute: Run = run,
): void {
  const missing = () => requirements.filter(([probe]) =>
    !execute('pkg-config', ['--exists', probe]))
  const packages = missing().map(([, name]) => name as string)
  if (packages.length === 0) return
  if (!execute('pkg-config', ['--version'])) packages.unshift('pkg-config')
  if (!isDebianFamily(osRelease)) {
    throw new Error('Missing Linux development libraries. Install GTK 3, WebKitGTK 4.1 and ALSA development packages for your distribution: https://v2.tauri.app/start/prerequisites/#linux')
  }
  const install = ['apt-get', 'install', '--no-remove', '-y', ...packages]
  if (!interactive) {
    throw new Error(`Missing Linux development packages: ${packages.join(', ')}. Run npm run tauri dev in an interactive terminal for automatic setup, or run sudo apt-get update followed by sudo ${install.join(' ')}.`)
  }
  console.log(`Installing Linux development packages: ${packages.join(', ')}. sudo may request your password.`)
  if (!execute('sudo', ['apt-get', 'update'], true)
    || !execute('sudo', install, true)) {
    throw new Error('Linux dependency installation failed; Tauri was not started.')
  }
  if (missing().length > 0) {
    throw new Error('Linux dependency checks still fail after installation; check pkg-config configuration. Tauri was not started.')
  }
}
