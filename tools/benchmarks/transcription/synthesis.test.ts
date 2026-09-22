import { test } from 'node:test';
import assert from 'node:assert/strict';
import { speechRequest, synthesize, defaultElevenVoice } from './synthesis.ts';
test('Eleven v3 uses app accent cue and normalization settings', () => {
  const request = speechRequest({ provider: 'elevenlabs', text: 'بدي مي', variety: 'Levantine Arabic' }, 'private', defaultElevenVoice);
  assert.deepEqual(request.body, { model_id: 'eleven_v3', text: '[Levantine Arabic accent]\nبدي مي', apply_text_normalization: 'off' });
  assert.ok(request.url.includes(defaultElevenVoice));
});
test('OpenRouter requests app read-aloud instruction and complete streamed PCM', async () => {
  const input = { provider: 'openrouter' as const, text: '你好', variety: 'Mandarin Chinese' };
  const request = speechRequest(input, 'private', 'unused');
  assert.equal(request.body.stream, true); assert.equal(request.body.audio?.format, 'pcm16');
  assert.ok(request.body.messages?.[0].content.includes('Mandarin Chinese'));
  const event = (value: unknown) => `data: ${JSON.stringify(value)}\n\n`;
  const bytes = Buffer.alloc(4800);
  const stream = event({ id: 'request-1', model: 'openai/gpt-audio-mini', choices: [{ delta: { audio: { data: bytes.toString('base64'), transcript: '你好', id: 'audio-1' } } }] })
    + event({ choices: [{ delta: { audio: { expires_at: 123456 } } }] })
    + event({ choices: [], usage: { prompt_tokens: 14, completion_tokens: 22, cost: 0.001 } }) + 'data: [DONE]\n\n';
  const result = await synthesize(input, 'private', 'unused', async () => new Response(stream));
  assert.equal(result.error, undefined); assert.equal(result.audio?.length, 4844);
  assert.equal(Buffer.from(result.audio!).readUInt32LE(24), 24000);
  assert.ok(JSON.stringify(result.metadata).includes('prompt_tokens')); assert.ok(!JSON.stringify(result.metadata).includes('你好'));
  const truncated = await synthesize(input, 'private', 'unused', async () => new Response(stream.replace('data: [DONE]', '')));
  assert.ok(truncated.error); assert.equal(truncated.audio, undefined);
});
test('speech errors preserve request ID and provider code without source text', async () => {
  const result = await synthesize({ provider: 'elevenlabs', text: 'private source', variety: 'English' }, 'key', defaultElevenVoice,
    async () => new Response(JSON.stringify({ detail: { status: 'quota_exceeded', message: 'private source' } }), { status: 429, headers: { 'request-id': 'request-2', 'retry-after': '30' } }));
  assert.ok(result.error); assert.ok(JSON.stringify(result.metadata).includes('quota_exceeded'));
  assert.ok(JSON.stringify(result.metadata).includes('request-2')); assert.ok(!JSON.stringify(result.metadata).includes('private source'));
});
