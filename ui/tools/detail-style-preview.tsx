/** Design review only: sample data, no workspace reads/writes or generation. */
import { createRoot } from 'react-dom/client'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { PREVIEW_SETTINGS } from './preview-settings'
import { AppearanceSettings } from '../src/features/settings/appearance/AppearanceSettings'
import { useAppearance } from '../src/platform/appearance/useAppearance'
import { SavedGlossText } from '../src/components/reading/SavedGlossText'
import { ReadingPreferencesContext } from '../src/components/reading/ReadingPreferences'
import { RewardBadge } from '../src/features/conversation/progress/RewardBadge'
import { DetailDialog } from '../src/components/dialogs/DetailDialog'
import { configureRewardSounds, unlockRewardAudio, playRewardSound, setRewardVolume, stopRewardSounds, soundPattern } from '../src/platform/audio/reward-sounds'
import type { GlossSegment } from '../src/generated/contracts'
import '../src/styles/index.css'
import './detail-style-preview.css'

const samples: { label: string; lang: string; text: string; segments: GlossSegment[]; note: string }[] = [
  { label: 'Spanish · accents', lang: 'es', text: '¿Hay una farmacia por aquí?', segments: [{ start: 9, end: 17, kind: 'gloss', gloss: 'pharmacy', pronunciation: 'far-MA-sya' }], note: 'Punctuation and an annotated word inside a sentence.' },
  { label: 'Arabic · joined word parts', lang: 'ar', text: 'والكتاب', segments: [
    { start: 0, end: 1, kind: 'gloss', gloss: 'and', romanization: 'wa' },
    { start: 1, end: 3, kind: 'gloss', gloss: 'the', romanization: 'al' },
    { start: 3, end: 7, kind: 'gloss', gloss: 'book', romanization: 'kitāb' },
  ], note: 'Check joined letters, word-part help and right-to-left ordering.' },
  { label: 'Chinese · no spaces', lang: 'zh', text: '你好，世界！', segments: [
    { start: 0, end: 2, kind: 'gloss', gloss: 'hello', romanization: 'nǐ hǎo' },
    { start: 3, end: 5, kind: 'gloss', gloss: 'world', romanization: 'shì jiè' },
  ], note: 'Check annotation width, tone marks and punctuation.' },
  { label: 'German · long word', lang: 'de', text: 'Die Geschwindigkeitsbegrenzung beträgt 30 km/h.', segments: [
    { start: 4, end: 30, kind: 'gloss', gloss: 'speed limit', pronunciation: 'ge-SHVIN-dig-kaits-be-GREN-tsung' },
  ], note: 'Stress case for wrapping long words and long help text.' },
  { label: 'Mixed direction · Arabic / Latin / numbers', lang: 'ar', text: 'الدرس 12 — React — الساعة 10:30', segments: [], note: 'Check numeral order and embedded Latin text; no annotations in this specimen.' },
  { label: 'French · diacritics', lang: 'fr', text: 'À bientôt ! Où est l’arrêt de bus ?', segments: [], note: 'Check accents, apostrophes and reading rhythm.' },
]
const domains = ['social', 'questions', 'opinions', 'statements', 'descriptions', 'situating']

