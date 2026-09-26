import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const root = resolve(process.argv[2]);
const files = new Set(['index.html', 'plan.yaml', 'run.yaml', 'receipts.yaml', 'summary.yaml', 'README.md','repeat-audit.yaml','discussion.yaml']);
const server = createServer((req, res) => {
    const name = new URL(req.url ?? '/', 'http://localhost').pathname.slice(1) || 'index.html';
    if (req.method !== 'GET' || !files.has(name)) {
        res.writeHead(404);
        res.end('Not found');
        return;
    }
    try {
        const body = readFileSync(resolve(root, name));
        res.writeHead(200, { 'Content-Type': name.endsWith('.html') ? 'text/html; charset=utf-8' : 'text/plain; charset=utf-8', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' });
        res.end(body);
    }
    catch {
        res.writeHead(404);
        res.end('Not found');
    }
});
server.listen(0, '127.0.0.1', () => { const a = server.address(); if (a && typeof a === 'object')
    console.log('http://127.0.0.1:' + a.port); });
