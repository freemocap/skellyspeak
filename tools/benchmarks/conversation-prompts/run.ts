import {instructionLanguageTrials} from './instruction-language.ts';
import {spanishHybridTrials} from './spanish-hybrid.ts';
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { fixture, jobs, repairJobs } from './prompts.ts';
import { factorJobs } from './factors.ts';
import { validationJobs, dialogueJobs, resolveHistory, validationFixture, type Trial } from './validation.ts';
import { revisionJobs } from './revision.ts';
import { nativeTrials, invitationFailures } from './native.ts';
import { engagementTrials, levelPairTrials } from './engagement.ts';
import { spanishResetTrials, spanishPersonaTrials, spanishVariationTrials } from './spanish-reset.ts';

const defaultModel = 'google/gemini-2.5-flash';

const inputRate = 0.0000003, outputRate = 0.0000025;
const inputCap = 16000, dollarCap = 1;
export function checkPrices(pricing: Record<string, unknown>, limits = { inputRate, outputRate }) {
  const { inputRate, outputRate } = limits;
  for (const field of ['prompt', 'completion']) {
    const n = Number(pricing[field]);
    if (pricing[field] == null || !Number.isFinite(n) || n < 0 || n > (field === 'prompt' ? inputRate : outputRate))
      throw Error(`Missing or excessive ${field} price`);
  }
  for (const [field, value] of Object.entries(pricing)) {
    if (field === 'prompt' || field === 'completion') continue;
    // Requests contain text only, no tools/search, no explicit cache writes.
    if (['image', 'audio', 'input_audio_cache', 'web_search', 'input_cache_write'].includes(field)) continue;
    if (['internal_reasoning', 'input_cache_read'].includes(field)) {
      const limit = field === 'internal_reasoning' ? outputRate : inputRate;
      if (!Number.isFinite(Number(value)) || Number(value) < 0 || Number(value) > limit) throw Error(`Excessive ${field} price`);
      continue;
    }
    // Discount metadata cannot increase the bound; reserve undiscounted unit prices.
    if (field === 'discount' && typeof value === 'number' && value >= 0 && value <= 1) continue;
    if (field === 'overrides') {
      if (!Array.isArray(value)) throw Error('Invalid price overrides');
      for (const override of value) {
        const { min_prompt_tokens, ...prices } = override;
        if (min_prompt_tokens != null && (!Number.isInteger(min_prompt_tokens) || min_prompt_tokens < 0)) throw Error('Invalid pricing tier threshold');
        // Text-only requests cannot reach tiers above the conservative byte/token bound.
        if (min_prompt_tokens > inputCap + 1024) continue;
        checkPrices({ ...pricing, overrides: [], ...prices }, limits);
      }
    } else if (!Number.isFinite(Number(value)) || Number(value) !== 0) {
      throw Error(`Unbudgeted price field: ${field}`);
    }
  }
}
export function credential() {
  if (process.env.OPENROUTER_API_KEY?.trim()) return process.env.OPENROUTER_API_KEY.trim();
  let text: string;
  try { text = readFileSync('server/development/.env', 'utf8'); }
  catch { throw Error('Configure OPENROUTER_API_KEY in the environment or server/development/.env; never paste it into chat.'); }
  const value = text.split('\n').find(line => /^\s*OPENROUTER_API_KEY\s*=/.test(line))?.split('=').slice(1).join('=').trim().replace(/^(['"])(.*)\1$/, '$2');
  if (!value) throw Error('OPENROUTER_API_KEY is missing');
  return value;
}
export async function boundedJson(response: Response, limit = 262144) {
  const reader = response.body?.getReader();
  if (!reader) throw Error('Missing response body');
  let bytes = 0; const chunks: Buffer[] = [];
  for (;;) {
    const next = await reader.read();
    if (next.done) break;
    bytes += next.value.byteLength;
    if (bytes > limit) { await reader.cancel(); throw Error('Response exceeds byte limit'); }
    chunks.push(Buffer.from(next.value));
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
// Metadata accepts explicitly reviewed field names and bounded identifiers/numbers.
// Synthetic assistant prose is the experiment artifact, kept separately from diagnostics.
export function metadata(raw: any, privateValues: string[] = []) {
  const omitted: string[] = [];
  const safe = (value: unknown, path: string): any => {
    if (value == null || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))) return value;
    if (typeof value === 'string' && value.length <= 160 && /^[\w./:-]+$/.test(value)) return value;
    omitted.push(path); return '[omitted: unreviewed or content-bearing metadata]';
  };
  const result: Record<string, unknown> = {};
  for (const name of ['id', 'model', 'provider', 'created', 'system_fingerprint']) result[name] = safe(raw[name], name);
  const usage: Record<string, unknown> = {};
  const known = new Set(['prompt_tokens', 'completion_tokens', 'total_tokens', 'cost', 'is_byok', 'cost_details', 'prompt_tokens_details', 'completion_tokens_details']);
  const numericTree = (v: any, path: string, depth = 0): any => {
    if (depth > 3) { omitted.push(path); return '[omitted: depth]'; }
    if (v && typeof v === 'object' && !Array.isArray(v)) return Object.fromEntries(Object.entries(v).slice(0, 30).map(([k, x]) => [k, numericTree(x, `${path}.${k}`, depth + 1)]));
    if (typeof v === 'number' || typeof v === 'boolean' || v == null) return v;
    omitted.push(path); return '[omitted: nonnumeric usage metadata]';
  };
  for (const [k, v] of Object.entries(raw.usage ?? {})) {
    if (known.has(k)) usage[k] = numericTree(v, `usage.${k}`); else omitted.push(`usage.${k}`);
  }
  result.usage = usage;
  result.finishReason = safe(raw.choices?.[0]?.finish_reason, 'finish_reason');
  result.nativeFinishReason = safe(raw.choices?.[0]?.native_finish_reason, 'native_finish_reason');
  if (raw.error) {
    result.errorCode = safe(raw.error.code, 'error.code');
    // Retain recognized provider reasons without retaining arbitrary echoed content.
    const reason = String(raw.error.message ?? '').toLowerCase();
    result.errorReason = ['rate limit', 'insufficient credits', 'invalid api key', 'context length',
      'timeout', 'overloaded', 'no endpoints', 'provider unavailable', 'invalid request', 'unauthorized']
      .filter(term => reason.includes(term) && !privateValues.some(value => value.toLowerCase().includes(term)));
    result.errorReasonRedaction = 'Free text omitted; recognized reason categories retained';
    omitted.push('error.message', 'error.metadata');
  }
  for (const k of Object.keys(raw)) if (!['id', 'model', 'provider', 'created', 'system_fingerprint', 'usage', 'choices', 'error', 'object'].includes(k)) omitted.push(k);
  result.omittedFields = omitted;
  return result;
}
export async function main(args = process.argv.slice(2)) {
  const modelIndex = args.indexOf('--model');
  const model = modelIndex < 0 ? ((args.includes('--spanish-reset') || args.includes('--spanish-persona') || args.includes('--spanish-variation') || args.includes('--spanish-hybrid')) ? 'google/gemini-2.5-flash-lite' : defaultModel) : args[modelIndex + 1];
  if (![defaultModel, 'google/gemini-2.5-flash-lite', 'google/gemini-3.8-flash', 'openai/gpt-5.4-mini', 'openai/gpt-6-astra'].includes(model)) throw Error('Unsupported comparison model');
  const provider = model.startsWith('openai/') ? 'openai' : 'google-ai-studio';
  const reference = model === 'openai/gpt-6-astra';
  const rates = model === 'google/gemini-2.5-flash-lite' ? { inputRate: 0.0000001, outputRate: 0.0000004 } : reference ? { inputRate: 0.00001, outputRate: 0.00005 } : model === defaultModel ? { inputRate, outputRate } : { inputRate: 0.00000075, outputRate: model.startsWith('openai/') ? 0.0000045 : 0.00000375 };
  if (model.startsWith('openai/') && args.includes('--minimal-reasoning')) throw Error('This comparison model does not support minimal effort');
  const studyFlags = ['--instruction-language','--spanish-hybrid', '--spanish-variation', '--spanish-persona', '--spanish-reset', '--repair', '--factors', '--validation', '--dialogues', '--revision', '--revision-dialogues'];
  if (args.some(x => !['--live', '--resume', ...studyFlags, '--native-prompts', '--engagement', '--level-pairs', '--minimal-reasoning', '--model', '--out', '--temperature', '--top-p'].includes(x) && !['--out', '--native-prompts', '--model', '--temperature', '--top-p'].includes(args[args.indexOf(x) - 1]))) throw Error(`Usage: run.ts [--live] [${studyFlags.join('|')}|--native-prompts FILE] [--out DIRECTORY]`);
  if ([...studyFlags, '--native-prompts'].filter(x => args.includes(x)).length > 1) throw Error('Choose one study');
  if (args.includes('--resume') && !args.includes('--live')) throw Error('--resume requires --live');
  const nativeIndex = args.indexOf('--native-prompts');
  if (nativeIndex >= 0 && (!args[nativeIndex + 1] || args[nativeIndex + 1].startsWith('--'))) throw Error('--native-prompts needs a file');
  if ((args.includes('--engagement') || args.includes('--level-pairs')) && nativeIndex < 0) throw Error('--engagement requires --native-prompts');
  const native = nativeIndex < 0 ? null : (args.includes('--level-pairs') ? levelPairTrials : args.includes('--engagement') ? engagementTrials : nativeTrials)(args[nativeIndex + 1]);
  const outIndex = args.indexOf('--out');
  if (outIndex >= 0 && (!args[outIndex + 1] || args[outIndex + 1].startsWith('--'))) throw Error('--out needs a directory');
  const directory = outIndex < 0 ? 'docs/notes/conversation-prompts/experiment-2026-09-19' : args[outIndex + 1];
  let trials: Trial[] = args.includes('--instruction-language') ? instructionLanguageTrials() : args.includes('--spanish-hybrid') ? spanishHybridTrials() : args.includes('--spanish-variation') ? spanishVariationTrials() : args.includes('--spanish-persona') ? spanishPersonaTrials() : args.includes('--spanish-reset') ? spanishResetTrials() : native ? native.trials : args.includes('--revision') ? revisionJobs() : args.includes('--revision-dialogues') ? dialogueJobs(['compact-grounded'])
    : args.includes('--validation') ? validationJobs() : args.includes('--dialogues') ? dialogueJobs()
    : args.includes('--factors') ? factorJobs() : args.includes('--repair') ? repairJobs() : jobs();
  if (reference) {
    if (!args.includes('--engagement')) throw Error('Reference model is limited to the engagement study');
    trials = trials.filter(x => x.language === 'arabic' && x.level === 'absolute_zero');
  }
  const outputCap = reference || args.includes('--minimal-reasoning') ? 2048 : 512;
  const reasoning = reference ? { effort: 'low' } : args.includes('--minimal-reasoning') ? { effort: 'minimal' } : { enabled: false };
  const numericOption = (flag: string, minimum: number, maximum: number) => {
    const i = args.indexOf(flag);
    if (i < 0) return undefined;
    const value = Number(args[i + 1]);
    if (!args[i + 1] || !Number.isFinite(value) || value < minimum || value > maximum) throw Error(`Invalid ${flag}`);
    return value;
  };
  const requestedTemperature = numericOption('--temperature', 0, 2);
  const topP = numericOption('--top-p', 0.000001, 1);
  if (model.startsWith('openai/') && (requestedTemperature !== undefined || topP !== undefined)) throw Error('Sampling overrides are limited to Gemini studies');
  const temperature = model.startsWith('openai/') ? undefined : requestedTemperature ?? 0.7;
  const planned = trials.map(job => ({ ...job, payload: { model, messages: job.messages, stream: false,
    temperature, ...(topP === undefined ? {} : { top_p: topP }), max_tokens: outputCap, reasoning,
    provider: { only: [provider], allow_fallbacks: false, require_parameters: true } } }));
  if (planned.some(job => Buffer.byteLength(JSON.stringify(job.payload)) > inputCap)) throw Error('Input exceeds budget bound');
  const reservation = planned.length * ((inputCap + 1024) * rates.inputRate + outputCap * rates.outputRate);
  if (reservation > (reference ? 5 : dollarCap)) throw Error('Run exceeds reservation ceiling');
  const plan = { model, provider, calls: planned.length, reservationUsd: reservation, priceCeilings: rates,
    outputCap, reasoning, temperature: temperature ?? null, topP: topP ?? null, retries: 0, concurrency: 1,
    sourceSha256: args.includes('--instruction-language') ? Object.fromEntries(['instruction-language.ts','spanish-reset.ts'].map(f=>[f,createHash('sha256').update(readFileSync('tools/benchmarks/conversation-prompts/'+f)).digest('hex')])) : args.includes('--spanish-hybrid') ? Object.fromEntries(['spanish-hybrid.ts','spanish-reset.ts'].map(f=>[f,createHash('sha256').update(readFileSync('tools/benchmarks/conversation-prompts/'+f)).digest('hex')])) : (args.includes('--spanish-reset') || args.includes('--spanish-persona') || args.includes('--spanish-variation') || args.includes('--spanish-hybrid')) ? { 'tools/benchmarks/conversation-prompts/spanish-reset.ts': createHash('sha256').update(readFileSync('tools/benchmarks/conversation-prompts/spanish-reset.ts')).digest('hex') } : ['--validation', '--dialogues', '--revision', '--revision-dialogues'].some(x => args.includes(x)) ? validationFixture.sourceSha256 : fixture.sourceSha256,
    ...(native ? { nativeVersion: native.source.version, nativeContentHash: native.source.contentHash, sourceSha256: undefined } : {}),
    fixtureSha256: createHash('sha256').update(JSON.stringify(planned)).digest('hex'), jobs: planned };
  mkdirSync(directory, { recursive: true });
  // Exclusive creation prevents silently replacing an experiment, including its prompts.
  if (!args.includes('--live')) {
    writeFileSync(`${directory}/plan.json`, JSON.stringify(plan, null, 2) + '\n', { flag: 'wx' });
    console.log(JSON.stringify({ mode: 'offline', calls: planned.length, reservationUsd: reservation, directory })); return;
  }
  const key = credential();
  const catalogResponse = await fetch(`https://openrouter.ai/api/v1/models/${model}/endpoints`, { redirect: 'error', signal: AbortSignal.timeout(20000) });
  if (!catalogResponse.ok) throw Error(`Catalog HTTP ${catalogResponse.status}`);
  const catalog = await boundedJson(catalogResponse);
  const endpoint = catalog.data?.endpoints?.find((e: any) => e.tag === provider);
  if (!endpoint) throw Error('Pinned provider unavailable');
  checkPrices(endpoint.pricing, rates);
  const savedPlan = JSON.parse(readFileSync(`${directory}/plan.json`, 'utf8'));
  if (savedPlan.fixtureSha256 !== plan.fixtureSha256) throw Error('Plan changed; use a fresh output directory');
  const resume = args.includes('--resume');
  const prior: any[] = resume ? readFileSync(`${directory}/results.jsonl`, 'utf8').trim().split('\n').filter(Boolean).map(x => JSON.parse(x)) : [];
  if (resume && planned.some(x => x.dialogueId)) throw Error('Resume is limited to independent calls');
  if (prior.some(x => !planned.some(job => job.id === x.id))) throw Error('Unexpected prior result');
  const completed = new Set(prior.filter(x => x.status === 'complete').map(x => x.id));
  if (!resume) {
    writeFileSync(`${directory}/results.jsonl`, '', { flag: 'wx' });
    writeFileSync(`${directory}/run.json`, JSON.stringify({ startedAt: new Date().toISOString(), ...plan, verifiedPricing: endpoint.pricing }, null, 2), { flag: 'wx' });
  } else appendFileSync(`${directory}/resume-events.jsonl`, JSON.stringify({ at: new Date().toISOString(), completed: completed.size, remaining: planned.length - completed.size, verifiedPricing: endpoint.pricing, explicitResume: true }) + '\n');
  const histories = new Map<string, { role: string; content: string }[]>();
  let failedInvitations = 0;
  for (const job of planned) {
    if (completed.has(job.id)) continue;
    const messages = resolveHistory(job, histories);
    const payload = { ...job.payload, messages };
    if (Buffer.byteLength(JSON.stringify(payload)) > inputCap) throw Error('Assembled dialogue exceeds reserved input bound; no request sent');
    const start = performance.now();
    const record: Record<string, any> = { id: job.id, requestedModel: model, requestedProvider: provider,
      ...(job.dialogueId ? { requestMessages: messages } : {}) };
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', { method: 'POST',
        redirect: 'error', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload), signal: AbortSignal.timeout(45000) });
      record.httpStatus = response.status;
      for (const h of ['x-request-id', 'retry-after', 'x-ratelimit-remaining']) {
        const value = response.headers.get(h);
        if (value) record[h] = /^[\w.:-]{1,160}$/.test(value) ? value : '[omitted: unsafe header value]';
      }
      const raw = await boundedJson(response);
      record.metadata = metadata(raw, [key, ...messages.map(x => x.content)]);
      const content = raw.choices?.[0]?.message?.content;
      if (typeof content === 'string') record.content = content.replaceAll(key, '[REDACTED]');
      if (!response.ok || raw.error || !content?.trim() || raw.choices?.[0]?.finish_reason !== 'stop') throw Error('Unsuccessful or incomplete completion');
      if (raw.model !== model) throw Error('Actual model differs from pinned model');
      record.status = 'complete';
      if (native && job.scenario !== 'ending') {
        record.invitationFailures = invitationFailures(content);
        if (record.invitationFailures.length) failedInvitations++;
      }
    } catch (error) {
      record.status = 'failed';
      record.failure = error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name) ? error.name : 'Request, response or completion validation failed';
      record.validationStage = record.metadata ? 'completion' : record.httpStatus ? 'body_decode' : 'transport';
    }
    record.elapsedMs = Math.round(performance.now() - start);
    appendFileSync(`${directory}/results.jsonl`, JSON.stringify(record) + '\n');
    console.log(`${job.id}: ${record.status} (${record.elapsedMs} ms)${record.invitationFailures?.length ? `; invitation FAILED: ${record.invitationFailures.join('; ')}` : ''}`);
    if (record.status !== 'complete') throw Error('Stopped at first failure; results retained. No automatic retries.');
    if (job.dialogueId) histories.set(job.dialogueId, [...messages.slice(1), { role: 'assistant', content: record.content }]);
  }
  if (failedInvitations) throw Error(`${failedInvitations} replies failed the invitation screen. Transport completion is not quality success; inspect all saved outputs. No automatic retries.`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
