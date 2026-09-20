import test from 'node:test';
import assert from 'node:assert/strict';
import { approaches, levels, spanishResetTrials, spanishPersonaTrials } from './spanish-reset.ts';

test('Spanish screen balances approaches, levels, topic conditions and repetitions', () => {
  const trials = spanishResetTrials();
  assert.equal(trials.length, 108);
  assert.equal(new Set(trials.map(t => t.id)).size, 108);
  assert.ok(trials.every(t => t.language === 'spanish'));
  for (const variant of approaches) for (const level of levels) {
    const cell = trials.filter(t => t.variant === variant && t.level === level);
    assert.equal(cell.length, 9);
    for (const scenario of ['free-opening', 'topic-opening']) assert.equal(cell.filter(t => t.scenario === scenario).length, 3);
    for (const scenario of ['choice', 'confusion', 'switch']) assert.equal(cell.filter(t => t.scenario === scenario).length, 1);
  }
});
test('meaning probes hold actual dialogue and topic context constant across alternatives', () => {
  const trials = spanishResetTrials();
  for (const level of levels) for (const scenario of ['choice', 'confusion', 'switch']) {
    const cell = trials.filter(t => t.level === level && t.scenario === scenario);
    for (const t of cell) assert.deepEqual(t.messages.slice(1), cell[0].messages.slice(1));
  }
  for (const t of trials.filter(t => t.scenario === 'topic-opening')) assert.match(t.messages[0].content, /Selected topic.*Un viaje en tren/);
  for (const t of trials.filter(t => t.scenario === 'free-opening')) assert.match(t.messages[0].content, /No topic selected/);
});

test('identity comparison contains 240 balanced independent openings and no other difference', () => {
  const trials = spanishPersonaTrials();
  assert.equal(trials.length, 240);
  assert.equal(new Set(trials.map(t => t.id)).size, 240);
  for (const variant of approaches) for (const level of levels) {
    const cell = trials.filter(t => t.variant === variant && t.level === level);
    for (const scenario of ['persona', 'no-persona']) assert.equal(cell.filter(t => t.scenario === scenario).length, 10);
    for (let repeat = 1; repeat <= 10; repeat++) {
      const pair = cell.filter(t => t.id.endsWith(`-r${repeat}`));
      const yes = pair.find(t => t.scenario === 'persona')!;
      const no = pair.find(t => t.scenario === 'no-persona')!;
      assert.equal(yes.messages[0].content.replace('Identity: Lucía, an adult in Valencia. ', ''), no.messages[0].content);
    }
  }
  assert.ok(trials.every(t => t.messages.length === 1 && t.messages[0].content.includes('No topic selected')));
});
