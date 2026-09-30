"""Offline, receipt-backed analysis. Run from repository root with local report dependencies."""
import json
import itertools
from pathlib import Path
import sys
import unicodedata
import subprocess

sys.path.insert(0, str(Path('.local/report-packages').resolve()))
import numpy as np
from jsonschema import Draft202012Validator

BASE = Path('.local')
OUT = BASE / 'model-comparison-analysis-2026-09-30'
OUT.mkdir(exist_ok=True)
DIRECTORIES = [BASE / f'model-comparison-{s}-2026-09-30' for s in ['live-pilot', 'live-continuation', 'live-tail']]
PLAN = json.loads((DIRECTORIES[0] / 'plan.json').read_text(encoding='utf-8'))
REVIEW = json.loads(Path(__file__).with_name('quality-review.json').read_text(encoding='utf-8'))
KINDS = ['persona_reply', 'persona_word_gloss', 'coach_feedback', 'reply_assistance']
NAMES = ['Partner reply', 'Word gloss', 'Coaching', 'Reply assistance']
ROWS = []
receipt_text = ''.join((d / 'results.jsonl').read_text(encoding='utf-8') for d in DIRECTORIES)
nonlatin_letters = set(json.loads(subprocess.run(['node', '-e',
    "let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',d=>s+=d);process.stdin.on('end',()=>console.log(JSON.stringify([...new Set(s)].filter(c=>/\\p{L}/u.test(c)&&!/[\\p{Script=Latin}\\p{Script=Common}\\p{Script=Inherited}]/u.test(c)))));"],
    input=receipt_text, text=True, encoding='utf-8', capture_output=True, check=True).stdout))

for directory in DIRECTORIES:
    for line in (directory / 'results.jsonl').read_text(encoding='utf-8').splitlines():
        r = json.loads(line)
        case = next(c for c in PLAN['cases'] if c['id'] == r['caseId'])
        r['kind'], r['language'] = case['kind'], case['language']
        r['block'] = DIRECTORIES.index(directory) + 1
        r['cost'] = r.get('metadata', {}).get('usage', {}).get('cost')
        r['tokens'] = r.get('metadata', {}).get('usage', {})
        core, flags, note = REVIEW['rows'][r['kind']][r['language']][r['arm']][r['repetition']]
        r.update(core=core, semantic_flags=flags, review_note=note, schema_errors=[], rule_errors=[])
        r['transport'] = r['status'] == 'complete'
        r['schema_pass'] = None
        r['schema_applicable'] = bool(case['payload'].get('response_format'))
        parsed = None
        if r['transport'] and r['schema_applicable']:
            try:
                parsed = json.loads(r['content'])
                validator = Draft202012Validator(case['payload']['response_format']['json_schema']['schema'])
                r['schema_errors'] = [f"{'.'.join(map(str, e.absolute_path)) or '$'}: {e.message}" for e in validator.iter_errors(parsed)]
                r['schema_pass'] = not r['schema_errors']
            except json.JSONDecodeError as e:
                r['schema_errors'] = [f'Invalid JSON at character {e.pos}: {e.msg}']
                r['schema_pass'] = False
        if parsed and r['kind'] == 'coach_feedback':
            inp = json.loads(case['messages'][-1]['content'])
            for i, item in enumerate(parsed.get('items', [])):
                if item['quote'] not in inp['learnerSource']:
                    r['rule_errors'].append(f'items.{i}.quote is not verbatim source')
                err = item.get('error')
                if err and err['source'] != 'unknown':
                    r['rule_errors'].append(f'items.{i}.error.source is not unknown')
                if not err and item['rationale']:
                    r['rule_errors'].append(f'items.{i}.rationale is not empty for evidence-only item')
        if parsed and r['kind'] == 'persona_word_gloss':
            graphemes = json.loads(case['messages'][-1]['content'])['graphemes']
            ids = [g['id'] for g in graphemes]
            used, previous = set(), -1
            if not any(s.get('kind') == 'gloss' for s in parsed.get('spans', [])):
                r['rule_errors'].append('No lexical meanings')
            for s in parsed.get('spans', []):
                if s['first'] not in ids or s['last'] not in ids:
                    r['rule_errors'].append('Unknown source anchor')
                    continue
                a, b = ids.index(s['first']), ids.index(s['last'])
                if b < a or a <= previous:
                    r['rule_errors'].append('Unordered or overlapping spans')
                previous = b
                text = ''.join(g['text'] for g in graphemes[a:b+1])
                if s['kind'] == 'literal' and any(unicodedata.category(ch)[0] in 'LN' for ch in text):
                    r['rule_errors'].append('Lexical text marked literal')
                if used.intersection(range(a, b+1)):
                    r['rule_errors'].append('Overlapping spans')
                used.update(range(a, b+1))
        if parsed and r['kind'] == 'reply_assistance':
            for i, reply in enumerate(parsed['replies']):
                if any(ch in nonlatin_letters for ch in reply['romanization']):
                    r['rule_errors'].append(f'replies.{i}.romanization contains non-Latin letters')
        r['rule_errors'] = sorted(set(r['rule_errors']))
        r['mechanical_pass'] = r['transport'] and r['schema_pass'] is not False and not r['rule_errors']
        r['review_clean'] = r['mechanical_pass'] and not flags and core == 'pass'
        r['input'] = case['messages']
        r['schema'] = case['payload'].get('response_format')
        ROWS.append(r)

assert len(ROWS) == len({r['id'] for r in ROWS}) == 48
assert sum(r['transport'] for r in ROWS) == 46
PAIRS = []
for s in [r for r in ROWS if r['arm'] == 'standard']:
    f = next(r for r in ROWS if r['caseId'] == s['caseId'] and r['repetition'] == s['repetition'] and r['arm'] == 'fast')
    PAIRS.append(dict(standard=s, fast=f, complete=s['transport'] and f['transport']))

