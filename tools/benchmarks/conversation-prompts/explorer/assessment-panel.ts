import {designPanel} from './assessment-design.ts';
import type {Observation} from '../assessment/analysis.ts';
import type {Row} from './compare.ts';
declare const Plotly:any;
const element=(tag:string,text='')=>{const e=document.createElement(tag);e.textContent=text;return e;};
const mean=(a:number[])=>a.length?a.reduce((s,n)=>s+n,0)/a.length:NaN;
const number=(n:number)=>Number.isFinite(n)?n.toFixed(3):'—';
export function assessmentPanels(root:HTMLElement,data:any,rows:Row[],choose:(rows:Row[],label?:string)=>void) {
  const tabs=root.querySelector('.left .tabs')!;
  for(const [id,title] of [['design','Design review'],['assessment','Skill decisions']]) {
    const b=element('button',title);b.dataset.tab=id;tabs.prepend(b);
    const panel=element('section');panel.id=id+'-panel';panel.className='tab-panel';panel.hidden=true;
    root.querySelector('#compare-panel')!.before(panel);
  }
  designPanel(root.querySelector('#design-panel')!,data);
  const panel=root.querySelector<HTMLElement>('#assessment-panel')!;
  panel.append(element('h2','Partial pilot — inspectable observations, not a model recommendation'),
    element('p','Cells show mean P(demonstrated) over the available repeats. Missing cells remain missing. The source is generated partner text reassigned synthetically; these are not real learner profiles. Click any cell to inspect the exact evidence, rubric, paired answers and receipts.'));
  const toolbar=element('div');toolbar.className='toolbar';
  const label=element('label','Condition'),condition=document.createElement('select');
  for(const c of ['learner','partner-only','evidence-first','evidence-last','reverse-criteria'])condition.append(new Option(c,c));
  label.append(condition);toolbar.append(label);panel.append(toolbar);
  const tableArea=element('div');tableArea.className='table-wrap';panel.append(tableArea);
  const observations:Observation[]=data.observations;
  const sources:string[]=data.sourceIds;
  const summaryArea=element('div');panel.append(summaryArea);
  function inspect(sourceId:string,skill:any) {
    const source=rows.find(r=>r.id===sourceId)!;choose([source],`Assessment · ${skill.label}`);
    const target=root.querySelector<HTMLElement>('#focus')!;target.hidden=false;target.replaceChildren();
    target.append(element('h3','Synthetic evidence and exact skill'),element('p',source.text),element('p',`Source: ${source.id}`),
      element('p',`${skill.label}: ${skill.criterion}`),element('p','This source was generated as partner prose. The experiment changes role eligibility explicitly. Original prompts and the source response remain below.'));
    const matched=observations.filter(o=>o.job.sourceId===sourceId);
    const chart=element('div');target.append(chart);
    const categories=['demonstrated','partial','not_demonstrated','not_observed','uncertain'];
    const palette=['#6fc29a','#e7a251','#ed7777','#8194ae','#b0a8ec'];
    Plotly.newPlot(chart,categories.map((outcome,i)=>({type:'bar',name:outcome,orientation:'h',marker:{color:palette[i]},
      y:matched.map(o=>`${o.job.engine} · ${o.job.condition} · r${o.job.repeat}`),
      x:matched.map(o=>o.receipt.answers[skill.id]?.probabilities[outcome]??null)})),
      {barmode:'stack',height:Math.max(350,matched.length*28),paper_bgcolor:'transparent',plot_bgcolor:'transparent',
        font:{color:getComputedStyle(target).color},margin:{l:210,r:15,t:20,b:90},xaxis:{range:[0,1],title:'Probability'},legend:{orientation:'h'}},
      {responsive:true,displaylogo:false});
    for(const o of matched) {
      const a=o.receipt.answers[skill.id];
      target.append(element('h4',`${o.job.engine} · ${o.job.condition} · repeat ${o.job.repeat}`),
        element('p',a?`${a.choice}; P(demonstrated) ${a.probabilities.demonstrated}; confidence ${a.confidence}`:'No validated answer'),
        element('p',`${o.receipt.status} · ${o.receipt.elapsedMs} ms · cost ${o.receipt.metadata?.usage?.cost??'unknown'}`));
      const details=element('details');details.append(element('summary','Exact state, question and receipt'),element('pre',JSON.stringify({
        state:o.job.payload.state,question:o.job.payload.questions[skill.id],answer:a,receipt:{...o.receipt,answers:undefined}},null,2)));target.append(details);
    }
    root.querySelector('.right')!.scrollTop=0;
  }
  function render() {
    tableArea.replaceChildren();const table=element('table'),head=element('tr');head.append(element('th','Source / model'));
    for(const s of data.skills){const th=element('th',s.id);th.style.writingMode='vertical-rl';th.style.minWidth='34px';th.title=s.criterion;head.append(th);}table.append(head);
    for(const id of sources)for(const engine of ['jev','chat']) {
      const source=rows.find(r=>r.id===id)!;
      const group=observations.filter(o=>o.job.sourceId===id&&o.job.engine===engine&&o.job.condition===condition.value&&o.receipt.status==='complete');
      const tr=element('tr');tr.dataset.assessmentSource=id;
      const rowLabel=element('td',`${source.language} · ${source.level} · ${engine} · n=${group.length}`);rowLabel.style.minWidth='190px';tr.append(rowLabel);
      for(const skill of data.skills) {
        const td=element('td'),p=mean(group.map(o=>o.receipt.answers[skill.id]?.probabilities.demonstrated).filter(x=>typeof x==='number'));
        const b=element('button',Number.isFinite(p)?p.toFixed(2):'—');b.style.padding='5px 3px';b.title=skill.label;
        if(Number.isFinite(p)){b.style.background=`rgb(${Math.round(239-145*p)},${Math.round(244-75*p)},${Math.round(249-95*p)})`;b.style.color='#17202c';}
        b.onclick=()=>inspect(id,skill);td.append(b);tr.append(td);
      }
      table.append(tr);
    }
    tableArea.append(table);
  }
  condition.onchange=render;render();
  summaryArea.append(element('h3','Quality and stability measures'),element('p','Agreement and stability are descriptive. Semantic accuracy and calibration are unavailable without reviewed labels. Pair counts below share source texts.'));
  const table=element('table');
  for(const engine of ['jev','chat']) {
    const group=observations.filter(o=>o.job.engine===engine),costs=group.map(o=>o.receipt.metadata?.usage?.cost);
    const controls=group.filter(o=>o.job.condition==='partner-only'&&o.receipt.status==='complete');
    const row=element('tr');[engine,`${group.length} receipts`,`${number(mean(group.map(o=>o.receipt.elapsedMs)))} ms mean`,
      `$${costs.filter(c=>typeof c==='number').reduce((s,c)=>s+c,0).toFixed(6)} known`,`${costs.filter(c=>typeof c!=='number').length} unknown costs`,
      `${controls.filter(o=>Object.values(o.receipt.answers).some(a=>a.choice!=='not_observed')).length}/${controls.length} ownership controls with any non-absent answer`]
      .forEach(v=>row.append(element('td',v)));table.append(row);
  }
  summaryArea.append(table);
  const pairPlot=element('div');summaryArea.append(pairPlot);
  function plots() {
    if(panel.hidden)return;
    const pairs=data.summary.pairs;
    Plotly.react(pairPlot,Object.entries(pairs).map(([axis,list]:[string,any])=>({type:'scatter',mode:'markers',name:axis,
      x:list.map((p:any)=>p.meanProbabilityChange),y:list.map((p:any)=>p.changed/p.total),
      text:list.map((p:any)=>`${p.language} · ${p.engine} · ${p.condition}`),customdata:list.map((p:any)=>p.sourceId),
      hovertemplate:'%{text}<br>Mean |ΔP| %{x:.3f}<br>Label flips %{y:.1%}<extra></extra>'})),
      {height:360,paper_bgcolor:'transparent',plot_bgcolor:'transparent',font:{color:getComputedStyle(panel).color},
        xaxis:{title:'Within-source mean absolute change in P(demonstrated)',range:[0,1]},yaxis:{title:'Fraction of 45 labels changed',range:[0,1]},legend:{orientation:'h'}},
      {responsive:true,displaylogo:false});
  }
  return {plots,highlight:(ids:Set<string>|null)=>{
    for(const tr of tableArea.querySelectorAll<HTMLElement>('[data-assessment-source]'))tr.className=ids?.has(tr.dataset.assessmentSource!)?'highlighted':'';
  }};
}
