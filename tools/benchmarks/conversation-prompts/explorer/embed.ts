import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { credential, boundedJson, checkPrices, metadata } from '../run.ts';
import { hash, readRuns } from './data.ts';

async function main() {
  const [out, ...directories] = process.argv.slice(2);
  if (!out || !directories.length) throw Error('Usage: embed.ts OUTPUT_DIRECTORY RUN_DIRECTORY...');
  mkdirSync(out, { recursive: true });
  const rows = readRuns(directories);
  const unique = [...new Map(rows.map((r: any) => [r.textHash, { hash: r.textHash, text: r.text }])).values()] as { hash: string; text: string }[];
  const model = 'openai/text-embedding-3-small', dimensions = 512, rate = 0.00000002;
  const bytes = unique.reduce((s, x) => s + Buffer.byteLength(x.text), 0);
  const reservation = (bytes + unique.length * 1024) * rate;
  if (reservation > 0.10 || unique.some(x => Buffer.byteLength(x.text) > 8000)) throw Error('Embedding budget exceeded');
  const signature = hash(JSON.stringify({ model, dimensions, hashes: unique.map(x => x.hash).sort() }));
  const planFile = `${out}/embedding-plan.json`;
  if (existsSync(planFile)) {
    if (JSON.parse(readFileSync(planFile, 'utf8')).signature !== signature) throw Error('Embedding corpus changed: use a new output directory');
  } else writeFileSync(planFile, JSON.stringify({ signature, model, dimensions, reservationUsd: reservation, uniqueTexts: unique.length, directories, retries: 0 }, null, 2), { flag: 'wx' });
  const cacheFile = `${out}/embeddings.jsonl`;
  const cache = existsSync(cacheFile) ? readFileSync(cacheFile, 'utf8').trim().split('\n').filter(Boolean).map(x => JSON.parse(x)) : [];
  if (cache.some(x => x.model !== model || x.vector?.length !== dimensions || !x.vector.every(Number.isFinite))) throw Error('Invalid embedding cache');
  const done = new Set(cache.map(x => x.hash));
  const pending = unique.filter(x => !done.has(x.hash));
  if (!pending.length) { console.log('All embeddings cached'); return; }
  const key = credential();
  const catalogResponse = await fetch('https://openrouter.ai/api/v1/embeddings/models', { redirect: 'error', headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(20000) });
  if (!catalogResponse.ok) throw Error(`Embedding catalog HTTP ${catalogResponse.status}`);
  const catalog = await boundedJson(catalogResponse, 2_000_000);
  const entry = catalog.data?.find((x: any) => x.id === model);
  if (!entry) throw Error('Embedding model missing');
  checkPrices(entry.pricing, { inputRate: rate, outputRate: 0 });
  for (let start = 0; start < pending.length; start += 32) {
    const batch = pending.slice(start, start + 32);
    const stamp: Record<string, any> = { requestedModel: model, dimensions, hashes: batch.map(x => x.hash), startedAt: new Date().toISOString(), verifiedPricing: entry.pricing };
    const begin = performance.now();
    try {
      const response = await fetch('https://openrouter.ai/api/v1/embeddings', { method: 'POST', redirect: 'error',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, dimensions, encoding_format: 'float', input: batch.map(x => x.text) }), signal: AbortSignal.timeout(45000) });
      stamp.httpStatus = response.status;
      for (const h of ['x-request-id', 'retry-after']) {
        const value = response.headers.get(h);
        if (value) stamp[h] = /^[\w.:-]{1,160}$/.test(value) ? value : '[redacted]';
      }
      const raw = await boundedJson(response, 2_000_000);
      stamp.metadata = metadata(raw, [key, ...batch.map(x => x.text)]);
      // Vectors are separately stored as content, not discarded response metadata.
      stamp.metadata.omittedFields = stamp.metadata.omittedFields.filter((x: string) => x !== 'data');
      stamp.vectorStorage = 'embeddings.jsonl';
      if (!response.ok || raw.error || ![model, 'text-embedding-3-small'].includes(raw.model) || raw.data?.length !== batch.length) throw Error('Invalid embedding response');
      const sorted = [...raw.data].sort((a, b) => a.index - b.index);
      if (sorted.some((x, i) => x.index !== i || !Array.isArray(x.embedding) || x.embedding.length !== dimensions || !x.embedding.every(Number.isFinite))) throw Error('Invalid vector shape/index');
      appendFileSync(cacheFile, sorted.map((x, i) => JSON.stringify({ hash: batch[i].hash, model, vector: x.embedding })).join('\n') + '\n');
      stamp.status = 'complete';
    } catch (error) {
      stamp.status = 'failed'; stamp.failure = error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name) ? error.name : 'Embedding request or validation failed';
    }
    stamp.elapsedMs = Math.round(performance.now() - begin);
    appendFileSync(`${out}/embedding-receipts.jsonl`, JSON.stringify(stamp) + '\n');
    if (stamp.status !== 'complete') throw Error('Embedding batch failed; receipts retained, no retry');
    console.log(`Embedded ${Math.min(start + 32, pending.length)}/${pending.length} unique responses`);
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
