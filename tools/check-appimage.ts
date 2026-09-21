import { readdirSync, mkdtempSync, rmSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { pathToFileURL } from 'node:url'
import { execFileSync } from 'node:child_process'

// Linked GStreamer libraries alone cannot play audio. These dynamically loaded
// plugins must come from the same build environment as the bundled libraries.
const required = [
  'libgstcoreelements.so', 'libgstapp.so', 'libgstplayback.so',
  'libgstautodetect.so', 'libgstpulseaudio.so', 'libgstaudioconvert.so',
  'libgstaudioresample.so', 'libgstwavparse.so', 'gst-plugin-scanner',
]

function files(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? files(path) : [path]
  })
}

export function checkMediaFiles(paths: string[]): void {
  const names = new Set(paths.map(path => basename(path)))
  const missing = required.filter(name => !names.has(name))
  if (missing.length) throw new Error(`AppImage lacks required audio runtime files: ${missing.join(', ')}. Enable bundle.linux.appimage.bundleMediaFramework and install the matching GStreamer plugins on the build runner.`)
}

export function checkAppImages(directory: string): void {
  const images = files(directory).filter(path => path.endsWith('.AppImage'))
  if (!images.length) throw new Error(`No AppImage artifacts found in ${directory}`)
  for (const image of images) {
    const temporary = mkdtempSync(join(tmpdir(), 'skellyspeak-appimage-check-'))
    try {
      execFileSync(resolve(image), ['--appimage-extract'], { cwd: temporary, stdio: ['ignore', 'ignore', 'pipe'] })
      checkMediaFiles(files(join(temporary, 'squashfs-root')))
      console.log(`Audio runtime files verified: ${basename(image)}`)
    } finally {
      rmSync(temporary, { recursive: true, force: true })
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  checkAppImages(process.argv[2] ?? 'native/target/release/bundle/appimage')
}
