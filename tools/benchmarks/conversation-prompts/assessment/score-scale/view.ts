import {analyze} from './analysis.ts';
const data=(window as any).STUDY;
const el=(id:string)=>document.getElementById(id)!;
const escape=(v:any)=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const pct=(v:number|null)=>v===null?'—':(100*v).toFixed(1)+'%';
const ci=(v:number[]|null)=>v?v.map(pct).join('–'):'—';
const names:Record<string,string>={narrow:'1–5',wide:'0–10',reaction:'Understanding'};
const table=(heads:string[],rows:any[][])=>'<table><thead><tr>'+heads.map(h=>'<th>'+escape(h)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(r=>'<tr>'+r.map(v=>'<td>'+escape(v)+'</td>').join('')+'</tr>').join('')+'</tbody></table>';
function render(){
 const language=(el('language') as HTMLSelectElement).value,dimension=(el('dimension') as HTMLSelectElement).value;
 const cases=data.plan.cases.filter((c:any)=>language==='all'||c.code===language),a=analyze(cases,data.receipts,dimension),rating=a.metrics.slice(0,2),reaction=a.metrics[2];
 el('metrics').innerHTML=`<div><strong>${cases.length}</strong><span>Cases / ${a.clusters} clusters</span></div><div><strong>${a.metrics.reduce((n,m)=>n+m.calls,0)}</strong><span>Requests in selection</span></div><div><strong>$${data.summary.costUsd.toFixed(5)}</strong><span>Entire study cost</span></div>`;
 el('findings').innerHTML='<h2>What this pilot shows</h2>'+data.findings.map((s:string)=>'<p>'+escape(s)+'</p>').join('');
 el('agreement').innerHTML='<svg viewBox="0 0 520 160" role="img" aria-label="Reference agreement with 95 percent intervals">'+[0,.25,.5,.75,1].map(v=>`<line x1="${90+390*v}" x2="${90+390*v}" y1="15" y2="120" stroke="#dce4e9"/><text x="${90+390*v}" y="148" text-anchor="middle">${v*100}%</text>`).join('')+rating.map((m,i)=>{const y=40+i*58;return `<text x="15" y="${y+5}">${names[m.arm]}</text><line x1="${90+390*m.ci![0]}" x2="${90+390*m.ci![1]}" y1="${y}" y2="${y}" stroke="#087f78" stroke-width="5"/><circle cx="${90+390*m.referenceAgreement!}" cy="${y}" r="7" fill="#163849"><title>${pct(m.referenceAgreement)} (${ci(m.ci)})</title></circle>`;}).join('')+'</svg>';
 el('distribution').innerHTML=rating.map(m=>'<h3>'+names[m.arm]+'</h3>'+Object.entries(m.distribution).sort(([a],[b])=>a.localeCompare(b,undefined,{numeric:true})).map(([k,v])=>`<div style="display:flex;gap:10px;align-items:center;font-size:13px"><span style="width:145px">${escape(k)}</span><span style="width:${v/m.calls*220}px;background:#16877c;height:10px"></span>${v}</div>`).join('')).join('');
 el('table').innerHTML=table(['Arm','Reference agreement [95% CI]','Changed repeats [95% CI]','Mean repeat distance [95% CI]','Numeric pairs','Median / p95 ms','Mean cost / request'],a.metrics.map(m=>[names[m.arm],pct(m.referenceAgreement)+' ['+ci(m.ci)+']',pct(m.repeatChanged)+' ['+ci(m.repeatCI)+']',pct(m.repeatDistance)+' ['+ci(m.repeatDistanceCI)+']',m.numericPairCount,Math.round(m.medianMs)+' / '+Math.round(m.p95Ms),'$'+m.cost.toFixed(7)]));
 el('difference').textContent=`Paired normalized score shift, 0–10 minus 1–5: ${pct(a.meanScoreDifference)} [95% CI ${ci(a.scoreDifferenceCI)}], ${a.numericComparisonCases} numeric cases. This measures score movement, not improvement.`;
 el('reaction').textContent=`Reference-category agreement: ${pct(reaction.referenceAgreement)} [95% CI ${ci(reaction.ci)}].`;
 const groups=new Map<string,number>();for(const c of cases)for(const r of data.receipts.filter((r:any)=>r.caseId===c.id&&r.arm==='reaction')){const key=c.expected.understanding.join(' / ')+'|'+(r.answers.understanding?.choice??'invalid');groups.set(key,(groups.get(key)??0)+1);}
 el('confusion').innerHTML=table(['Expected category','Observed category','Count'],[...groups].sort().map(([k,n])=>[...k.split('|'),n]));
 const previous=(el('case') as HTMLSelectElement).value;
 el('case').innerHTML=cases.map((c:any)=>`<option value="${escape(c.id)}">${escape(c.id)}</option>`).join('');
 if(cases.some((c:any)=>c.id===previous))(el('case') as HTMLSelectElement).value=previous;
 renderCase();
}
function renderCase(){const id=(el('case') as HTMLSelectElement).value,c=data.plan.cases.find((c:any)=>c.id===id);
 el('case-detail').innerHTML=['preceding','learner','reply'].map(k=>`<h3>${k==='preceding'?'Previous partner message':k==='learner'?'Learner message':'Actual partner reply'}</h3><blockquote dir="auto">${escape(c[k]||'(absent)')}</blockquote>`).join('')+'<p class="caption">Provisional reference: '+escape(JSON.stringify(c.expected))+'</p>';
 el('case-results').innerHTML=table(['Arm / repeat','Question','Selected label','Distribution'],data.receipts.filter((r:any)=>r.caseId===id).sort((a:any,b:any)=>a.arm.localeCompare(b.arm)||a.repeat-b.repeat).flatMap((r:any)=>Object.entries(r.answers).map(([q,a]:[string,any])=>[names[r.arm]+' / '+r.repeat,q,a.choice,Object.entries(a.probabilities).sort(([,a]:any,[,b]:any)=>b-a).map(([k,v])=>k+': '+Number(v).toFixed(3)).join('; ')])));
}
el('language').addEventListener('change',render);el('dimension').addEventListener('change',render);el('case').addEventListener('change',renderCase);
el('prompts').innerHTML=['narrow','wide','reaction'].map(arm=>'<h3>'+names[arm]+'</h3><pre>'+escape(JSON.stringify(data.plan.jobs.find((j:any)=>j.arm===arm).payload,null,2))+'</pre>').join('');
el('provenance').textContent=`Frozen input hash: ${data.plan.hash}. Model identity is hashed in the frozen plan and receipts; the runner resolves the existing selected configuration. All ${data.summary.calls} requests have receipts; ${data.summary.invalidResponses} invalid responses.`;
render();
