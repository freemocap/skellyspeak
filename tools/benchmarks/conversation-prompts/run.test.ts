import test from 'node:test';
import assert from 'node:assert/strict';
import { checkPrices, metadata } from './run.ts';
import { jobs } from './prompts.ts';
import { factorJobs } from './factors.ts';
import { validationJobs, dialogueJobs, resolveHistory } from './validation.ts';
import { revisionJobs } from './revision.ts';
import { invitationFailures } from './native.ts';

test('invitation screen rejects the shipped dead-end openings and generic check-ins', () => {
  for (const text of ['Yo como.', 'Me gusta la casa.', 'Me gusta el café.', 'Hola. Soy Lucía.', '', '¿Qué tal?', '¿Te gusta el café? ¿Y el té?']) {
    assert.ok(invitationFailures(text).length > 0, text);
  }
  for (const text of ['¿Te gusta el café?', 'بتحب القهوة؟', '你喜欢喝茶吗？']) {
    assert.deepEqual(invitationFailures(text), []);
  }
});

test('price guard refuses missing, invalid, excessive and unknown charges', () => {
  const price = { prompt: '0.0000003', completion: '0.0000025' };
  assert.doesNotThrow(() => checkPrices({ ...price, discount: 0.5 }));
  assert.doesNotThrow(() => checkPrices({ ...price, overrides: [{ min_prompt_tokens: 272000, prompt: '1' }] }));
  assert.throws(() => checkPrices({ ...price, overrides: [{ min_prompt_tokens: 1000, prompt: '1' }] }));
  assert.doesNotThrow(() => checkPrices({ ...price, image: '1', input_cache_read: '0.00000003' }));
  for (const invalid of [{}, { ...price, prompt: 'NaN' }, { ...price, completion: '1' },
    { ...price, discount: 2 }, { ...price, discount: -1 }, { ...price, request: '0.1' }, { ...price, overrides: [{ completion: '1' }] }])
    assert.throws(() => checkPrices(invalid));
});
test('validation covers languages/levels and dialogues use their own generated prior turns', () => {
  const trials = validationJobs();
  assert.equal(trials.length, 135);
  assert.equal(new Set(trials.map(x => x.id)).size, 135);
  assert.equal(new Set(trials.map(x => x.language)).size, 3);
  assert.equal(new Set(trials.map(x => x.level)).size, 5);
  const dialogues = dialogueJobs();
  assert.equal(dialogues.length, 48);
  const [first, second, third] = dialogues;
  const histories = new Map();
  assert.deepEqual(resolveHistory(first, histories), first.messages);
  assert.throws(() => resolveHistory(second, histories));
  histories.set(first.dialogueId, [{ role: 'assistant', content: 'Actual generated opening.' }]);
  const messages = resolveHistory(second, histories);
  assert.equal(messages[1].content, 'Actual generated opening.');
  assert.deepEqual(messages[2], second.messages[1]);
  assert.throws(() => resolveHistory(third, histories));
  assert.throws(() => resolveHistory(dialogues[5], histories));
});
test('revision comparisons hold histories fixed and repeat the same actual inputs', () => {
  const trials = revisionJobs();
  assert.equal(trials.length, 48);
  assert.equal(new Set(trials.map(x => x.id)).size, 48);
  for (const job of trials.filter(x => x.id.endsWith('-r1'))) {
    const repeated = trials.find(x => x.id === job.id.replace('-r1', '-r2'))!;
    assert.deepEqual(job.messages, repeated.messages);
    const pair = trials.find(x => x.language === job.language && x.scenario === job.scenario && x.variant !== job.variant && x.id.endsWith('-r1'))!;
    assert.deepEqual(job.messages.slice(1), pair.messages.slice(1));
  }
  assert.equal(dialogueJobs(['compact-grounded']).length, 24);
});
test('paired trials hold histories fixed, cover all levels and do not invent opening user turns', () => {
  const all = jobs();
  assert.equal(all.length, 40);
  assert.equal(new Set(all.map(x => x.id)).size, 40);
  for (const level of new Set(all.map(x => x.level))) {
    const opening = all.filter(x => x.level === level && x.scenario === 'opening');
    assert.equal(opening.length, 4);
    assert.ok(opening.every(x => x.messages.length === 1));
    const histories = all.filter(x => x.level === level && x.scenario === 'reply').map(x => JSON.stringify(x.messages.slice(1)));
    assert.equal(new Set(histories).size, 1);
  }
});
test('retains useful metadata while excluding echoed request content and unknown fields', () => {
  const saved = metadata({ id: 'gen-123', model: 'google/gemini-2.5-flash', usage: { prompt_tokens: 123, cost: 0.001 },
    choices: [{ finish_reason: 'stop', message: { content: 'private text' } }],
    error: { code: 429, message: 'Bearer secret: private text' }, arbitrary: 'secret' });
  assert.equal(saved.id, 'gen-123');
  assert.deepEqual(saved.usage, { prompt_tokens: 123, cost: 0.001 });
  assert.equal(saved.errorCode, 429);
  assert.equal(saved.finishReason, 'stop');
  assert.ok(!JSON.stringify(saved).includes('private text'));
  assert.ok((saved.omittedFields as string[]).includes('arbitrary'));
});
test('factor study repeats identical requests and isolates each changed block', () => {
  const all = factorJobs();
  assert.equal(all.length, 108);
  assert.equal(new Set(all.map(x => x.id)).size, 108);
  for (const job of all.filter(x => x.repeat === 1)) {
    const repeat = all.find(x => x.id === job.id.replace('-r1', '-r2'))!;
    assert.deepEqual(job.messages, repeat.messages);
    const control = all.find(x => x.level === job.level && x.scenario === job.scenario && x.repeat === 1 && x.variant === 'control')!;
    assert.deepEqual(job.messages.slice(1), control.messages.slice(1));
    const blocks = new Set(job.messages[0].content.split('\n\n'));
    const original = new Set(control.messages[0].content.split('\n\n'));
    const added = [...blocks].filter(x => !original.has(x));
    const removed = [...original].filter(x => !blocks.has(x));
    assert.ok(added.length <= 1 && removed.length <= 1, `${job.id} changes multiple blocks`);
  }
});
