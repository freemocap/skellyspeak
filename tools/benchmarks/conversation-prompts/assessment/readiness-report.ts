import {readFileSync,writeFileSync} from 'node:fs';
import {loadSpanish} from './spanish-analysis.ts';
const [directory,mode]=process.argv.slice(2);
if(!directory)throw Error('Provide study directory');
const d=loadSpanish(directory),p=JSON.parse(readFileSync(directory+'/plan.json','utf8'));
if(!d.complete)throw Error('Run has incomplete pairs; wait or account for interruption explicitly');
if(mode==='prepare-replay'){
 const replay=d.rows.filter(r=>r.engine!=='jev'&&r.receipt.nativeOutput!==undefined).map(r=>({id:r.id,source:r.text,criteria:d.catalog,output:r.receipt.nativeOutput}));
 writeFileSync(directory+'/replay.json',JSON.stringify(replay,null,2));
 console.log(JSON.stringify({replayCount:replay.length,noNativeOutput:d.rows.filter(r=>r.engine!=='jev'&&r.receipt.nativeOutput===undefined).map(r=>r.id)}));
}else if(mode==='report'){
 const replay=JSON.parse(readFileSync(directory+'/replay.json.validated.json','utf8'));
 const stages=['sparse','chat'].map(engine=>{
  const rs=d.rows.filter(r=>r.engine===engine),ids=new Set(rs.map(r=>r.id)),replayed=replay.filter((r:any)=>ids.has(r.id));
  return {engine,planned:rs.length,transportValid:rs.filter(r=>r.status==='complete').length,rustValid:replayed.filter((r:any)=>r.valid).length,rustRejected:replayed.filter((r:any)=>!r.valid).length,notReplayed:rs.length-replayed.length,rejected:replayed.filter((r:any)=>!r.valid),gate:replayed.some((r:any)=>!r.valid)||rs.some(r=>r.status!=='complete')?'BLOCKED':'Structural checks passed; semantic review still required'};
 });
 const report={planHash:d.planHash,actualCalls:d.actualCalls,actualSpend:d.actualSpend,unknownCallCosts:d.unknownCallCosts,paths:d.overall,stages,emptyShortlists:d.rows.filter(r=>r.engine==='chat'&&r.receipt.metadata?.extractionSkipped).length,failures:d.rows.filter(r=>r.status!=='complete').map(r=>({id:r.id,validation:r.receipt.validation,metadata:r.receipt.metadata?.pipeline})),independentSemanticReview:false};
 writeFileSync(directory+'/readiness-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}else throw Error('Expected prepare-replay or report');
