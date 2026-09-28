import { DIFFICULTY_LEVELS, type ConversationStartConfig, type RecommendationMode, type TimeReference, type TopicCard, type TopicChoice } from '../../../generated/contracts'
import { difficultyLabel } from '../../../components/controls/DifficultySelect'
import { SegmentedChoice } from '../../../components/controls/SegmentedChoice'
import { InfoTip } from '../../../components/controls/InfoTip'
import { ToolbarIcon } from '../../../components/controls/ToolbarIcon'
import { useI18n } from '../../../components/localization/i18n'
import { messageKey } from '../../../domain/localization'
import { CoachIntentTip } from './CoachIntentTip'

type Translate = ReturnType<typeof useI18n>

export const TIME_FRAME_LABELS = {
  any: messageKey('Any time'),
  past: messageKey('Past events'),
  future: messageKey('Future plans'),
} as const satisfies Record<TimeReference, string>

export const SKILL_FOCUS_LABELS = {
  explore: messageKey('Explore'),
  continuePracticing: messageKey('Continue practicing'),
  coachChoice: messageKey('Coach’s choice'),
} as const satisfies Record<RecommendationMode, string>

/** The skill focus a configuration carries, if any. It shares the topic slot:
 * with a focus the partner chooses the scene around the skill. */
export function skillFocusOf(value: ConversationStartConfig): RecommendationMode | null {
  return value.direction.topic?.kind === 'coach' ? value.direction.topic.mode : null
}

/** The options on one line, as the folded Options row shows them. */
export function startOptionsSummary(tr: Translate, value: ConversationStartConfig): string {
  const focus = skillFocusOf(value)
  return [tr(difficultyLabel(value.difficulty)), tr(TIME_FRAME_LABELS[value.direction.timeReference]), focus && tr(SKILL_FOCUS_LABELS[focus])]
    .filter(Boolean).join(' · ')
}

function withTopic(value: ConversationStartConfig, topic: TopicChoice | null): ConversationStartConfig {
  // Leaving the scene to the partner always lets them draw on who they are.
  return { ...value, direction: { ...value.direction, topic, usePersonaDetails: topic === null ? true : value.direction.usePersonaDetails } }
}

/// What the conversation is about, as the Prompt Creator configures it: choosing
/// only selects, for the configuration it applies. (The start card's topics start
/// the conversation instead.) The partner choosing is the default, and a skill
/// focus leaves the scene to the partner too, so it shows here as the partner's
/// choice. Your own topic opens its dialog.
export function TopicChoices({ value, topics, partnerName, disabled, targetTag, targetDir, onChange, onCustom }: {
  value: ConversationStartConfig; topics: TopicCard[]; partnerName: string; disabled: boolean
  /// The target language's tag and direction. A chip names its scene in the
  /// target language and again in the explanation language, so each run carries
  /// its own language and direction rather than inheriting the interface's.
  targetTag?: string; targetDir?: string
  onChange: (value: ConversationStartConfig) => void; onCustom: () => void
}) {
  const tr = useI18n()
  const topic = value.direction.topic
  const partnerChooses = topic === null || topic.kind === 'coach'
  return <fieldset className="start-topics" disabled={disabled}>
    <legend>{tr('Topic')}</legend>
    <div className="topic-chips">
      <button type="button" className="topic-chip" aria-pressed={partnerChooses} onClick={() => { if (!partnerChooses) onChange(withTopic(value, null)) }}>
        <span className="topic-chip-label">{tr('{name} chooses', { name: partnerName })}</span></button>
      {topics.map(item => <button type="button" className="topic-chip" key={item.id} aria-pressed={topic?.kind === 'builtin' && topic.id === item.id}
        onClick={() => onChange(withTopic(value, { kind: 'builtin', id: item.id }))}>
        <span className="topic-chip-target target-word"><bdi lang={targetTag} dir={targetDir}>{item.target}</bdi></span>
        {/* Romanization is Latin whatever the surrounding script, so it states
            its direction rather than inferring one: a leading modifier letter
            such as ʿ is not a strong character and would inherit RTL. */}
        {item.romanized && <span className="topic-chip-roman"><bdi dir="ltr">{item.romanized}</bdi></span>}
        {item.translation !== item.target && <span className="topic-chip-translation">{item.translation}</span>}
      </button>)}
      <button type="button" className="topic-chip" aria-pressed={topic?.kind === 'custom'} aria-haspopup="dialog" onClick={onCustom}>
        {topic?.kind === 'custom'
          ? <span className="topic-chip-target"><bdi>{topic.text}</bdi></span>
          : <span className="topic-chip-label"><ToolbarIcon name="plus" size={14} />{tr('Your own topic')}</span>}
      </button>
    </div>
  </fieldset>
}

