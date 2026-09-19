/** Read-only inventory. Source bytes and frontend build bytes are separate views. */
import fs from 'node:fs'
import path from 'node:path'

type FileSize = { path: string; bytes: number }
type Group = { name: string; files: FileSize[]; bytes: number }
const root = path.resolve(import.meta.dirname, '..')
const args = process.argv.slice(2)
if (args.some(arg => arg !== '--json') || args.length > 1) {
  throw new Error('Usage: npm run size:report -- [--json]')
}

function inventory(relative: string): FileSize[] {
  const directory = path.join(root, relative)
  const info = fs.lstatSync(directory)
  if (!info.isDirectory() || info.isSymbolicLink()) throw new Error(`Expected a directory: ${relative}`)
  return fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).flatMap(entry => {
    const file = `${relative}/${entry.name}`
    if (entry.isSymbolicLink()) throw new Error(`Unexpected symlink: ${file}`)
    if (entry.isDirectory()) return inventory(file)
    if (!entry.isFile()) throw new Error(`Unexpected non-file entry: ${file}`)
    return [{ path: file, bytes: fs.statSync(path.join(root, file)).size }]
  })
}
function group(name: string, files: FileSize[]): Group {
  return { name, files, bytes: files.reduce((sum, file) => sum + file.bytes, 0) }
}
function largest(files: FileSize[]): FileSize[] {
  return [...files].sort((a, b) => b.bytes - a.bytes || a.path.localeCompare(b.path)).slice(0, 8)
}
function formatBytes(bytes: number): string {
  const readable = bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(2)} MiB`
    : bytes >= 1024 ? `${(bytes / 1024).toFixed(2)} KiB` : `${bytes} B`
  return `${readable} (${bytes.toLocaleString('en-US')} bytes)`
}

const buildEntry = path.join(root, 'ui/dist/index.html')
if (!fs.existsSync(buildEntry)) throw new Error('Frontend build missing. Run npm run build, then npm run size:report.')
const publicFiles = inventory('ui/public')
const fontFiles = publicFiles.filter(file => file.path.startsWith('ui/public/fonts/'))
const sources = [
  group('Shared font binaries', fontFiles.filter(file => /\.(ttf|otf|woff2?)$/i.test(file.path))),
  group('Font licenses and metadata', fontFiles.filter(file => !/\.(ttf|otf|woff2?)$/i.test(file.path))),
  group('Language definitions (YAML)', inventory('content/languages').filter(file => /\.ya?ml$/i.test(file.path))),
  group('Interface translations (JSON)', inventory('ui/src/domain/localization/locales').filter(file => file.path.endsWith('.json'))),
  group('Other public assets', publicFiles.filter(file => !file.path.startsWith('ui/public/fonts/'))),
]
const buildFiles = inventory('ui/dist')
const build = [
  group('Fonts and notices', buildFiles.filter(file => file.path.startsWith('ui/dist/fonts/'))),
  group('JavaScript', buildFiles.filter(file => !file.path.startsWith('ui/dist/fonts/') && file.path.endsWith('.js'))),
  group('CSS', buildFiles.filter(file => !file.path.startsWith('ui/dist/fonts/') && file.path.endsWith('.css'))),
  group('HTML and other assets', buildFiles.filter(file => !file.path.startsWith('ui/dist/fonts/') && !/\.(js|css)$/.test(file.path))),
]
const report = {
  schemaVersion: 1,
  measurement: 'Raw file bytes; not compressed downloads, native packages, or installed application size.',
  buildEntryModifiedAt: fs.statSync(buildEntry).mtime.toISOString(),
  freshness: 'Reads existing ui/dist without rebuilding. Run npm run build immediately before reporting for current output.',
  sourceGroups: sources,
  frontendBuild: { groups: build, fileCount: buildFiles.length, bytes: buildFiles.reduce((sum, file) => sum + file.bytes, 0) },
  largestSourceFiles: largest(sources.flatMap(item => item.files)),
  largestBuildFiles: largest(buildFiles),
}
if (args.includes('--json')) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
} else {
  console.log('SkellySpeak size report')
  console.log(report.measurement)
  console.log(report.freshness)
  console.log(`Build entry modified: ${report.buildEntryModifiedAt}`)
  for (const [heading, groups] of [['Selected source assets', sources], ['Existing frontend build (ui/dist)', build]] as const) {
    console.log(`\n${heading}`)
    for (const item of groups) console.log(`  ${item.name}: ${formatBytes(item.bytes)} · ${item.files.length} ${item.files.length === 1 ? 'file' : 'files'}`)
  }
  console.log(`  Frontend total: ${formatBytes(report.frontendBuild.bytes)} · ${report.frontendBuild.fileCount} files`)
  console.log('\nSource and build views overlap; do not add their sizes together.')
  for (const [heading, files] of [['Largest selected source files', report.largestSourceFiles], ['Largest build files', report.largestBuildFiles]] as const) {
    console.log(`\n${heading}`)
    for (const file of files) console.log(`  ${file.path}: ${formatBytes(file.bytes)}`)
  }
}
