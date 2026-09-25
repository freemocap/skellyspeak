import {multilingualSetup, multilingualRender} from './multilingual.ts';
import {transitions} from './transitions.ts';
import { summarize, arms, names, quantile } from './statistics.ts';
declare global {
    interface Window {
        STUDY: any;
    }
}
const data = window.STUDY;
if(data.armIds)arms.splice(0,arms.length,...data.armIds);
if(data.armNames)names.splice(0,names.length,...data.armNames);
const allArms=[...arms], allNames=[...names];
for(let i=arms.length-1;i>=0;i--)if(data.controlArms?.includes(arms[i])){arms.splice(i,1);names.splice(i,1);}
const repetitions=data.repetitions??5;
const $ = (id: string) => document.getElementById(id)!;
const value = (id: string) => ($(id) as HTMLSelectElement).value;
const colors = ['#3278bd', '#008477', '#9c62b0', '#bc681c', '#c44c63','#5669b1','#647c31','#94543f'];
const escape = (v: any) => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const pct = (v: number) => (v * 100).toFixed(1) + '%';
const interval = (ci: number[], factor = 100) => ci.map(v => (v * factor).toFixed(1)).join('–');
let selected: any[] = [], report: any;
function svg(body: string, height = 310) { return `<svg class="chart" viewBox="0 0 640 ${height}" role="img">${body}</svg>`; }
function forest(id: string, values: number[], intervals: number[][], domain: number[], formatter: (n: number) => string, zero = false, hideControl=false) {
    const bottom=25+arms.length*47;
    const x = (n: number) => 205 + (n - domain[0]) / (domain[1] - domain[0]) * 420;
    let s = `<title>${escape($(id).parentElement!.querySelector('h3')!.textContent)}</title>`;
    for (let i = 0; i <= 4; i++) {
        const t = domain[0] + (domain[1] - domain[0]) * i / 4;
        s += `<line class="gridline" x1="${x(t)}" x2="${x(t)}" y1="20" y2="${25+arms.length*47}"/><text x="${x(t)}" y="${56+arms.length*47}" text-anchor="middle">${formatter(t)}</text>`;
    }
    if (zero)
        s += `<line x1="${x(0)}" x2="${x(0)}" y1="20" y2="${25+arms.length*47}" stroke="#52697a" stroke-dasharray="4 4"/>`;
    arms.forEach((a, i) => { if(hideControl&&a==='E')return;const y = 42 + i * 47, [lo, hi] = intervals[i]; s += `<text class="label" x="8" y="${y + 5}">${a} · ${names[i].replace('Examples in criteria','Criteria examples').replace('Decision rules','Procedure').replace('Misleading control','Misleading').replace('Language + ', '+ ').replace(' specimen', '')}</text><g fill="${colors[i]}" stroke="${colors[i]}"><title>${names[i]}: ${formatter(values[i])}; interval ${formatter(lo)} to ${formatter(hi)}</title><line x1="${x(lo)}" x2="${x(hi)}" y1="${y}" y2="${y}" stroke-width="3"/><path d="M${x(lo)},${y - 6}v12 M${x(hi)},${y - 6}v12"/><circle cx="${x(values[i])}" cy="${y}" r="6"/></g>`; });
    $(id).innerHTML = svg(s,75+arms.length*47);
}
function render() {
    selected = data.cases.filter((c: any) => (value('language') === 'all' || c.language + ' · ' + c.variety === value('language')) && (value('skill') === 'all' || c.focal === value('skill')) && (value('references') === 'all' || !c.contested));
    if(data.study?.adjusted&&!data.study?.multilingual)selected=selected.filter(c=>value('cohort')==='all'||c.partition===value('cohort'));
    report = summarize(selected, data.receipts, value('dimension'),5000,Boolean(data.study?.adjusted));
    const m = report.metrics;
    $('metrics').innerHTML = [['' + report.cases, 'selected cases · '+repetitions+' repeats each'], ['' + report.clusters, 'semantic scenario clusters'], [report.calls.toLocaleString(), data.controlArms?.length?'selected candidate responses · excludes E':'selected measured responses'], ['$' + data.totalCost.toFixed(4), 'reported cost · full study including controls']].map(([v, k]) => `<div class="metric"><strong>${v}</strong><span>${k}</span></div>`).join('');
    forest('agreement', m.map((v: any) => v.accuracy), m.map((v: any) => v.ci), [0, 1], pct);
    const hideControl=data.study&&document.getElementById('focus')&&(document.getElementById('focus') as HTMLInputElement).checked;
    const extent = Math.max(.05, ...m.filter((v:any)=>!hideControl||v.arm!=='E').flatMap((v: any) => v.deltaCI.map(Math.abs))) * 1.15;
    forest('difference', m.map((v: any) => v.accuracy - m[1].accuracy), m.map((v: any) => v.deltaCI), [-extent, extent], n => (n * 100).toFixed(0), true,Boolean(hideControl));
    forest('cost', m.map((v: any) => v.cost), m.map((v: any) => v.costCI), [0, Math.max(...m.map((v: any) => v.costCI[1])) * 1.12], n => '$' + n.toFixed(3));
    const best = [...m].sort((a: any, b: any) => b.accuracy - a.accuracy)[0];
    const informative = m.filter((v: any) => v.arm !== 'B' && (v.deltaCI[0] > 0 || v.deltaCI[1] < 0));
    $('finding').innerHTML = `<h3>${best.arm} has the highest point estimate in this selection: ${pct(best.accuracy)}</h3><p>${informative.length ? informative.map((v: any) => `${v.arm} versus B: ${((v.accuracy - m[1].accuracy) * 100).toFixed(1)} percentage points (${data.study?.adjusted?'adjusted':'95%'} interval ${interval(v.deltaCI)}).`).join(' ') : 'Every paired comparison with B includes zero in its interval. This selection does not clearly separate the conditions.'}</p><p class="caption">Do not rank conditions by their point estimates alone. These intervals reflect scenario variability; reference quality remains unresolved. Changing filters is exploratory.</p>`;
    $('table').innerHTML = `<table><thead><tr><th>Condition</th><th>Agreement [95% interval]</th><th>Δ vs B [${data.study?.adjusted?'adjusted':'95%'} interval], pp</th><th>Median / p95, ms</th><th>USD / 1,000 requests</th><th>USD / request</th></tr></thead><tbody>${m.map((v: any) => `<tr><td><span class="swatch" style="background:${colors[arms.indexOf(v.arm)]}"></span>${v.arm} · ${v.name}</td><td>${pct(v.accuracy)} [${interval(v.ci)}]</td><td>${((v.accuracy - m[1].accuracy) * 100).toFixed(1)} [${interval(v.deltaCI)}]</td><td>${quantile(v.latencies, .5).toFixed(0)} / ${quantile(v.latencies, .95).toFixed(0)}</td><td>$${v.cost.toFixed(4)}</td><td>$${(v.cost/1000).toFixed(7)}</td></tr>`).join('')}</tbody></table>`;
    latency(m);
    $('repeat').innerHTML = `<table><thead><tr><th>Condition</th><th>Disagreement [95% interval]</th><th>Drift [95% interval]</th></tr></thead><tbody>${m.map((v: any) => `<tr><td>${v.arm} · ${v.name}</td><td>${pct(v.change)} [${interval(v.changeCI)}]</td><td>${v.drift.toFixed(4)} [${v.driftCI.map((n: number) => n.toFixed(4)).join("–")}]</td></tr>`).join('')}</tbody></table>`;
    if(data.audit)$('repeat').innerHTML+='<details open><summary>Exact-input repeatability audit · full study</summary><p>'+data.audit.groups+' case/strategy groups each have one identical request-body hash across '+repetitions+' repetitions. Among '+data.audit.completeValidGroups+' groups with '+repetitions+' valid responses, '+data.audit.choiceChangedGroups+' changed any choice, '+data.audit.focalChoiceChangedGroups+' changed a focal choice, and '+data.audit.probabilityChangedGroups+' changed probabilities. These are group counts, not individual-call error rates.</p><p class="caption">Keys are sorted before comparison. A missing temperature option does not guarantee determinism. The cause of the observed API variation is not established.</p><a href="repeat-audit.yaml">Full hash audit and repeated choices</a></details>';
    if(data.study?.adjusted){
      const checks=arms.map(arm=>{let valid=0,contradictions=0;for(const c of selected)for(const r of data.receipts.filter((r:any)=>r.caseId===c.id&&r.arm===arm)){const e=r.answers[c.focal+'__evidence']?.choice,x=r.answers[c.focal+'__expression']?.choice;if(e===undefined||x===undefined)continue;valid++;if((e==='absent')!==(x==='not_applicable'))contradictions++;}return{arm,valid,contradictions};});
      $('repeat').innerHTML+='<h3 style="margin-top:20px">Absence / applicability consistency</h3><table><thead><tr><th>Strategy</th><th>Inconsistent / valid paired judgments</th></tr></thead><tbody>'+checks.map(c=>'<tr><td>'+c.arm+' · '+escape(names[arms.indexOf(c.arm)])+'</td><td>'+c.contradictions+' / '+c.valid+'</td></tr>').join('')+'</tbody></table><p class="caption">Descriptive secondary diagnostic: absent evidence should pair with not-applicable expression under the proposed rubric. D enforces this by its available joint labels, so zero contradictions for D is not independent evidence of better language interpretation.</p>';
    }
    const current = value('case');
    $('case').innerHTML = selected.map(c => `<option value="${c.id}">${escape(c.id + ' · ' + c.variety + ' · ' + c.input.learner)}</option>`).join('');
    if (selected.some(c => c.id === current))
        ($('case') as HTMLSelectElement).value = current;
    if(data.study){
      const ts=transitions(selected,data.receipts,value('dimension'));
      $('transitions').innerHTML='<h3>Which answers changed from baseline?</h3><p class="caption">Same case, repetition and focal judgment. 95% cluster intervals measure the changed-label rate. Invalid pairs are listed separately.</p><div class="tablewrap"><table><thead><tr><th>Condition</th><th>Changed / valid pairs</th><th>Changed % [95% interval]</th><th>Now matches reference</th><th>No longer matches</th><th>Invalid pairs</th></tr></thead><tbody>'+ts.map(t=>'<tr><td>'+t.arm+' · '+escape(names[arms.indexOf(t.arm)])+'</td><td>'+t.changed+' / '+t.total+'</td><td>'+pct(t.changed/t.total)+' ['+interval(t.ci)+']</td><td>'+t.fixed+'</td><td>'+t.broken+'</td><td>'+t.invalid+'</td></tr>').join('')+'</tbody></table></div><p class="caption">A label can change without either answer matching the provisional reference. This comparison measures behavioral sensitivity, not just net agreement. Individual paired repetitions do not share a random seed.</p>';
    }
    if(data.study?.multilingual)multilingualRender(data,selected,value('dimension'),value('references'),allArms,allNames);
    matrix();
    inspect();
}
function latency(m: any[]) {
    const limit = Math.max(...m.map(v => quantile(v.latencies, .95))) * 1.15, x = (v: number) => 185 + 420 * v / limit;
    let s = '<title>Latency box plots by condition</title>';
    for (let i = 0; i <= 4; i++) {
        let t = limit * i / 4;
        s += `<line class="gridline" x1="${x(t)}" x2="${x(t)}" y1="20" y2="${25+arms.length*47}"/><text x="${x(t)}" y="${56+arms.length*47}" text-anchor="middle">${t.toFixed(0)} ms</text>`;
    }
    m.forEach((v, i) => { const y = 42 + i * 47, [lo, q1, median, q3, hi] = [.05, .25, .5, .75, .95].map(p => quantile(v.latencies, p)); s += `<text class="label" x="8" y="${y + 5}">${v.arm} · ${names[i].replace('Examples in criteria','Criteria examples').replace('Decision rules','Procedure').replace('Misleading control','Misleading').replace('Language + ', '+ ').replace(' specimen', '')}</text><g stroke="${colors[i]}"><title>p05 ${lo.toFixed(0)}, p25 ${q1.toFixed(0)}, median ${median.toFixed(0)}, p75 ${q3.toFixed(0)}, p95 ${hi.toFixed(0)} milliseconds</title><path d="M${x(lo)} ${y}H${x(hi)}M${x(lo)} ${y - 6}v12 M${x(hi)} ${y - 6}v12"/><rect x="${x(q1)}" y="${y - 12}" width="${Math.max(1, x(q3) - x(q1))}" height="24" fill="${colors[i]}" fill-opacity=".2"/><path d="M${x(median)} ${y - 12}v24" stroke-width="3"/></g>`; });
    $('latency').innerHTML = svg(s,75+arms.length*47);
    const max = Math.max(...m.flatMap(v => v.latencies)), sx = (v: number) => 65 + 540 * Math.log1p(v) / Math.log1p(max), sy = (v: number) => 250 - 220 * v;
    s = '<title>Latency cumulative distribution, logarithmic time axis</title>';
    for (let i = 0; i <= 4; i++)
        s += `<line class="gridline" x1="65" x2="605" y1="${sy(i / 4)}" y2="${sy(i / 4)}"/><text x="55" y="${sy(i / 4) + 5}" text-anchor="end">${i * 25}%</text>`;
    for (const t of [50, 100, 200, 500, 1000, 5000, 10000, 60000].filter(t => t <= max))
        s += `<text x="${sx(t)}" y="278" text-anchor="middle">${t}</text>`;
    m.forEach((v, i) => { const a = [...v.latencies].sort((a, b) => a - b); s += `<path d="M${sx(a[0])},${sy(0)}${a.map((t, j) => `H${sx(t)}V${sy((j + 1) / a.length)}`).join('')}" fill="none" stroke="${colors[i]}" stroke-width="2"/>`; });
    s += '<text x="330" y="309" text-anchor="middle">Request latency, ms · logarithmic axis · billed responses</text>';
    $('ecdf').innerHTML = svg(s, 330);
    $('legend').innerHTML = arms.map((a, i) => `<span><i class="swatch" style="background:${colors[i]}"></i>${a} ${names[i]}</span>`).join('');
}
function matrix() {
    const ds = value('dimension') === 'both' ? ['evidence', 'expression'] : [value('dimension')];
    const rows = selected.map(c => { const scores = arms.map(a => { const rs = data.receipts.filter((r: any) => r.caseId === c.id && r.arm === a); return rs.reduce((n: number, r: any) => n + ds.filter(d => r.answers[c.focal + '__' + d]?.choice === c.targets[c.focal][d]).length, 0) / (rs.length * ds.length); }); return { c, scores, total: scores.reduce((a, b) => a + b, 0) }; }).sort((a, b) => a.total - b.total);
    $('matrix').innerHTML = `<table><thead style="position:sticky;top:0"><tr><th>Case · variety</th>${arms.map(a => `<th>${a}</th>`).join('')}</tr></thead><tbody>${rows.map(({ c, scores }) => `<tr><td><button data-case="${c.id}" style="border:0;background:transparent;padding:2px;text-align:left">${escape(c.id + ' · ' + c.variety + ' · ' + c.input.learner)}${c.contested ? ' †' : ''}</button></td>${scores.map(v => `<td style="background:${v >= .8 ? '#d9efea' : v >= .5 ? '#f7edcf' : '#f1d6bc'}">${pct(v)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    $('matrix').querySelectorAll<HTMLButtonElement>('button[data-case]').forEach(b => b.addEventListener('click', () => { ($('case') as HTMLSelectElement).value = b.dataset.case!; inspect(); $('case-detail').scrollIntoView({ block: 'center', behavior: 'smooth' }); }));
}
function inspect() {
    const c = selected.find(c => c.id === value('case'));
    if (!c)
        return;
    $('case-detail').innerHTML = `<div class="inspect"><div><h3>${escape(c.language + ' · ' + c.variety)} <span class="pill">${c.focal === 'past_reference' ? 'Past reference' : 'Possession & relationships'}</span></h3><p class="caption">Partner context</p><p dir="auto">${escape(c.input.preceding_partner ?? 'No preceding exchange')}</p><p class="caption">Learner message</p><blockquote dir="auto">${escape(c.input.learner)}</blockquote></div><div><h3>Provisional reference</h3><p>Evidence: <strong>${escape(c.targets[c.focal].evidence)}</strong><br>Expression: <strong>${escape(c.targets[c.focal].expression)}</strong></p><p>${c.contested ? '<span class="pill">Flagged for review before inference</span>' : ''}</p><p>${escape(c.review_note || 'No additional case note.')}</p><p class="caption">Case ${c.id} · scenario cluster ${escape(c.cluster)}. All labels remain provisional, including unflagged labels.</p></div></div>`;
    const invalid = data.receipts.filter((r:any)=>r.caseId===c.id && r.errors?.length);
    if(invalid.length)$('case-detail').innerHTML += '<p class="notice">Validation failures (including the other assessed skill): '+invalid.map((r:any)=>escape(r.arm+' repeat '+r.repeat+': '+r.errors.join('; '))).join('<br>')+'</p>';
    const ds = value('dimension') === 'both' ? ['evidence', 'expression'] : [value('dimension')];
    $('case-results').innerHTML = ds.map(d => `<h3>${d === 'evidence' ? 'Evidence' : 'Expression'} · reference: ${escape(c.targets[c.focal][d])}</h3><table><thead><tr><th>Condition</th>${Array.from({length:repetitions},(_,i)=>i+1).map(i => `<th>Repeat ${i}</th>`).join('')}<th>Matches</th></tr></thead><tbody>${arms.map((a, i) => { const rs = data.receipts.filter((r: any) => r.caseId === c.id && r.arm === a).sort((a: any, b: any) => a.repeat - b.repeat); return `<tr><td>${a} · ${names[i]}</td>${rs.map((r: any) => { const ans = r.answers[c.focal + '__' + d]; if (!ans)
        return '<td>Invalid answer<br><small>' + escape(r.errors.join('; ')) + '</small></td>'; return `<td><details><summary>${escape(ans.choice)} ${ans.choice === c.targets[c.focal][d] ? '✓' : '≠'}</summary>${Object.entries<number>(ans.probabilities).map(([k, v]) => `<div>${escape(k)}: ${pct(v)}</div>`).join('')}<p class="caption">${r.elapsedMs} ms · $${r.costUsd.toFixed(7)}</p></details></td>`; }).join('')}<td>${rs.filter((r: any) => r.answers[c.focal + '__' + d]?.choice === c.targets[c.focal][d]).length}/${repetitions}</td></tr>`; }).join('')}</tbody></table>`).join('');
    const joint = data.receipts.filter((r:any)=>r.caseId===c.id&&r.rawAnswers);
    if(joint.length)$('case-results').innerHTML+='<details><summary>Original joint choices and probabilities</summary><p class="caption">The rows above map the winning joint category to evidence and expression. Probabilities are marginal sums; their maxima may differ from the winning joint category. Joint confidence is not marginal calibration.</p>'+joint.map((r:any)=>'<h3>'+escape(r.arm+' · repeat '+r.repeat)+'</h3><pre>'+escape(JSON.stringify(r.rawAnswers,null,2))+'</pre>').join('')+'</details>';
}
for (const id of ['language', 'skill', 'dimension', 'references'])
    $(id).addEventListener('change', render);
$('case').addEventListener('change', inspect);
for (const [id, direction] of [['previous', -1], ['next', 1]] as const)
    $(id).addEventListener('click', () => { const el = $('case') as HTMLSelectElement; el.selectedIndex = (el.selectedIndex + direction + selected.length) % selected.length; inspect(); });
$('download').addEventListener('click', () => { const rows = [['condition', 'agreement', 'agreement_lower95', 'agreement_upper95', 'delta_B', 'delta_lower95', 'delta_upper95', 'median_ms', 'p95_ms', 'usd_per_1000', 'choice_disagreement', 'probability_drift', 'language', 'skill', 'judgment', 'references', 'cases', 'clusters'], ...report.metrics.map((m: any) => [m.arm, m.accuracy, ...m.ci, m.accuracy - report.metrics[1].accuracy, ...m.deltaCI, quantile(m.latencies, .5), quantile(m.latencies, .95), m.cost, m.change, m.drift, value('language'), value('skill'), value('dimension'), value('references'), report.cases, report.clusters])]; const url = URL.createObjectURL(new Blob([rows.map(r => r.map((v: any) => '"' + String(v).replace(/"/g, '""') + '"').join(',')).join('\n')], { type: 'text/csv' })); const a = document.createElement('a'); a.href = url; a.download = 'jev-comparison.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); });
if(data.study){
 if(data.study.adjusted&&!data.study.multilingual){const cohort=document.createElement('label');cohort.innerHTML='Data slice<select id="cohort"><option value="fresh">Fresh challenge cases</option><option value="development">Development cases</option><option value="all">All (exploratory)</option></select>';document.querySelector('.filters')!.prepend(cohort);cohort.querySelector('select')!.addEventListener('change',render);($('references')as HTMLSelectElement).value='uncontested';}
 const focus=document.createElement('label');focus.innerHTML='<span><input type="checkbox" id="focus"> Zoom paired differences (hide misleading control)</span>';focus.addEventListener('change',render);$('difference').before(focus);
 const changes=document.createElement('article');changes.id='transitions';changes.className='card wide';$('comparison').querySelector('.grid')!.append(changes);
 if(data.study.adjusted)$('table').parentElement!.querySelector('.caption')!.textContent='Intervals preserve translations and related variants as one scenario cluster. Agreement intervals are pointwise 95%; baseline differences adjust for the candidate contrasts. Exploring additional filters is not covered by that adjustment.';
 const st=data.study;document.title=st.title;document.querySelector('h1')!.textContent=st.title;document.querySelector('header p')!.textContent=st.subtitle;
 $('language').innerHTML=data.study.multilingual?'<option value="all">All three languages</option>'+[...new Set<string>(data.cases.map((c:any)=>c.language+' · '+c.variety))].map(l=>'<option>'+escape(l)+'</option>').join(''):'<option value="all">Spanish · Mexico</option>';
 $('difference').parentElement!.querySelector('h3')!.textContent='Paired difference from concurrent baseline (B)';
 if(st.adjusted)$('difference').parentElement!.querySelector('.caption')!.textContent='Percentage points · Bonferroni-adjusted paired cluster intervals for '+(arms.length-1)+' contrasts (approximate 95% family coverage).';
 $('cost').parentElement!.querySelectorAll('.caption')[1].textContent=st.adjusted?'Provider-reported billing per 1,000 assessment requests. Joint strategy: two joint questions; others: four separate questions. Both cost units appear in the table.':'Provider-reported billing per 1,000 four-judgment requests. Divide by 1,000 for one request; both units appear in the table.';
 $('latency').parentElement!.querySelectorAll('.caption')[1].textContent='Observed distribution percentiles, not confidence intervals. Billed invalid responses are included; transport failures are listed separately.';
 $('method').innerHTML='<h2>Study design and interpretation</h2><article class="card"><h3>Findings</h3>'+(data.discussion?.findings??['Results awaiting interpretation.']).map((p:string)=>'<p>'+escape(p)+'</p>').join('')+'<h3>Design</h3><ul>'+st.design.map((p:string)=>'<li>'+escape(p)+'</li>').join('')+'</ul><h3>Limits</h3>'+st.limitations.map((p:string)=>'<p>'+escape(p)+'</p>').join('')+'<p id="provenance"></p><p><a href="plan.yaml">Frozen requests</a> · <a href="receipts.yaml">Receipts</a> · <a href="summary.yaml">Summary</a> · <a href="README.md">Report</a></p></article>';
 if(st.adjusted)$('method').querySelector('article')!.insertAdjacentHTML('beforeend','<h3>Research behind these contrasts</h3><p><a href="https://docs.typesafe.ai/primitives/choice">TypeSafe: Choice and structured criteria</a> · <a href="https://docs.typesafe.ai/model-jaggedness/jev-1.13">TypeSafe: documented limitations</a> · <a href="https://www.reddit.com/r/AI_India/comments/1wmvyqz/i_benchmarked_typesafes_jev_against_llms_bert_and/">First-person community benchmark (not independently verified)</a></p>');
 if(!st.multilingual){const prompts=document.createElement('section');prompts.innerHTML='<h2>Inspect the exact prompt strategies</h2><p class="caption">Instructions below are sent for each skill judgment. The deliberately misleading condition is an experimental control, not proposed guidance.</p>'+arms.map((a,i)=>'<details class="card"><summary>'+a+' · '+escape(names[i])+'</summary>'+Object.entries<any>(data.strategies[a]).map(([id,q])=>'<h3>'+escape(id)+'</h3><pre>'+escape(typeof q.instructions==='string'?q.instructions:JSON.stringify(q.instructions,null,2))+'</pre><details><summary>Unchanged label criteria</summary><pre>'+escape(JSON.stringify(q.criteria,null,2))+'</pre></details>').join('')+'</details>').join('');$('method').before(prompts);}
 if(st.multilingual)multilingualSetup(data);
}
$('quality').textContent = data.invalidResponses + ' of '+data.receipts.length+' responses contained invalid judgments. Missing judgments count as reference non-matches; invalid pairs are excluded from repeat-variability calculations. Valid partial judgments remain inspectable.';
$('provenance').textContent = 'Requested model: typesafe/jev-1.13. Frozen plan SHA-256: ' + data.planHash + '. One initial request timed out with unknown billing; a deliberate continuation retained that receipt and reserved its cost. Completed-call costs exclude that unknown amount.';
render();

if(data.study)$('provenance').textContent='Model: '+data.model.join(', ')+'. Frozen plan SHA-256: '+data.planHash+'. Transport/unbilled failures: '+data.failures+'. No historical responses are pooled.';
