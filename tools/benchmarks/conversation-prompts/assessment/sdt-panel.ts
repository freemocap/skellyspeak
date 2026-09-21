import type {Row} from './spanish-analysis.ts';
import {cohort,counts,roc,trials,type Task,type Outcome} from './sdt.ts';
declare const Plotly:any;
let names:Record<string,string>={sparse:'Current assessor · max 4',chat:'LLM · all 45',jev:'Jev · all 45'};
const colors=['#6fc29a','#e7a251','#5da7e7'];
const rate=(n:number|null)=>n===null?'—':(100*n).toFixed(2)+'%';
const esc=(s:string)=>s.replaceAll('&','&amp;').replaceAll('<','&lt;');
const num=(n:number|null)=>n===null?'—':n.toFixed(3);
export function installSdt(rows:Row[],select:(r:Row[],label:string)=>void, customNames?:Record<string,string>, readiness=false){
    if(customNames)names=customNames;
    const $=(id:string)=>document.getElementById(id)!;
    const root=$('sdt');
    root.innerHTML=`<h2>Signal detection · evidence in the current message</h2>
    <p>One trial = message × skill × condition × repetition. Hits and misses concern evidence in this message, not whether the learner knows the skill.</p>
    <div class="toolbar"><label>Detection task<select id="sdt-task"><option value="attempt">Any attempt: partial or demonstrated</option><option value="full">Full demonstration only</option></select></label>
    <label>Comparison cohort<select id="sdt-cohort"><option value="matched">Matched valid responses from all three</option><option value="available">All available valid responses</option></select></label>
    <label>Reporting cap<select id="sdt-cap"><option value="all">Include nine-target case</option><option value="exclude">Exclude nine-target case</option></select></label>
    <label>Focal skill<select id="sdt-skill"><option value="">All scored skills</option>${[...new Set(rows.flatMap(r=>Object.keys(r.reference)))].sort().map(id=>`<option>${esc(id)}</option>`).join('')}</select></label><label>Context<select id="sdt-context"><option value="">All</option><option>alone</option><option>before</option><option>after</option></select></label></div>
    <p id="sdt-run-economics"></p><p id="sdt-denominators"></p><div id="sdt-table" class="table-wrap"></div>
    <p>Click any outcome count to inspect its messages on the right. Raw rates pool labeled trials, unlike the case-macro rates on the overview. Repetitions and skills within a message are dependent. Large denominators do not mean many independent examples.</p>
    <div id="sdt-selected-trials"></div><div id="sdt-roc"></div>
    <label>Explore Jev evidence threshold <input id="sdt-threshold" type="range" min="0" max="1" step="0.01" value="0.5"><output id="sdt-threshold-value">0.50</output></label>
    <p id="sdt-threshold-result"></p><p>The curve thresholds P(demonstrated)+P(partial) for any attempt, or P(demonstrated) for full demonstration. Report evidence when score ≥ threshold. Named operating points use the original returned label, so Jev’s original point need not lie on this binary-score curve. No probabilities are invented for the LLM controls. Moving this slider does not change the app or make API calls.</p>
    <div id="sdt-scores"></div><h3>Interpretation and exclusions</h3>
    <ul><li>Hit rate = hits/(hits + misses); false-alarm rate = false alarms/(false alarms + correct rejections).</li>
    <li>d′ = z(H) − z(F); criterion c = −½[z(H)+z(F)]. Larger d′ indicates separation under the equal-variance Gaussian interpretation. Positive c means conservative withholding; negative c means liberal reporting.</li>
    <li>For d′ and c only, add 0.5 to each of the four cells. Raw rates and ROC stay uncorrected. Empty signal/noise classes yield no d′ or AUC. <a href="https://doi.org/10.3758/BF03203619">Hautus (1995)</a>.</li>
    <li>In full-demonstration mode, partial references are signal-absent: calling a partial attempt “demonstrated” becomes a false alarm. In any-attempt mode, it is a hit.</li>
    <li>Uncertain and native unreported judgments mean no evidence reported in this operational analysis. They are not explicit absence judgments. Counts are shown separately. Failed calls are excluded, never counted as correct rejections.</li>
    <li>Only supplied reference labels are scored. They remain provisional. Easy all-absent controls dominate the pooled negative class; inspect individual skills and contexts before interpreting a high AUC. Pooled d′ is descriptive for this mixed fixture set; it is not a model-intrinsic sensitivity estimate. No independent-trial confidence intervals or significance claims.</li>
    <li>Excluding the nine-target case reduces the obvious cap confound; it does not create an uncapped version of the current assessor. Other unscored skills can still compete for four slots.</li></ul>
    <div id="sdt-next-study"><h3>Next study · concrete proposal, not executed</h3>
    <p>12 target skills × 4 independently authored message families × 3 evidence states (absent, partial, full) = 144 messages. Each family keeps the topic and vocabulary similar while changing evidence for one focal skill. Only that focal skill is scored unless other labels are separately reviewed.</p>
    <p>Four assessors: current max-four; the same prompt/schema with only the reporting cap removed; the existing full-list LLM; Jev. Three contexts: alone, evidence before distractors, evidence after the same distractors. Two repetitions = 3,456 calls. Criterion order held fixed for this study; the existing order experiment remains available.</p>
    <p>Review labels without model outputs; record disagreements and exclude unresolved targets before freezing requests. Split whole message families equally into threshold-development and held-out evaluation sets (1,728 calls each), with variants and repetitions kept together. Choose a threshold on development data only, then lock it for evaluation. Report hit/false-alarm rates, partial over-credit, failure rates, latency and billed cost together. A false-alarm tolerance is a product decision still to choose—not a number inferred from the same test set.</p>
    <p>Label adjudication, new fixtures, uncapped control and a priced request manifest are not complete. This tab reanalyzes the existing 648 attempts; no new paid calls have been made.</p></div>`;
    if(readiness){$('sdt-next-study').innerHTML='<h3>Implementation boundary</h3><p>This study evaluates Jev screening plus LLM evidence extraction. Both app-compatible paths retain the four-item contract. No uncapped ablation, independent label review, multilingual validation, routing change or live reward publication is claimed.</p>';($('sdt-cap') as HTMLSelectElement).disabled=true;}
    $('sdt-run-economics').textContent='Full-run speed/cost (unfiltered): '+['sparse','chat','jev'].map(engine=>{const rs=rows.filter(r=>r.engine===engine),good=rs.filter(r=>r.status==="complete"),times=good.map(r=>r.elapsedMs).sort((a,b)=>a-b),cost=rs.reduce((sum,r)=>sum+(r.cost??0),0);return `${names[engine]}: median ${times[Math.ceil(times.length/2)-1]} ms, known $${(cost/good.length).toFixed(6)}/valid (${rs.filter(r=>r.cost===null).length} unknown costs)`;}).join(' · ');
    const get=(id:string)=>($(id) as HTMLSelectElement).value;
    function render(){
        $('sdt-selected-trials').textContent='';
        const task=get('sdt-task') as Task;
        const c=cohort(rows,get('sdt-cohort')==='matched',get('sdt-cap')==='exclude',get('sdt-context'));
        const all=trials(c.rows,task).filter(t=>!get('sdt-skill')||t.skill===get('sdt-skill'));
        const engines=['sparse','jev','chat'];
        const results=engines.map(engine=>({engine,ts:all.filter(t=>t.row.engine===engine),...counts(all.filter(t=>t.row.engine===engine))}));
        $('sdt-denominators').textContent=`${c.failed} failed/interrupted requests excluded in this scope; ${c.excludedValid} additional valid responses excluded to match comparisons. References: ${new Set(all.map(t=>t.row.caseId)).size} fixture cases. Speed/cost overview still includes all attempted calls and retained billing.`;
        $('sdt-table').innerHTML=`<table><tr><th>Assessor</th><th>Hits</th><th>Misses</th><th>False alarms</th><th>Correct rejections</th><th>Hit rate</th><th>FA rate</th><th>d′</th><th>c</th><th>Distinct case × skill labels</th><th>Uncertain / unreported</th></tr>${results.map(s=>`<tr><td>${names[s.engine]}</td>${(['hit','miss','falseAlarm','correctRejection'] as Outcome[]).map(o=>`<td><button data-engine="${s.engine}" data-outcome="${o}">${s[o]}</button></td>`).join('')}<td>${rate(s.hitRate)}</td><td>${rate(s.falseAlarmRate)}</td><td>${num(s.dPrime)}</td><td>${num(s.criterion)}</td><td>${s.targets}</td><td>${s.uncertain} / ${s.unreported}</td></tr>`).join('')}</table>`;
        for(const button of $('sdt-table').querySelectorAll<HTMLButtonElement>('button'))button.onclick=()=>{
            const ts=all.filter(t=>t.row.engine===button.dataset.engine&&t.outcome===button.dataset.outcome);
            $('sdt-selected-trials').innerHTML=`<details open><summary>${ts.length} selected skill trials · first 60 below; all associated messages in inspector</summary><table><tr><th>Request</th><th>Skill</th><th>Reference</th><th>Judgment</th></tr>${ts.slice(0,60).map(t=>`<tr><td>${esc(t.row.id)}</td><td>${esc(t.skill)}</td><td>${esc(t.row.reference[t.skill])}</td><td>${esc(t.row.predictions[t.skill])}</td></tr>`).join('')}</table></details>`;
            select([...new Map(ts.map(t=>[t.row.id,t.row])).values()],`${names[button.dataset.engine!]} · ${button.dataset.outcome} (${ts.length} skill trials)`);
        };
        const jev=all.filter(t=>t.row.engine==='jev');
        const curve=roc(jev),threshold=Number(get('sdt-threshold'));
        const thresholdCounts=counts(trials(c.rows.filter(r=>r.engine==='jev'),task,threshold).filter(t=>!get('sdt-skill')||t.skill===get('sdt-skill')));
        $('sdt-threshold-value').textContent=threshold.toFixed(2);
        $('sdt-threshold-result').textContent=`Threshold ${threshold.toFixed(2)}: ${thresholdCounts.hit} hits, ${thresholdCounts.miss} misses, ${thresholdCounts.falseAlarm} false alarms, ${thresholdCounts.correctRejection} correct rejections. Hit rate ${rate(thresholdCounts.hitRate)}; false-alarm rate ${rate(thresholdCounts.falseAlarmRate)}. Empirical ROC AUC ${num(curve.auc)} (exploratory, same provisional labels).`;
        const style={height:420,paper_bgcolor:'transparent',plot_bgcolor:'transparent',font:{color:getComputedStyle(root).color},margin:{l:65,r:20,t:50,b:65},legend:{orientation:'h'}};
        Plotly.react($('sdt-roc'),[
            {x:[0,1],y:[0,1],mode:'lines',name:'Chance diagonal',line:{dash:'dot',color:'#888'}},
            {x:curve.points.map(p=>p.falseAlarmRate),y:curve.points.map(p=>p.hitRate),mode:'lines',name:'Jev threshold sweep',line:{color:'#e7a251'}},
            ...results.map((s,i)=>({x:[s.falseAlarmRate],y:[s.hitRate],mode:'markers',name:names[s.engine],marker:{size:12,color:colors[i]}})),
            {x:[thresholdCounts.falseAlarmRate],y:[thresholdCounts.hitRate],mode:'markers',name:'Selected threshold',marker:{size:16,symbol:'diamond-open',color:'#ffca58'}}
        ],{...style,title:{text:'Hit rate versus false-alarm rate'},xaxis:{title:{text:'False-alarm rate'},range:[-.02,1.02]},yaxis:{title:{text:'Hit rate'},range:[-.02,1.02]}},{responsive:true,displaylogo:false});
        Plotly.react($('sdt-scores'),[false,true].map(signal=>({type:'histogram',name:signal?'Reference signal present':'Reference signal absent',x:jev.filter(t=>t.signal===signal).map(t=>t.score),histnorm:'probability',opacity:.6,xbins:{start:0,end:1,size:.05}})),{...style,barmode:'overlay',title:{text:'Jev evidence-score distributions'},xaxis:{title:{text:'Evidence score'},range:[0,1]},yaxis:{title:{text:'Fraction within reference class'}}},{responsive:true,displaylogo:false});
    }
    for(const control of root.querySelectorAll('select,input'))control.addEventListener('input',render);
    return render;
}
