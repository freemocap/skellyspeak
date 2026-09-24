import { createServer } from 'node:http'
import { randomBytes } from 'node:crypto'
import { chmodSync, readFileSync, renameSync, unlinkSync, writeFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'
import { catalog, inspect, LIMIT, readEntry, repository, safePath } from './catalog.ts'

export function save(root: string, path: string, text: string, expected: string) {
  if (typeof text !== 'string' || Buffer.byteLength(text) > LIMIT) throw Error('Text must be at most 1 MiB.')
  const entry = readEntry(root, path)
  if (!entry.editable) throw Error('Generated schemas and bibliography are read-only in this tool.')
  if (entry.revision !== expected) throw Error('Conflict: this file changed on disk. Your draft has not been saved. Copy it, then reload and reconcile.')
  const parsed = inspect(path, text)
  if (parsed.errors.length) throw Error(`Cannot save invalid syntax: ${parsed.errors.join('\n')}`)
  const filename = safePath(root, path)
  const temporary = `${filename}.${randomBytes(12).toString('hex')}.tmp`
  try {
    writeFileSync(temporary, text, { flag: 'wx', mode: statSync(filename).mode })
    chmodSync(temporary, statSync(filename).mode)
    if (readEntry(root, path).revision !== expected) throw Error('Conflict: file changed during save.')
    renameSync(temporary, filename)
  } finally {
    try { unlinkSync(temporary) } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error }
  }
  return readEntry(root, path)
}

export function createWorkbench(root = repository) {
  const token = randomBytes(32).toString('hex')
  const server = createServer(async (req, res) => {
    const address = server.address()
    const host = address && typeof address !== 'string' ? `127.0.0.1:${address.port}` : ''
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'")
    const json = (value: unknown, status = 200) => { res.writeHead(status, {'Content-Type': 'application/json; charset=utf-8'}); res.end(JSON.stringify(value)) }
    if (req.headers.host !== host || (req.headers.origin && req.headers.origin !== `http://${host}`)) { json({error: 'Local same-origin access required.'}, 403); return }
    const url = new URL(req.url ?? '/', `http://${host}`)
    try {
      if (req.method === 'GET' && url.pathname === '/') {
        res.setHeader('Content-Type', 'text/html; charset=utf-8')
        res.end(readFileSync(join(import.meta.dirname, 'index.html'), 'utf8').replace('SESSION_TOKEN', token)); return
      }
      if (req.method === 'GET' && ['/client.js', '/layout.js', '/tree.js'].includes(url.pathname)) {
        res.setHeader('Content-Type', 'text/javascript; charset=utf-8')
        res.end(ts.transpileModule(readFileSync(join(import.meta.dirname, url.pathname.slice(1).replace('.js', '.ts')), 'utf8'), {compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022}}).outputText); return
      }
      if (req.method === 'GET' && url.pathname === '/style.css') { res.setHeader('Content-Type', 'text/css'); res.end(readFileSync(join(import.meta.dirname, 'style.css'))); return }
      if (req.method === 'GET' && url.pathname === '/api/catalog') { json(catalog(root)); return }
      if (req.method === 'POST' && url.pathname === '/api/save') {
        if (req.headers['x-workbench-token'] !== token || req.headers['content-type'] !== 'application/json') { json({error: 'Invalid save request.'}, 403); return }
        const chunks: Buffer[] = []; let bytes = 0
        for await (const chunk of req) { bytes += chunk.length; if (bytes > LIMIT * 6 + 4096) throw Error('Request too large.'); chunks.push(Buffer.from(chunk)) }
        const input = JSON.parse(Buffer.concat(chunks).toString('utf8'))
        if (typeof input.path !== 'string' || typeof input.revision !== 'string' || typeof input.text !== 'string') throw Error('Expected path, revision and text.')
        json(save(root, input.path, input.text, input.revision)); return
      }
      json({error: 'Not found.'}, 404)
    } catch (error) { json({error: error instanceof Error ? error.message : String(error)}, 400) }
  })
  return server
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const server = createWorkbench()
  server.listen(Number(process.env.CONTENT_WORKBENCH_PORT ?? 0), '127.0.0.1', () => {
    const address = server.address()
    if (address && typeof address !== 'string') console.log(`Content workbench: http://127.0.0.1:${address.port}\nFiles: ${repository}\nCtrl+C to stop. Saves update source files; no app build or deployment runs.`)
  })
}
