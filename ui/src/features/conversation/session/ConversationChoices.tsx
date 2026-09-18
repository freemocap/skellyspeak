import type { ConversationStartConfig, TopicCard } from '../../../generated/contracts'
import { useI18n } from '../../../components/localization/i18n'
import { DifficultySelect } from './DifficultySelect'

export function ConversationChoices({ value, topics, disabled, onChange, onCustom }: {
  value: ConversationStartConfig; topics: TopicCard[]; disabled: boolean
  onChange: (value: ConversationStartConfig) => void; onCustom: () => void
}) {
  const tr = useI18n()
  return <>
    <label className="start-difficulty">{tr('Difficulty')}<DifficultySelect value={value.difficulty} saving={disabled} onChange={async difficulty => onChange({ ...value, difficulty })} /></label>
    <fieldset className="start-choice-row" disabled={disabled}><legend>{tr('Topic')}</legend>
      <button type="button" className="btn" aria-pressed={!value.direction.topic} onClick={() => onChange({ ...value, direction: { ...value.direction, topic: null } })}>{tr('Partner chooses')}</button>
      {topics.map(topic => <button type="button" className="btn" key={topic.id} aria-pressed={value.direction.topic?.kind === 'builtin' && value.direction.topic.id === topic.id} onClick={() => onChange({ ...value, direction: { ...value.direction, topic: { kind: 'builtin', id: topic.id } } })}>{topic.label}</button>)}
      <button type="button" className="btn" aria-pressed={value.direction.topic?.kind === 'custom'} onClick={onCustom}>{tr('Custom topic')}</button>
    </fieldset>
    <fieldset className="start-choice-row" disabled={disabled}><legend>{tr('Grammar practice')}</legend>
      {(['any', 'past', 'future'] as const).map(timeReference => <button type="button" className="btn" key={timeReference} aria-pressed={value.direction.timeReference === timeReference} onClick={() => onChange({ ...value, direction: { ...value.direction, timeReference } })}>{tr({ any: 'No preference', past: 'Past events', future: 'Future plans' }[timeReference])}</button>)}
    </fieldset>
  </>
}
