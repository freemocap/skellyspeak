"""Build standalone figures, a PDF report and a self-contained response explorer."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path('.local/report-packages').resolve()))
import json
import base64
import html
import textwrap
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.colors import ListedColormap
from matplotlib.ticker import FuncFormatter, MaxNLocator
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor

OUT=Path('.local/model-comparison-analysis-2026-09-30')
D=json.loads((OUT/'analysis.json').read_text(encoding='utf-8'))
ROWS, GROUPS = D['rows'],D['groups']
ARMS=['standard','fast']
COLORS={'standard':'#2166AC','fast':'#D66A18'}
plt.rcParams.update({'font.family':'DejaVu Sans','font.size':10,'axes.spines.top':False,'axes.spines.right':False,
                     'axes.labelcolor':'#243247','text.color':'#243247','axes.titleweight':'bold','figure.facecolor':'white'})
FIGS=[]
def save(fig,name):
    fig.savefig(OUT/(name+'.png'),dpi=170,bbox_inches='tight')
    fig.savefig(OUT/(name+'.svg'),bbox_inches='tight')
    plt.close(fig);FIGS.append(name)
def selected(kind,arm):return [r for r in ROWS if r['kind']==kind and r['arm']==arm and r['transport']]
def currency(x,pos=None):return f'${x:.5f}'

# Each row is one fixed input/repetition; no invented continuous quality score.
fig,ax=plt.subplots(figsize=(12,7.4))
mat=[];labels=[]
for g in GROUPS:
    for lang in ['spanish','arabic','mandarin']:
        for rep in range(2):
            values=[]
            for arm in ARMS:
                r=next(r for r in ROWS if r['kind']==g['kind'] and r['language']==lang and r['repetition']==rep and r['arm']==arm)
                values.extend([int(r['transport']), -1 if r['schema_pass'] is None else int(r['schema_pass']),
                     {'pass':1,'partial':2,'fail':0,'uncertain':-1,'unavailable':-1}[r['core']],int(r['review_clean'])])
            mat.append(values);labels.append(f"{g['name']} / {lang.title()} / {rep+1}")
mat=np.array(mat)
cmap=ListedColormap(['#DCE1E8','#BD4050','#288475','#E8B54F'])
ax.imshow(mat,vmin=-1,vmax=2,cmap=cmap,aspect='auto')
for (y,x),v in np.ndenumerate(mat):ax.text(x,y,{-1:'-',0:'F',1:'P',2:'~'}[v],ha='center',va='center',color='white' if v in [0,1] else '#243247',fontsize=9)
ax.set_yticks(range(len(labels)),labels,fontsize=9)
ax.set_xticks(range(8),['Transport','Schema','Core goal','Review clean']*2)
ax.xaxis.tick_top();ax.axvline(3.5,color='white',lw=6)
for y in [5.5,11.5,17.5]:ax.axhline(y,color='white',lw=3)
ax.set_title('STANDARD                                  FAST',pad=36)
fig.text(.35,.02,'P = pass   F = fail   ~ = partial   - = unavailable / not applicable / uncertain',fontsize=10)
fig.subplots_adjust(left=.32,bottom=.07,top=.90)
save(fig,'quality-matrix')

fig,axes=plt.subplots(2,2,figsize=(12,7.2),sharex=True,sharey=True)
for g,ax in zip(GROUPS,axes.flat):
    for lang in ['spanish','arabic','mandarin']:
        for rep in range(2):
            pair=[next(r for r in ROWS if r['kind']==g['kind'] and r['language']==lang and r['repetition']==rep and r['arm']==arm) for arm in ARMS]
            if all(r['transport'] for r in pair):ax.plot([r['elapsedMs'] for r in pair],[r['cost'] for r in pair],color='#CDD3DC',lw=1,zorder=1)
    for arm in ARMS:
        for r in selected(g['kind'],arm):
            marker='o' if r['review_clean'] else 'X'
            ax.scatter(r['elapsedMs'],r['cost'],marker=marker,s=70,color=COLORS[arm],edgecolors='white',linewidths=.5,zorder=2)
    ax.set_title(g['name']);ax.grid(alpha=.15);ax.yaxis.set_major_formatter(FuncFormatter(currency))
    ax.set_xlabel('Complete response duration (ms)');ax.set_ylabel('Reported cost (USD/call)')
fig.suptitle('All 46 completed responses: cost, duration and observed defects',y=1.01)
fig.text(.1,-.01,'Blue = standard   Orange = fast   Circle = review clean   X = at least one review/check defect   Line = matched pair',fontsize=10)
fig.tight_layout();save(fig,'cost-duration-cloud')

fig,axes=plt.subplots(2,4,figsize=(13,7.3),sharex='row')
bins=np.arange(0,2801,350)
for j,g in enumerate(GROUPS):
    ax=axes[0,j]
    for i,arm in enumerate(ARMS):
        vals=np.array([r['elapsedMs'] for r in selected(g['kind'],arm)])
        ax.boxplot([vals],positions=[i],widths=.32,orientation='horizontal',showfliers=False,patch_artist=True,
             boxprops={'facecolor':COLORS[arm],'alpha':.18},medianprops={'color':COLORS[arm]},whiskerprops={'color':COLORS[arm]},capprops={'color':COLORS[arm]})
        ax.scatter(vals,i+np.linspace(-.12,.12,len(vals)),s=28,color=COLORS[arm],zorder=3)
        axes[1,j].hist(vals,bins=bins,histtype='step',lw=2,color=COLORS[arm],label=arm.title())
    ax.set_yticks([0,1],['Standard','Fast']);ax.set_ylim(-.5,1.5);ax.set_title(g['name']);ax.set_xlabel('Duration (ms)');ax.grid(axis='x',alpha=.15)
    axes[1,j].set_xlabel('Duration (ms)');axes[1,j].set_ylabel('Response count');axes[1,j].yaxis.set_major_locator(MaxNLocator(integer=True));axes[1,j].set_ylim(0,6)
axes[1,0].legend(frameon=False)
fig.suptitle('Duration distributions: every observation, quartiles and fixed-bin histograms')
fig.tight_layout();save(fig,'duration-distributions')

fig,axes=plt.subplots(2,4,figsize=(13,7.3))
costbins=np.linspace(0,.0016,9)
for j,g in enumerate(GROUPS):
    for i,arm in enumerate(ARMS):
        vals=np.array([r['cost'] for r in selected(g['kind'],arm)])
        axes[0,j].scatter(vals,i+np.linspace(-.12,.12,len(vals)),s=32,color=COLORS[arm])
        axes[0,j].plot([np.quantile(vals,.25),np.quantile(vals,.75)],[i,i],color=COLORS[arm],lw=5,alpha=.35)
        axes[1,j].hist(vals,bins=costbins,histtype='step',lw=2,color=COLORS[arm])
    axes[0,j].set_yticks([0,1],['Standard','Fast']);axes[0,j].set_ylim(-.5,1.5);axes[0,j].set_title(g['name'])
    for ax in axes[:,j]:ax.set_xlim(0,.0016);ax.set_xticks([0,.0008,.0016]);ax.xaxis.set_major_formatter(FuncFormatter(currency));ax.set_xlabel('USD/call')
    axes[1,j].set_ylabel('Response count');axes[1,j].set_ylim(0,6);axes[1,j].yaxis.set_major_locator(MaxNLocator(integer=True))
fig.suptitle('Reported cost distributions: points, interquartile ranges and shared-bin histograms')
fig.tight_layout();save(fig,'cost-distributions')

fig,axes=plt.subplots(1,2,figsize=(12,6.5))
for j,(key,stat,label) in enumerate([('elapsedMs','time','Standard - fast duration (ms)'),('cost','cost','Standard - fast cost (USD/call)')]):
    ax=axes[j]
    for i,g in enumerate(GROUPS):
        diffs=[]
        for s in selected(g['kind'],'standard'):
            f=next(r for r in ROWS if r['caseId']==s['caseId'] and r['repetition']==s['repetition'] and r['arm']=='fast')
            if f['transport']:diffs.append(s[key]-f[key])
        ax.scatter(diffs,i+np.linspace(-.13,.13,len(diffs)),s=35,color='#637994',alpha=.85)
        st=g[stat];lo,hi=st['cluster_bootstrap_95']
        ax.plot([lo,hi],[i+.27,i+.27],color='#243247',lw=2)
        ax.scatter([st['mean_saving']],[i+.27],marker='D',s=38,color='#243247')
    ax.axvline(0,color='#B34D56',lw=1);ax.set_yticks(range(4),[g['name'] for g in GROUPS]);ax.invert_yaxis();ax.set_xlabel(label);ax.grid(axis='x',alpha=.15)
    ax.set_title('Positive = fast saves; negative = fast costs more')
axes[1].xaxis.set_major_formatter(FuncFormatter(currency))
axes[1].xaxis.set_major_locator(MaxNLocator(4))
fig.suptitle('Paired differences: 22 complete pairs, grouped by task')
fig.text(.08,.015,'Dots = individual pairs. Diamond = paired mean. Line = 95% empirical case-cluster bootstrap interval (only 3 contexts/task).',fontsize=10)
fig.tight_layout(rect=[0,.05,1,.96]);save(fig,'paired-differences')

PDF=OUT/'model-comparison-report.pdf'
c=canvas.Canvas(str(PDF),pagesize=(792,612))
c.setTitle('Model comparison: pilot evidence and larger-run plan');c.setAuthor('Jon Matthis')
page=0
def start(title,subtitle):
    global page
    page+=1;c.setFillColor(HexColor('#142B45'));c.setFont('Helvetica-Bold',21);c.drawString(36,571,title)
    c.setFont('Helvetica',10);c.setFillColor(HexColor('#526173'));c.drawString(36,552,subtitle)
    c.setStrokeColor(HexColor('#D8DFE7'));c.line(36,540,756,540)
def finish():
    c.setFont('Helvetica',9);c.setFillColor(HexColor('#526173'));c.drawString(36,20,'Pilot: 2026-09-30 | Synthetic inputs only | Preliminary review; no routing changes')
    c.drawRightString(756,20,str(page));c.showPage()
def paragraph(text,y,width=110,size=11):
    c.setFillColor(HexColor('#243247'));c.setFont('Helvetica',size)
    for line in textwrap.wrap(text,width):c.drawString(36,y,line);y-=size+5
    return y-8
def table(headers,rows,y,widths,size=9):
    x0=36
    for n,row in enumerate([headers]+rows):
        c.setFont('Helvetica-Bold' if n==0 else 'Helvetica',size);c.setFillColor(HexColor('#142B45'))
        x=x0
        for cell,w in zip(row,widths):c.drawString(x,y,str(cell));x+=w
        c.setStrokeColor(HexColor('#E1E5EB'));c.line(36,y-7,756,y-7);y-=25
    return y-12
def chart(name):
    from PIL import Image
    p=OUT/(name+'.png');w,h=Image.open(p).size;scale=min(728/w,490/h)
    c.drawImage(str(p),(792-w*scale)/2,40+(490-h*scale)/2,width=w*scale,height=h*scale)

start('What the pilot actually established','48 attempts | 46 completions | 22 complete pairs | 12 inputs | 2 repetitions per arm')
y=paragraph('Known billed cost: $0.02311524. Two failed calls have unknown billing. The larger synthetic suite was prepared, not executed.',510)
y=table(['Task','Transport S / F','Schema S / F','Core pass S / F','Review clean S / F'],[
 [g['name'],f"{g['arms']['standard']['completed']}/6 | {g['arms']['fast']['completed']}/6",
  'N/A' if g['kind']=='persona_reply' else f"{g['arms']['standard']['schema_pass']}/6 | {g['arms']['fast']['schema_pass']}/6",
  f"{g['arms']['standard']['core']['pass']}/6 | {g['arms']['fast']['core']['pass']}/6",
  f"{g['arms']['standard']['review_clean']}/6 | {g['arms']['fast']['review_clean']}/6"] for g in GROUPS],y,[135,145,140,140,160])
y=paragraph('S = standard; F = fast. Denominator is all six attempts per task/arm. Core pass uses the task-specific rubric. Review clean requires transport, schema and limited rule checks, core pass, and no flagged semantic defect. It is not expert-certified correctness.',y,117,10)
for text in [
 'Partner reply is the strongest candidate for expansion: every completed reply follows the topic switch. That tests one narrow behavior, not full conversation quality.',
 'Glosses expose a real downgrade risk: fast loses meanings, overlaps spans and substitutes English words for target pronunciation. Standard also has segmentation/contextual-meaning defects.',
 'Coaching is not ready for a blanket substitution: 1/6 standard and 0/6 fast meet the frozen schema. Both arms produce harmful or mis-scoped replacements.',
 'Reply assistance is cheaper with fast, but neither arm reliably supplies the complete requested help. Separate answer relevance, transliteration and pronunciation before routing changes.']:
    y=paragraph(text,y,116,10)
finish()
for name,title,sub in [
 ('quality-matrix','Success and failure, response by response','Post-hoc review. Schema = exact frozen JSON schema; core goal = narrow task rubric; review clean = no identified defect.'),
 ('cost-duration-cloud','The joint distribution, including quality','Every completed response appears. Failed requests have no completion coordinates and remain counted in the quality matrix.'),
 ('duration-distributions','Latency variability, not just averages','5-6 completed responses per arm/task. Boxes show quartiles and median; histograms use identical 350 ms bins.'),
 ('cost-distributions','Cost variability, not just percentages','Actual reported USD per call. Shared bins are $0.0002 wide. Unusable completions remain included.'),
 ('paired-differences','Where fast wins, and where it loses','Case clusters retain paired repetitions. Intervals are conditional on only three observed contexts, not population guarantees.')]:
    start(title,sub);chart(name);finish()

start('Summary statistics and quality-adjusted spending','Descriptive statistics only; no equivalence claim and no pooling away task differences')
y=table(['Task / arm','n','Mean ms','SD ms','Median ms','P90 ms','Mean USD/call'],[
 [g['name']+' / '+a[0].upper(),g['arms'][a]['completed'],f"{g['arms'][a]['duration']['mean']:.1f}",f"{g['arms'][a]['duration']['sd']:.1f}",f"{g['arms'][a]['duration']['median']:.1f}",f"{g['arms'][a]['duration']['p90']:.1f}",f"${g['arms'][a]['cost']['mean']:.8f}"] for g in GROUPS for a in ARMS],510,[169,30,82,80,86,80,180])
y=table(['Task','Paired duration saving','Paired cost saving','Known USD / review-clean S | F'],[
 [g['name'],f"{g['time']['mean_saving']:.1f} ms ({g['time']['reduction_pct']:.1f}%)",f"${g['cost']['mean_saving']:.8f} ({g['cost']['reduction_pct']:.1f}%)",
  ' | '.join(f"${g['arms'][a]['cost_per_review_clean']:.6f}" if g['arms'][a]['cost_per_review_clean'] is not None else 'undefined (0)' for a in ARMS)]for g in GROUPS],y,[130,177,190,230],8.5)
y=paragraph('The upper table uses all completions; savings use matched completions only. P90 is linearly interpolated and unstable with n=5-6. Known spending per review-clean response includes spending on bad outputs; it is a lower bound when failed-call billing is unknown. Zero clean outputs yields an undefined ratio, not zero cost.',y,135,9)
finish()

F=D['forecast']
start('The bigger push: qualify, measure, then expand','Proposed experiment. No larger paid batch has been launched.')
y=paragraph('Prepared corpus: 64 exchanges = 60 language-specific semantic cases + 4 encoding variants. They cover 6 languages and 10 shared scenario families, not 60 independent story templates. Seven task builders yield 448 synthetic task inputs; 19 recorded inputs are separate.',510,118,10)
y=table(['Stage','Calls','Pilot-scaled charge','Purpose'],[
 ['0. Qualification','84',f"~${F['qualification_proxy_usd']:.2f}",'7 tasks x 6 languages x 2 arms; one input/cell'],
 ['1. Existing synthetic suite','2,688',f"~${F['central_proxy_usd']:.2f}",'448 inputs x 2 arms x 3 repetitions'],
 ['2. Independent stories','Up to 8,640','~$4.16*','360 exchanges x 4 tasks x 2 arms x 3 reps'],
 ['Separate recorded replay','114','Re-estimate from plan','19 inputs x 2 arms x 3 repetitions']],y,[173,80,150,320],9)
y=paragraph(f"Stage 1 sensitivity: ${F['threefold_sensitivity_usd']:.2f} at three times the pilot-scaled output cost. This is a scenario, not a statistical confidence bound. The frozen maximum-token reservation is ${F['conservative_snapshot_reservation_usd']:.2f}, before fresh price checks. Expected bill and conservative reservation must remain separate.",y,117,10)
y=paragraph('Measured-task component: $0.74. Untested-task proxy: $0.55. Three unseen task types borrow the equal-weight mean of the four tested task costs; longer contexts and three unseen languages can change token use substantially. Qualification replaces these assumptions with observed task/language token counts.',y,117,10)
y=paragraph('*Stage 2 adds six distinct story seeds per family: 10 families x 6 seeds x 6 languages = 360 exchanges. Run only selected tasks after Stage 1 review. The $4.16 estimate assumes all four pilot tasks and their observed token use. Record language adaptations under a common story-seed cluster.',y,117,10)
y=paragraph('Serial Stage 1 elapsed-time planning: roughly 8.4 hours at a 10-second inter-request gap plus observed ~1.3-second response time, before pauses. This is batch wall time, not user-visible latency. Start serial; do not assume the two observed 429s identify a model-specific limit.',y,117,10)
finish()

start('Execution and decision rules','Freeze the evaluation contract before new paid calls; keep the original pilot as a separate baseline')
y=510
for text in [
 '1. Qualification: restore native replay, validate frozen schemas, and test actual app acceptance. Resolve why successful HTTP responses violate explicit cue-field constraints. If prompts change, assign a new version; do not merge old and new results.',
 '2. Coverage: retain all ten families and six languages. Add targeted failures from this pilot: empty glosses, overlapping anchors, wrong-language pronunciation, target-script romanization, wrong replacement scope, lost quantities and unsupported corrections.',
 '3. Design: identical frozen inputs within pairs; randomized and counterbalanced arm order within task/language blocks. Keep all attempts and failures. Three repetitions measure instability; more distinct stories measure generalization.',
 '4. Review: conceal model, cost and latency labels. Use task rubrics for meaning preservation, correctness and usefulness, plus hard contract checks and harmful-error flags. Have a second competent language reviewer adjudicate disagreements before claiming semantic equivalence.',
 '5. Analysis: per-task and per-language counts, paired success discordance, error taxonomy, response clouds, ECDF/histograms, mean/median/SD/tails, paired deltas, and total spend per accepted result. Resample by story seed, retaining translations and repetitions together.',
 '6. Gates: pause an affected cell on a new harmful failure, failed native acceptance, HTTP 429 or budget limit. Keep failures; resume only unattempted jobs through a separately logged continuation. No automatic retries that hide first-attempt reliability.',
 '7. Budgets: refresh prices and reservations; split each language batch into compliant sub-batches (three repetitions push some existing language reservations above $5). Use a proposed $5 actual-spend checkpoint for Stage 1, with a fresh estimate after qualification. A checkpoint requires runner enforcement before execution.',
 '8. Selection: advance partner reply first. Require zero unresolved severe-error classes and a prospectively chosen acceptable quality-loss margin before a downgrade. A suggested 5 percentage-point margin is a proposal; n=3 contexts/task cannot test it. With zero independent failures, about 59 independent cases are needed for a one-sided 95% upper failure-rate bound below 5%.',
 '9. Integration: after per-call quality gates pass, measure whole-turn graph latency, first-token time, native acceptance and downstream effects with selected routes. Direct-call savings are not automatically whole-turn savings. Recorded prompts remain a separately reviewed private-data batch.'
]:y=paragraph(text,y,135,9)
finish();c.save()

# Complete locally inspectable evidence: annotations, validation paths, inputs and raw output.
esc=lambda s:html.escape(str(s))
parts=['<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Model comparison evidence</title>',
 '<style>body{font:16px/1.5 system-ui;margin:0;background:#f2f5f8;color:#203148}main{max-width:1200px;margin:auto;padding:30px}h1,h2{line-height:1.2}nav{display:flex;gap:20px;flex-wrap:wrap}a{color:#175798}img{width:100%;height:auto;background:white}section{margin:36px 0}article{background:white;padding:20px;margin:15px 0;border:1px solid #dce3eb;border-radius:8px}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:13px/1.5 ui-monospace}summary{cursor:pointer;padding:10px 0}select{font:inherit;padding:6px}label{margin-right:18px}table{border-collapse:collapse;width:100%}td,th{text-align:left;padding:9px;border-bottom:1px solid #ddd}.small{font-size:14px;color:#526173}.flag{color:#99303f}.pair{display:grid;grid-template-columns:1fr 1fr;gap:20px}@media(max-width:700px){.pair{grid-template-columns:1fr}}</style><main>',
 '<h1>Model comparison: evidence and next-run plan</h1><p>48 attempts, 46 completions, 12 fixed inputs. Known billed cost $0.02311524; two failure costs unknown. No new paid calls for this analysis.</p><nav><a href="model-comparison-report.pdf">Download the statistical report (PDF)</a><a href="#quality">Quality matrix</a><a href="#cloud">Response clouds</a><a href="#evidence">Inspect every pair</a><a href="analysis.json">Analysis data (JSON)</a></nav>',
 '<p class="small">Review labels are post-hoc and unblinded. Review clean means no defect found in the evaluated dimensions, not certified correctness. Raw responses and precise validation failures remain below.</p>']
for name,title in zip(FIGS,['Quality outcomes','Joint cost-duration cloud','Duration distributions','Cost distributions','Paired savings']):
    anchor='quality' if name=='quality-matrix' else ('cloud' if name=='cost-duration-cloud' else name)
    parts.append(f'<section id="{anchor}"><h2>{title}</h2><img alt="{title}" src="data:image/png;base64,{base64.b64encode((OUT/(name+".png")).read_bytes()).decode()}"></section>')
parts.append('<section id="evidence"><h2>Every paired response</h2><label>Task <select id="task"><option value="all">All four tasks</option>'+''.join(f'<option value="{g["kind"]}">{g["name"]}</option>'for g in GROUPS)+'</select></label><label><input id="defects" type="checkbox"> Only pairs with defects or missing responses</label><p id="count" aria-live="polite"></p>')
for g in GROUPS:
    for lang in ['spanish','arabic','mandarin']:
        for rep in range(2):
            pair=[next(r for r in ROWS if r['kind']==g['kind'] and r['language']==lang and r['repetition']==rep and r['arm']==arm) for arm in ARMS]
            bad=any(not r['review_clean'] for r in pair)
            parts.append(f'<article data-kind="{g["kind"]}" data-bad="{str(bad).lower()}"><h3>{g["name"]} / {lang.title()} / repetition {rep+1}</h3><p>{esc(D["rubric"][g["kind"]])}</p><div class="pair">')
            for r in pair:
                cost='unknown' if r['cost'] is None else f'${r["cost"]:.8f}'
                parts.append(f'<div><h4>{r["arm"].title()} - core: {r["core"]}</h4><p>{r["elapsedMs"]} ms ({"completion" if r["transport"] else "failed attempt"}) / {cost}</p><p>{esc(r["review_note"])}</p><p class="flag">'+esc('; '.join(r['schema_errors']+r['rule_errors']) or 'No mechanical defects found; this is not full native validation.')+f'</p><details><summary>Actual response</summary><pre dir="auto">{esc(r.get("content","No completion received"))}</pre></details><details><summary>Exact frozen input and schema</summary><pre>{esc(json.dumps(dict(messages=r["input"],schema=r["schema"]),ensure_ascii=False,indent=2))}</pre></details></div>')
            parts.append('</div></article>')
parts.append('</section><script>const task=document.getElementById("task"),defects=document.getElementById("defects");function filter(){let n=0;document.querySelectorAll("article[data-kind]").forEach(e=>{e.hidden=(task.value!=="all"&&e.dataset.kind!==task.value)||(defects.checked&&e.dataset.bad!=="true");if(!e.hidden)n++});document.getElementById("count").textContent=n+" of 24 pairs shown"}task.addEventListener("change",filter);defects.addEventListener("change",filter);filter();</script></main></html>')
(OUT/'report.html').write_text(''.join(parts),encoding='utf-8')
print(str(PDF.resolve()))
