import { CoachChoices } from './CoachChoices'
import type { ConversationStartConfig, TopicCard } from '../../../generated/contracts'
import { useI18n } from '../../../components/localization/i18n'
import { DifficultySelect } from '../../../components/controls/DifficultySelect'

/// The optional choices on an empty conversation: which scene to open in, and
/// the two settings that shape the opening.
///
/// On the starter, topics begin an exchange. The detailed editor instead uses
/// them to configure its draft. Difficulty and grammar always update the draft.
export function ConversationChoices({ conversationId, value, topics, disabled, targetTag, targetDir, onChange, onCustom, onChooseTopic, topicsDisabled = disabled }: {
  conversationId?: string
  value: ConversationStartConfig; topics: TopicCard[]; disabled: boolean
  /// The target language's tag and direction. A card names its scene in the
  /// target language and again in the explanation language, so each run carries
  /// its own language and direction rather than inheriting the interface's.
  targetTag?: string; targetDir?: string
  topicsDisabled?: boolean
  onChooseTopic?: (value: ConversationStartConfig) => void
  onChange: (value: ConversationStartConfig) => void; onCustom: () => void
}) {
  const tr = useI18n()
  const choose = (topic: ConversationStartConfig['direction']['topic']) =>
    (onChooseTopic ?? onChange)({ ...value, direction: { ...value.direction, topic, usePersonaDetails: topic === null ? true : value.direction.usePersonaDetails } })
  return <>
    <CoachChoices conversationId={conversationId} configuration={value} selected={value.direction.topic?.kind === 'coach' ? value.direction.topic.mode : value.direction.topic === null ? null : undefined} disabled={topicsDisabled} onChoose={mode => choose(mode ? { kind: 'coach', mode } : null)} />
    <fieldset className="start-scenes" disabled={topicsDisabled}><legend>{tr('Topic')}</legend>
      <div className="scene-grid">
        {topics.map(topic => <button type="button" className="scene-card" key={topic.id}
          aria-pressed={onChooseTopic ? undefined : value.direction.topic?.kind === 'builtin' && value.direction.topic.id === topic.id}
          onClick={() => choose({ kind: 'builtin', id: topic.id })}>
          <span className="scene-glyph" aria-hidden="true">{topic.glyph}</span>
          <span className="scene-label"><bdi lang={targetTag} dir={targetDir}>{topic.target}</bdi></span>
          {/* Romanization is Latin whatever the surrounding script, so it states
              its direction rather than inferring one: a leading modifier letter
              such as ʿ is not a strong character and would inherit RTL. */}
          {topic.romanized && <span className="scene-roman"><bdi dir="ltr">{topic.romanized}</bdi></span>}
          {topic.translation !== topic.target && <span className="scene-translation">{topic.translation}</span>}
        </button>)}
        <button type="button" className="scene-card" aria-pressed={value.direction.topic?.kind === 'custom'} onClick={onCustom}>
          <span className="scene-glyph" aria-hidden="true">✎</span>
          <span className="scene-label">{tr('Custom topic')}</span>
        </button>
      </div>
    </fieldset>
    <div className="start-controls">
      <label className="start-difficulty">{tr('Difficulty')}<DifficultySelect value={value.difficulty} saving={disabled} onChange={async difficulty => onChange({ ...value, difficulty })} /></label>
      <fieldset className="start-choice-row" disabled={disabled}><legend>{tr('Grammar practice')}</legend>
        {(['any', 'past', 'future'] as const).map(timeReference => <button type="button" className="btn" key={timeReference} aria-pressed={value.direction.timeReference === timeReference} onClick={() => onChange({ ...value, direction: { ...value.direction, timeReference } })}>{tr({ any: 'No preference', past: 'Past events', future: 'Future plans' }[timeReference])}</button>)}
      </fieldset>
    </div>
  </>
}
