import {design} from '../assessment/design.ts';
const el=(tag:string,text='')=>{const e=document.createElement(tag);e.textContent=text;return e;};
export function designPanel(container:HTMLElement,data:any) {
  container.append(el('h2',design.status),el('p',design.question),el('p',design.distinction));
  const summary=data.summary;
  container.append(el('p',`Preserved pilot: ${summary.completed} completed requests, ${summary.failed} failed receipts, ${data.planned-summary.attempts} planned requests without receipts. ${summary.independentSourceTexts} distinct source texts reached. Known receipt cost $${summary.knownCost.toFixed(6)}; ${summary.missingCosts} missing costs. An interrupted in-flight request may have incurred unreported cost.`));
  if(data.instrumentation){
    const s=data.instrumentation.summary;
    container.append(el('p',`Earlier smoke tests, kept separate: ${s.completed} complete and ${s.failed} failed requests. Known cost $${s.knownCost.toFixed(6)}; ${s.missingCosts} missing costs. The first Gemini control returned HTTP 502; its provider reason was not retained by the older receipt helper.`));
    const details=el('details');details.append(el('summary','Inspect smoke-test failure receipts'),el('pre',JSON.stringify(data.instrumentation.observations.filter((o:any)=>o.receipt.status==='failed').map((o:any)=>o.receipt),null,2)));container.append(details);
  }
  const table=(title:string,headers:string[],rows:string[][])=>{
    container.append(el('h3',title));const wrap=el('div');wrap.className='table-wrap';const t=el('table'),head=el('tr');
    headers.forEach(h=>{const th=el('th',h);th.style.textAlign='left';head.append(th);});t.append(head);
    rows.forEach(values=>{const tr=el('tr');values.forEach(v=>{const td=el('td',v);td.style.textAlign='left';tr.append(td);});t.append(tr);});wrap.append(t);container.append(wrap);
  };
  table('Choices already made — visible for review',['Dimension','Current draft','What this does not establish'],design.choices);
  table('Proposed sequence',['Stage','Work','Status'],design.stages);
  table('How success and quality would be evaluated',['Measure','Observable result','Limits / approval status'],design.success);
  container.append(el('h3','Compose a proposed next experiment'),el('p','These controls only describe a design. They do not call APIs or change the frozen pilot. Export your selection for review.'));
  const form=el('div');form.className='toolbar';
  const options:Record<string,string[]>={
    Evidence:['Single message','Bounded conversation window','Both scopes'],
    Comparison:['Jev + dense LLM','Jev + dense LLM + exact native sparse (not connected)'],
    Perturbation:['Ownership minimal pairs','Criterion order','Evidence position','Context length','Question batch size'],
    Labels:['Review controls before running','Blinded human labels + held-out validation'],
    Sampling:['Small instrumentation check','Balanced language × difficulty × wording sample','Expanded reviewed learner-like corpus'],
  };
  const selects:Record<string,HTMLSelectElement>={};
  for(const [key,values] of Object.entries(options)){
    const label=el('label',key),select=document.createElement('select');select.dataset.emptyLabel='Undecided';select.append(new Option('Undecided',''));
    values.forEach(v=>select.append(new Option(v,v)));selects[key]=select;label.append(select);form.append(label);
  }
  container.append(form);
  const note=document.createElement('textarea');note.placeholder='Questions, desired contrasts, acceptance criteria';note.setAttribute('aria-label','Design review notes');container.append(note);
  const exportButton=el('button','Export design for review') as HTMLButtonElement;
  const result=el('pre');
  exportButton.onclick=()=>{
    const value={status:'proposal, not authorization',choices:Object.fromEntries(Object.entries(selects).map(([k,s])=>[k,s.value||'undecided'])),notes:note.value};
    result.textContent=JSON.stringify(value,null,2);
    const url=URL.createObjectURL(new Blob([result.textContent],{type:'application/json'}));
    const link=document.createElement('a');link.href=url;link.download='jev-experiment-design.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  container.append(exportButton,result);
}
