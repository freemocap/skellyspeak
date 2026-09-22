import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { prepareStudy, saveStudyFile } from './storage.ts';
import { phrases } from './corpus.ts';
test('import verifies copies, keeps originals, snapshots, and never reimports stale data', () => {
  const root=mkdtempSync(join(tmpdir(),'speech-storage-')), legacy=join(root,'old'), dest=join(root,'study');
  try {
    mkdirSync(legacy); writeFileSync(join(legacy,'take.wav'),Buffer.from([1,2,3])); writeFileSync(join(legacy,'take.json'),'original');
    prepareStudy(dest,legacy);
    assert.deepEqual(readFileSync(join(dest,'take.wav')),readFileSync(join(legacy,'take.wav')));
    assert.equal(readFileSync(join(dest,'recovery','take.json'),'utf8'),'original');
    const snapshot=readdirSync(join(dest,'snapshots'))[0];
    assert.equal(readFileSync(join(dest,'snapshots',snapshot,'take.json'),'utf8'),'original');
    saveStudyFile(dest,'take.json',Buffer.from('updated')); prepareStudy(dest,legacy);
    assert.equal(readFileSync(join(dest,'take.json'),'utf8'),'updated');
    assert.equal(readFileSync(join(dest,'recovery','take.json'),'utf8'),'updated');
    assert.equal(readFileSync(join(legacy,'take.json'),'utf8'),'original');
  } finally { rmSync(root,{recursive:true}); }
});
test('conflicting destination refuses migration rather than overwriting', () => {
  const root=mkdtempSync(join(tmpdir(),'speech-conflict-')); try {
    const old=join(root,'old'),dest=join(root,'new'); mkdirSync(old);mkdirSync(dest);
    writeFileSync(join(old,'take.json'),'old');writeFileSync(join(dest,'take.json'),'new');
    assert.throws(()=>prepareStudy(dest,old),/conflict/); assert.equal(readFileSync(join(dest,'take.json'),'utf8'),'new');
  } finally {rmSync(root,{recursive:true});}
});
test('new sound drills retain original IDs and keep formal pronunciation separately labeled', () => {
  assert.equal(phrases[6].id,'practice-7');assert.equal(phrases[35].id,'practice-36');
  assert.equal(new Set(phrases.map(p=>p.id)).size,phrases.length);
  const drills=phrases.filter(p=>p.focus);assert.equal(drills.length,18);
  assert.equal(drills.find(p=>p.id==='arabic-sounds-q-k')?.variety,'Modern Standard Arabic');
  assert.ok(drills.some(p=>p.focus==='ص / س'));assert.ok(drills.some(p=>p.focus==='ط / ت'));
});
