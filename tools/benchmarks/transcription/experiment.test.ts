import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { encodeWav, wavMetrics } from './audio.ts';
import { conditions, score } from './experiment.ts';
import { requestFor, transcribe } from './providers.ts';
import { createWorkbench } from './server.ts';
test('scoring respects script, Arabic marks, insertions and empty references', () => {
  assert.deepEqual(score('你好。', '你好', 'zh'), { cer: 0, wer: null });
  assert.equal(score('مَرْحَبًا', 'مرحبا', 'ar').cer, 0);
  assert.equal(score('sí', 'si', 'es').cer, 0.5);
  assert.equal(score('water', 'water please now', 'en').wer, 2);
  assert.equal(score('', 'anything', 'en').cer, null);
  assert.equal(score('水', 'English words', 'zh').cer! > 1, true);
});
test('audio rejects corrupt framing and measures quiet/clipped samples', () => {
  const wav = encodeWav(new Float32Array(16000).fill(0.5));
  assert.equal(wavMetrics(wav).duration, 1); assert.equal(wavMetrics(wav).rms, 0.5);
  const broken = wav.slice(); broken[24] = 0; assert.throws(() => wavMetrics(broken));
  assert.throws(() => wavMetrics(new Uint8Array()));
  assert.throws(() => wavMetrics(encodeWav(new Float32Array(10))));
  assert.equal(wavMetrics(encodeWav(new Float32Array(16000).fill(1))).clippedFraction, 1);
});
test('all conditions use identical audio, correct language fields and no answer leakage', async () => {
  const wav = encodeWav(new Float32Array(16000));
  for (const condition of conditions) {
    const request = requestFor(condition, 'ar', wav, 'secret');
    const file = request.body.get('file') as File;
    assert.deepEqual(new Uint8Array(await file.arrayBuffer()), wav);
    assert.equal(request.body.has('prompt'), false); assert.equal(request.body.has('keyterms'), false);
    assert.equal(request.body.get(condition.provider === 'elevenlabs' ? 'language_code' : 'language'), condition.mode === 'forced' ? 'ar' : null);
    assert.equal(request.url.includes('translations'), false);
    if (condition.provider === 'elevenlabs') assert.equal(request.body.get('no_verbatim'), String(condition.cleaned));
  }
});
test('provider retains useful partial metadata while removing credentials and content', async () => {
  const condition = conditions[0]; let calls = 0;
  const result = await transcribe(condition, 'ar', new Uint8Array(), 'fixture-secret', async () => {
    calls++; return new Response(JSON.stringify({ text: 'مرحبا', language_code: 'ar', language_probability: 0.8,
      request_id: 'request-123', unknown: 'private transcript', words: [{ text: 'private', start: 0, end: 1 }], usage: { total_tokens: 42 } }), { headers: { 'request-id': 'request-123' } });
  });
  assert.equal(calls, 1); assert.equal(result.text, 'مرحبا'); assert.equal(result.status, 'ok');
  const saved = JSON.stringify(result.metadata); assert.ok(saved.includes('request-123')); assert.ok(saved.includes('total_tokens')); assert.ok(saved.includes('0.8')); assert.ok(!saved.includes('private'));
  const failure = await transcribe(condition, 'ar', new Uint8Array(), 'fixture-secret', async () => new Response(JSON.stringify({ error: { code: 'invalid_audio', message: 'fixture-secret private content', request_id: 'request-2' }, usage: { total_tokens: 12 } }), { status: 400, headers: { 'retry-after': '10' } }));
  const diagnostic = JSON.stringify(failure); assert.equal(failure.status, 'error'); assert.ok(diagnostic.includes('invalid_audio')); assert.ok(diagnostic.includes('request-2')); assert.ok(diagnostic.includes('total_tokens')); assert.ok(!diagnostic.includes('fixture-secret')); assert.ok(!diagnostic.includes('private content'));
});
test('malformed success retains HTTP/request metadata and never retries', async () => {
  let calls = 0;
  const result = await transcribe(conditions[0], 'zh', new Uint8Array(), 'key', async () => { calls++; return new Response('{bad', { headers: { 'request-id': 'abc' } }); });
  assert.equal(calls, 1); assert.equal(result.status, 'error'); assert.equal(result.metadata.httpStatus, 200); assert.equal(result.metadata.unreadable, true);
  assert.ok(JSON.stringify(result.metadata).includes('abc'));
});
test('local server protects APIs, persists audio, survives restart, and excludes keys from export', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'speech-lab-'));
  const server = createWorkbench(directory, '__TOKEN__', '', '', { groq: 'private-key' });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const address = server.address(); assert.ok(address && typeof address === 'object'); const root = `http://127.0.0.1:${address.port}`;
  try {
    const token = await (await fetch(root)).text(); const headers = { 'x-workbench-token': token, 'Content-Type': 'application/json' };
    assert.equal((await fetch(root + '/dashboard/')).status, 404);
    mkdirSync(join(directory, 'figures', 'latest'), { recursive: true });
    writeFileSync(join(directory, 'figures', 'latest', 'index.html'), '<h1>Study dashboard</h1><script>document.title = \"Study\";</script>');
    const dashboard = await fetch(root + '/dashboard/');
    assert.equal(dashboard.status, 200); assert.equal(await dashboard.text(), '<h1>Study dashboard</h1><script>document.title = \"Study\";</script>');
    assert.ok(dashboard.headers.get('content-security-policy')?.includes("default-src 'none'"));
    assert.ok(dashboard.headers.get('content-security-policy')?.includes("script-src 'sha256-"));
    assert.ok(!dashboard.headers.get('content-security-policy')?.includes("script-src 'unsafe-inline'"));
    assert.equal((await fetch(root + '/dashboard/plot-data.json')).status, 404);
    assert.equal((await fetch(root + '/dashboard/', { headers: { Origin: 'https://example.com' } })).status, 403);
    assert.equal((await fetch(root + '/api/state')).status, 403);
    assert.equal((await fetch(root + '/api/state', { headers: { ...headers, Origin: 'https://example.com' } })).status, 403);
    const wav = encodeWav(new Float32Array(16000).fill(0.1));
    const response = await fetch(root + '/api/take', { method: 'POST', headers, body: JSON.stringify({ phraseId: 'practice-7', text: 'مي', english: 'water', pronunciation: 'mayy', wav: Buffer.from(wav).toString('base64'), browser: 'test', processing: 'test', referenceVoice: 'none' }) });
    assert.equal(response.status, 200); const take = await response.json();
    assert.equal(take.duration, 1);
    const audio = await fetch(`${root}/audio/${take.id}?token=${token}`); assert.deepEqual(new Uint8Array(await audio.arrayBuffer()), wav);
    const exported = await (await fetch(root + '/api/export', { headers })).text(); assert.ok(exported.includes(take.sha256)); assert.ok(!exported.includes('private-key'));
    const remove = await fetch(root + '/api/remove', { method: 'POST', headers, body: JSON.stringify({ takeId: take.id }) });
    assert.equal(remove.status, 200);
    const hidden = await (await fetch(root + '/api/state', { headers })).json();
    assert.equal(hidden.takes.length, 0); assert.equal(hidden.removedTakes[0].id, take.id);
    const excluded = await (await fetch(root + '/api/export', { headers })).json();
    assert.equal(excluded.takes.length, 0); assert.equal(Object.keys(excluded.audio).length, 0);
    const refused = await fetch(root + '/api/run', { method: 'POST', headers, body: JSON.stringify({ takeId: take.id, conditionId: 'whisper-large-v3-forced' }) });
    assert.equal(refused.status, 409);
    const restore = await fetch(root + '/api/restore', { method: 'POST', headers, body: JSON.stringify({ takeId: take.id }) });
    assert.equal(restore.status, 200);
    const noKey = await fetch(root + '/api/run', { method: 'POST', headers, body: JSON.stringify({ takeId: take.id, conditionId: 'scribe-forced-clean' }) }); assert.equal(noKey.status, 400);
    const corrupt = await fetch(root + '/api/take', { method: 'POST', headers, body: '{}' }); assert.equal(corrupt.status, 400);
    // Read the same saved corpus through a separate process-equivalent server instance.
    const reopened = createWorkbench(directory, '__TOKEN__', '', ''); reopened.listen(0, '127.0.0.1'); await once(reopened, 'listening');
    try { const addr = reopened.address(); assert.ok(addr && typeof addr === 'object'); const url = `http://127.0.0.1:${addr.port}`; const auth = await (await fetch(url)).text();
      const state = await (await fetch(url + '/api/state', { headers: { 'x-workbench-token': auth } })).json(); assert.equal(state.takes[0].id, take.id);
    } finally { reopened.closeAllConnections(); await new Promise<void>(resolve => reopened.close(() => resolve())); }
  } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); rmSync(directory, { recursive: true }); }
});
