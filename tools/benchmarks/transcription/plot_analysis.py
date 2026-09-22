"""Scientific descriptive plots from export-analysis.ts; no provider calls.
Usage: python plot_analysis.py /absolute/private/output/directory
Dependencies: matplotlib, numpy. Scoring remains in TypeScript.
"""
import json
import sys
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.lines import Line2D
import numpy as np

out = Path(sys.argv[1])
data = json.loads((out / 'plot-data.json').read_text())
rows = data['rows']
if not rows:
    raise ValueError('No kept recordings')
ids = [c['id'] for c in data['conditions']]
labels = ['Whisper · Arabic supplied', 'Scribe verbatim · Arabic supplied',
          'Scribe clean · Arabic supplied', 'Whisper · Auto language',
          'Scribe verbatim · Auto language', 'Scribe clean · Auto language']
languages = {r['language'] for r in rows}
if len(languages) != 1:
    raise ValueError('Plot each language separately')
language = {'ar':'Arabic','es':'Spanish','zh':'Chinese','en':'English'}[next(iter(languages))]
labels = [label.replace('Arabic', language) for label in labels]
values = np.array([[np.nan if r['cer'] is None else 100*r['cer'] for r in row['results']] for row in rows])
phrase_ids = list(dict.fromkeys(r['phraseId'] for r in rows))
phrases = [next(r['meaning'] for r in rows if r['phraseId']==p) for p in phrase_ids]
colors = plt.get_cmap('tab20').colors
palette = {p:colors[i % len(colors)] for i,p in enumerate(phrase_ids)}
plt.rcParams.update({'font.family':'DejaVu Sans','font.size':11,'axes.spines.top':False,
                     'axes.spines.right':False,'savefig.facecolor':'white'})
footer = (f'{len(rows)} recordings · {len(phrase_ids)} intended phrases · one speaker · first attempt per condition\n'
          'Character error is text distance, NOT success or meaning accuracy. Punctuation and Arabic vowel marks ignored.\n'
          'Spelling variants and paraphrases still count as edits. References are intended text; no listening adjudication.\n'
          f'Models: Groq Whisper large-v3; ElevenLabs Scribe v2. {np.isfinite(values).sum()} scored transcripts / {values.size} condition slots.')

def finish(fig, name):
    fig.text(.025,.025,footer,fontsize=9,color='#505860',va='bottom')
    fig.savefig(out/f'{name}.png',dpi=190)
    fig.savefig(out/f'{name}.svg')
    plt.close(fig)

fig,ax=plt.subplots(figsize=(14,9.5))
fig.subplots_adjust(left=.30,right=.88,top=.83,bottom=.36)
fig.suptitle('Text difference varies substantially across recordings',x=.025,ha='left',fontsize=20,y=.97)
fig.text(.025,.91,'Each circle = one take; black diamond = mean across returned transcripts. Lower error is closer to the target.',fontsize=11)
for j in range(len(ids)):
    for i,row in enumerate(rows):
        ax.scatter(values[i,j],j+(i-(len(rows)-1)/2)*(.5/max(len(rows),1)),color=palette[row['phraseId']],s=42,alpha=.85,zorder=3)
    if np.isfinite(values[:,j]).any():
        mean=np.nanmean(values[:,j]); ax.scatter(mean,j,marker='D',c='black',s=57,zorder=5)
        ax.text(1.015,j,f'{mean:.1f}%',transform=ax.get_yaxis_transform(),va='center',fontweight='bold',fontsize=10)
ax.set_yticks(range(len(ids)),labels); ax.invert_yaxis()
ax.set_xlim(-3,max(100,np.nanmax(values)*1.08)); ax.set_xlabel('Character error (%) — lower is better; can exceed 100%')
ax.grid(axis='x',alpha=.2); ax.axhline(2.5,color='#aaaaaa',lw=.8)
handles=[Line2D([0],[0],marker='o',linestyle='',color=palette[p],label=phrases[i]) for i,p in enumerate(phrase_ids)]
fig.legend(handles=handles,loc='lower left',bbox_to_anchor=(.025,.12),ncol=2,frameon=False,fontsize=9)
finish(fig,'01-distributions')

