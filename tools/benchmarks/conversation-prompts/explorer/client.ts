import {exposeOptions,syncOptions} from './options.ts';
import {installTopDivider,installDivider,layerColors,type HighlightLayer} from './interaction.ts';
import {semantic} from './semantic.ts';
import {config,groups,levels,bounds,name,mean,ordering,summarize,type Row} from './compare.ts';
import {plot} from './charts.ts';
declare const d3:any;
const root=document.getElementById('prompt-explorer')!;
const $=<T extends HTMLElement=HTMLElement>(q:string)=>root.querySelector<T>(q)!;
const data=JSON.parse(document.getElementById('prompt-explorer-data')!.textContent!);
const rows:Row[]=data.rows;
const pinned:HighlightLayer[]=[];
let fullReport=false;
function inspectionRows(){
 if(fullReport)return rows;
 if(highlighted())return listed();
 if(pinned.length){const ids=new Set(pinned.flatMap(l=>[...l.ids]));return rows.filter(r=>ids.has(r.id));}
 return rows;
}
function layers():HighlightLayer[]{const current=highlighted();return [...pinned,...(current?[{label:'Current',color:getComputedStyle(root).color,ids:current}]:[])];}
const prompts=[...new Set(rows.map(r=>r.prompt))].sort((a,b)=>['direct','relationship','contract','examples','relationship-calibrated','examples-capability'].indexOf(a)-['direct','relationship','contract','examples','relationship-calibrated','examples-capability'].indexOf(b)||a.localeCompare(b));
const packed=Uint8Array.from(atob(data.similarity),x=>x.charCodeAt(0)),dv=new DataView(packed.buffer);
const cos=(a:Row,b:Row)=>dv.getUint16((a.vectorIndex*data.vectorCount+b.vectorIndex)*2,true)/65535*2-1;
// Keep the similarity color scale fixed across filters, using complete corpus cells.
const cellSimilarities=groups(rows).flatMap(g=>levels.map(l=>summarize(g.filter(r=>r.level===l),cos).similarity)).filter(Number.isFinite);
const similarityRange=[Math.floor(Math.min(...cellSimilarities)*100)/100,Math.ceil(Math.max(...cellSimilarities)*100)/100];
let filters:Record<string,string>={prompt:'',level:'',persona:'',wording:'',temperature:'',topP:'',round:'',cluster:'',language:'',search:''};
let selected:Set<string>|null=null,selectionLabel='',focus:Row|null=null,neighbor:Row|null=null,tab='compare',side='responses';
const element=(tag:string,text:string,cls='')=>{const e=document.createElement(tag);e.textContent=text;e.className=cls;return e;};
const button=(text:string,fn:()=>void,cls='')=>{const e=element('button',text,cls) as HTMLButtonElement;e.type='button';e.onclick=fn;return e;};
const pct=(n:number)=>Number.isFinite(n)?`${(n*100).toFixed(0)}%`:'—';
const num=(n:number,d=2)=>Number.isFinite(n)?n.toFixed(d):'—';
function visible(){return rows.filter(r=>Object.entries(filters).every(([k,v])=>!v||(k==='search'?r.text.toLocaleLowerCase('es').includes(v.toLocaleLowerCase('es')):String(r[k]??'default')===v)));}
function highlighted(){return selected||Object.values(filters).some(Boolean)?new Set(listed().map(r=>r.id)):null;}
function listed(){return visible().filter(r=>!selected||selected.has(r.id));}
function choose(group:Row[],label='Plot selection'){fullReport=false;selected=new Set(group.map(r=>r.id));selectionLabel=label;neighbor=null;focus=group.length===1?group[0]:null;render();$('.right').scrollTop=0;}
function updateFilter(key:string,value:string){fullReport=false;filters[key]=value;selected=null;focus=null;neighbor=null;for(const e of root.querySelectorAll<HTMLInputElement>('[data-filter]'))e.value=filters[e.dataset.filter!];render();$('.right').scrollTop=0;}
if(new Set(rows.map(r=>r.language)).size>1){
 const label=document.createElement('label');label.textContent='Target language';
 const select=document.createElement('select');select.dataset.filter='language';select.append(new Option('All languages',''));label.append(select);$('#filters').prepend(label);
 $<HTMLSelectElement>('#color-by').append(new Option('Target language','language'),new Option('Instruction language','wording'));
}
for(const e of root.querySelectorAll<HTMLInputElement|HTMLSelectElement>('[data-filter]')){
 const key=e.dataset.filter!;
 if(e instanceof HTMLSelectElement){let values=[...new Set(rows.map(r=>String(r[key]??'default')))];if(key==='prompt')values=prompts;if(key==='level')values=levels;if(key==='temperature')values.sort((a,b)=>Number(a)-Number(b));for(const v of values)e.append(new Option(name(v),v));}
 e.addEventListener(key==='search'?'input':'change',()=>updateFilter(key,e.value));
}
for(const b of root.querySelectorAll<HTMLButtonElement>('[data-tab]'))b.onclick=()=>{tab=b.dataset.tab!;switchTabs();renderPlots();};
for(const b of root.querySelectorAll<HTMLButtonElement>('[data-side]'))b.onclick=()=>{side=b.dataset.side!;switchTabs();};
function switchTabs(){for(const b of root.querySelectorAll<HTMLButtonElement>('[data-tab]'))b.setAttribute('aria-pressed',String(b.dataset.tab===tab));$('#compare-panel').hidden=tab!=='compare';$('#plots-panel').hidden=tab!=='plots';for(const b of root.querySelectorAll<HTMLButtonElement>('[data-side]'))b.setAttribute('aria-pressed',String(b.dataset.side===side));$('#responses').hidden=side!=='responses';$('#prompts').hidden=side!=='prompts';}
$('#clear').onclick=()=>{selected=null;neighbor=null;focus=null;render();};
$('#reset').onclick=()=>{pinned.splice(0);for(const key in filters)filters[key]='';for(const e of root.querySelectorAll<HTMLInputElement>('[data-filter]'))e.value='';selected=null;neighbor=null;focus=null;render();};
$('#heat-metric').onchange=()=>renderTables();$('#measure').onchange=()=>renderPlots();
$('#fit-target').onchange=()=>renderTables();$('#cos-target').onchange=()=>renderTables();
$('#export').onclick=()=>{$<HTMLTextAreaElement>('#json-text').value=JSON.stringify({fingerprint:data.fingerprint,filters,selectionLabel,layers:pinned.map(l=>({...l,ids:[...l.ids]})),rows:listed().map(r=>({...r,promptText:data.prompts[r.promptIndex]}))},null,2);};
$('#dataset-label').textContent=`${rows.length} responses · Gemini 2.5 Flash Lite · no topic · 10 repetitions per cell`;
for(const [i,p]of prompts.entries()){const e=element('span',name(p));const dot=element('span','','dot');dot.style.background=`var(--s${i%6+1})`;e.prepend(dot);$('#legend').append(e);}
$('#legend').append(element('span','○ Persona · ◇ No persona · drag or click to select','subtle'));
function tags(){const area=$('#tags');area.replaceChildren();for(const [key,v]of Object.entries(filters).filter(([,v])=>v))area.append(button(`${key}: ${name(v)} ×`,()=>updateFilter(key,''),'tag'));if(selected)area.append(button(`${selectionLabel} · ${listed().length} ×`,()=>{selected=null;focus=null;neighbor=null;render();},'tag'));}
function conditionButton(group:Row[],label?:string,selectionName?:string){return button(label??`${name(group[0].prompt)} · ${config(group[0])}`,()=>choose(group,selectionName??label??`${name(group[0].prompt)} · ${config(group[0])}`));}
function appendRow(parent:HTMLElement,first:HTMLElement,values:string[]){const tr=document.createElement('tr'),td=document.createElement('td');td.append(first);tr.append(td);for(const v of values)tr.append(element('td',v,'numeric'));parent.append(tr);}
function renderTables(){
 const collection=groups(rows),rank=$('#ranking'),heat=$('#heat'),summary=$('#summary');rank.replaceChildren();heat.replaceChildren();summary.replaceChildren();
 const fit=Number($<HTMLInputElement>('#fit-target').value)/100,maxCos=Number($<HTMLInputElement>('#cos-target').value);
 const validTargets=Number.isFinite(fit)&&fit>=0&&fit<=1&&Number.isFinite(maxCos)&&maxCos>=-1&&maxCos<=1;
 const metric=$<HTMLSelectElement>('#heat-metric').value,percent=['adherence','duplicates','openings'].includes(metric);
 const scaleRange=metric==='similarity'?similarityRange:percent?[0,1]:[0,Math.max(1,...collection.flatMap(g=>levels.map(l=>summarize(g.filter(r=>r.level===l),cos)[metric as 'words'])).filter(Number.isFinite))];
 const scale=d3.scaleDiverging([scaleRange[0],mean(scaleRange),scaleRange[1]],(t:number)=>d3.interpolateRdBu(1-t));
 $('#heat-low').textContent=percent?pct(scaleRange[0]):num(scaleRange[0],2);$('#heat-high').textContent=percent?pct(scaleRange[1]):num(scaleRange[1],2);
 for(const group of collection){
  const cells=levels.map(l=>group.filter(r=>r.level===l)),stats=cells.map(c=>summarize(c,cos));
  const full=cells.every(c=>c.length===10);
  const passes=full&&stats.every(s=>s.adherence>=fit&&s.similarity<=maxCos);
  appendRow(rank,conditionButton(group),[String(group.length),num(mean(stats.map(s=>s.similarity).filter(Number.isFinite))),pct(Math.min(...stats.filter(s=>s.n).map(s=>s.adherence))),pct(ordering(cells[0],cells[1],'words')),pct(ordering(cells[1],cells[2],'words')),!validTargets?'Invalid target':!full?'Partial data':passes?'Met — review text':'Not met']);
  const tr=document.createElement('tr'),label=document.createElement('td');label.append(conditionButton(group));tr.append(label);
  cells.forEach((cell,i)=>{const td=document.createElement('td');const value=stats[i][metric as 'words'];if(cell.length){const b=conditionButton(cell,`${percent?pct(value):num(value,metric==='words'?1:2)} · n=${cell.length}`,`${name(group[0].prompt)} · ${config(group[0])} · ${name(levels[i])}`);b.style.background=Number.isFinite(value)?scale(value):'var(--input)';if(Number.isFinite(value)){const c=d3.lab(scale(value));b.style.color=c.l<55?'#fff':'#15202f';}b.title=`${name(levels[i])}: ${metric}. Click to inspect ${cell.length} responses`;td.append(b);appendRow(summary,conditionButton(cell,`${name(group[0].prompt)} · ${config(group[0])} · ${name(levels[i])}`),[String(cell.length),num(stats[i].words,1),pct(stats[i].adherence),String(stats[i].unique),String(new Set(cell.map(r=>r.opening)).size),num(stats[i].complexity,1),num(stats[i].letters,1),num(stats[i].similarity)]);}else td.textContent='—';tr.append(td);});heat.append(tr);
 }
}
function renderPlots(){
 if(tab!=='plots')return;
 for(const kind of ['strata','complexity'])plot(root.querySelector<SVGSVGElement>('#'+kind)!,rows,rows,highlighted(),kind,$<HTMLSelectElement>('#measure').value,data.variance,choose,layers());
 if(data.projections){
  const index=Number($<HTMLSelectElement>('#projection').value),p=data.projections.projections[index];
  $('#projection-quality').textContent=`${p.label} · trustworthiness@10 ${p.trustworthiness10.toFixed(3)} · neighbor recall@10 ${(100*p.neighborRecall10).toFixed(1)}%. These measure neighborhood preservation, not response quality.`;
  semantic($('#semantic-map'),data,index,rows,highlighted(),$<HTMLSelectElement>('#color-by').value,choose,layers());
 }
}
function inspect(r:Row,showPrompt=false){fullReport=false;focus=r;if(showPrompt){selected=new Set([r.id]);selectionLabel=r.trial;side='prompts';}render();$('.right').scrollTop=0;}
function renderRight(){
 $<HTMLTextAreaElement>('#json-text').value='';
 const selection=inspectionRows(),active=highlighted(),area=$('#responses'),promptArea=$('#prompts');area.replaceChildren();promptArea.replaceChildren();
 $('#selection-status').textContent=`${selection.length} responses in this panel · ${new Set(selection.map(r=>r.promptIndex)).size} exact prompts · all ${rows.length} points remain on the plots`;
 $('#inspection-title').textContent=fullReport?'Full report':[...new Set(selection.map(r=>name(r.prompt)))].join(' / ')||'No matching content';
 $('#inspection-scope').textContent=fullReport?'Show selection only':'Show full report';
 $('#inspection-scope').setAttribute('aria-pressed',String(fullReport));
 tags();
 if(!selection.length){area.append(element('p','No responses match. Clear the selection or reset filters.','empty'));promptArea.append(element('p','No prompts in this selection.','empty'));}
 for(const p of prompts){const pg=selection.filter(r=>r.prompt===p);if(!pg.length)continue;const section=element('section','','response-group');section.append(element('h3',name(p)));for(const l of levels){const lg=pg.filter(r=>r.level===l);if(!lg.length)continue;section.append(element('h4',name(l)));for(const g of groups(lg)){section.append(element('p',`${config(g[0])} · ${g.length} responses`,'subtle'));const ul=document.createElement('ul');for(const r of g){const li=document.createElement('li');li.dataset.responseId=r.id;li.className=active?(active.has(r.id)?'highlighted':''):'';li.append(element('span',r.text));li.append(button('Inspect',()=>inspect(r)),button('Prompt',()=>inspect(r,true)));ul.append(li);}section.append(ul);}}area.append(section);}
 // Print exact prompts once; identical instructions reused across temperatures remain one block.
 for(const p of prompts){const pg=selection.filter(r=>r.prompt===p);if(!pg.length)continue;const section=element('section','','response-group');section.append(element('h3',name(p)));for(const l of levels){const lg=pg.filter(r=>r.level===l);if(!lg.length)continue;section.append(element('h4',name(l)));for(const pi of [...new Set(lg.map(r=>r.promptIndex))]){const matching=lg.filter(r=>r.promptIndex===pi);const block=element('pre',data.prompts[pi],'prompt-text');block.dataset.promptIndex=String(pi);if(active&&matching.some(r=>active.has(r.id)))block.classList.add('highlighted');section.append(element('p',[...new Set(matching.map(config))].join(' / '),'subtle'),block);}}promptArea.append(section);}
 const detail=$('#focus');detail.replaceChildren();detail.hidden=!focus;if(focus){const r=focus;detail.className='focus';detail.append(element('h3','Selected response'),element('p',r.text),element('p',`${name(r.level)} · ${r.words} words · T ${r.temperature} · top_p ${r.topP??'not supplied'} · ${r.trial}`,'subtle'),button('Show exact prompt',()=>inspect(r,true)),button('Find similar',()=>{neighbor=r;render();}));if(neighbor){detail.append(element('h4','Nearest responses within active filters'));const ul=document.createElement('ul');for(const n of visible().filter(x=>x.id!==neighbor!.id).sort((a,b)=>cos(neighbor!,b)-cos(neighbor!,a)).slice(0,8)){const li=document.createElement('li');li.append(element('span',`${num(cos(neighbor,n),3)} · ${n.text}`),button('Inspect',()=>{neighbor=null;inspect(n);}));ul.append(li);}detail.append(ul);}}
 switchTabs();
}
$('#projection-label').textContent=`This map retains ${(mean(data.variance)*200).toFixed(1)}% of total embedding variance. It discards the rest, so apparent proximity can be misleading. The axes stay fixed across filters.`;
for(const text of [
 'Sampling: the original and wording-variation runs use temperature 0.7. Two new runs keep the original prompts and use 0.3 and 1.1. The nucleus-sampling round uses explicit top_p 0.8 and 1.0 at temperature 1.1. Earlier runs omitted top_p, leaving the upstream default unknown. Reasoning disabled; 512 output-token cap; no provider fallback. These are separate batches, not randomized simultaneous paired trials. Every exact prompt is available in the right panel.',
 'PCA is descriptive, not the optimization objective. Embeddings are unit-normalized before joint PCA. Identical text is embedded once but each generation remains an observation. Neighbors and table cosine values use all 512 embedding dimensions, with quantization error at most 1/65535. Ten observations yield 45 pairs; those pairs are not 45 independent samples.',
 'Cosine means cosine similarity, not cosine distance. Distance is 1 minus similarity. The similarity heatmap uses the observed full-corpus cell-mean range, rounded outward to hundredths and fixed across filters; it does not waste half its color scale on unobserved negative values.',
 'Mean cosine is computed separately within each difficulty and then averaged equally across available levels. Lower means less semantic resemblance; it does not guarantee useful diversity. Exact-text and opening collisions measure the fraction of response pairs that share normalized whole text or first two words. No word or grammatical construction is blacklisted.',
 'AZ < Beginner and Beginner < Intermediate are empirical probabilities that a random higher-level response is longer, counting ties as one half. 50% indicates no ordering; 100% means complete separation in this sample. A missing level makes that comparison unavailable. The shaded bands on the word-count plot are requested ranges (3–5, 6–11, 13–23). Vertical jitter within each difficulty is only to expose repeated points; it encodes no complexity.',
 'Words per sentence and letters per word are simple language-form proxies. They cannot identify tense, subordinate clauses, vocabulary familiarity, inference burden, CEFR level or interestingness. Short texts make readability formulas unstable, so none is presented as a calibrated difficulty score. Review actual text alongside numerical targets.',
 'Numeric targets are user-adjustable screening criteria. A condition meets them only if all three complete difficulty cells satisfy both targets. This is not a recommendation, a statistical significance claim, or an automatic semantic quality grade. Filtering by response text can bias these metrics; reset filters for whole-condition comparisons.',
 'The right panel preserves the requested report order: prompt → difficulty → settings/identity → response bullets. Selectors highlight matching observations while keeping every response and all comparison data visible. Table cells and plots highlight the corresponding group. The inspection panel shows matching content immediately; Show full report restores the complete list. Plots and tables retain all observations. JSON is secondary and stays collapsed until opened.'
])$('#method').append(element('p',text));
function render(){
 syncOptions(root);renderTables();renderRight();renderPlots();renderLayers();
 const active=highlighted();
 for(const body of ['ranking','heat','summary']){
  const conditions=groups(rows).flatMap(g=>body==='summary'?levels.map(l=>g.filter(r=>r.level===l)):[g]);
  [...$('#'+body).children].forEach((tr,i)=>{tr.className=active?(conditions[i]?.some(r=>active.has(r.id))?'highlighted':''):'';});
 }
 const decorate=(el:HTMLElement,ids:Set<string>)=>{
  const matches=layers().filter(layer=>[...ids].some(id=>layer.ids.has(id)));
  el.classList.remove('highlighted');el.dataset.highlighted=String(matches.length>0);
  el.style.boxShadow=matches.map((layer,i)=>`0 0 0 ${(i+1)*2}px ${layer.color}`).join(',');
 };
 for(const el of root.querySelectorAll<HTMLElement>('[data-response-id]'))decorate(el,new Set([el.dataset.responseId!]));
 for(const el of root.querySelectorAll<HTMLElement>('[data-prompt-index]'))decorate(el,new Set(rows.filter(r=>r.promptIndex===Number(el.dataset.promptIndex)).map(r=>r.id)));
 for(const body of ['ranking','heat','summary']){
  const conditions=groups(rows).flatMap(g=>body==='summary'?levels.map(l=>g.filter(r=>r.level===l)):[g]);
  [...$('#'+body).children].forEach((tr,i)=>decorate(tr as HTMLElement,new Set(conditions[i].map(r=>r.id))));
 }
}
function renderLayers(){
 const area=$('#layers');area.replaceChildren();
 pinned.forEach((layer,i)=>{
  const chip=element('div','','layer-chip');chip.style.setProperty('--layer',layer.color);
  chip.append(element('span',`${layer.label} · ${layer.ids.size}`),button('Load',()=>{
   selected=new Set(layer.ids);selectionLabel=layer.label;for(const key in filters)filters[key]='';
   for(const e of root.querySelectorAll<HTMLInputElement>('[data-filter]'))e.value='';
   render();
  }),button('Remove',()=>{pinned.splice(i,1);render();}));area.append(chip);
 });
 $<HTMLButtonElement>('#pin-layer').disabled=!highlighted()||!listed().length||pinned.length>=4;
}
$('#pin-layer').onclick=()=>{
 const label=Object.entries(filters).filter(([,v])=>v).map(([k,v])=>`${k}: ${name(v)}`).join(' · ')||selectionLabel;
 pinned.push({label,color:layerColors.find(c=>!pinned.some(l=>l.color===c))!,ids:new Set(listed().map(r=>r.id))});
 for(const key in filters)filters[key]='';for(const e of root.querySelectorAll<HTMLInputElement>('[data-filter]'))e.value='';
 selected=null;render();
};
installDivider($('.workspace'),$('#panel-divider'));
$('#inspection-scope').onclick=()=>{fullReport=!fullReport;render();$('.right').scrollTop=0;};
if(data.projections)for(const [i,p] of data.projections.projections.entries())$<HTMLSelectElement>('#projection').append(new Option(p.label,String(i)));
$('#projection').onchange=renderPlots;$('#color-by').onchange=renderPlots;
if(data.study?.recommendation){$('#recommendation').append(element('h2','Current recommendation'),element('p',data.study.recommendation,'instructions'));}
if(data.study?.review)for(const paragraph of data.study.review)$('#recommendation').append(element('p',paragraph,'instructions'));
if(data.study?.metricNotes)$('#recommendation').append(element('p',data.study.metricNotes,'instructions'));
if(data.study)$('#study-label').textContent=data.study.title+' · '+data.study.runs.length+' saved runs';

exposeOptions(root);
installTopDivider($('header'),$('#top-divider'));
new ResizeObserver(()=>renderPlots()).observe($('.left'));
render();
