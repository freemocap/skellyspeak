import type {TwoStageData} from './two-stage-analysis.ts';
import {installDivider,installTopDivider} from '../explorer/interaction.ts';
declare const Plotly:any;
const data=JSON.parse(document.getElementById('prompt-explorer-data')!.textContent!) as TwoStageData&{projections:any;labels?:Record<string,string>;failures?:{engine:string;counts:[string,number][]}[]};
const $=(id:string)=>document.getElementById(id)!;
const esc=(v:unknown)=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const label=(engine:string)=>data.labels?.[engine]??(engine==='jev_fast'?'Jev + Fast':'Chat assessment');
document.title=data.plan.title??'Jev + Fast versus Chat assessment';
document.querySelector('h1')!.textContent=document.title;
const pct=(v:number|null)=>v===null?'—':(100*v).toFixed(1)+'%';
const usd=(v:number|null)=>v===null?'Unknown':'$'+v.toFixed(6);
const num=(v:number|null)=>v===null?'—':v.toFixed(2);
const table=(head:string[],rows:unknown[][])=>`<table><thead><tr>${head.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
$('progress').textContent=`${data.extractionCalls}/${data.plan.calls} new extraction calls · ${usd(data.extractionKnownCost)} new known spend · ${data.extractionUnknownCosts} unknown costs · ${data.complete?'Native replay complete':'Incomplete; do not interpret pending rows as failures'}`;
const candidates=data.arms.filter(a=>a.engine!=='chat_model');
$('verdict').textContent=candidates.map(a=>`${label(a.engine)}: ${a.summary.complete}/120 valid, ${a.summary.failed-a.pending} failed, ${a.pending} pending.`).join(' ') + ` ${data.reviewedSemanticQuotes} semantic quote reviews completed; mechanical validity alone does not establish suitability.`;
$('comparison').innerHTML=table(['Route','Complete','Failed / pending','Delivered hit rate','Delivered false alarms','All-attempt p50 ms','All-attempt p95 ms','Known total cost','Unknown cost rows'],data.arms.map(a=>[label(a.engine),a.summary.complete,`${a.summary.failed-a.pending} / ${a.pending}`,pct(a.delivered.attempt.hitRate),pct(a.delivered.attempt.falseAlarmRate),a.latencyAllP50,a.latencyAllP95,usd(a.summary.knownCost),a.summary.missingCosts]));
$('failures').innerHTML=data.failures?table(['Candidate','Failure reason','Pipelines'],data.failures.flatMap(a=>a.counts.map(([reason,count])=>[label(a.engine),reason,count]))):'';
$('sdt').innerHTML=table(['Route / cohort / task','Hits','Misses','False alarms','Correct rejections','Hit rate','FA rate','d′','Criterion'],data.arms.flatMap(a=>(['delivered','validOnly'] as const).flatMap(cohort=>(['attempt','full'] as const).map(task=>{const s=a[cohort][task];return [`${label(a.engine)} / ${cohort} / ${task}`,s.hit,s.miss,s.falseAlarm,s.correctRejection,pct(s.hitRate),pct(s.falseAlarmRate),num(s.dPrime),num(s.criterion)];}))));
const layout=(title:string)=>({title:{text:title},paper_bgcolor:'transparent',plot_bgcolor:'transparent',font:{color:'#d8dce8'},height:500,legend:{orientation:'h',y:-.35},margin:{l:70,r:20,t:50,b:165}});
Plotly.newPlot('quality',data.arms.map(a=>({type:'bar',name:label(a.engine),x:['Completion','Delivered hits','Delivered false alarms'],y:[a.summary.complete/120,a.delivered.attempt.hitRate,a.delivered.attempt.falseAlarmRate]})),{...layout('Coverage and delivered evidence'),barmode:'group',yaxis:{tickformat:'.0%'}},{responsive:true});
for(const [id,field,title] of [['latency','elapsedMs','All completed attempts: composed two-stage latency (ms)'],['cost','cost','Per-pipeline actual cost, including failures (USD)']] as const){
 Plotly.newPlot(id,data.arms.map(a=>({type:'box',name:label(a.engine),boxpoints:'all',jitter:.4,y:data.rows.filter(r=>r.engine===a.engine&&r.status!=='pending'&&r[field]!==null).map(r=>r[field])})),layout(title),{responsive:true});
}
Plotly.newPlot('shortlist',candidates.map(a=>{
 const groups=new Map<number,{valid:number;total:number}>();
 for(const p of data.pairs.filter(p=>p.row.engine===a.engine&&p.row.status!=='pending')){
  const count=p.request?.response_format?.json_schema?.schema?.properties?.items?.minItems;
  if(typeof count!=='number')continue;
  const g=groups.get(count)??{valid:0,total:0};g.total++;g.valid+=Number(p.row.status==='complete');groups.set(count,g);
 }
 const points=[...groups.entries()].sort(([a],[b])=>a-b);
 return {type:'scatter',mode:'lines+markers',name:label(a.engine),x:points.map(([n])=>n),y:points.map(([,g])=>g.valid/g.total),text:points.map(([,g])=>`${g.valid}/${g.total} complete`)};
}),{...layout('Pipeline completion by number of Jev-selected skills'),xaxis:{title:{text:'Required exact quotes'}},yaxis:{tickformat:'.0%',range:[0,1]}},{responsive:true});
function inspect(index:number){
 const p=data.pairs[index];
 const quotes=p.quotes.map(q=>`<article class="card"><h3>${esc(data.plan.catalog.find((c:any)=>c.id===q.skill)?.label??q.skill)}</h3><p>${esc(data.plan.catalog.find((c:any)=>c.id===q.skill)?.criterion)}</p><p>Chat: ${esc(q.chatOutcome)} · ${esc(q.chatQuote??'No quote')}</p><p>Jev decision: ${esc(q.jevOutcome)}. Quote (${q.jevPublished?'published':'not published'}): ${esc(q.jevQuote||'Empty or missing')}. Returned entries: ${q.candidateCount}</p><p>Character overlap: ${q.overlap===null?'Not paired':pct(q.overlap)}. Not a semantic score.</p></article>`).join('');
 $('inspection').innerHTML=`<h3>${esc(p.row.caseId)} · ${esc(p.row.context)} · run ${p.row.repeat}</h3><div class="source">${esc(p.row.text)}</div><p>Chat: ${p.baseline.status} · ${p.baseline.elapsedMs} ms · ${usd(p.baseline.cost)}</p><p>${esc(label(p.row.engine))}: ${p.row.status} · ${p.row.elapsedMs} ms composed · ${usd(p.row.cost)}</p>${quotes}<details open><summary>Validation result</summary><pre>${esc(JSON.stringify(p.error,null,2))}</pre></details><details open><summary>Raw extractor output (may be invalid)</summary><pre>${esc(JSON.stringify(p.receipt?.nativeOutput??null,null,2))}</pre></details><details><summary>Exact extraction request</summary><pre>${esc(JSON.stringify(p.request,null,2))}</pre></details><details><summary>Extraction receipt</summary><pre>${esc(JSON.stringify(p.receipt,null,2))}</pre></details><details><summary>Chat assessment receipt</summary><pre>${esc(JSON.stringify(p.baseline.receipt,null,2))}</pre></details>`;
}
function pairs(){const arm=($('arm') as HTMLSelectElement).value;const filter=($('filter') as HTMLSelectElement).value;$('pairs').innerHTML=data.pairs.map((p,i)=>({p,i})).filter(({p})=>arm==='all'||p.row.engine===arm).filter(({p})=>filter==='all'||filter==='failed'&&p.row.status==='failed'||filter==='changed'&&p.changed||filter==='both'&&p.row.status==='complete'&&p.baseline.status==='complete').map(({p,i})=>`<button class="card" data-pair="${i}">${esc(p.row.caseId)} · ${esc(p.row.context)} · ${p.row.repeat}<br>Chat ${p.baseline.status} / ${esc(label(p.row.engine))} ${p.row.status}</button>`).join('');$('pairs').querySelectorAll<HTMLButtonElement>('[data-pair]').forEach(b=>b.onclick=()=>inspect(Number(b.dataset.pair)));}
$('arm').innerHTML='<option value="all">All candidates</option>'+candidates.map(a=>`<option value="${esc(a.engine)}">${esc(label(a.engine))}</option>`).join('');$('arm').onchange=pairs;$('filter').onchange=pairs;pairs();
$('choices').innerHTML=data.plan.choices.map((c:string)=>`<p>${esc(c)}</p>`).join('');
function map(){if(!data.projections){$('map-quality').textContent='Projection fitting pending.';return;}const p=data.projections.projections[Number(($('projection') as HTMLSelectElement).value)];const rows=data.rows.filter(r=>r.status==='complete');
 $('map-quality').textContent=`${p.label} · trustworthiness ${num(p.trustworthiness10)} · neighbor recall ${pct(p.neighborRecall10)}`;
 Plotly.newPlot('profile-map',data.arms.map(a=>{const own=rows.filter(r=>r.engine===a.engine);const coordinates=own.map(r=>p.coordinates[data.projections.hashes.indexOf(r.profileHash)]);return {type:'scatter',mode:'markers',name:label(a.engine),x:coordinates.map((c:number[])=>c[0]),y:coordinates.map((c:number[])=>c[1]),text:own.map(r=>r.caseId),customdata:own.map(r=>data.pairs.findIndex(pair=>(r.engine==='chat_model'||pair.row.engine===r.engine)&&pair.row.caseId===r.caseId&&pair.row.context===r.context&&pair.row.repeat===r.repeat))};}),layout(p.label),{responsive:true});
 ($('profile-map') as any).on('plotly_click',(event:any)=>inspect(event.points[0].customdata));
}
$('projection').innerHTML=(data.projections?.projections??[]).filter((p:any)=>p.dimensions===2).map((p:any)=>`<option value="${data.projections.projections.indexOf(p)}">${esc(p.label)}</option>`).join('');$('projection').onchange=map;
document.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach(b=>b.onclick=()=>{document.querySelectorAll<HTMLElement>('.tab-panel').forEach(p=>p.hidden=p.id!==b.dataset.tab);document.querySelectorAll('[data-tab]').forEach(t=>t.setAttribute('aria-pressed',String(t===b)));if(b.dataset.tab==='maps')map();});
installDivider(document.querySelector('.workspace')!,$('panel-divider'));installTopDivider(document.querySelector('header')!,$('top-divider'));inspect(0);
