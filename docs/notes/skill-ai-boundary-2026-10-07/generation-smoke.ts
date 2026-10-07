import { readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { boundedJson, checkPrices, credential, metadata } from '../../../tools/benchmarks/conversation-prompts/run.ts';

const dir = 'docs/notes/skill-ai-boundary-2026-10-07';
const source = JSON.parse(readFileSync(`${dir}/generation-prompts.json`, 'utf8'));
const model = 'google/gemini-2.5-flash';
const provider = 'google-ai-studio';
const rates = { inputRate: 0.0000003, outputRate: 0.0000025 };
const jobs = source.cases.map((c: any) => ({ id: c.id, kind: c.kind, language: c.language, variety: c.variety,
  payload: { model, messages: c.messages, stream: false, max_tokens: 1500, temperature: 0,
    reasoning: { effort: 'none' }, provider: { only: [provider], allow_fallbacks: false, require_parameters: true } } }));
if (jobs.length !== 6 || jobs.some((j: any) => !Array.isArray(j.payload.messages))) throw Error('Expected six native message fixtures');
const reservation = jobs.reduce((sum: number, j: any) => sum + (Buffer.byteLength(JSON.stringify(j.payload)) + 4096) * rates.inputRate + 1500 * rates.outputRate, 0);
if (reservation > 0.75) throw Error('Reservation exceeds generation budget');
const catalogResponse = await fetch(`https://openrouter.ai/api/v1/models/${model}/endpoints`, { redirect: 'error', signal: AbortSignal.timeout(15000) });
if (!catalogResponse.ok) throw Error('Pricing lookup failed');
const catalog = await boundedJson(catalogResponse);
const endpoint = catalog.data?.endpoints?.find((e: any) => e.tag === provider);
if (!endpoint) throw Error('Pinned endpoint unavailable');
checkPrices(endpoint.pricing, rates);
writeFileSync(`${dir}/generation-plan.json`, JSON.stringify({ model, provider, jobs, reservationUsd: reservation, capUsd: 0.75, pricing: endpoint.pricing,
  hash: createHash('sha256').update(JSON.stringify(jobs)).digest('hex'), retries: 0, scope: 'Synthetic current native prompts; one sample per case, no reliability claim.' }, null, 2), { flag: 'wx' });
writeFileSync(`${dir}/generation-results.jsonl`, '', { flag: 'wx' });
const key = credential();
let spent = 0;
for (const job of jobs) {
  const receipt: any = { id: job.id, language: job.language, kind: job.kind, requestedModel: model, status: 'failed' };
  const start = performance.now();
  appendFileSync(`${dir}/generation-attempts.jsonl`, JSON.stringify({ id: job.id, at: new Date().toISOString() }) + '\n');
  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', { method: 'POST', redirect: 'error',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify(job.payload), signal: AbortSignal.timeout(45000) });
    receipt.httpStatus = response.status;
    receipt.headers = Object.fromEntries(['x-request-id', 'retry-after'].flatMap(name => {
      const value = response.headers.get(name); return value && /^[\w.:-]{1,160}$/.test(value) ? [[name, value]] : [];
    }));
    const raw = await boundedJson(response);
    receipt.metadata = metadata(raw, [key, ...job.payload.messages.map((m: any) => m.content)]);
    const content = raw.choices?.[0]?.message?.content;
    if (typeof content === 'string') receipt.content = content.replaceAll(key, '[REDACTED]');
    receipt.costUsd = typeof raw.usage?.cost === 'number' && Number.isFinite(raw.usage.cost) && raw.usage.cost >= 0 ? raw.usage.cost : null;
    if (!response.ok || raw.error || !content?.trim() || raw.choices?.[0]?.finish_reason !== 'stop' || raw.model !== model || receipt.costUsd === null) throw Error('Completion validation failed');
    spent += receipt.costUsd;
    if (spent > 0.75) throw Error('Reported cost exceeds budget');
    receipt.status = 'complete';
  } catch (error) { receipt.failure = error instanceof Error ? error.name : 'UnknownError'; }
  receipt.elapsedMs = Math.round(performance.now() - start);
  appendFileSync(`${dir}/generation-results.jsonl`, JSON.stringify(receipt) + '\n');
  console.log(JSON.stringify({ id: receipt.id, status: receipt.status, costUsd: receipt.costUsd, elapsedMs: receipt.elapsedMs }));
  if (receipt.status !== 'complete') throw Error('Stopped after first failure; no automatic retry');
}
console.log(JSON.stringify({ completed: jobs.length, spentUsd: spent, reservationUsd: reservation }));
