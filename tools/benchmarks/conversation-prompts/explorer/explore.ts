/** Reopen a saved study using cached embeddings/projections; no paid calls. */
import {readFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
const args = process.argv.slice(2);
let study = 'docs/notes/conversation-prompts/explorer-hybrid-2026-09-20/study.json';
let port = '8770';
for (let i = 0; i < args.length; i += 2) {
  if (!args[i + 1]) throw Error('Expected --study PATH or --port NUMBER');
  if (args[i] === '--study') study = args[i + 1];
  else if (args[i] === '--port') port = args[i + 1];
  else throw Error('Unknown option: ' + args[i]);
}
if (!/^\d+$/.test(port) || Number(port) < 1024 || Number(port) > 65535) throw Error('Invalid local port');
const manifest = JSON.parse(readFileSync(study, 'utf8'));
const out = dirname(resolve(study));
const built = spawnSync(process.execPath, ['tools/benchmarks/conversation-prompts/explorer/build.ts', manifest.analysisSource??out, out + '/index.html', '--study', study, ...manifest.runs.map((run: {path: string}) => run.path)], {stdio: 'inherit'});
if (built.error) throw built.error;
if (built.status !== 0) throw Error('Explorer build failed');
console.log(`Open http://127.0.0.1:${port}/ — Ctrl+C stops the server. No generation or embedding calls.`);
const served = spawnSync('python3', ['-m', 'http.server', port, '--bind', '127.0.0.1', '--directory', out], {stdio: 'inherit'});
if (served.error) throw served.error;
if (served.status !== 0 && served.signal !== 'SIGINT') throw Error('Local server failed (is the port already in use?)');
