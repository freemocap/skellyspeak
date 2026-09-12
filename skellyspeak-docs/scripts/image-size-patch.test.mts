import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

const scripts = dirname(fileURLToPath(import.meta.url))
const docs = resolve(scripts, '..')
const installed = join(docs, 'node_modules/image-size')
const patchScript = join(scripts, 'image-size-patch.mts')

function box(type: string, payload = Buffer.alloc(0)): Buffer {
  const header = Buffer.alloc(8)
  header.writeUInt32BE(8 + payload.length)
  header.write(type, 4, 'ascii')
  return Buffer.concat([header, payload])
}
function fixtures() {
  const icns = Buffer.alloc(16)
  icns.write('icns'); icns.writeUInt32BE(16, 4); icns.write('is32', 8); icns.writeUInt32BE(8, 12)
  const ispe = Buffer.alloc(12)
  ispe.writeUInt32BE(42, 4); ispe.writeUInt32BE(24, 8)
  const heif = Buffer.concat([box('ftyp', Buffer.from('heic')), box('meta', Buffer.concat([Buffer.alloc(4), box('iprp', box('ipco', box('ispe', ispe)))]))])
  const jxl = Buffer.concat([box('JXL ', Buffer.from([13, 10, 135, 10])), box('ftyp', Buffer.from('jxl ')), box('jxlp', Buffer.from([0, 0, 0, 0, 255, 10, 1, 0]))])
  const badIcns = Buffer.from(icns); badIcns.writeUInt32BE(0, 12)
  const badHeif = Buffer.from(heif); badHeif.writeUInt32BE(0, heif.indexOf('ispe') - 4)
  const badJxl = Buffer.from(jxl); badJxl.writeUInt32BE(0, jxl.indexOf('jxlp') - 4)
  const shortIcns = Buffer.from(icns); shortIcns.writeUInt32BE(7, 12)
  const longIcns = Buffer.from(icns); longIcns.writeUInt32BE(100, 12)
  return { icns, heif, jxl, badIcns, badHeif, badJxl, shortIcns, longIcns }
}

