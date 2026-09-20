/** Rebuild a named, append-only-in-practice study from frozen generation receipts.
 * This command never generates prompts or starts paid calls.
 */
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {spawnSync} from 'node:child_process';
import {hash,readRuns} from './data.ts';
const [manifestPath,python,...extra]=process.argv.slice(2);
if(!manifestPath||!python||extra.length)throw Error('Usage: study.ts STUDY_JSON PYTHON_EXECUTABLE');
const manifest=JSON.parse(readFileSync(manifestPath,'utf8'));
if(manifest.version!==1||!manifest.id||!manifest.title||!manifest.runs?.length)throw Error('Invalid study');
const directories=manifest.runs.map((r:any)=>{
 if(!r.round||!r.recordedAt||!r.path||!r.planHash)throw Error('Each run needs round, recordedAt, path and planHash');
 const plan=JSON.parse(readFileSync(resolve(r.path,'plan.json'),'utf8'));
 if(hash(JSON.stringify(plan.jobs))!==plan.fixtureSha256||plan.fixtureSha256!==r.planHash)throw Error('Frozen run plan changed: '+r.path);
 return r.path;
});
readRuns(directories); // Validate successful, complete trials before expensive work.
const out=dirname(manifestPath);
function run(command:string,args:string[]){
 const r=spawnSync(command,args,{stdio:'inherit',env:{...process.env,OMP_NUM_THREADS:'1',OPENBLAS_NUM_THREADS:'1',NUMBA_NUM_THREADS:'1'}});
 if(r.error)throw r.error;if(r.status!==0)throw Error('Analysis stage failed: '+command);
}
if(!existsSync(out+'/embedding-plan.json'))throw Error('Embed the manifest runs first with embed.ts; paid calls are explicit.');
run(python,['tools/benchmarks/conversation-prompts/explorer/project.py',out]);
run(process.execPath,['tools/benchmarks/conversation-prompts/explorer/build.ts',out,out+'/index.html',...directories]);
writeFileSync(out+'/study-receipt.json',JSON.stringify({studyHash:hash(JSON.stringify(manifest)),builtAt:new Date().toISOString(),generationCalls:0,runs:manifest.runs},null,2));
