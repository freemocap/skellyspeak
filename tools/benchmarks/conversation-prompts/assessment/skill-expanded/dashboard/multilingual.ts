import { summarize, arms, names } from './statistics.ts';
const esc=(v:any)=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const pct=(v:number)=>(v*100).toFixed(1);
const range=(v:number[])=>v.map(pct).join(' to ');
export function multilingualSetup(data:any){
 const comparison=document.getElementById('comparison')!;
 const scope=document.createElement('p');scope.id='scope';scope.className='notice';comparison.prepend(scope);
 for(const [id,title]of [['language-results','Results by language'],['history','Matched Spanish comparison'],['control-results','Misleading control · excluded from candidate performance']]){
 const card=document.createElement('article');card.className='card wide';card.innerHTML='<h3>'+title+'</h3><div id="'+id+'"></div>';comparison.querySelector('.grid')!.append(card);
 }
 document.getElementById('focus')?.parentElement?.parentElement?.remove();
 const section=document.createElement('section');section.innerHTML='<h2>Exact prompts by language</h2><p class="caption">Expand a language and strategy to inspect the actual instructions and criteria. E is a deliberately incorrect control.</p>'+Object.entries<any>(data.strategiesByLanguage).map(([code,strategies])=>'<details class="card"><summary>'+esc(data.cases.find((c:any)=>c.languageCode===code).language)+'</summary>'+Object.entries<any>(strategies).map(([arm,qs])=>'<details><summary>'+arm+' · '+esc(data.armNames[data.armIds.indexOf(arm)])+'</summary><pre>'+esc(JSON.stringify(qs,null,2))+'</pre></details>').join('')+'</details>').join('');document.getElementById('method')!.before(section);
}
export function multilingualRender(data:any,selected:any[],dimension:string,references:string,allArms:string[],allNames:string[]){
 const $=(id:string)=>document.getElementById(id)!;
 $('scope').textContent=`Scope: ${selected.length} cases; ${selected.filter(c=>c.contested).length} flagged cases included. ${references==='all'?'All references included':'Preflagged cases excluded'}. Two repetitions per case and condition. Seven candidate strategies; E excluded. The same scenario across languages remains one cluster.`;
 const codes=[...new Set<string>(selected.map(c=>c.languageCode))];
 $('language-results').innerHTML='<p class="caption">Reference agreement, % [95% scenario-cluster interval]. These language slices are exploratory; translations have not had independent native-speaker review.</p><div class="tablewrap"><table><thead><tr><th>Condition</th>'+codes.map(code=>'<th>'+esc(selected.find(c=>c.languageCode===code).language)+'</th>').join('')+'</tr></thead><tbody>'+(()=>{
 const reports=codes.map(code=>summarize(selected.filter(c=>c.languageCode===code),data.receipts,dimension));
 return arms.map((arm,i)=>'<tr><td>'+arm+' · '+esc(names[i])+'</td>'+reports.map(r=>'<td>'+pct(r.metrics[i].accuracy)+' ['+range(r.metrics[i].ci)+']</td>').join('')+'</tr>').join('');})()+'</tbody></table></div>';
 const control=summarize(selected,data.receipts,dimension,5000,false,['E','B'],['Misleading control','Baseline']).metrics[0];
 $('control-results').innerHTML='<p>E agreement: <strong>'+pct(control.accuracy)+'%</strong> [95% interval '+range(control.ci)+']. This control appears here only; its results do not enter candidate rankings, charts, transition summaries or candidate averages. Its billing is included in total experiment spending.</p>';
 if(data.historical){
 const sources=new Set(selected.map(c=>c.sourceId));const current=data.cases.filter((c:any)=>c.languageCode==='es'&&sources.has(c.sourceId));
 const oldCases=data.historical.cases.filter((c:any)=>sources.has(c.id));
 const old=summarize(oldCases,data.historical.receipts,dimension),now=summarize(current,data.receipts,dimension);
 $('history').innerHTML='<p class="caption">Same '+current.length+' Spanish scenarios, same request bodies and references. Previous run: five repetitions; current run: two. Each case has equal weight within each run. This panel always compares Spanish, even when the main filter selects Arabic or Chinese. These are descriptive run-to-run differences, not a treatment effect.</p><table><thead><tr><th>Condition</th><th>Previous, %</th><th>Current, %</th><th>Change, pp</th></tr></thead><tbody>'+now.metrics.map((m,i)=>'<tr><td>'+m.arm+'</td><td>'+pct(old.metrics[i].accuracy)+'</td><td>'+pct(m.accuracy)+'</td><td>'+pct(m.accuracy-old.metrics[i].accuracy)+'</td></tr>').join('')+'</tbody></table>';
 }
}
