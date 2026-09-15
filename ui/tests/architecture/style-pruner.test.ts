import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { analyseStyles, prune } from '../../tools/prune-styles'

async function fixture(css: string, run: (root: string, sheet: string) => Promise<void>) {
  const root = mkdtempSync(join(tmpdir(), 'style-pruner-'))
  const sheet = join(root, 'ui/src/styles/test.css')
  mkdirSync(join(root, 'ui/src/styles'), { recursive: true })
  writeFileSync(sheet, css)
  writeFileSync(join(root, 'ui/src/example.tsx'), 'const classes = "a b"')
  try { await run(root, sheet) } finally { rmSync(root, { recursive: true }) }
}

it('reads classes from selectors without treating font URLs or strings as classes', async () => {
  await fixture('@font-face { src: url("/fonts/sample.ttf") } /* .ghost */ .a[data-file=".json"] { content: ".text" } .unused {}', async root => {
    expect(analyseStyles(root).unused).toEqual(['unused'])
  })
})

it('refuses duplicate relocation and leaves every byte unchanged', async () => {
  const css = '.a { color: red } .b { color: blue } .a { padding: 1px } .unused {}'
  await fixture(css, async (root, sheet) => {
    await expect(prune(root)).rejects.toThrow('no files written')
    expect(readFileSync(sheet, 'utf8')).toBe(css)
  })
})

it('keeps functional selectors and prunes only unambiguous missing classes', async () => {
  await fixture('.a:not(.missing) { color: red } .a:is(.b,.missing) { padding: 1px } .unused, .b { margin: 0 }', async (root, sheet) => {
    await prune(root)
    const css = readFileSync(sheet, 'utf8')
    expect(css).toContain('.a:not(.missing)')
    expect(css).toContain('.a:is(.b,.missing)')
    expect(css).not.toContain('.unused')
    expect(css).toContain('.b { margin: 0 }')
  })
})
