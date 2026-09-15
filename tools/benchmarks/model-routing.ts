// Synthetic OpenRouter screening only; does not change application routing.
import { readFileSync, writeFileSync, appendFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { checks } from './screening.ts';
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
