// Direct Groq comparison: same frozen fixtures, no production integration.
import { readFileSync, writeFileSync, appendFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { checks } from './screening.ts';
import { groqSchema, groqGlossShape } from './groq-schema.ts';
const nativeGloss = process.argv.includes('--native-gloss');
const compatibleGloss = process.argv.includes('--compatible-gloss');
const directory = 'workflow/benchmarks/model-routing';
const allFixtures = JSON.parse(readFileSync(`${directory}/${nativeGloss ? 'native-gloss-fixtures' : 'fixtures'}.json`, 'utf8'));
const fixtures = compatibleGloss ? allFixtures.filter((f: any) => f.task === 'gloss') : allFixtures;
// Dated official Groq model table, 2026-09-13. [@groqModels20260913]
const bindings = [
  { model: 'qwen/qwen3.8-27b', reasoning: 'none', input: 0.8e-6, output: 4e-6 },
  { model: 'openai/gpt-oss-20b', reasoning: 'low', input: 0.075e-6, output: 0.30e-6 },
  { model: 'openai/gpt-oss-120b', reasoning: 'low', input: 0.15e-6, output: 0.60e-6 },
];
const jobs = fixtures.flatMap((fixture: any, i: number) => bindings.map((_, j) => {
  const binding = bindings[(i + j) % bindings.length];
  const payload: any = { model: binding.model, messages: fixture.messages, stream: false,
    max_completion_tokens: 2048, temperature: 0.7, reasoning_effort: binding.reasoning };
  if (fixture.schema) payload.response_format = { type: 'json_schema', json_schema: { name: fixture.task, strict: true, schema: nativeGloss ? groqGlossShape(fixture.schema) : compatibleGloss ? groqSchema(fixture.schema) : fixture.schema } };
  const bytes = Buffer.byteLength(JSON.stringify(payload));
  if (bytes > 16000) throw new Error('Input limit exceeded');
  return { fixture, binding, payload, reservation: (bytes + 1024) * binding.input + 2048 * binding.output };
}));
const reservation = jobs.reduce((sum: number, j: any) => sum + j.reservation, 0);
if (reservation > 0.4) throw new Error('Groq screen exceeds $0.40 ceiling');
console.log(JSON.stringify({ calls: jobs.length, reservationUsd: reservation, retries: 0, concurrency: 2 }));
if (process.argv.includes('--live')) {
  const candidate = readFileSync('server/local.env', 'utf8').split('\n').find(l => l.startsWith('GROQ_API_KEY='))?.split('=').slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
  if (!candidate) throw new Error('Groq key missing');
  const key: string = candidate;
  const catalogResponse = await fetch('https://api.groq.com/openai/v1/models', { headers: { Authorization: `Bearer ${key}` } });
  if (!catalogResponse.ok) throw new Error(`Groq catalog HTTP ${catalogResponse.status}`);
  const catalog: any = await catalogResponse.json();
  if (bindings.some(b => !catalog.data.some((m: any) => m.id === b.model))) throw new Error('Model unavailable');
  const output = `${directory}/${nativeGloss ? 'groq-native-gloss-results' : compatibleGloss ? 'groq-compatible-gloss-results' : 'groq-results'}.jsonl`;
  if (existsSync(output)) throw new Error('Refusing accidental paid rerun');
  writeFileSync(`${directory}/${nativeGloss ? 'groq-native-gloss-run' : compatibleGloss ? 'groq-compatible-gloss-run' : 'groq-run'}.json`, JSON.stringify({ startedAt: new Date().toISOString(), bindings,
    fixtureSha256: createHash('sha256').update(JSON.stringify(fixtures)).digest('hex'), reservationUsd: reservation,
    outputCap: 2048, concurrency: 2, compatibleGloss, nativeGloss, pricesSource: 'https://console.groq.com/docs/models' }, null, 2));
  writeFileSync(output, '');
  let cursor = 0;
  async function worker() {
    while (cursor < jobs.length) {
      const job = jobs[cursor++];
      const start = performance.now();
      const result: any = { fixture: job.fixture.id, task: job.fixture.task, requestedModel: job.binding.model,
        requestedProvider: 'groq-direct', reasoningEffort: job.binding.reasoning, reservedUsd: job.reservation };
      try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', { method: 'POST',
          headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(job.payload), signal: AbortSignal.timeout(90000) });
        result.httpStatus = response.status;
        const raw: any = await response.json();
        result.actualModel = raw.model; result.id = raw.id; result.usage = raw.usage;
        result.finishReason = raw.choices?.[0]?.finish_reason;
        result.content = raw.choices?.[0]?.message?.content ?? '';
        result.reasoningCharacters = raw.choices?.[0]?.message?.reasoning?.length ?? 0;
        if (raw.usage) result.estimatedCostUsd = raw.usage.prompt_tokens * job.binding.input + raw.usage.completion_tokens * job.binding.output;
        result.errors = response.ok ? checks(nativeGloss ? { ...job.fixture, task: 'native-gloss' } : job.fixture, result.content) : [`http-${response.status}`];
        if (raw.error) result.providerError = JSON.stringify(raw.error).replaceAll(key, '[REDACTED]');
        if (response.ok && result.finishReason !== 'stop') result.errors.push('incomplete');
      } catch (error: any) { result.errors = [error.name === 'TimeoutError' ? 'timeout' : 'transport']; }
      result.elapsedMs = Math.round(performance.now() - start);
      appendFileSync(output, JSON.stringify(result) + '\n');
      console.log(`${result.fixture} ${result.requestedModel} ${result.elapsedMs}ms ${result.errors.join(',') || 'mechanical-pass'}`);
    }
  }
  await Promise.all([worker(), worker()]);
}
