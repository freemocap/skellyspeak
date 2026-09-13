// Synthetic OpenRouter screening only; does not change application routing.
import { readFileSync, writeFileSync, appendFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
const directory = 'workflow/benchmarks/model-routing';
const strong = process.argv.includes('--strong');
const inputRate = strong ? 0.000004 : 0.0000003;
const outputRate = strong ? 0.000018 : 0.0000025;
const outputCap = strong ? 4096 : 2048;
const reasoning = strong ? { effort: 'low' } : { enabled: false };
const fixtures = JSON.parse(readFileSync(`${directory}/fixtures.json`, 'utf8'));
const qwenAlternative = process.argv.includes('--qwen-alternative');
const bindings = strong ? [['google/gemini-3.1-pro-preview', 'google-ai-studio']] : qwenAlternative ? [['qwen/qwen3.8-flash', 'makora/fp4']] : [
  ['google/gemini-2.5-flash', 'google-ai-studio'],
  ['google/gemini-2.5-flash-lite', 'google-ai-studio'],
  ['qwen/qwen3.8-flash', 'alibaba'],
  ['deepseek/deepseek-v4-flash', 'deepinfra/fp8'],
  ['deepseek/deepseek-v4.1-flash', 'fireworks'],
];
// Only the schema subset present in these fixtures; fail on unsupported keywords.
export function validate(schema: any, value: any): boolean {
  const supported = ['type', 'properties', 'required', 'additionalProperties', 'items', 'oneOf', 'enum', 'minLength', 'maxLength', 'maxItems'];
  for (const key of Object.keys(schema)) if (!supported.includes(key)) throw new Error(`Unsupported schema keyword ${key}`);
  if (schema.oneOf) return schema.oneOf.filter((s: any) => validate(s, value)).length === 1;
  if (schema.enum && !schema.enum.includes(value)) return false;
  const type = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
  if (schema.type && ![schema.type].flat().includes(type)) return false;
  if (type === 'string') return [...value].length >= (schema.minLength ?? 0) && [...value].length <= (schema.maxLength ?? Infinity);
  if (type === 'array') return value.length <= (schema.maxItems ?? Infinity) && value.every((v: any) => validate(schema.items, v));
  if (type === 'object') return (schema.required ?? []).every((k: string) => k in value)
    && Object.keys(value).every(k => schema.properties[k] ? validate(schema.properties[k], value[k]) : schema.additionalProperties !== false);
  return true;
}
export function checks(f: any, content: string): string[] {
  const errors: string[] = [];
  if (!content.trim()) return ['empty'];
  if (!f.schema) return errors; // Conversation semantics require separate review.
  let data: any;
  try { data = JSON.parse(content); } catch { return ['json']; }
  if (!validate(f.schema, data)) return ['schema'];
  if (f.task === 'reaction' && !f.expected.includes(data.kind)) errors.push('reaction-meaning');
  if (f.task === 'coach') {
    const ids = new Set();
    for (const item of data.items) {
      if (!f.source.includes(item.quote)) errors.push('quote-not-in-source');
      if (ids.has(item.construct)) errors.push('duplicate-construct');
      ids.add(item.construct);
      if (/the learner|the speaker|try again/i.test(item.rationale)) errors.push('coach-voice');
      if (item.error) for (const key of ['hint','elicitation','metalinguistic']) {
        if (item.error[key].toLowerCase().includes(item.error.target_hypothesis.toLowerCase())) errors.push('hidden-answer-leak');
      }
    }
    if (f.id === 'coach-clear' && data.items.some((i: any) => i.error)) errors.push('invented-error');
  }
  if (f.task === 'gloss') {
    let next = 0;
    for (const span of data.spans) {
      const first = Number(span.first.slice(1)), last = Number(span.last.slice(1));
      if (first !== next || last < first) errors.push('span-coverage');
      next = last + 1;
      if (f.language === 'Arabic' && [5,6,7,8].includes(first)) errors.push('arabic-word-split');
    }
    if (next !== [...f.source].length) errors.push('span-coverage');
  }
  return errors;
}
async function main() {
  const jobs: any[] = [];
  for (let i = 0; i < fixtures.length; i++) for (let j = 0; j < bindings.length; j++) {
    const [model, provider] = bindings[(j + i) % bindings.length];
    const fixture = fixtures[i];
    if (strong && fixture.task === 'conversation') continue;
    const payload: any = { model, messages: fixture.messages, stream: false, max_tokens: outputCap,
      temperature: 0.7, reasoning, provider: { only: [provider], allow_fallbacks: false, require_parameters: true } };
    if (fixture.schema) payload.response_format = { type: 'json_schema', json_schema: { name: fixture.task, strict: true, schema: fixture.schema } };
    // UTF-8 byte count + framing reserve bounds input tokens conservatively.
    const bytes = Buffer.byteLength(JSON.stringify(payload));
    if (bytes > 16000) throw new Error('Input budget exceeded');
    jobs.push({ fixture, model, provider, payload, reservation: (bytes + 1024) * inputRate + outputCap * outputRate });
  }
  const reserved = jobs.reduce((sum, j) => sum + j.reservation, 0);
  if (reserved > 2) throw new Error('Run exceeds $2 ceiling');
  console.log(JSON.stringify({ calls: jobs.length, maxUsdAtPriceCeilings: reserved, concurrency: 2, retries: 0 }));
  if (!process.argv.includes('--live')) return;
  // Recheck endpoint prices before spending. No paid calls if prices exceed the reservation.
  for (const [model, provider] of bindings) {
    const response = await fetch(`https://openrouter.ai/api/v1/models/${model}/endpoints`);
    if (!response.ok) throw new Error(`Catalog HTTP ${response.status}`);
    const catalog: any = await response.json();
    const endpoint = catalog.data.endpoints.find((e: any) => e.tag === provider);
    if (!endpoint) throw new Error(`Missing endpoint ${model} ${provider}`);
    for (const p of [endpoint.pricing, ...(endpoint.pricing.overrides ?? [])]) {
      if (Number(p.prompt) > inputRate || Number(p.completion) > outputRate || Number(p.request ?? 0) > 0) throw new Error('Endpoint price exceeds budget rates');
    }
  }
  const configuredKey = readFileSync('server/local.env', 'utf8').split('\n').find(l => l.startsWith('OPENROUTER_API_KEY='))?.split('=').slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
  if (!configuredKey) throw new Error('OpenRouter key missing');
  const key: string = configuredKey;
  const output = `${directory}/${strong ? 'strong-results' : qwenAlternative ? 'qwen-alternative-results' : 'results'}.jsonl`;
  if (existsSync(output)) throw new Error('Results already exist; refusing an accidental paid rerun');
  writeFileSync(`${directory}/${strong ? 'strong-run' : qwenAlternative ? 'qwen-alternative-run' : 'run'}.json`, JSON.stringify({ startedAt: new Date().toISOString(), bindings, reservedUsd: reserved, fixtureSha256: createHash('sha256').update(JSON.stringify(fixtures)).digest('hex'), concurrency: 2, reasoning, outputCap }, null, 2));
  writeFileSync(output, '');
  let cursor = 0;
  async function worker() {
    while (cursor < jobs.length) {
      const job = jobs[cursor++];
      const start = performance.now();
      const result: any = { fixture: job.fixture.id, task: job.fixture.task, requestedModel: job.model, requestedProvider: job.provider, reservedUsd: job.reservation };
      try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(job.payload), signal: AbortSignal.timeout(90000),
        });
        result.httpStatus = response.status;
        const raw: any = await response.json();
        result.provider = raw.provider; result.actualModel = raw.model; result.id = raw.id; result.usage = raw.usage;
        result.finishReason = raw.choices?.[0]?.finish_reason;
        result.content = raw.choices?.[0]?.message?.content ?? '';
        result.reasoningCharacters = raw.choices?.[0]?.message?.reasoning?.length ?? 0;
        result.errors = response.ok ? checks(job.fixture, result.content) : [`http-${response.status}`];
        if (raw.error) result.providerError = JSON.stringify(raw.error).replaceAll(key, '[REDACTED]');
        if (response.ok && result.finishReason !== 'stop') result.errors.push('incomplete');
      } catch (error: any) { result.errors = [error.name === 'TimeoutError' ? 'timeout' : 'transport']; }
      result.elapsedMs = Math.round(performance.now() - start);
      appendFileSync(output, JSON.stringify(result) + '\n');
      console.log(`${job.fixture.id} ${job.model} ${result.elapsedMs}ms ${result.errors.join(',') || 'mechanical-pass'}`);
    }
  }
  await Promise.all([worker(), worker()]);
}
if (import.meta.main) await main();
