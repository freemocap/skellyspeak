// Development launchers need the same desktop identity as packaged GTK windows.
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, isAbsolute, join } from 'node:path'
import { spawnSync } from 'node:child_process'

export function desktopExec(path: string): string {
  if (/[\r\n]/.test(path)) throw new Error('Desktop launcher path contains a newline')
  return '"' + path.replace(/[%]/g, '%%').replace(/[\\"$`]/g, '\\$&') + '"'
}

export function installLinuxDevDesktop(root: string, dataHome = process.env.XDG_DATA_HOME || join(homedir(), '.local/share')) {
  if (!isAbsolute(dataHome)) throw new Error('XDG_DATA_HOME must be absolute')
  const config = JSON.parse(readFileSync(join(root, 'native/tauri.conf.json'), 'utf8'))
  // GTK's D-Bus application ID does not establish the Wayland toplevel app_id.
  // Verified on the native COSMIC window: the toplevel uses the executable name.
  const id = (config.mainBinaryName || 'skellyspeak') as string
  if (!/^[a-zA-Z0-9.-]+$/.test(id)) throw new Error('Invalid desktop application identifier')
  const desktop = join(dataHome, 'applications', id + '.desktop')
  // Do not overwrite a manually installed or packaged launcher.
  const marker = 'X-SkellySpeak-Development=true'
  if (existsSync(desktop) && !readFileSync(desktop, 'utf8').includes(marker)) {
    throw new Error('A non-development launcher already owns ' + desktop)
  }
  const icon = join(dataHome, 'icons/hicolor/256x256/apps', id + '.png')
  mkdirSync(dirname(icon), { recursive: true })
  copyFileSync(join(root, 'native/icons/128x128@2x.png'), icon)
  mkdirSync(dirname(desktop), { recursive: true })
  writeFileSync(desktop, [
    '[Desktop Entry]', 'Type=Application', 'Name=SkellySpeak (Development)',
    'Exec=' + desktopExec(join(root, 'native/target/debug/skellyspeak')),
    'Icon=' + icon, 'StartupWMClass=' + id, 'Terminal=false',
    'Categories=Education;Languages;', marker, '',
  ].join('\n'))
  // Caches are optional; the desktop and icon remain valid without these tools.
  for (const [command, args] of [
    ['update-desktop-database', [dirname(desktop)]],
    ['gtk-update-icon-cache', ['--force', '--ignore-theme-index', join(dataHome, 'icons/hicolor')]],
  ] as const) {
    const result = spawnSync(command, [...args], { encoding: 'utf8' })
    if (result.error && 'code' in result.error && result.error.code === 'ENOENT') continue
    if (result.error || result.status !== 0) throw new Error(command + ': ' + (result.error?.message || result.stderr))
  }
  return desktop
}
