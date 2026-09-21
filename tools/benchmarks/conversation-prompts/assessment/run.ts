import {appendFileSync,readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {credential} from '../run.ts';
import {hash,loadSkills,makePlan,reservation,type Plan} from './plan.ts';
import {call,prices,chatPayload} from './transport.ts';

export async function main(args=process.argv.slice(2)) {
  const mode=args.shift(),out=args.shift();
  if(!mode||!out||!['plan','live'].includes(mode)) throw Error('Usage: run.ts plan OUT STUDY CATALOG [--smoke] | live OUT');
  if(mode==='plan') {
    const [study,catalog,...flags]=args;
    if(!study||!catalog||flags.some(f=>f!=='--smoke'))throw Error('Expected STUDY CATALOG [--smoke]');
    const plan=makePlan(study,loadSkills(catalog),1,flags.includes('--smoke')?1:2,flags.includes('--smoke'));
    for(const job of plan.jobs)job.request=job.engine==='jev'?job.payload:chatPayload(job);
    plan.fixtureSha256=hash(JSON.stringify(plan.jobs));
    for(const file of ['plan.ts','transport.ts','run.ts']) {
      const path=`tools/benchmarks/conversation-prompts/assessment/${file}`;
      plan.sourceHashes[path]=hash(readFileSync(path,'utf8'));
    }
    mkdirSync(out,{recursive:true});writeFileSync(`${out}/plan.json`,JSON.stringify(plan,null,2)+'\n',{flag:'wx'});
    console.log(JSON.stringify({mode,calls:plan.calls,reservationUsd:plan.reservationUsd,out}));return;
  }
  if(args.length)throw Error('Unexpected live arguments; run consumes the frozen plan');
  const plan:Plan=JSON.parse(readFileSync(`${out}/plan.json`,'utf8'));
  if(plan.kind!=='skill-assessment'||hash(JSON.stringify(plan.jobs))!==plan.fixtureSha256 ||
    plan.jobs.length!==plan.calls || plan.jobs.reduce((s,j)=>s+reservation(j),0)!==plan.reservationUsd || plan.reservationUsd>5)
    throw Error('Frozen assessment plan invalid');
  const key=credential();
  const verifiedPricing={jev:await prices('jev'),chat:await prices('chat')};
  writeFileSync(`${out}/run.json`,JSON.stringify({startedAt:new Date().toISOString(),fixtureSha256:plan.fixtureSha256,
    verifiedPricing,reservationUsd:plan.reservationUsd,retries:0,concurrency:1},null,2),{flag:'wx'});
  writeFileSync(`${out}/results.jsonl`,'',{flag:'wx'});
  for(const job of plan.jobs) {
    const receipt=await call(job,key);
    appendFileSync(`${out}/results.jsonl`,JSON.stringify(receipt)+'\n');
    console.log(`${job.id}: ${receipt.status} ${Object.keys(receipt.answers).length} answers ${receipt.elapsedMs}ms`);
    if(receipt.status!=='complete')throw Error('Stopped at first failure; retained receipt and partial answers. No automatic retry.');
  }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)
  main().catch(e=>{console.error(e.message);process.exitCode=1;});
