// Controlled gloss granularity/concurrency experiment, no app-state writes.
import { readFileSync, writeFileSync, appendFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { groqGlossShape } from './groq-schema.ts';
const directory = 'workflow/benchmarks/model-routing';
const fixtures = JSON.parse(readFileSync(`${directory}/split-fixtures.json`, 'utf8'));
const variants = ['whole', 'split-1', 'split-2', 'split-4'];
const model = 'openai/gpt-oss-120b';
const experiments: any[] = [];
for (let trial = 0; trial < 3; trial++) for (const [index, group] of ['es', 'ar'].entries()) {
  for (let v = 0; v < variants.length; v++) {
    const variant = variants[(v + trial + index) % variants.length];
    const jobs = fixtures.filter((f: any) => f.group === group && (variant === 'whole' ? f.part === 'whole' : f.part !== 'whole')).map((fixture: any) => {
      const payload = { model, messages: fixture.messages, temperature: 0.7, stream: false,
        reasoning_effort: 'low', max_completion_tokens: variant === 'whole' ? 4096 : 1024,
        response_format: { type: 'json_schema', json_schema: { name: 'gloss', strict: true, schema: groqGlossShape(fixture.schema) } } };
      const bytes = Buffer.byteLength(JSON.stringify(payload));
      if (bytes > 20000) throw new Error('Input exceeds benchmark bound');
      return { fixture, payload, reservation: (bytes + 1024) * 0.15e-6 + payload.max_completion_tokens * 0.6e-6 };
    });
    experiments.push({ trial, group, variant, jobs, concurrency: variant === 'whole' ? 1 : Number(variant.slice(-1)) });
  }
}
const reserved = experiments.flatMap(e => e.jobs).reduce((sum: number, j: any) => sum + j.reservation, 0);
if (reserved > 0.4) throw new Error('Experiment exceeds $0.40 bound');
console.log(JSON.stringify({ conditions: experiments.length, calls: experiments.flatMap(e => e.jobs).length, reservedUsd: reserved, retries: 0 }));
if (process.argv.includes('--live')) {
  const configuredKey = readFileSync('server/local.env', 'utf8').split('\n').find(l => l.startsWith('GROQ_API_KEY='))?.split('=').slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
  if (!configuredKey) throw new Error('Missing Groq key');
  const key: string = configuredKey;
  const path = `${directory}/split-results.jsonl`;
  if (existsSync(path)) throw new Error('Refusing accidental paid rerun');
  writeFileSync(`${directory}/split-run.json`, JSON.stringify({ startedAt: new Date().toISOString(), model,
    reasoningEffort: 'low', reservedUsd: reserved, repetitions: 3, variants, pricePerToken: { input: 0.15e-6, output: 0.6e-6 },
    fixtureSha256: createHash('sha256').update(JSON.stringify(fixtures)).digest('hex') }, null, 2));
  writeFileSync(path, '');
  for (const experiment of experiments) {
    let cursor = 0;
    const groupStart = performance.now();
    async function worker() {
      while (cursor < experiment.jobs.length) {
        const job = experiment.jobs[cursor++];
        const start = performance.now();
        const result: any = { trial: experiment.trial, group: experiment.group, variant: experiment.variant,
          fixture: job.fixture.id, part: job.fixture.part, requestedModel: model, requestedProvider: 'groq-direct',
          dispatchedAfterMs: Math.round(start - groupStart), reservedUsd: job.reservation };
        try {
          const response = await fetch('https://api.groq.com/openai/v1/chat/completions', { method: 'POST',
            headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(job.payload), signal: AbortSignal.timeout(90000) });
          result.httpStatus = response.status;
          const raw: any = await response.json();
          result.actualModel = raw.model; result.id = raw.id; result.usage = raw.usage;
          result.content = raw.choices?.[0]?.message?.content ?? '';
          result.finishReason = raw.choices?.[0]?.finish_reason;
          if (raw.usage) result.estimatedCostUsd = raw.usage.prompt_tokens * 0.15e-6 + raw.usage.completion_tokens * 0.6e-6;
          if (raw.error) result.providerError = JSON.stringify(raw.error).replaceAll(key, '[REDACTED]');
          result.errors = !response.ok ? [`http-${response.status}`] : result.finishReason !== 'stop' ? ['incomplete'] : [];
        } catch (e: any) { result.errors = [e.name === 'TimeoutError' ? 'timeout' : 'transport']; }
        result.elapsedMs = Math.round(performance.now() - start);
        result.readyAfterMs = Math.round(performance.now() - groupStart);
        appendFileSync(path, JSON.stringify(result) + '\n');
      }
    }
    await Promise.all(Array.from({ length: experiment.concurrency }, worker));
    console.log(`${experiment.group} trial=${experiment.trial} ${experiment.variant} ${Math.round(performance.now() - groupStart)}ms`);
  }
}
