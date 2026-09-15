import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

// Current entry points only: historical reports retain their original context.
const documents = ['README.md', 'AGENTS.md', 'ui/README.md', 'native/README.md', 'docs/README.md', 'docs/notes/README.md', 'content/README.md', 'tools/README.md', 'server/README.md']
const failures: string[] = []
for (const file of documents) {
  const source = readFileSync(file, 'utf8').replace(/```[\s\S]*?```/g, '')
  for (const match of source.matchAll(/\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
    const target = match[1].replace(/^<|>$/g, '').split('#')[0]
    if (!target || /^[a-z][a-z\d+.-]*:/i.test(target)) continue
    if (!existsSync(resolve(dirname(file), decodeURIComponent(target)))) failures.push(`${file}: ${match[1]}`)
  }
}
if (failures.length) {
  console.error(failures.join('\n'))
  process.exitCode = 1
} else console.log(`Local links valid in ${documents.length} current documentation entry points.`)
