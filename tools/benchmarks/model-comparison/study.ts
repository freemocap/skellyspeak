/** Private, read-only recorded-request comparison. No app publication. */
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, appendFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { boundedJson, checkPrices, credential, metadata } from '../conversation-prompts/run.ts';

export const kinds = ['persona_reply', 'persona_opening', 'coach_reply', 'coach_feedback',
  'coach_retry_check', 'user_word_gloss', 'persona_word_gloss', 'reply_brief', 'reply_assistance', 'reply_explanations'];
function canonical(value: any): any {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])]));
  return value;
}
export const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
const read = (path: string) => JSON.parse(readFileSync(path, 'utf8'));
const save = (path: string, value: unknown) => writeFileSync(path, JSON.stringify(value, null, 2), { flag: 'wx' });
export type Case = { id: string; kind: string; language: string; turn: string; conversation: string;
  model: string; fastModel: string; messages: any[]; source: string; context: any; payload?: any };
type Job = { id: string; caseId: string; arm: string; repetition: number; payload: any; reservation: number };
export function reservation(payload: any, rates: { inputRate: number; outputRate: number }) {
  return (Buffer.byteLength(JSON.stringify(payload)) + 4096) * rates.inputRate + payload.max_tokens * rates.outputRate;
}
export function jobsFor(cases: Case[], repetitions: number, rates: any): Job[] {
  const jobs: Job[] = [];
  for (let repetition = 0; repetition < repetitions; repetition++) {
    for (const [index, c] of cases.entries()) {
      // Counterbalance order within each matched case, not two time-separated model blocks.
      const arms = (index + repetition) % 2 ? ['fast', 'standard'] : ['standard', 'fast'];
      for (const arm of arms) {
        const model = arm === 'fast' ? c.fastModel : c.model;
        const payload = { ...c.payload, model };
        jobs.push({ id: `${c.id}-${repetition}-${arm}`, caseId: c.id, arm, repetition, payload,
          reservation: reservation(payload, rates[arm]) });
      }
    }
  }
  return jobs;
}
export function native(input: string, output: string) {
  const result = spawnSync('cargo', ['test', '--manifest-path', 'native/Cargo.toml', '--lib',
    'model_comparison_boundary', '--', '--ignored', '--exact',
    'conversations::execution::tests::model_comparison::model_comparison_boundary'], {
    stdio: 'inherit', env: { ...process.env, MODEL_COMPARISON_INPUT: resolve(input), MODEL_COMPARISON_OUTPUT: resolve(output) },
  });
  if (result.status !== 0) throw Error('Native experiment boundary failed');
  return read(output);
}
function capture(directory: string, database: string) {
  mkdirSync(directory, { recursive: true });
  const db = new DatabaseSync(database, { readOnly: true });
  try {
    db.exec('BEGIN');
    const config: any = db.prepare('SELECT standard_model,fast_model FROM ai_config').get();
    if (!config || config.standard_model === config.fast_model) throw Error('Distinct model selections required');
    const rows: any[] = db.prepare(`SELECT a.id,a.requested_model model,a.request_messages messages,
      o.kind,t.id turn,t.conversation_id conversation,t.context,c.language_id language,
      (SELECT m.text FROM messages m WHERE m.turn_id=t.id AND m.role=CASE WHEN o.kind='user_word_gloss' THEN 'user' ELSE 'assistant' END) source
      FROM attempts a JOIN operations o ON a.operation_id=o.id JOIN turns t ON o.turn_id=t.id
      JOIN conversations c ON c.id=t.conversation_id WHERE a.state='succeeded' AND a.request_messages IS NOT NULL
      ORDER BY a.started_at DESC`).all();
    const selected = new Map<string, Case>();
    for (const r of rows) {
      if (!kinds.includes(r.kind) || r.model !== config.standard_model) continue;
      const key = `${r.kind}:${r.language}`;
      if (selected.has(key) || [...selected.values()].filter(c => c.kind === r.kind).length >= 2) continue;
      const context = JSON.parse(r.context);
      // Access/credential state is not needed by any output-contract builder.
      for (const field of ['target', 'retryTargets', 'speechTarget', 'speechUsageByAttempt']) delete context[field];
      selected.set(key, { ...r, origin: 'recorded', messages: JSON.parse(r.messages), context, fastModel: config.fast_model });
    }
    db.exec('COMMIT');
    if (!selected.size) throw Error('No eligible recorded requests');
    save(join(directory, 'capture.json'), { mode: 'export', capturedAt: new Date().toISOString(),
      models: config, cases: [...selected.values()] });
  } finally { db.close(); }
  console.log('Saved private recorded cases; no network calls.');
}
async function plan(directory: string) {
  const exported = existsSync(join(directory, 'native.json')) ? read(join(directory, 'native.json'))
    : native(join(directory, 'capture.json'), join(directory, 'native.json'));
  const captured = read(join(directory, 'capture.json'));
  if (hash(exported.cases.map(({ payload, ...c }: any) => c)) !== hash(captured.cases)) throw Error('Native export differs from capture');
  // Fetch live text prices before making a bounded, immutable request plan.
  const rates: any = {}; const catalogs: any = {};
  for (const [arm, model] of Object.entries({ standard: exported.models.standard_model, fast: exported.models.fast_model })) {
    const response = await fetch(`https://openrouter.ai/api/v1/models/${model}/endpoints`, { redirect: 'error', signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw Error(`Price lookup failed (${response.status})`);
    const catalog = await boundedJson(response);
    const endpoints = catalog.data?.endpoints;
    if (!Array.isArray(endpoints) || !endpoints.length) throw Error('No model endpoints');
    // Same endpoint for both models; explicitly pinned, without fallback.
    const selected = endpoints.find((e: any) => e.tag === 'google-ai-studio');
    if (!selected) throw Error('Shared experiment endpoint unavailable');
    rates[arm] = { inputRate: Number(selected.pricing.prompt), outputRate: Number(selected.pricing.completion) };
    checkPrices(selected.pricing, rates[arm]);
    catalogs[arm] = { model, provider: selected.tag, pricing: selected.pricing };
  }
  const body = freezePlan(exported, rates, catalogs);
  save(join(directory, 'plan.json'), { ...body, hash: hash(body) });
  console.log(JSON.stringify({ cases: body.cases.length, calls: body.jobs.length, reservationUsd: body.reservationUsd }));
}
export function freezePlan(exported: any, rates: any, catalogs: any) {
  if (exported.models.standard_model !== catalogs.standard.model || exported.models.fast_model !== catalogs.fast.model)
    throw Error('Pricing snapshot model mismatch');
  for (const arm of ['standard', 'fast']) checkPrices(catalogs[arm].pricing, rates[arm]);
  const cases = exported.cases.map((c: Case) => ({ ...c, payload: { ...c.payload,
    provider: { only: [catalogs.standard.provider], allow_fallbacks: false, require_parameters: true } } }));
  const jobs = jobsFor(cases, 2, rates);
  const reserve = jobs.reduce((sum, j) => sum + j.reservation, 0);
  if (!Number.isFinite(reserve) || reserve > 5) throw Error('Reservation exceeds $5 pilot cap');
  return { cases, jobs, rates, catalogs, reservationUsd: reserve, capUsd: 5,
    repetitions: 2, capturedAt: exported.capturedAt, createdAt: new Date().toISOString(),
    limitations: ['Recorded cases use saved prompts and reconstructed current contracts; synthetic cases use current native prompt builders and fictional fixed replies.',
      'Independent fixed-input calls; excludes hosted-service overhead, graph scheduling, audio, and downstream changes.',
      'Two repetitions are an exploratory screen, not evidence of equivalence.'] };
}
async function live(directory: string) {
  const { hash: expected, ...plan } = read(join(directory, 'plan.json'));
  if (hash(plan) !== expected) throw Error('Plan hash mismatch');
  const interval = plan.minimumIntervalMs ?? 0;
  if (!Number.isInteger(interval) || interval < 0 || interval > 60000) throw Error('Invalid request spacing');
  const key = credential();
  for (const arm of ['standard', 'fast']) {
    const response = await fetch(`https://openrouter.ai/api/v1/models/${plan.catalogs[arm].model}/endpoints`, { redirect: 'error', signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw Error('Price recheck failed');
    const raw = await boundedJson(response);
    const endpoint = raw.data?.endpoints?.find((e: any) => e.tag === plan.catalogs[arm].provider);
    if (!endpoint) throw Error('Pinned endpoint unavailable');
    checkPrices(endpoint.pricing, plan.rates[arm]);
  }
  save(join(directory, 'run.json'), { planHash: expected, startedAt: new Date().toISOString(), retries: 0 });
  writeFileSync(join(directory, 'results.jsonl'), '', { flag: 'wx' });
  for (const job of plan.jobs as Job[]) {
    if (interval) await new Promise(resolve => setTimeout(resolve, interval));
    const started = performance.now();
    const receipt: any = { id: job.id, caseId: job.caseId, arm: job.arm, repetition: job.repetition,
      requestedModel: job.payload.model, startedAt: new Date().toISOString(), status: 'failed' };
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', { method: 'POST', redirect: 'error',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(job.payload), signal: AbortSignal.timeout(120000) });
      receipt.httpStatus = response.status;
      receipt.headersMs = performance.now() - started;
      receipt.headers = Object.fromEntries(['x-request-id', 'retry-after', 'x-ratelimit-remaining'].flatMap(k => {
        const v = response.headers.get(k); return v ? [[k, /^[\w.:-]{1,160}$/.test(v) ? v : '[omitted]']] : [];
      }));
      const raw = await boundedJson(response, 1048576);
      receipt.metadata = metadata(raw, [key, ...job.payload.messages.map((m: any) => m.content)]);
      const choice = raw.choices?.[0];
      if (typeof choice?.message?.content === 'string') receipt.content = choice.message.content.replaceAll(key, '[secret redacted]');
      if (!response.ok || raw.error || !receipt.content?.trim() || choice?.finish_reason !== 'stop') throw Error('Incomplete response');
      if (raw.model !== job.payload.model) throw Error('Model identity mismatch');
      receipt.status = 'complete';
    } catch (error) {
      receipt.failure = error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name) ? error.name : 'Request or response rejected';
      receipt.stage = receipt.metadata ? 'completion' : receipt.httpStatus ? 'response_decode' : 'transport';
    }
    receipt.elapsedMs = Math.round(performance.now() - started);
    appendFileSync(join(directory, 'results.jsonl'), JSON.stringify(receipt) + '\n');
    console.log(`${receipt.id}: ${receipt.status}, ${receipt.elapsedMs} ms`);
    if (receipt.status !== 'complete') throw Error('Stopped at failure; receipts saved. No automatic retry.');
  }
}
function replay(directory: string) {
  const plan = read(join(directory, 'plan.json'));
  const receipts = readFileSync(join(directory, 'results.jsonl'), 'utf8').trim().split('\n').filter(Boolean).map(x => JSON.parse(x));
  const cases = receipts.filter(r => r.status === 'complete').map(r => ({
    ...plan.cases.find((c: Case) => c.id === r.caseId), id: r.id,
    completion: { text: r.content, finish_reason: r.metadata.finishReason, actual_model: r.metadata.model,
      provider_id: r.metadata.provider ?? '', input_tokens: r.metadata.usage.prompt_tokens ?? null,
      output_tokens: r.metadata.usage.completion_tokens ?? null, diagnostics: null },
  }));
  save(join(directory, 'replay-input.json'), { mode: 'replay', cases });
  native(join(directory, 'replay-input.json'), join(directory, 'validation.json'));
}
export async function main() {
  const [mode, directory, database] = process.argv.slice(2);
  if (!directory || !['capture', 'plan', 'live', 'replay'].includes(mode)) throw Error('Usage: study.ts capture|plan|live|replay PRIVATE_DIRECTORY [DATABASE]');
  if (mode === 'capture') capture(directory, database ?? join(process.env.APPDATA!, 'com.freemocap.skellyspeak/skellyspeak.sqlite3'));
  if (mode === 'plan') await plan(directory);
  if (mode === 'live') await live(directory);
  if (mode === 'replay') replay(directory);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => { console.error(error instanceof Error ? error.message : 'Experiment failed'); process.exitCode = 1; });
}
