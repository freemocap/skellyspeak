/** Local-only analysis. References are intended words unless manually corrected. */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { studyDirectory, saveStudyFile } from './storage.ts';
import { conditions, normalize, score, type Take, type Result } from './experiment.ts';
const directory = studyDirectory();
const read = <T>(suffix: string): T[] => readdirSync(directory).filter(f => f.endsWith(suffix)).map(f => JSON.parse(readFileSync(join(directory, f), 'utf8')));
const takes = read<Take>('.take.json').filter(t => !t.removedAt).sort((a,b) => a.created.localeCompare(b.created));
const results = read<Result>('.result.json').sort((a,b) => a.created.localeCompare(b.created));
const chosen = conditions.filter(c => ['scribe-forced-clean','scribe-forced-verbatim','scribe-auto-clean','scribe-auto-verbatim','whisper-large-v3-forced','whisper-large-v3-auto'].includes(c.id));
const first = (take: Take, id: string) => results.find(r => r.takeId === take.id && r.condition.id === id);
const summary = chosen.map(condition => {
  const rows = takes.map(take => ({take, result: first(take, condition.id)}));
  const successful = rows.filter(row => row.result?.status === 'ok');
  const distances = successful.map(row => score(row.take.reference, row.result!.text!, row.take.phrase.language).cer).filter((x): x is number => x !== null);
  return {condition: condition.id, total: takes.length, missing: rows.filter(r => !r.result).length,
    failures: rows.filter(r => r.result?.status === 'error').length,
    exact: successful.filter(r => normalize(r.take.reference,r.take.phrase.language) === normalize(r.result!.text!,r.take.phrase.language)).length,
    meanCEROnSuccessfulResponses: distances.length ? distances.reduce((a,b)=>a+b,0)/distances.length : null};
});
const escape = (text: string) => text.replaceAll('|','\\|').replaceAll('\n',' ');
const lines = ['# Saved-take comparison', '', `Generated ${new Date().toISOString()}. ${takes.length} kept takes.`, '',
  'First attempt per take/condition only; removed takes excluded. This compares against intended text unless the reference was corrected. It is not a pronunciation grade or a human-verified transcript. Failures and missing attempts remain explicit. CER ignores punctuation/case and Arabic vowel marks but still penalizes dialect spelling variants.', '',
  'These are text-distance diagnostics, not success percentages. Lower error is better: 10.9% CER does not mean 10.9% success, nor does subtracting it from 100 produce a semantic accuracy score. Exact matches exclude acceptable alternate spellings and paraphrases. Judge meaning preservation, dialect/wording fidelity and wrong-language failures separately; actual spoken-word fidelity requires listening review.', '',
  '| Condition | Exact normalized text matches (not task success) | Request failures | Missing | Mean character error % (lower is better; returned transcripts only) |', '| --- | ---: | ---: | ---: | ---: |',
  ...summary.map(r => `| ${r.condition} | ${r.exact}/${r.total} | ${r.failures} | ${r.missing} | ${r.meanCEROnSuccessfulResponses === null ? '—' : (100*r.meanCEROnSuccessfulResponses).toFixed(1)+'%'} |`), '',
  '## Per-take results', ''];
for (const [index,take] of takes.entries()) {
  lines.push(`### Take ${index+1}: ${take.phrase.text}`, '', `${take.id} · ${take.created} · ${take.duration.toFixed(2)} seconds · RMS ${(20*Math.log10(take.rms)).toFixed(1)} dBFS · near-full-scale ${(100*take.clippedFraction).toFixed(2)}%`, '',
    '| Condition | Transcript or failure |', '| --- | --- |', ...chosen.map(c => {const r=first(take,c.id);return `| ${c.id} | ${escape(r?.text ?? r?.error ?? 'Not run')} |`;}), '');
}
saveStudyFile(directory,'comparison-latest.md',Buffer.from(lines.join('\n')+'\n'));
saveStudyFile(directory,'comparison-latest.json',Buffer.from(JSON.stringify({generated:new Date().toISOString(),takeIds:takes.map(t=>t.id),summary},null,2)));
console.log(JSON.stringify(summary,null,2));
console.log(join(directory,'comparison-latest.md'));
