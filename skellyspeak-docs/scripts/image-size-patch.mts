/** Local bounds fixes for image-size 2.0.2; remove only after reviewing an upstream fix.
 * GHSA-w3rx-r6r6-pgpr (ICNS), GHSA-5p2g-fcmc-qvqq (HEIF/JXL).
 * Every bundled CJS/ESM copy is checked, including the independent fromFile entry.
 */
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const packageDirectory = resolve(scriptDirectory, '../node_modules/image-size')
const manifest: Record<string, { original: string; patched: string }> = JSON.parse(
  readFileSync(resolve(scriptDirectory, 'image-size-patch-hashes.json'), 'utf8'),
)
const digest = (value: string) => createHash('sha256').update(value).digest('hex')

function patchSource(source: string): string {
  return source
    .replace('if (input.length - offset < 4) return;', 'if (input.length - offset < 8) return;')
    .replace('if (input.length - offset < boxSize) return;', 'if (boxSize < 8 || input.length - offset < boxSize) return;')
    .replace('      const imageHeader = readImageHeader(input, imageOffset);', `      if (Math.min(fileLength, inputLength) - imageOffset < 8) {
        throw new TypeError("Invalid ICNS entry header");
      }
      const imageHeader = readImageHeader(input, imageOffset);
      if (imageHeader[1] < 8 || imageHeader[1] > Math.min(fileLength, inputLength) - imageOffset) {
        throw new TypeError("Invalid ICNS entry length");
      }`)
}

export function enforcePatch(directory: string, apply: boolean): void {
  const metadata = JSON.parse(readFileSync(resolve(directory, 'package.json'), 'utf8'))
  if (metadata.name !== 'image-size' || metadata.version !== '2.0.2') {
    throw new Error('image-size version changed; review the bounds mitigation before building docs.')
  }
  // Validate every input before writing any file. Mixed pristine/patched installs
  // can be repaired; unreviewed upstream changes cannot be silently patched.
  const changes: Array<{ path: string; source: string }> = []
  for (const [file, expected] of Object.entries(manifest)) {
    const path = resolve(directory, file)
    const source = readFileSync(path, 'utf8')
    const hash = digest(source)
    if (hash === expected.patched) continue
    if (!apply || hash !== expected.original) {
      throw new Error(`image-size bounds mitigation missing or changed: ${file}. Run npm ci in skellyspeak-docs; do not bypass this check.`)
    }
    const patched = patchSource(source)
    if (digest(patched) !== expected.patched) throw new Error(`image-size patch output mismatch: ${file}`)
    changes.push({ path, source: patched })
  }
  for (const change of changes) writeFileSync(change.path, change.source)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const mode = process.argv[2]
  if (mode !== '--apply' && mode !== '--check') throw new Error('Expected --apply or --check')
  const mdxRequire = createRequire(resolve(scriptDirectory, '../node_modules/@docusaurus/mdx-loader/package.json'))
  if (mdxRequire.resolve('image-size/fromFile') !== resolve(packageDirectory, 'dist/fromFile.cjs')) {
    throw new Error('Docusaurus resolves an unreviewed image-size copy; inspect the dependency tree before building.')
  }
  enforcePatch(packageDirectory, mode === '--apply')
  console.log(`image-size 2.0.2 bounds mitigation ${mode === '--apply' ? 'applied' : 'verified'} (${Object.keys(manifest).length} files). Upstream advisories remain open.`)
}