// Child process deadlines are essential: the unpatched fixtures permanently block
// the event loop, so an in-process test timeout cannot contain a regression.
for (const format of ['cjs', 'mjs']) {
  for (const entry of ['index', 'fromFile']) {
    test(`${format} ${entry}: bounded hostile inputs and valid dimensions`, () => {
      const directory = mkdtempSync(join(tmpdir(), 'skelly-docs-image-test-'))
      try {
        const values = fixtures()
        const cases: Array<[string, Buffer, number[] | null]> = [
          ['badIcns', values.badIcns, null], ['badHeif', values.badHeif, null], ['badJxl', values.badJxl, null],
          ['shortIcns', values.shortIcns, null], ['longIcns', values.longIcns, null],
          ['icns', values.icns, [16, 16]], ['heif', values.heif, [42, 24]], ['jxl', values.jxl, [8, 8]],
          ['png', Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a7V8AAAAASUVORK5CYII=', 'base64'), [1, 1]],
          ['svg', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="41" height="23"></svg>'), [41, 23]],
        ]
        for (let length = 0; length < 8; length++) {
          const invalid = Buffer.from(values.icns)
          invalid.writeUInt32BE(length, 12)
          cases.push([`icns-length-${length}`, invalid, null])
          cases.push([`icns-truncated-${length}`, values.icns.subarray(0, 8 + length), null])
        }
        for (const [name, bytes, expected] of cases) {
          const path = join(directory, name)
          writeFileSync(path, bytes)
          const modulePath = join(installed, 'dist', `${entry}.${format}`)
          const code = `
            const fs = require('node:fs');
            (async () => {
              const module = await import(require('node:url').pathToFileURL(process.argv[1]).href);
              try {
                const result = ${entry === 'fromFile' ? 'await module.imageSizeFromFile(process.argv[2])' : 'module.imageSize(fs.readFileSync(process.argv[2]))'};
                process.stdout.write(JSON.stringify([result.width, result.height]));
              } catch { process.stdout.write('rejected'); }
            })().catch(error => { console.error(error); process.exitCode = 1; });
          `
          const result = spawnSync(process.execPath, ['-e', code, modulePath, path], { encoding: 'utf8', timeout: 2000 })
          assert.equal(result.error, undefined, `${name} timed out: ${result.error}`)
          assert.equal(result.status, 0, result.stderr)
          assert.equal(result.stdout, expected ? JSON.stringify(expected) : 'rejected', name)
        }
      } finally { rmSync(directory, { recursive: true, force: true }) }
    })
  }
}

test('patch is idempotent and refuses drift/version changes before writing', async () => {
  // Import from a child so the checked TypeScript remains usable without enabling
  // allowImportingTsExtensions in the documentation site's compiler settings.
  const directory = mkdtempSync(join(tmpdir(), 'skelly-docs-patch-test-'))
  try {
    cpSync(installed, directory, { recursive: true })
    const invoke = (apply: boolean) => spawnSync(process.execPath, ['--input-type=module', '-e', `
      const { enforcePatch } = await import(process.argv[1]);
      enforcePatch(process.argv[2], ${apply});
    `, pathToFileURL(patchScript).href, directory], { encoding: 'utf8', timeout: 2000 })
    assert.equal(invoke(false).status, 0)
    assert.equal(invoke(true).status, 0)
    const target = join(directory, 'dist/fromFile.cjs')
    const valid = readFileSync(target, 'utf8')
    writeFileSync(target, valid.replace('boxSize < 8 || ', ''))
    assert.notEqual(invoke(false).status, 0, 'missing bounds must block builds')
    assert.notEqual(invoke(true).status, 0, 'unreviewed source must block installation')
    assert.equal(readFileSync(target, 'utf8'), valid.replace('boxSize < 8 || ', ''), 'failed patch must not change input')
    writeFileSync(target, valid)
    writeFileSync(join(directory, 'package.json'), '{"name":"image-size","version":"2.0.3"}')
    assert.notEqual(invoke(true).status, 0, 'an upstream version needs review')
  } finally { rmSync(directory, { recursive: true, force: true }) }
})


test('npm --ignore-scripts build still blocks an unpatched dependency', () => {
  const directory = mkdtempSync(join(tmpdir(), 'skelly-docs-build-gate-'))
  try {
    cpSync(join(docs, 'package.json'), join(directory, 'package.json'))
    cpSync(scripts, join(directory, 'scripts'), { recursive: true })
    cpSync(installed, join(directory, 'node_modules/image-size'), { recursive: true })
    const mdx = join(directory, 'node_modules/@docusaurus/mdx-loader')
    mkdirSync(mdx, { recursive: true })
    writeFileSync(join(mdx, 'package.json'), '{"name":"@docusaurus/mdx-loader"}')
    const target = join(directory, 'node_modules/image-size/dist/fromFile.cjs')
    writeFileSync(target, readFileSync(target, 'utf8').replace('boxSize < 8 || ', ''))
    const result = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['--ignore-scripts', 'run', 'build'], {
      cwd: directory, encoding: 'utf8', timeout: 5000, shell: process.platform === 'win32',
    })
    assert.equal(result.error, undefined)
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /image-size bounds mitigation missing or changed/)
    assert.doesNotMatch(result.stderr, /docusaurus:.*not found/)
  } finally { rmSync(directory, { recursive: true, force: true }) }
})


test('pristine release fingerprints reproduce every patched bundle', () => {
  const directory = mkdtempSync(join(tmpdir(), 'skelly-docs-pristine-patch-'))
  try {
    cpSync(installed, directory, { recursive: true })
    const hashes: Record<string, { original: string; patched: string }> = JSON.parse(readFileSync(join(scripts, 'image-size-patch-hashes.json'), 'utf8'))
    const digest = (source: string) => createHash('sha256').update(source).digest('hex')
    for (const [file, expected] of Object.entries(hashes)) {
      const target = join(directory, file)
      // Restore pristine bytes, then independently verify their recorded release
      // fingerprint. This fixture needs no network or vulnerable in-process calls.
      const original = readFileSync(target, 'utf8')
        .replace('if (input.length - offset < 8) return;', 'if (input.length - offset < 4) return;')
        .replace('if (boxSize < 8 || input.length - offset < boxSize) return;', 'if (input.length - offset < boxSize) return;')
        .replace(/      if [^\n]+\{\n        throw new TypeError\("Invalid ICNS entry (?:header|length)"\);\n      }\n/g, '')
      assert.equal(digest(original), expected.original, file)
      writeFileSync(target, original)
    }
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', `
      const { enforcePatch } = await import(process.argv[1]);
      enforcePatch(process.argv[2], true);
      enforcePatch(process.argv[2], false);
    `, pathToFileURL(patchScript).href, directory], { encoding: 'utf8', timeout: 2000 })
    assert.equal(result.error, undefined)
    assert.equal(result.status, 0, result.stderr)
    for (const [file, expected] of Object.entries(hashes)) {
      assert.equal(digest(readFileSync(join(directory, file), 'utf8')), expected.patched, file)
    }
  } finally { rmSync(directory, { recursive: true, force: true }) }
})
