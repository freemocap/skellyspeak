import {installSdt} from './sdt-panel.ts';
import type { loadSpanish, Row } from './spanish-analysis.ts';
import { installDivider, installTopDivider, layerColors, type HighlightLayer } from '../explorer/interaction.ts';
import { semantic } from '../explorer/semantic.ts';
import type { Row as ExplorerRow } from '../explorer/compare.ts';
declare const Plotly: any;
const data = JSON.parse(document.getElementById('prompt-explorer-data')!.textContent!) as ReturnType<typeof loadSpanish> & {
    projections: any;
    readiness?:any;
};
const $ = (id: string) => document.getElementById(id)!;
const esc = (s: unknown) => String(s ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
const names: Record<string, string> = data.assessorNames??{ sparse: 'Current assessor · max 4', chat: 'LLM · all 45', jev: 'Jev · all 45' };
if(data.title)names.jev='Jev alone · all 45 skills';
const colors: Record<string, string> = { sparse: '#6fc29a', chat: '#5da7e7', jev: '#e7a251' };
const pct = (n: number | null) => n === null ? '—' : (100 * n).toFixed(1) + '%';
const usd = (n: number | null) => n === null ? 'Unknown' : '$' + n.toFixed(6);
const ms = (n: number | null) => n === null ? '—' : n.toLocaleString() + ' ms';
let highlight: Set<string> | null = null, inspectionRows = data.rows, page = 0, matrixPage = 0;
const layers: HighlightLayer[] = [];
function select(rows: Row[], label = 'Selection') {
    highlight = new Set(rows.map(r => r.id));
    $('selection-status').textContent = `${label}: ${rows.length} requests highlighted. Charts and tables retain the full study.`;
    $('skill-detail').textContent = '';
    inspectionRows = rows;
    page = 0;
    inspect();
    matrix();
    map();
}
function chart(id: string, traces: any[], title: string, axes: any = {}) {
    Plotly.react($(id), traces, { title: { text: title, font: { size: 16 } }, height: 340, paper_bgcolor: 'transparent', plot_bgcolor: 'transparent',
        font: { color: getComputedStyle($(id)).color }, margin: { l: 65, r: 25, t: 65, b: 65 }, legend: { orientation: 'h' }, ...axes }, { responsive: true, displaylogo: false });
}
if(data.title){document.title=data.title;document.querySelector('h1')!.textContent=data.title;$('study-description').textContent=data.description;$('design').innerHTML='<h2>App-contract experiment · frozen design</h2><div id="design-choices"></div><div id="design-cases"></div><p>Agent-authored focal labels remain provisional. Real Rust validation checks source binding and structure, not semantic correctness. Screening is reused inside the pipeline: path costs must not be added to estimate experiment spend.</p>'; }
$('progress').textContent = `${data.summary.complete} valid / ${data.planned} planned · ${data.summary.failed} failed or interrupted · ${usd(data.summary.knownCost)} recorded cost · ${data.summary.missingCosts} costs unknown${data.complete ? ' · Run finished' : ' · Incomplete snapshot'}`;
if(data.actualCalls!==null)$('progress').textContent=`${data.summary.complete} valid / ${data.planned} planned path outcomes · ${data.summary.failed} failed · ${data.actualCalls} actual API calls · $${data.actualSpend?.toFixed(6)} recorded spend (${data.unknownCallCosts} unknown) · ${data.complete?'Run finished':'Incomplete snapshot'}. Path costs overlap because the Jev screen is reused.`;
$('overall').innerHTML = [...data.overall].sort((a,b)=>['sparse','jev','chat'].indexOf(a.engine)-['sparse','jev','chat'].indexOf(b.engine)).map(s => `<article class="scorecard"><h3>${names[s.engine]}</h3><p class="metric">${pct(s.macroRecall)} positive recall</p><p>${pct(s.macroFalseCredit)} false credit</p><p>Median ${ms(s.latencyP50)}<br>p95 ${ms(s.latencyP95)}</p><p>${usd(s.costPerComplete)} / valid assessment<br>${usd(s.knownCost)} recorded total</p><small>${s.complete}/${data.planned/3} valid · ${s.failed} failed · ${s.missingCosts} unknown costs<br>${s.positiveCases} positive-reference cases / ${s.negativeCases} negative-reference cases</small></article>`).join('');
$('condition-table').innerHTML = `<h2>All ${data.conditions.length} conditions</h2><table class="experiment-table"><thead><tr><th>Assessor</th><th>Placement</th><th>Order</th><th>Valid / ${data.planned/data.conditions.length}</th><th>Recall</th><th>False credit</th><th>p50 / p95 ms</th><th>$/valid*</th></tr></thead><tbody>${data.conditions.map((s, i) => `<tr><td><button data-condition="${i}">${names[s.engine]}</button></td><td>${s.context}</td><td>${s.order}</td><td>${s.complete} (${s.failed} failed)</td><td>${pct(s.macroRecall)}</td><td>${pct(s.macroFalseCredit)}</td><td>${s.latencyP50 ?? '—'} / ${s.latencyP95 ?? '—'}</td><td>${usd(s.costPerComplete)}</td></tr>`).join('')}</tbody></table><p>*Known cost including failed calls divided by valid assessments. Missing billing is unknown, never zero. Latency includes request through validation; successful calls only. Quality is case-macro averaged, restricted to scored targets. Repetitions are not independent learners.</p>`;
for (const b of $('condition-table').querySelectorAll<HTMLButtonElement>('button'))
    b.onclick = () => { const c = data.conditions[Number(b.dataset.condition)]; select(data.rows.filter(r => r.engine === c.engine && r.context === c.context && r.order === c.order), `${names[c.engine]} / ${c.context} / ${c.order}`); };
function plots() {
    chart('tradeoff', data.overall.map(s => ({ type: 'scatter', mode: 'markers+text', name: names[s.engine], x: [s.costPerComplete], y: [s.macroRecall === null ? null : s.macroRecall * 100], text: [names[s.engine]], textposition: 'top center', marker: { size: 15, color: colors[s.engine] }, customdata: [[s.latencyP50, s.macroFalseCredit]], hovertemplate: 'Cost $%{x:.6f}<br>Recall %{y:.1f}%<br>Median latency %{customdata[0]} ms<extra>%{text}</extra>' })), 'Quality versus cost · speed stays visible above', { xaxis: { title: { text: 'Recorded USD / valid assessment' } }, yaxis: { title: { text: 'Positive recall (%)' }, range: [0, 110] } });
    for (const [id, title, field] of [['latency', 'Latency distribution · valid calls', 'elapsedMs'], ['cost', 'Billed cost distribution · known receipts', 'cost']] as const) {
        chart(id, ['sparse', 'chat', 'jev'].map(engine => { const rows = data.rows.filter(r => r.engine === engine && (field === 'cost' ? r.cost !== null : r.status === 'complete')); return { type: 'box', name: names[engine], y: rows.map(r => r[field]), boxpoints: 'all', jitter: .35, pointpos: 0, marker: { color: colors[engine], size: 3 }, customdata: rows.map(r => r.id) }; }), title, { yaxis: { title: { text: field === 'cost' ? 'USD per request' : 'Milliseconds' } } });
        ($(id) as any).on('plotly_click', (e: any) => { const ids = new Set(e.points?.map((p: any) => p.customdata)); select(data.rows.filter(r => ids.has(r.id)), title); });
    }
    chart('quality-by-family', ['sparse', 'chat', 'jev'].map(engine => ({ type: 'bar', name: names[engine], x: data.cases.map(c => c.id), y: data.cases.map(c => { const rs = data.rows.filter(r => r.engine === engine && r.caseId === c.id && r.status === 'complete'); const den = rs.reduce((s, r) => s + r.scored, 0); return den ? 100 * rs.reduce((s, r) => s + r.exact, 0) / den : null; }), marker: { color: colors[engine] } })), 'Reference-label agreement by case · native omissions count only as no credit', { height: 430, barmode: 'group', xaxis: { tickangle: -35 }, yaxis: { title: { text: 'Agreement (%)' }, range: [0, 100] } });
    chart('stability', ['sparse', 'chat', 'jev'].map(engine => ({ type: 'box', name: names[engine], y: data.orderPairs.filter(p => p.engine === engine).map(p => p.changed), boxpoints: 'all', jitter: .35, marker: { color: colors[engine], size: 3 } })), 'Criterion-order sensitivity · paired normal versus reversed', { yaxis: { title: { text: 'Changed labels out of 45' } } });
    for (const [id,title,metric] of [['context-recall','Positive recall by context placement','macroRecall'],['context-false-credit','False credit by context placement','macroFalseCredit']] as const) {
        chart(id,['sparse','chat','jev'].map(engine=>({type:'bar',name:names[engine],x:[...new Set(data.conditions.map(c=>c.context))],y:[...new Set(data.conditions.map(c=>c.context))].map(context=>{
            const cells=data.conditions.filter(c=>c.engine===engine&&c.context===context&&c[metric]!==null);
            return cells.length?100*cells.reduce((sum,c)=>sum+c[metric]!,0)/cells.length:null;
        }),marker:{color:colors[engine]}})),title,{barmode:'group',yaxis:{title:{text:'Percent · mean across available order cells'}}});
    }
    for (const [id, title, pairs] of [['context-stability', 'Context-position sensitivity · before versus after', data.contextPairs], ['repeat-stability', 'Repeat sensitivity · within-condition pairs', data.repeatPairs]] as const)
        chart(id, ['sparse', 'chat', 'jev'].map(engine => ({ type: 'box', name: names[engine], y: pairs.filter(p => p.engine === engine).map(p => p.changed), boxpoints: 'all', jitter: .35, marker: { color: colors[engine], size: 3 } })), title, { yaxis: { title: { text: 'Changed labels out of 45' } } });
}
function skillDetail(r: Row, id: string) {
    const skill = data.catalog.find(s => s.id === id)!;
    $('skill-detail').innerHTML = `<h3>${esc(id)} · ${esc(r.caseId)}</h3><p>${esc(skill.criterion)}</p><p>Reference: ${esc(r.reference[id] ?? 'Unknown / unscored')} · Judgment: ${esc(r.predictions[id] ?? 'Unavailable')}</p><div id="probability-chart"></div>`;
    const probabilities = r.probabilities[id];
    if (probabilities)
        chart('probability-chart', [{ type: 'bar', x: Object.keys(probabilities), y: Object.values(probabilities), marker: { color: colors.jev } }], 'Jev probabilities · not validated calibration', { yaxis: { range: [0, 1] }, xaxis: { tickangle: -25 }, height: 300 });
    else
        $('probability-chart').textContent = 'This assessor produces no probability distribution.';
}
function neighbors(r: Row) {
    if (r.status !== 'complete')
        return '';
    const candidates = data.rows.filter(b => b.status === 'complete' && b.id !== r.id).map(b => ({ row: b, similarity: r.vector.reduce((v, x, i) => v + x * b.vector[i], 0) / 45 })).sort((a, b) => b.similarity - a.similarity || a.row.id.localeCompare(b.row.id)).slice(0, 6);
    return `<details><summary>Nearest output profiles · original-space cosine</summary><p>Same-profile repeats can tie at 1.000; ties use request ID order. Shared neither-reported coordinates can dominate similarity.</p>${candidates.map(c => `<p>${c.similarity.toFixed(3)} · ${esc(c.row.id)}</p>`).join('')}</details>`;
}
function inspect() {
    const rs = inspectionRows.slice(page * 12, page * 12 + 12);
    $('inspection').innerHTML = `<p>${inspectionRows.length} requests · page ${page + 1}/${Math.max(1, Math.ceil(inspectionRows.length / 12))}</p><button id="prev">Previous</button> <button id="next">Next</button>` + rs.map(r => `<article class="card"><h3>${esc(r.caseId)} · ${names[r.engine]}</h3><p>${r.context} / ${r.order} / repetition ${r.repeat} · ${r.status}</p><div class="evidence">${esc(r.text)}</div><p>${r.receipt.metadata?.timingUnavailable ? 'Timing unknown' : ms(r.elapsedMs)} · ${usd(r.cost)} · ${r.positiveHits}/${r.positiveTotal} positive targets reported · ${r.falseCredits}/${r.negativeTotal} false credits</p>${r.caseId === 'clear-many' ? '<p>Native cap: at most 4 of 9 positive targets can be reported.</p>' : ''}<details open><summary>Reference targets & judgments</summary><table><tr><th>Skill</th><th>Reference</th><th>Judgment</th></tr>${Object.entries(r.reference).map(([id, v]) => `<tr><td>${esc(id)}</td><td>${v}</td><td>${r.predictions[id] ?? 'Unavailable'}</td></tr>`).join('')}</table></details><details><summary>All 45 judgments & Jev probabilities</summary><pre>${esc(JSON.stringify({ judgments: r.predictions, probabilities: r.probabilities }, null, 2))}</pre></details>${r.status!=='complete'&&r.receipt.nativeOutput?`<details open><summary>Rejected assessment · exact returned items</summary><pre>${esc(JSON.stringify(r.receipt.nativeOutput,null,2))}</pre></details>`:''}<details><summary>Native quotes and rationales</summary><pre>${esc(JSON.stringify(r.receipt.sparseItems ?? 'Not produced by this assessor', null, 2))}</pre></details>${neighbors(r)}<details><summary>Exact frozen request</summary><pre>${esc(JSON.stringify(data.requests[r.requestIndex], null, 2))}</pre></details><details><summary>Receipt · validation · billing · timing</summary><pre>${esc(JSON.stringify(r.receipt, null, 2))}</pre></details></article>`).join('');
    ($('prev') as HTMLButtonElement).disabled = page === 0;
    ($('next') as HTMLButtonElement).disabled = (page + 1) * 12 >= inspectionRows.length;
    $('prev').onclick = () => { page--; inspect(); };
    $('next').onclick = () => { page++; inspect(); };
}
const labels: Record<string, string> = { demonstrated: 'D', partial: 'P', not_demonstrated: 'N', not_observed: 'Ø', uncertain: '?', unreported: '—' };
function matrix() {
    const rs = data.rows.slice(matrixPage * 36, matrixPage * 36 + 36);
    $('matrix-table').innerHTML = `<button id="matrix-prev">Previous 36</button> <button id="matrix-next">Next 36</button> Page ${matrixPage + 1} / ${Math.ceil(data.rows.length / 36)}<table class="matrix"><thead><tr><th>Request</th>${data.catalog.map(s => `<th title="${esc(s.criterion)}">${esc(s.id)}</th>`).join('')}</tr></thead><tbody>${rs.map(r => `<tr style="${highlight?.has(r.id) ? 'outline:2px solid #ffca58' : ''}"><td>${esc(r.id)}</td>${data.catalog.map(s => `<td><button data-row="${r.id}" data-skill="${s.id}" title="${esc(s.id)}: ${esc(r.predictions[s.id] ?? 'failed')}; reference ${esc(r.reference[s.id] ?? 'unknown / unscored')}" style="background:${r.predictions[s.id] === 'demonstrated' ? '#286449' : r.predictions[s.id] === 'partial' ? '#725923' : 'transparent'}">${labels[r.predictions[s.id]] ?? '!'}</button></td>`).join('')}</tr>`).join('')}</tbody></table>`;
    ($('matrix-prev') as HTMLButtonElement).disabled = matrixPage === 0;
    ($('matrix-next') as HTMLButtonElement).disabled = (matrixPage + 1) * 36 >= data.rows.length;
    $('matrix-prev').onclick = () => { matrixPage--; matrix(); };
    $('matrix-next').onclick = () => { matrixPage++; matrix(); };
    for (const b of $('matrix-table').querySelectorAll<HTMLButtonElement>('[data-row]'))
        b.onclick = () => { const r = data.rows.find(r => r.id === b.dataset.row)!; select([r], 'Matrix cell'); skillDetail(r, b.dataset.skill!); };
}
function map() {
    if (!data.projections) {
        $('projection-quality').textContent = 'Maps pending: this snapshot has no fitted projections.';
        return;
    }
    if ($('maps').hidden)
        return;
    const index = Number(($('projection') as HTMLSelectElement).value), p = data.projections.projections[index];
    $('projection-quality').textContent = `${data.projections.hashes.length} unique profiles · trustworthiness (${data.projections.neighborCount ?? 10} neighbors) ${p.trustworthiness10.toFixed(3)} · neighbor retention ${pct(p.neighborRecall10)} · original-space HDBSCAN: ${JSON.stringify(data.projections.clusterSettings)}`;
    const rows = data.rows.filter(r => r.status === 'complete').map(r => ({ ...r, engine:names[r.engine], cluster: data.projections.clusters[data.projections.hashes.indexOf(r.profileHash)], textHash: r.profileHash, text: `${r.caseId} · ${names[r.engine]} · ${r.context} · ${r.order} · r${r.repeat}`, prompt: r.engine })) as unknown as ExplorerRow[];
    semantic($('profile-map'), data, index, rows, highlight, ($('color-by') as HTMLSelectElement).value, rs => select(data.rows.filter(r => rs.some(s => s.id === r.id)), 'Output map'), [...layers, ...(highlight ? [{ label: 'Current', color: '#ffca58', ids: highlight }] : [])]);
}
$('projection').innerHTML = (data.projections?.projections ?? []).map((p: any, i: number) => `<option value="${i}">${esc(p.label)}</option>`).join('');
$('projection').onchange = map;
$('color-by').onchange = map;
$('design-choices').innerHTML = `<ul>${data.choices.map(c => `<li>${esc(c)}</li>`).join('')}</ul><p>Frozen request hash: <code>${data.planHash}</code><br>Pre-run reservation: ${usd(data.reservationUsd)}. This is not billed spend.</p>`;
$('design-cases').innerHTML = data.cases.map(c => `<details><summary>${esc(c.id)} · ${esc(c.group)}</summary><div class="evidence">${esc(c.text)}</div>${c.partner ? `<p>Partner: ${esc(c.partner)}</p>` : ''}<p>${esc(c.review)}</p><pre>${esc(JSON.stringify(c.targets, null, 2))}</pre><button data-case="${c.id}">Inspect all assessments for this case</button></details>`).join('');
for (const b of $('design-cases').querySelectorAll<HTMLButtonElement>('button'))
    b.onclick = () => select(data.rows.filter(r => r.caseId === b.dataset.case), b.dataset.case);
for (const key of ['engine', 'context', 'order', 'group', 'repeat', 'status'] as const) {
    const label = document.createElement('label');
    label.textContent = key === 'engine' ? 'Assessor' : key;
    const selectEl = document.createElement('select');
    selectEl.dataset.filter = key;
    selectEl.innerHTML = '<option value="">All</option>' + [...new Set(data.rows.map(r => String(r[key])))].map(v => `<option value="${v}">${esc(names[v] ?? v)}</option>`).join('');
    selectEl.onchange = () => select(data.rows.filter(r => [...$('filters').querySelectorAll<HTMLSelectElement>('select')].every(s => !s.value || String(r[s.dataset.filter as keyof Row]) === s.value)), 'Header selection');
    label.append(selectEl);
    $('filters').append(label);
}
$('pin-layer').onclick = () => { if (!highlight)
    return; layers.push({ label: `Pinned ${layers.length + 1} (${highlight.size})`, color: layerColors[layers.length % layerColors.length], ids: new Set(highlight) }); $('layers').innerHTML = layers.map(l => `<span style="color:${l.color}">${l.label}</span>`).join(' · '); map(); };
$('reset').onclick = () => { $('skill-detail').textContent = ''; highlight = null; layers.length = 0; $('layers').textContent = ''; for (const s of $('filters').querySelectorAll('select'))
    s.value = ''; inspectionRows = data.rows; page = 0; $('selection-status').textContent = 'All requests'; inspect(); matrix(); map(); };
$('show-selection').onclick = () => { inspectionRows = highlight ? data.rows.filter(r => highlight!.has(r.id)) : data.rows; page = 0; inspect(); };
$('show-all').onclick = () => { inspectionRows = data.rows; page = 0; inspect(); };
for (const b of document.querySelectorAll<HTMLButtonElement>('[data-tab]'))
    b.onclick = () => { for (const panel of document.querySelectorAll<HTMLElement>('.tab-panel'))
        panel.hidden = panel.id !== b.dataset.tab; for (const button of document.querySelectorAll('.tabs button'))
        button.setAttribute('aria-pressed', String(button === b)); if (b.dataset.tab === 'sdt') renderSdt(); if (b.dataset.tab === 'maps')
        map(); if (b.dataset.tab === 'summary')
        for (const id of ['tradeoff', 'latency', 'cost', 'context-recall', 'context-false-credit', 'quality-by-family', 'stability', 'context-stability', 'repeat-stability'])
            Plotly.Plots.resize($(id)); };
installDivider(document.querySelector('.workspace')!, $('panel-divider'));
installTopDivider(document.querySelector('header')!, $('top-divider'));
inspect();
matrix();
plots();
if(data.title){$('stability').textContent='Criterion order was fixed in this study.';$('context-stability').textContent='This study compares no context with preceding partner context, not before/after field placement.';}


const renderSdt = installSdt(data.rows, select, names, Boolean(data.title));

if(data.readiness){
 const button=document.createElement('button');button.textContent='App contract';
 const panel=document.createElement('section');panel.className='tab-panel';panel.id='readiness';panel.hidden=true;
 document.querySelector('.tabs')!.append(button);document.querySelector('main')!.append(panel);
 button.onclick=()=>{for(const p of document.querySelectorAll<HTMLElement>('.tab-panel'))p.hidden=p!==panel;for(const b of document.querySelectorAll('.tabs button'))b.setAttribute('aria-pressed',String(b===button));};
 panel.innerHTML=`<h2>Current-contract verdict: hybrid blocked; Jev-alone design remains open</h2><p>The gate was frozen before execution: any rejected candidate artifact or failed candidate path blocks unattended integration. No app routing or reward publication changed.</p><table><tr><th>Path</th><th>Rust accepted</th><th>Rust rejected</th><th>No artifact to replay</th></tr>${data.readiness.stages.map((s:any)=>`<tr><td>${names[s.engine]}</td><td>${s.rustValid}/${s.planned}</td><td>${s.rustRejected}</td><td>${s.notReplayed}</td></tr>`).join('')}</table><p>Rust checks source binding, structure, prose and the reporting cap. It does not prove semantic correctness. Jev alone was evaluated on all 45 skills without a four-item cap. Its 70/72 valid responses are a separate result. The hybrid’s quote failures are not Jev-alone failures. Jev does not generate explanations, but a classifier-first app design could retain the actual learner message as the source record and make explanations a separate feature; that contract has not been designed or tested here.</p><h3>Failure inspection</h3>${data.readiness.failures.map((r:any)=>`<p><button data-failure="${esc(r.id)}">${esc(r.id)}</button><br>${esc(r.validation.join('; '))}</p>`).join('')}<h3>Next implementation step</h3><p>Do not enable this hybrid path for learner credit yet. Diagnose Jev probability-consistency failures, inspect the rejected extraction, and review shortlist misses. Rejected Jev distributions were not retained by the original decoder, so those two cases have validation reasons but cannot be numerically reconstructed from these receipts. A development-only shadow adapter could record decisions alongside the current assessor without publishing rewards, but it is not implemented here.</p><p>Decision required before a production design: retain immediate quote/explanation generation, or let a reviewed classifier assessment have a separate evidence contract. Jev is not a drop-in replacement for the current chat-completion response.</p>`;
 for(const b of panel.querySelectorAll<HTMLButtonElement>('button'))b.onclick=()=>select(data.rows.filter(r=>r.id===b.dataset.failure),'App-contract failure');
}