fig,ax=plt.subplots(figsize=(15,max(9, len(rows)*.34+3)))
fig.subplots_adjust(left=.38,right=.90,top=.81,bottom=.19)
fig.suptitle('Which recordings account for the differences?',x=.025,ha='left',fontsize=20,y=.97)
fig.text(.025,.92,'Each cell = character error (%) for the same recording under one condition. Color uses one shared scale.',fontsize=11)
im=ax.imshow(np.ma.masked_invalid(values),cmap='magma_r',vmin=0,vmax=max(100,np.nanmax(values)),aspect='auto')
ax.set_xticks(range(6),['Whisper\nArabic','Scribe verbatim\nArabic','Scribe clean\nArabic','Whisper\nAuto','Scribe verbatim\nAuto','Scribe clean\nAuto'],fontsize=10)
ax.set_xticklabels([t.get_text().replace('Arabic',language) for t in ax.get_xticklabels()]); ax.xaxis.tick_top(); ax.tick_params(axis='both',length=0)
# Short labels avoid crowding; full meanings retained in source JSON.
short = {p:(phrases[i][:49]+'…' if len(phrases[i])>50 else phrases[i]) for i,p in enumerate(phrase_ids)}
ax.set_yticks(range(len(rows)),[f"{r['number']:02d}  {short[r['phraseId']]}" for r in rows],fontsize=10)
for i in range(len(rows)):
    for j in range(6):
        v=values[i,j]
        txt=f'{v:.0f}' if np.isfinite(v) else rows[i]['results'][j]['status']
        ax.text(j,i,txt,ha='center',va='center',fontsize=11,color='white' if np.isfinite(v) and v>max(100,np.nanmax(values))*.48 else '#111111')
    if i and rows[i]['phraseId']!=rows[i-1]['phraseId']: ax.axhline(i-.5,color='white',lw=3)
ax.axvline(2.5,color='white',lw=3)
cb=fig.colorbar(im,ax=ax,fraction=.025,pad=.025); cb.set_label('Character error (%)')
finish(fig,'02-recording-heatmap')

comparisons=[(3,0,'Whisper: Auto − Arabic'),(4,1,'Scribe verbatim: Auto − Arabic'),
             (5,2,'Scribe clean: Auto − Arabic'),(2,1,'Scribe Arabic: Clean − Verbatim'),(5,4,'Scribe Auto: Clean − Verbatim')]
comparisons=[(a,b,label.replace('Arabic',language)) for a,b,label in comparisons]
fig,ax=plt.subplots(figsize=(14,9.5))
fig.subplots_adjust(left=.34,right=.88,top=.80,bottom=.36)
fig.suptitle('Controlled comparisons on the same audio',x=.025,ha='left',fontsize=20,y=.97)
fig.text(.025,.91,'Each circle = paired change on one take; black diamond = mean change. Positive = more text error.',fontsize=11)
for j,(a,b,label) in enumerate(comparisons):
    delta=values[:,a]-values[:,b]
    for i,row in enumerate(rows):
        ax.scatter(delta[i],j+(i-(len(rows)-1)/2)*(.5/max(len(rows),1)),color=palette[row['phraseId']],s=42,alpha=.85,zorder=3)
    mean=np.nanmean(delta); ax.scatter(mean,j,marker='D',c='black',s=57,zorder=4)
    ax.text(1.015,j,f'{mean:+.1f} pp',transform=ax.get_yaxis_transform(),va='center',fontweight='bold',fontsize=10)
ax.axvline(0,color='black',lw=1); ax.axhline(2.5,color='#aaaaaa',lw=.8)
ax.set_yticks(range(5),[c[2] for c in comparisons]); ax.invert_yaxis()
ax.set_xlabel('Change in character error (percentage points)\n← less text error                              more text error →')
ax.grid(axis='x',alpha=.2)
fig.legend(handles=handles,loc='lower left',bbox_to_anchor=(.025,.12),ncol=2,frameon=False,fontsize=9)
finish(fig,'03-paired-changes')
status_counts={s:sum(r['status']==s for row in rows for r in row['results']) for s in ['ok','error','missing']}
(out/'figure-methods.txt').write_text(f"Generated from {data['generated']}\nStatuses: {status_counts}\nMeans weight each recording equally, not each phrase or character. Paired plots use the same recordings for both conditions; missing values are excluded pairwise. No confidence intervals or significance tests: this small convenience sample has repeated phrases from one speaker and cannot support population claims. No semantic success score is inferred. Inspect qualitative-review-2026-09-21.md separately for meaning and wording judgments. SVG is the vector export; PNG is the preview. Source values are in plot-data.json.\n")
print(json.dumps({'takes':len(rows),'phrases':len(phrase_ids),'statuses':status_counts,'means':np.nanmean(values,axis=0).tolist()},indent=2))
