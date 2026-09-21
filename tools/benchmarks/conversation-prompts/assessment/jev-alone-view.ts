import {installCurrent} from './current-panel.ts';
import type {CurrentComparison} from './current-comparison.ts';
import {installDecision} from './decision-panel.ts';
import type {DecisionReport} from './decision-gates.ts';
import type {loadJev,JevRow} from './jev-alone-analysis.ts';
import {cohort,trials,counts,roc,type Task,type Outcome} from './sdt.ts';
import {summarize} from './metrics.ts';
import {installDivider,installTopDivider} from '../explorer/interaction.ts';
import {semantic} from '../explorer/semantic.ts';
import type {Row as ExplorerRow} from '../explorer/compare.ts';
declare const Plotly:any;
const data=JSON.parse(document.getElementById('prompt-explorer-data')!.textContent!) as ReturnType<typeof loadJev>&{projections:any;decision?:DecisionReport;current?:CurrentComparison;recommendation?:{status:string;candidate:string;text:string;limits:string}};
const $=(id:string)=>document.getElementById(id)!;
const val=(id:string)=>($(id) as HTMLSelectElement).value;
const esc=(s:unknown)=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const colors=['#e7a251','#5da7e7','#6fc29a'];
const rate=(n:number|null)=>n===null?'—':(n*100).toFixed(1)+'%';
const usd=(n:number|null)=>n===null?'Unknown':'$'+n.toFixed(6);
const num=(n:number|null)=>n===null?'—':n.toFixed(3);
const name=(arm:string)=>data.names[arm as keyof typeof data.names]??arm;
let inspected=data.rows,page=0,matrixPage=0,highlight:Set<string>|null=null;
function scoped(){return data.rows.filter(r=>(val('set')==='all'||r.set===val('set'))&&(!val('context')||r.context===val('context')));}
function select(rows:JevRow[],label:string){inspected=rows;page=0;highlight=rows.length===scoped().length?null:new Set(rows.map(r=>r.id));$('selection').textContent=`${label}: ${rows.length} requests`;inspect();map();}
function chart(id:string,traces:any[],title:string,extra:any={}){Plotly.react($(id),traces,{title:{text:title,font:{size:16}},height:380,paper_bgcolor:'transparent',plot_bgcolor:'transparent',font:{color:getComputedStyle($(id)).color},margin:{l:65,r:25,t:60,b:70},legend:{orientation:'h'},...extra},{responsive:true,displaylogo:false});}
function inspect(){
 $('inspection').innerHTML=`<p>Page ${page+1}/${Math.max(1,Math.ceil(inspected.length/8))}</p><button id="prev">Previous</button> <button id="next">Next</button>`+inspected.slice(page*8,page*8+8).map(r=>`<article class="card"><h3>${esc(r.caseId)} · ${name(r.engine)}</h3><p>${r.set} · ${r.context} · repetition ${r.repeat} · ${r.status}</p><div class="evidence">${esc(r.text)}</div><p>${r.elapsedMs} ms · ${usd(r.cost)}</p><table><tr><th>Focal skill</th><th>Reference</th><th>P(evidence)</th><th>P(full)</th></tr>${Object.entries(r.reference).map(([s,v])=>`<tr><td>${esc(s)}</td><td>${v}</td><td>${num(r.evidenceScores[s]?.attempt??null)}</td><td>${num(r.evidenceScores[s]?.full??null)}</td></tr>`).join('')}</table><p>Decision contradictions: ${r.contradictions.join(', ')||'none'}<br>Probability-order violations: ${r.orderViolations.join(', ')||'none'}</p>${r.status==='failed'?`<p>${esc(r.receipt.validation.join('; '))}</p>`:''}<details><summary>All 45 scores and decisions</summary><pre>${esc(JSON.stringify({scores:r.evidenceScores,decisions:r.predictions},null,2))}</pre></details><details><summary>Exact frozen request</summary><pre>${esc(JSON.stringify(data.requests[r.requestIndex],null,2))}</pre></details><details><summary>Original response · validation · timing · billing</summary><pre>${esc(JSON.stringify(r.receipt,null,2))}</pre></details></article>`).join('');
 ($('prev') as HTMLButtonElement).disabled=page===0;($('next') as HTMLButtonElement).disabled=(page+1)*8>=inspected.length;
 $('prev').onclick=()=>{page--;inspect();};$('next').onclick=()=>{page++;inspect();};
}
function main(){
 const rows=scoped(),c=cohort(rows,val('cohort')==='matched',false,'');
 $('exclusions').textContent=`Quality scope: ${new Set(c.rows.map(r=>r.caseId)).size} distinct messages; ${c.failed} failed calls excluded; ${c.excludedValid} additional valid responses excluded for matching. Speed and cost include the entire selected scope, independent of quality matching.`;
 $('cards').innerHTML=data.arms.map((arm,i)=>{const rs=rows.filter(r=>r.engine===arm),s=summarize(rs);return `<article class="card" style="border-top:3px solid ${colors[i]}"><h3>${name(arm)}</h3><p>${s.complete}/${rs.length} valid · ${s.failed} failed</p><p class="metric">${s.latencyP50??'—'} ms median</p><p>${s.latencyP95??'—'} ms p95 · valid calls</p><p class="metric">${usd(s.costPerComplete)} / valid</p><p>${usd(s.knownCost)} known total · ${s.missingCosts} unknown</p><p>${rs.reduce((n,r)=>n+r.contradictions.length,0)} contradictory skill decisions<br><button data-coherence="${arm}">${rs.reduce((n,r)=>n+r.orderViolations.length,0)} probability-order violations</button></p></article>`;}).join('');
 for(const b of $('cards').querySelectorAll<HTMLButtonElement>('[data-coherence]'))b.onclick=()=>select(rows.filter(r=>r.engine===b.dataset.coherence&&r.orderViolations.length>0),'Probability-order violations');
 const results=(['attempt','full'] as const).flatMap(task=>data.arms.map(arm=>({arm,task,...counts(trials(c.rows.filter(r=>r.engine===arm),task))})));
 $('interpretation').textContent='Ranking versus decisions: '+data.arms.map(arm=>`${name(arm)} full-demonstration AUC ${num(roc(trials(c.rows.filter(r=>r.engine===arm),'full')).auc)}`).join(' · ')+'. Equal AUC can coexist with different errors at the operating thresholds. A better threshold on these same cases is exploratory, not validated improvement.';
 $('quality-table').innerHTML=`<table><tr><th>Task</th><th>Formulation</th><th>Hits / positives</th><th>False alarms / negatives</th><th>Hit rate</th><th>FA rate</th><th>d′</th></tr>${results.map(r=>`<tr><td>${r.task==='full'?'Full demonstration':'Some evidence'}</td><td>${name(r.arm)}</td><td>${r.hit}/${r.positives}</td><td>${r.falseAlarm}/${r.negatives}</td><td>${rate(r.hitRate)}</td><td>${rate(r.falseAlarmRate)}</td><td>${num(r.dPrime)}</td></tr>`).join('')}</table>`;
 chart('quality',data.arms.map((arm,i)=>({type:'bar',name:name(arm),x:['Evidence: hit','Evidence: false alarm','Full: hit','Full: false alarm'],y:results.filter(r=>r.arm===arm).flatMap(r=>[r.hitRate===null?null:r.hitRate*100,r.falseAlarmRate===null?null:r.falseAlarmRate*100]),marker:{color:colors[i]}})),'Hit and false-alarm rates · frozen operating thresholds',{barmode:'group',yaxis:{title:{text:'Percent'},range:[0,105]}});
 chart('tradeoff',data.arms.map((arm,i)=>{const s=summarize(rows.filter(r=>r.engine===arm)),r=results.find(r=>r.arm===arm&&r.task==='full')!;return {mode:'markers+text',name:name(arm),x:[s.costPerComplete],y:[r.dPrime],text:[name(arm)],textposition:'top center',marker:{size:14,color:colors[i]},customdata:[s.latencyP50],hovertemplate:'$/valid %{x:.6f}<br>d′ %{y:.3f}<br>Median %{customdata} ms<extra></extra>'};}),'Full-demonstration separation versus cost',{xaxis:{title:{text:'USD / valid assessment'}},yaxis:{title:{text:'Descriptive d′'}}});
 for(const [id,field,title] of [['latency','elapsedMs','Latency · valid responses'],['cost','cost','Actual billed cost · includes failures']] as const)chart(id,data.arms.map((arm,i)=>({type:'box',name:name(arm),y:rows.filter(r=>r.engine===arm&&(field==='cost'?r.cost!==null:r.status==='complete')).map(r=>r[field]),boxpoints:'all',jitter:.3,marker:{color:colors[i],size:3}})),title,{yaxis:{title:{text:field==='cost'?'USD':'Milliseconds'}}});
 chart('stability',data.arms.map((arm,i)=>({type:'box',name:name(arm),y:rows.filter(r=>r.engine===arm&&r.repeat===1&&r.status==='complete').flatMap(a=>{const b=rows.find(r=>r.engine===arm&&r.caseId===a.caseId&&r.context===a.context&&r.repeat===2&&r.status==='complete');return b?[a.vector.filter((v,k)=>v!==b.vector[k]).length/2]:[];}),boxpoints:'all',marker:{color:colors[i]}})),'Changed binary decisions between repetitions · out of 90');
 $('failures').innerHTML=`<h3>All failed calls in scope</h3>${rows.filter(r=>r.status==='failed').map(r=>`<p><button data-failure="${r.id}">${esc(r.id)}</button> ${esc(r.receipt.validation.join('; '))}</p>`).join('')||'<p>None.</p>'}`;
 for(const b of $('failures').querySelectorAll<HTMLButtonElement>('button'))b.onclick=()=>select(rows.filter(r=>r.id===b.dataset.failure),'Failed call');
}
function sdt(){
 const c=cohort(scoped(),val('cohort')==='matched',false,''),task=val('task') as Task,threshold=val('threshold-mode')==='locked'?undefined:Number(val('threshold'));
 const ts=trials(c.rows,task,threshold).filter(t=>!val('skill')||t.skill===val('skill'));
 const results=data.arms.map(arm=>({arm,...counts(ts.filter(t=>t.row.engine===arm)),curve:roc(ts.filter(t=>t.row.engine===arm))}));
 $('threshold-label').textContent=threshold===undefined?'Frozen per-arm thresholds':threshold.toFixed(2);
 ($('threshold') as HTMLInputElement).disabled=threshold===undefined;
 $('sdt-table').innerHTML=`<table><tr><th>Formulation</th><th>Hits</th><th>Misses</th><th>False alarms</th><th>Correct rejections</th><th>H</th><th>FA</th><th>d′</th><th>c</th><th>AUC</th></tr>${results.map(r=>`<tr><td>${name(r.arm)}</td>${(['hit','miss','falseAlarm','correctRejection'] as Outcome[]).map(o=>`<td><button data-arm="${r.arm}" data-outcome="${o}">${r[o]}</button></td>`).join('')}<td>${rate(r.hitRate)}</td><td>${rate(r.falseAlarmRate)}</td><td>${num(r.dPrime)}</td><td>${num(r.criterion)}</td><td>${num(r.curve.auc)}</td></tr>`).join('')}</table>`;
 for(const b of $('sdt-table').querySelectorAll<HTMLButtonElement>('button'))b.onclick=()=>select([...new Map(ts.filter(t=>t.row.engine===b.dataset.arm&&t.outcome===b.dataset.outcome).map(t=>[t.row.id,t.row as JevRow])).values()],`${name(b.dataset.arm!)}: ${b.dataset.outcome}`);
 chart('roc',[{x:[0,1],y:[0,1],mode:'lines',name:'Chance',line:{dash:'dot',color:'#888'}},...results.flatMap((r,i)=>[{mode:'lines',name:name(r.arm),x:r.curve.points.map(p=>p.falseAlarmRate),y:r.curve.points.map(p=>p.hitRate),line:{color:colors[i]}},{mode:'markers',name:`${name(r.arm)} @ ${threshold===undefined?'frozen':threshold.toFixed(2)}`,x:[r.falseAlarmRate],y:[r.hitRate],marker:{size:12,color:colors[i]}}])],'ROC · all formulations',{xaxis:{title:{text:'False-alarm rate'},range:[-.02,1.02]},yaxis:{title:{text:'Hit rate'},range:[-.02,1.02]}});
 chart('scores',data.arms.flatMap((arm,i)=>[false,true].map(signal=>({type:'box',name:`${name(arm)} · ${signal?'signal':'noise'}`,y:ts.filter(t=>t.row.engine===arm&&t.signal===signal).map(t=>t.score),boxpoints:'all',marker:{color:colors[i],symbol:signal?'circle':'diamond',size:4}}))),'Evidence scores by reference class',{yaxis:{range:[0,1],title:{text:'Model probability'}}});
}
function matrix(){
 const rows=scoped(),slice=rows.slice(matrixPage*24,matrixPage*24+24);
 $('matrix-table').innerHTML=`<button id="matrix-prev">Previous</button> <button id="matrix-next">Next</button> Page ${matrixPage+1}/${Math.max(1,Math.ceil(rows.length/24))}<table class="matrix"><tr><th>Request</th>${data.catalog.map(s=>`<th title="${esc(s.criterion)}">${s.id}</th>`).join('')}</tr>${slice.map(r=>`<tr><td>${r.id}</td>${data.catalog.map(s=>{const p=r.predictions[s.id],label=p==='demonstrated'?'D':p==='partial'?'P':p==='contradictory'?'!':p?'Ø':'?';return `<td><button data-row="${r.id}" title="${s.id}: ${p??'failed'}; reference ${r.reference[s.id]??'unscored'}" style="background:${label==='D'?'#286449':label==='P'?'#725923':label==='!'?'#933':'transparent'}">${label}</button></td>`;}).join('')}</tr>`).join('')}</table>`;
 ($('matrix-prev') as HTMLButtonElement).disabled=matrixPage===0;($('matrix-next') as HTMLButtonElement).disabled=(matrixPage+1)*24>=rows.length;
 $('matrix-prev').onclick=()=>{matrixPage--;matrix();};$('matrix-next').onclick=()=>{matrixPage++;matrix();};
 for(const b of $('matrix-table').querySelectorAll<HTMLButtonElement>('[data-row]'))b.onclick=()=>select(rows.filter(r=>r.id===b.dataset.row),'Skill matrix');
}
function map(){
 if($('maps').hidden)return;
 if(!data.projections){$('map-quality').textContent='Maps not fitted yet; no previous-study coordinates substituted.';return;}
 const index=Number(val('projection')),p=data.projections.projections[index];
 $('map-quality').textContent=`${data.projections.hashes.length} unique profiles · trustworthiness ${p.trustworthiness10.toFixed(3)} · 10-neighbor retention ${rate(p.neighborRecall10)}`;
 const rows=scoped().filter(r=>r.status==='complete').map(r=>({...r,engine:name(r.engine),textHash:r.profileHash,text:`${r.id} · ${r.text}`,cluster:data.projections.clusters[data.projections.hashes.indexOf(r.profileHash)]})) as unknown as ExplorerRow[];
 semantic($('profile-map'),data,index,rows,highlight,val('color'),rs=>select(data.rows.filter(r=>rs.some(x=>x.id===r.id)),'Map selection'),highlight?[{label:'Selected',color:'#ffca58',ids:highlight}]:[]);
}
document.title=data.title;document.querySelector('h1')!.textContent=data.title;
$('description').textContent=data.description;
$('set').innerHTML='<option value="all">All '+data.cases.length+'</option>'+[...new Set(data.rows.map(r=>r.set))].map(s=>'<option value="'+s+'">'+s+'</option>').join('');
$('threshold-note').textContent='Frozen thresholds: '+data.arms.map(arm=>{const t=data.operatingThresholds?.[arm]??{attempt:.5,full:.5};return name(arm)+' evidence '+t.attempt.toFixed(2)+', full '+t.full.toFixed(2);}).join(' · ')+'. The slider changes only exploratory SDT decisions; overview and maps stay frozen.';
$('reference-note').textContent='All arms assess 45 skills. Only '+data.cases.length+' provisional focal labels across '+new Set(data.cases.flatMap(c=>Object.keys(c.targets))).size+' skills are scored. These synthetic labels are author-reviewed, not independent human validation.';
$('progress').textContent=`${data.rows.length}/${data.planned} calls recorded · ${data.summary.failed} failed · ${usd(data.summary.knownCost)} known spend · ${data.summary.missingCosts} unknown costs · ${data.complete?'Finished':'Not complete'}`;
$('choices').innerHTML=`<ul>${data.choices.map(c=>`<li>${esc(c)}</li>`).join('')}</ul><p>Pre-run reservation: ${usd(data.reservationUsd)} (not actual spend). Frozen request hash: ${data.planHash}.</p><p>Vendor references: <a href="https://docs.typesafe.ai/primitives/choice">Choice</a>, <a href="https://docs.typesafe.ai/primitives/noul">Noul</a>. Spanish accuracy is not guaranteed; model probabilities require empirical calibration.</p>`;
$('cases').innerHTML=data.cases.map(c=>`<details><summary>${esc(c.id)} · ${c.group}</summary><div class="evidence">${esc(c.text)}</div><p>${esc(c.review)}</p><pre>${esc(JSON.stringify(c.targets,null,2))}</pre><button data-case="${c.id}">Inspect this case</button></details>`).join('');
for(const b of $('cases').querySelectorAll<HTMLButtonElement>('button'))b.onclick=()=>select(data.rows.filter(r=>r.caseId===b.dataset.case),'Reference case');
$('skill').innerHTML+=[...new Set(data.rows.flatMap(r=>Object.keys(r.reference)))].sort().map(s=>`<option>${s}</option>`).join('');
$('projection').innerHTML=(data.projections?.projections??[]).map((p:any,i:number)=>`<option value="${i}">${esc(p.label)}</option>`).join('');
for(const id of ['set','context','cohort'])$(id).onchange=()=>{matrixPage=0;main();sdt();matrix();map();select(scoped(),'Scope');};
for(const id of ['task','skill','threshold','threshold-mode'])$(id).oninput=sdt;
for(const id of ['projection','color'])$(id).onchange=map;
$('reset').onclick=()=>select(scoped(),'All in scope');
if(data.decision)installDecision(data.decision,data.names,data.rows,select);
if(data.current){
 $('description').textContent=data.description+' Plus 120 current-assessor calls on the same cases.';
 $('progress').textContent=`${data.rows.length+data.current.current.requests}/480 total calls · ${data.summary.failed+data.current.current.failed} failed · ${usd(data.current.totalKnownSpend)} known spend · ${data.current.totalUnknownCosts} unknown costs · ${data.current.complete?'Comparison complete':'Comparison pending'}`;
 document.querySelector<HTMLButtonElement>('[data-tab="decision"]')!.textContent='Absolute targets';
 document.querySelector('#decision p:last-child')!.textContent='These are the original absolute targets. The user revised the adoption rule to assess improvements over the current system; see Versus current app for the recommendation.';
 const heading=document.querySelector('#decision h2')!;heading.textContent='Original absolute-target result: '+data.decision?.status+' · not the revised adoption verdict';
 installCurrent(data.current,data.names,data.rows,select,rows=>{
  $('selection').textContent='Selected current app outputs: '+rows.length;
  $('inspection').innerHTML=rows.map(r=>`<article class="card"><h3>${esc(r.caseId)} · current app</h3><div class="evidence">${esc(r.text)}</div><p>${r.status} · ${r.elapsedMs} ms · ${usd(r.cost)}</p><details open><summary>Returned quotes and outcomes</summary><pre>${esc(JSON.stringify(r.receipt.nativeOutput,null,2))}</pre></details><details><summary>Exact native request</summary><pre>${esc(JSON.stringify(data.current!.currentRequests[r.requestIndex],null,2))}</pre></details><details><summary>Receipt and validation</summary><pre>${esc(JSON.stringify(r.receipt,null,2))}</pre></details></article>`).join('');
 });
 if(data.recommendation){const r=data.recommendation;document.querySelector('#current h2')!.insertAdjacentHTML('afterend',`<article class="card"><h3>${esc(r.status)} · ${esc(r.candidate)}</h3><p>${esc(r.text)}</p><details><summary>Implementation scope and limitations</summary><p>${esc(r.limits)}</p></details></article>`);}
}
for(const b of document.querySelectorAll<HTMLButtonElement>('[data-tab]'))b.onclick=()=>{for(const p of document.querySelectorAll<HTMLElement>('.tab-panel'))p.hidden=p.id!==b.dataset.tab;for(const x of document.querySelectorAll('[data-tab]'))x.setAttribute('aria-pressed',String(x===b));if(b.dataset.tab==='maps')map();if(b.dataset.tab==='sdt')sdt();if(b.dataset.tab==='summary')main();};
installDivider(document.querySelector('.workspace')!,$('panel-divider'));installTopDivider(document.querySelector('header')!,$('top-divider'));
main();inspect();matrix();sdt();

if(data.current)document.querySelector<HTMLButtonElement>('[data-tab="current"]')!.click();