def distribution(values):
    a = np.array(values)
    return dict(n=len(a), mean=float(a.mean()), median=float(np.median(a)), sd=float(a.std(ddof=1)) if len(a)>1 else None,
                minimum=float(a.min()), q25=float(np.quantile(a,.25)), q75=float(np.quantile(a,.75)),
                p90=float(np.quantile(a,.9)), maximum=float(a.max()))

def paired_stats(pairs, key):
    s = np.array([p['standard'][key] for p in pairs])
    f = np.array([p['fast'][key] for p in pairs])
    diff = s-f
    cases = sorted({p['standard']['caseId'] for p in pairs})
    clusters = [np.array([i for i,p in enumerate(pairs) if p['standard']['caseId']==c]) for c in cases]
    # Exact enumeration of the empirical cluster-bootstrap distribution, only 3^3 per task.
    draws = [np.concatenate([clusters[j] for j in choice]) for choice in itertools.product(range(len(clusters)), repeat=len(clusters))]
    boot = np.array([float(diff[ids].mean()) for ids in draws])
    cluster_means = np.array([diff[ids].mean() for ids in clusters])
    flips = [abs(np.mean(cluster_means*np.array(signs))) for signs in itertools.product([-1,1], repeat=len(clusters))]
    return dict(n=len(pairs), contexts=len(cases), standard=distribution(s), fast=distribution(f),
                mean_saving=float(diff.mean()), reduction_pct=float(100*diff.mean()/s.mean()),
                median_saving=float(np.median(diff)), fast_lower=int(sum(diff>0)), fast_higher=int(sum(diff<0)),
                cluster_bootstrap_95=list(map(float,np.quantile(boot,[.025,.975]))),
                cluster_signflip_p=float(np.mean(np.array(flips)>=abs(cluster_means.mean())-1e-12)))

groups = []
for kind, name in zip(KINDS,NAMES):
    rows = [r for r in ROWS if r['kind']==kind]
    pairs = [p for p in PAIRS if p['standard']['kind']==kind and p['complete']]
    armstats = {}
    for arm in ['standard','fast']:
        armrows = [r for r in rows if r['arm']==arm]
        complete = [r for r in armrows if r['transport']]
        clean = sum(r['review_clean'] for r in armrows)
        known = sum(r['cost'] for r in armrows if r['cost'] is not None)
        armstats[arm] = dict(attempted=len(armrows),completed=len(complete),schema_pass=sum(r['schema_pass'] is True for r in armrows),
          schema_applicable=sum(r['schema_applicable'] for r in armrows),mechanical_pass=sum(r['mechanical_pass'] for r in armrows),
          core={x:sum(r['core']==x for r in armrows) for x in ['pass','partial','fail','uncertain','unavailable']},
          review_clean=clean,semantic_flagged=sum(bool(r['semantic_flags']) for r in armrows),known_cost=known,
          cost_per_review_clean=known/clean if clean else None,unknown_cost=sum(r['cost'] is None for r in armrows),
          duration=distribution([r['elapsedMs'] for r in complete]),cost=distribution([r['cost'] for r in complete]))
    groups.append(dict(kind=kind,name=name,arms=armstats,time=paired_stats(pairs,'elapsedMs'),cost=paired_stats(pairs,'cost')))

suite = json.loads((BASE/'model-comparison-suite-final-2026-09-30/suite.json').read_text())
synthetic_reservation = sum(b['reservationUsd'] for b in suite['batches'] if b['name']!='recorded')
# 64 inputs per task, three repetitions per arm. Untested tasks borrow equal-weight pilot task means.
pair_costs = [g['cost']['standard']['mean']+g['cost']['fast']['mean'] for g in groups]
tested_cost = 64*3*sum(pair_costs)
untested_proxy = 64*3*3*float(np.mean(pair_costs))
forecast = dict(synthetic_inputs=448,repetitions=3,calls=2688,tested_tasks=4,untested_tasks=3,
               measured_task_proxy_usd=tested_cost,untested_task_proxy_usd=untested_proxy,
               central_proxy_usd=tested_cost+untested_proxy,
               threefold_sensitivity_usd=3*(tested_cost+untested_proxy),
               conservative_snapshot_reservation_usd=synthetic_reservation*1.5,
               recorded_calls_at_3_repetitions=114,recorded_reservation_usd=suite['batches'][0]['reservationUsd']*1.5,
               qualification_calls=84,qualification_proxy_usd=42*float(np.mean(pair_costs)),
               scope='Projection from pilot task means, not a price quote or confidence interval. Three untested tasks and three untested languages require qualification.')
result = dict(rows=[{k:v for k,v in r.items() if k not in ['metadata','requestedModel','tokens']} for r in ROWS],
              groups=groups,forecast=forecast,rubric=REVIEW['rubric'],review_status=REVIEW['status'],
              known_total=sum(r['cost'] for r in ROWS if r['cost'] is not None),
              matched_pairs=sum(p['complete'] for p in PAIRS),
              limitations=['Only three contexts per task; repeated calls and translated scenarios are not independent samples.',
              'Bootstrap intervals are conditional on the three observed contexts; no population coverage or equivalence claim.',
              'Native replay was unavailable. Frozen JSON schema and limited source checks do not replace app validation.',
              'No new paid calls were made for this analysis.'])
(OUT/'analysis.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(dict(groups=[dict(name=g['name'],arms=g['arms']) for g in groups],forecast=forecast),indent=2))