function Explorer() {
  const [settings, setSettings] = useState(PREVIEW_SETTINGS)
  const [help, setHelp] = useState(false)
  const [roman, setRoman] = useState(false)
  const [pronunciation, setPronunciation] = useState(false)
  const [scale, setScale] = useState(100)
  const [scriptScale, setScriptScale] = useState(100)
  const [font, setFont] = useState('serif')
  const [domain, setDomain] = useState('descriptions')
  const [xp, setXp] = useState(10)
  const [stored, setStored] = useState(false)
  const [motion, setMotion] = useState('system')
  const [audio, setAudio] = useState(false)
  const [volume, setVolume] = useState(15)
  const [status, setStatus] = useState('Ready to preview.')
  const [open, setOpen] = useState(false)
  const card = useRef<HTMLDivElement>(null)
  const animation = useRef<Animation | null>(null)
  useAppearance(settings)
  useEffect(() => { setRewardVolume(volume / 100) }, [volume])
  useEffect(() => () => { stopRewardSounds(); configureRewardSounds('no', false); animation.current?.cancel() }, [])
  const badge = <RewardBadge domainId={domain} label={domain} xp={xp} creditKind={stored ? 'stored' : 'earned'} quote="Sample evidence: I described where the pharmacy is." />
  const replay = () => {
    animation.current?.cancel()
    if (stored) { setStatus('Stored evidence stays inspectable; no new-credit animation or sound.'); return }
    const reduce = motion === 'static' || window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!reduce) animation.current = card.current!.animate([{ transform: 'translateY(6px)', opacity: .65 }, { transform: 'translateY(0)', opacity: 1 }], { duration: 440, easing: 'ease-out' })
    const sounded = audio && playRewardSound({ kind: 'xp', xp }, card.current!)
    setStatus(`Sample ${stored ? 'stored credit' : 'new credit'}: ${xp} XP. ${reduce ? 'No entrance animation.' : 'Proposed gentle entrance.'} ${audio ? sounded ? 'Sound played.' : 'Sound not ready; use Replay again.' : 'Sound off.'}`)
  }
  return <main className="detail-lab">
    <header><a href="/tools/style-preview.html">← Shared components</a><h1>Language & reward details</h1><p>Interactive design review · sample data only. These choices do not save app preferences or award XP.</p><nav><a href="#reading">Reading</a><a href="#rewards">Rewards</a><a href="#questions">Review checklist</a></nav></header>
    <details><summary>Shared appearance</summary><label>Theme<select value={settings.theme ?? 'light'} onChange={e => setSettings({ ...settings, theme: e.target.value as 'light' | 'dark' | 'system' })}><option>light</option><option>dark</option><option>system</option></select></label><AppearanceSettings settings={settings} onChange={setSettings} /></details>
    <section id="reading"><h2>01 · Reading and annotations</h2><p><strong>Baseline:</strong> production saved-word interaction. <strong>Exploration:</strong> adjustable reading face and local script scale. Arabic/CJK glyphs use available system fallback fonts; this does not establish a bundled font choice.</p>
      <div className="lab-controls">
        <label>Reading size · {scale}%<input aria-label="Reading size" type="range" min="85" max="160" step="5" value={scale} onChange={e => setScale(Number(e.target.value))} /></label>
        <label>Script scale · {scriptScale}%<input aria-label="Script scale" type="range" min="85" max="160" step="5" value={scriptScale} onChange={e => setScriptScale(Number(e.target.value))} /></label>
        <label>Reading face<select value={font} onChange={e => setFont(e.target.value)}><option value="serif">Serif</option><option value="sans">Sans serif</option></select></label>
        <label><input type="checkbox" checked={help} onChange={e => setHelp(e.target.checked)} />Always show glosses</label>
        <label><input type="checkbox" checked={roman} onChange={e => setRoman(e.target.checked)} />Always show romanization</label>
        <label><input type="checkbox" checked={pronunciation} onChange={e => setPronunciation(e.target.checked)} />Always show pronunciation</label>
      </div>
      <ReadingPreferencesContext value={{ autoTranslate: help, alwaysRomanize: roman, alwaysPronunciation: pronunciation }}>
        <div className="lab-grid" style={{ '--reading-scale': scale / 100, '--script-scale': scriptScale / 100, '--lab-reading-font': font === 'serif' ? 'var(--font-serif)' : 'var(--font-sans)' } as CSSProperties}>
          {samples.map(sample => <article key={sample.lang + sample.label}><h3>{sample.label}</h3><div className="lab-reading" lang={sample.lang} dir="auto"><SavedGlossText text={sample.text} segments={sample.segments} /></div><p>{sample.note}</p></article>)}
        </div>
      </ReadingPreferencesContext>
    </section>
    <section id="rewards"><h2>02 · Reward meaning and presentation</h2><p><strong>Baseline:</strong> production reward badges, domain colors and sound patterns. <strong>Proposal:</strong> the replay entrance below. Full card travel, reward sequencing and haptics require native-app review.</p>
      <div className="lab-controls">
        <label>Learning domain<select value={domain} onChange={e => setDomain(e.target.value)}>{domains.map(d => <option key={d}>{d}</option>)}</select></label>
        <label>Sound tier sample<select aria-label="Sound tier sample" value={xp} onChange={e => setXp(Number(e.target.value))}><option value="5">5 XP · below 10</option><option value="10">10 XP · 10–19</option><option value="20">20 XP · 20+</option></select></label>
        <label><input type="checkbox" checked={stored} onChange={e => setStored(e.target.checked)} />Stored credit (no plus sign)</label>
        <label>Entrance motion<select value={motion} onChange={e => { setMotion(e.target.value); animation.current?.cancel() }}><option value="system">Follow system</option><option value="static">No entrance animation</option></select></label>
        <label><input type="checkbox" checked={audio} onChange={e => { setAudio(e.target.checked); configureRewardSounds(e.target.checked ? 'yes' : 'no', false); if (e.target.checked) unlockRewardAudio() }} />Enable sample audio</label>
        <label>Audio volume · {volume}%<input aria-label="Audio volume" type="range" min="0" max="100" step="5" value={volume} onChange={e => setVolume(Number(e.target.value))} /></label>
      </div>
      <div className="lab-grid"><article><h3>Full evidence card</h3><div ref={card}>{badge}</div><p>{soundPattern({ kind: 'xp', xp }).length} notes in the current sound pattern. Larger tiers rise in pitch; they do not increase volume.</p><button className="btn" onClick={replay}>Replay sample</button> <button className="btn" onClick={() => setOpen(true)}>Inspect sample</button><p role="status">{status}</p></article>
      <article><h3>Compact dock variant</h3><div className="reward-inspection-card">{badge}<p className="reward-rationale">The same evidence in a smaller inspection area.</p><small className="reward-credit-note">XP is practice credit, not a proficiency score.</small></div><h3>Pending and no-new-credit states</h3><p>Pending: evidence is still being evaluated.</p><p>No new credit: keep the evidence available without a new-credit celebration.</p><small>These state labels are discussion proposals, not new app behavior.</small></article></div>
      {open && <DetailDialog title="Sample reward evidence" onClose={() => setOpen(false)}>{badge}<p>Sample only. No learner records are read or updated.</p><dl><dt>Observation</dt><dd>Described a location</dd><dt>Credit</dt><dd>{xp} XP · {stored ? 'stored' : 'new'}</dd><dt>Meaning</dt><dd>Practice credit; independent of mastery estimates.</dd></dl></DetailDialog>}
    </section>
    <section id="questions"><h2>03 · What to decide</h2><ul><li>Which scripts need a different reading face or scale?</li><li>Should gloss, romanization and pronunciation stay equally prominent?</li><li>How much detail belongs inline versus in an inspection card?</li><li>Are reward tiers distinguishable without being distracting?</li><li>Does static presentation retain the same meaning?</li></ul><p>Native follow-up: glyph/font availability, real reward travel, sound mixing with speech, haptics, touch and screen-reader behavior.</p></section>
  </main>
}
createRoot(document.getElementById('root')!).render(<Explorer />)