/// The settings that shape the opening: difficulty, the time frame and the skill
/// focus, each a segmented choice, then a skill of the learner's choosing. The
/// focus chooses from recorded experience, so where there is none yet it stays
/// hidden unless a focus is already set.
export function StartOptions({ conversationId, value, disabled, skillFocus, onChange }: {
  conversationId?: string; value: ConversationStartConfig; disabled: boolean; skillFocus: boolean
  onChange: (value: ConversationStartConfig) => void
}) {
  const tr = useI18n()
  const focus = skillFocusOf(value)
  return <div className="start-options-rows">
    <span className="start-option-label">{tr('Difficulty')}</span>
    <SegmentedChoice label={tr('Difficulty')} value={value.difficulty} disabled={disabled}
      options={DIFFICULTY_LEVELS.map(level => [level, tr(difficultyLabel(level))] as const)} onChange={difficulty => onChange({ ...value, difficulty })} />
    <span className="start-option-label">{tr('Time frame')}</span>
    <SegmentedChoice label={tr('Time frame')} value={value.direction.timeReference} disabled={disabled}
      options={(['any', 'past', 'future'] as const).map(time => [time, tr(TIME_FRAME_LABELS[time])] as const)}
      onChange={timeReference => onChange({ ...value, direction: { ...value.direction, timeReference } })} />
    {(skillFocus || focus) && <>
      <span className="start-option-label">{tr('Skill focus')}{' '}
        {conversationId ? <CoachIntentTip conversationId={conversationId} configuration={value} />
          : <InfoTip>{tr('Choose from recorded experience and retry effort, not correctness.')} {tr('Explore uses skills with little recorded experience. Continue practicing uses skills with retry effort. Coach’s choice mixes both.')}</InfoTip>}</span>
      <SegmentedChoice label={tr('Skill focus')} value={focus ?? 'none'} disabled={disabled}
        options={[['none', tr('No focus')] as const, ...(['explore', 'continuePracticing', 'coachChoice'] as const).map(mode => [mode, tr(SKILL_FOCUS_LABELS[mode])] as const)]}
        onChange={mode => { if (mode !== (focus ?? 'none')) onChange(withTopic(value, mode === 'none' ? null : { kind: 'coach', mode })) }} />
    </>}
    {/* Coming soon: a skill the learner picks, as Practice's Add practice cards
        offers. BACKEND: a conversation cannot carry one yet. The direction needs
        a practice target of its own, separate from the topic and shaped like
        DrillSkillTarget ({ kind: 'coach', mode } | { kind: 'skill', skillId }),
        and recommendations::capture must resolve a chosen skill the way
        drill/skill_focus.rs::capture does. Then this select loads the skill
        catalog as DrillSkillSelection does and is enabled; the skill focus above
        moves into the same target, and a topic start keeps it. See
        docs/notes/ux-design-pass/01-first-run.md. */}
    <span className="start-option-label">{tr('Skill')}</span>
    <span className="start-option-soon" title={tr('Coming soon')}>
      <select className="field" aria-label={tr('Skill')} aria-description={tr('Coming soon')} value="" disabled>
        <option value="">{tr('Any skill')}</option>
      </select>
    </span>
  </div>
}
