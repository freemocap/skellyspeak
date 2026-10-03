import { ProgressCounters } from '../../components/learning/ProgressCounters'
import { ProgressCard } from '../../components/learning/ProgressCard'
import { useOverlayLayer } from '../../components/dialogs/useOverlayLayer'
import { useHoverCard } from '../../components/learning/useHoverCard'
import { LanguageTable, languageCode } from '../../components/learning/LanguageTable'
import { useLanguageTotals } from '../../state/learning/useLanguageTotals'
import { useVisibleEffort } from '../../state/learning/EffortProgressContext'
import { playRewardSound } from '../../platform/audio/reward-sounds'
import { useEffect, useRef, type ReactNode, type RefObject } from 'react'
import { LearningPicker } from '../../features/settings/language/LanguagePickers'
import { useI18n } from '../../components/localization/i18n'
import { ToolbarIcon } from '../../components/controls/ToolbarIcon'
import { useNavigationStore } from '../../state/navigation/navigation'
import { useSettingsStore } from '../../state/settings/settings'
import { useSkillEvidence } from '../../state/learning/useSkillEvidence'
import { Destinations } from './Destinations'
import { SkillRadarGlyph } from '../../components/learning/SkillRadar'
import { holdingBack, languageSkillLevels } from '../../domain/learning/statistics/skill-levels'
import { skillColors } from '../../domain/learning/catalog/skill-domains'
import { ThemeControls } from './ThemeControls'

/** The global bar: the wordmark, the language, then the Practice and Skills
 * destinations, progress, Settings and More. The conversation is home: the
 * wordmark returns to it. Controls that belong to a place live in that place
 * (Conversations in the chat header; the AI status in the chat composer, with
 * AI activity under More everywhere). The theme and palette sit here when the
 * bar has room, and always in Settings.
 * The injected picker supports the local layout fixture; production selection
 * uses the shared settings writer. */
export function TopBar({ languagePicker = <LearningPicker /> }: { languagePicker?: ReactNode }) {
  const tr = useI18n()
  const evidence = useSkillEvidence()
  const effort = useVisibleEffort()
  const counter = useRef<HTMLButtonElement>(null)
  const progressAnchor = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (counter.current && effort.value?.recent.some(award => effort.arrived.includes(award.id) && award.dimension !== 'partner_understood')) playRewardSound({ kind: 'pop' }, counter.current)
  }, [effort.arrived, effort.value])
  // A summary of the language profile: which language, and its XP. There is
  // nothing to show until evidence for the active language has landed.
  const profile = evidence.snapshot ? { target: evidence.snapshot.target, xp: evidence.snapshot.profile.xp } : null
  // The language's skill level: its weakest skill, drawn as the resting radar.
  const levels = evidence.snapshot ? languageSkillLevels(evidence.snapshot) : null
  const savingLanguage = useSettingsStore((state) => state.savingLanguage)
  const included = useSettingsStore((state) => state.settings?.my_languages)
  const totals = useLanguageTotals(evidence.snapshot, effort.value, included)
  const activeRow = totals.rows?.find(row => row.target === profile?.target)
  const overlay = useNavigationStore((state) => state.overlay)
  const goHome = useNavigationStore((state) => state.goHome)
  const showOverlay = useNavigationStore((state) => state.showOverlay)
  const progressCard = useHoverCard(() => showOverlay('profile'))
  return (
    <div className="topbar">
      <button type="button" className="wordmark app-home" aria-label={tr("SkellySpeak home — Chat")} onClick={goHome}>
        <img src="/skellyspeak-logo.png" alt="" width="28" height="28" />
        <span>SkellySpeak</span>
      </button>
      <div className="topbar-language">{languagePicker}</div>
      <div className="topbar-actions">
      <Destinations />
      <ThemeControls />
      {/* Hover (mouse) or a first tap shows the card; pressing while it shows opens the full report. */}
      <div ref={progressAnchor} className="progress-anchor" {...progressCard.anchor}>
        <button ref={counter} type="button" className="profile-trigger progress-trigger" aria-label={tr("Language progress")} aria-haspopup="dialog" aria-expanded={progressCard.open} onClick={progressCard.press}>
          {levels && <span className="skill-level-chip" title={tr('Skill level {value0}', { value0: levels.level })}><SkillRadarGlyph levels={levels} /><strong>{tr('Lv {value0}', { value0: levels.level })}</strong></span>}
          <ProgressCounters xp={profile?.xp ?? null} xpLabel="Language XP" code={activeRow ? languageCode(activeRow) : undefined} global={totals.globalXp} effort={effort.value} effects={effort.effects} error={effort.error ?? totals.error} />
        </button>
        {progressCard.open && <CardLayer anchor={progressAnchor} onClose={progressCard.close}>
          <ProgressCard title={tr("All languages")} icon="globe" xp={totals.globalXp} effort={totals.globalEffort} units={['explorations', 'bot']} error={totals.error} expandLabel="Full report" onExpand={() => { progressCard.close(); showOverlay('profile') }}>
            {levels && <div className="progress-card-levels">
              <SkillRadarGlyph levels={levels} />
              <div>
                <strong>{tr('Skill level {value0}', { value0: levels.level })}</strong>
                <span>{levels.level === 0 && levels.ready === 0 ? tr('Get a skill point in each skill to reach level 1.') : tr('{value0} of {value1} skills at {value2} points for level {value3}', { value0: levels.ready, value1: levels.skills.length, value2: levels.target, value3: levels.level + 1 })}</span>
                <ul>{holdingBack(levels).slice(0, 3).map(({ skill, needed }) => <li key={skill.id} style={{ color: skillColors(skill.id).ink }}>{tr(skill.label)}<span>{tr('{value0} more', { value0: needed })}</span></li>)}</ul>
              </div>
            </div>}
            {totals.rows ? <LanguageTable rows={totals.rows} active={profile?.target} compact /> : <p role="status" className="progress-card-empty">{tr('Loading…')}</p>}
          </ProgressCard>
        </CardLayer>}
      </div>

      {/* App-wide settings. The conversation's own settings open from the chat
          header, so this one carries its name to keep the two apart. On a
          phone it moves into More, where there is room for its label. */}
      <button
        type="button"
        className="gear app-settings"
        onClick={() => showOverlay('settings')}
        disabled={savingLanguage}
        aria-label={tr("Settings")}
        title={tr("Settings")}
      >
        <ToolbarIcon name="cog" /><span>{tr("Settings")}</span>
      </button>
      <button type="button" className="gear" aria-label={tr("More")} aria-expanded={overlay === 'more'} onClick={() => showOverlay('more')}><ToolbarIcon name="more" size={18} /></button>

      </div>
    </div>
  )
}

/** Closes on Escape or an outside press; the anchor holds the button, so pressing it again reaches its handler. */
function CardLayer({ anchor, onClose, children }: { anchor: RefObject<HTMLDivElement | null>; onClose: () => void; children: ReactNode }) {
  useOverlayLayer(anchor, onClose, true)
  return children
}
