import {renderDocument} from './document.ts';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { build } from 'esbuild';
import {writeReports} from './reports.ts';
import { dot, hash, measures, project, readRuns, unit } from './data.ts';
import {readAssessments} from '../assessment/analysis.ts';

const [embeddingDirectory, output, ...argumentsAfterOutput] = process.argv.slice(2);
let studyOverride:string|undefined;
const runs=[...argumentsAfterOutput];
if(runs[0]==='--study'){runs.shift();studyOverride=runs.shift();if(!studyOverride)throw Error('--study needs a manifest');}
if (!embeddingDirectory || !output || !runs.length) throw Error('Usage: build.ts EMBEDDING_DIRECTORY OUTPUT_FRAGMENT RUN_DIRECTORY...');
const raw = readRuns(runs);
const embeddingPlan = JSON.parse(readFileSync(`${embeddingDirectory}/embedding-plan.json`, 'utf8'));
const expectedSignature=hash(JSON.stringify({model:embeddingPlan.model,dimensions:embeddingPlan.dimensions,hashes:[...new Set(raw.map((r:any)=>r.textHash))].sort()}));
if(expectedSignature!==embeddingPlan.signature)throw Error('Embedding plan does not match input corpus');
const embeddings = readFileSync(`${embeddingDirectory}/embeddings.jsonl`, 'utf8').trim().split('\n').map(x => JSON.parse(x));
if (new Set(embeddings.map(x => x.hash)).size !== embeddings.length) throw Error('Duplicate embedding cache keys');
if (embeddings.some(x => x.model !== embeddingPlan.model || x.vector.length !== embeddingPlan.dimensions)) throw Error('Embedding model/dimensions differ');
const lookup = new Map(embeddings.map((x, i) => [x.hash, i]));
const vectors = embeddings.map(x => unit(x.vector));
const sourceVectors = raw.map((r: any) => {
  const index = lookup.get(r.textHash);
  if (index === undefined) throw Error('Missing embedding');
  return vectors[index];
});
const projection = project(sourceVectors);
const projectionFile = `${embeddingDirectory}/projections.json`;
const nonlinear = existsSync(projectionFile) ? JSON.parse(readFileSync(projectionFile, 'utf8')) : null;
if (nonlinear && nonlinear.corpusSignature !== embeddingPlan.signature) throw Error('Projection corpus mismatch');
const clusterByHash = new Map(nonlinear?.hashes.map((h:string,i:number)=>[h,nonlinear.clusters[i]]) ?? []);
const studyFile = studyOverride ?? `${embeddingDirectory}/study.json`;
const study = existsSync(studyFile) ? JSON.parse(readFileSync(studyFile, 'utf8')) : null;
const prompts: string[] = [];
const rows = raw.map((r: any, i: number) => {
  let promptIndex = prompts.indexOf(r.promptText);
  if (promptIndex < 0) { promptIndex = prompts.length; prompts.push(r.promptText); }
  const { promptText, textHash, ...fields } = r;
  return { ...fields, textHash, cluster: String(clusterByHash.get(textHash) ?? 'unavailable'), round: study?.runs.find((run:any)=>run.path.endsWith('/'+r.run))?.round ?? r.run, ...measures(r.text, r.locale), promptIndex, vectorIndex: lookup.get(textHash), x: projection.xy[i][0], y: projection.xy[i][1] };
});
// Full-space cosine similarities quantized to 16 bits for a compact offline viewer.
// This is NOT distance in the two-dimensional projection. Error <= 1/65535.
const n = vectors.length, packed = Buffer.alloc(n * n * 2);
for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
  const cosine = Math.max(-1, Math.min(1, dot(vectors[i], vectors[j])));
  packed.writeUInt16LE(Math.round((cosine + 1) / 2 * 65535), (i * n + j) * 2);
}
const receipts = readFileSync(`${embeddingDirectory}/embedding-receipts.jsonl`, 'utf8').trim().split('\n').map(x => JSON.parse(x));
const dataset = { version: 2, projections: nonlinear, study, rows, prompts, variance: projection.variance, vectorCount: n,
  assessment:study?.assessmentRuns?{...readAssessments(study.assessmentRuns,raw),
    instrumentation:study.smokeRuns?readAssessments(study.smokeRuns,raw):null}:null,
  similarity: packed.toString('base64'), embeddingModel: embeddingPlan.model, dimensions: embeddingPlan.dimensions,
  knownEmbeddingCost: receipts.reduce((s, r) => s + (r.metadata?.usage?.cost ?? 0), 0),
  missingEmbeddingCosts: receipts.filter(r => typeof r.metadata?.usage?.cost !== 'number').length };
mkdirSync(dirname(output),{recursive:true});
writeReports(dirname(output), rows, prompts, (a, b) => dot(vectors[a.vectorIndex], vectors[b.vectorIndex]));
const fingerprint = hash(JSON.stringify(dataset)).slice(0, 16);
const bundle = await build({ entryPoints: ['tools/benchmarks/conversation-prompts/explorer/client.ts'], bundle: true, write: false, format: 'iife', minify: true, target: 'es2022' });
const template = readFileSync('tools/benchmarks/conversation-prompts/explorer/view.html', 'utf8');
const html = renderDocument(template,{...dataset,fingerprint},bundle.outputFiles[0].text);
if (Buffer.byteLength(html) > 20_000_000) throw Error('Explorer exceeds 20 MB standalone limit');
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, html);
writeFileSync(`${dirname(output)}/analysis.json`, JSON.stringify({ fingerprint, variance: projection.variance, rows, assessment:dataset.assessment, embeddingModel: embeddingPlan.model, dimensions: embeddingPlan.dimensions }, null, 2));
console.log(JSON.stringify({ output, rows: rows.length, uniqueEmbeddings: n, bytes: Buffer.byteLength(html), variance: projection.variance }));
