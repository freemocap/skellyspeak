import { useEffect, useRef, useState } from 'react'
import type { ConversationStartConfig, Language, PersonaDetails, PromptPreview, SavedTopic, TopicCard } from '../../../generated/contracts'
import { DetailDialog } from '../../../components/dialogs/DetailDialog'
import { useI18n } from '../../../components/localization/i18n'
import { invoke } from '../../../platform/ipc/native'
import { nativeError } from '../../../platform/ipc/workspace'
import { ConversationChoices } from './ConversationChoices'
import { CustomTopicDialog } from './CustomTopicDialog'
import { difficultyLabel } from './DifficultySelect'

export function ConversationPromptCreator({ conversationId, initial, topics, savedTopics, language, persona, onApply, onClose }: {
  conversationId: string; initial: ConversationStartConfig; topics: TopicCard[]; savedTopics: SavedTopic[]; language: Language; persona: PersonaDetails
  onApply: (value: ConversationStartConfig, additions: string[], deletions: string[]) => Promise<void>; onClose: () => void
}) {
  const tr = useI18n()
  const [draft, setDraft] = useState(initial)
  const [view, setView] = useState<'form' | 'yaml' | 'preview'>('form')
  const [yaml, setYaml] = useState('')
  const [preview, setPreview] = useState<PromptPreview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [pending, setPending] = useState(true)
  const [saving, setSaving] = useState(false)
  const [custom, setCustom] = useState(false)
  const [additions, setAdditions] = useState<string[]>([])
  const [deletions, setDeletions] = useState<string[]>([])
  const generation = useRef(0)
  const request = JSON.stringify(view === 'yaml' ? { yaml, configuration: null } : { configuration: draft, yaml: null })
  useEffect(() => {
    const id = ++generation.current
    setPending(true); setError(null)
    const timer = setTimeout(() => {
      void invoke<PromptPreview>('preview_conversation_prompt', { conversationId, ...JSON.parse(request) }).then(result => {
        if (id !== generation.current) return
        setPreview(result)
        if (view === 'yaml') setDraft(result.configuration)
        else setYaml(result.yaml)
      }).catch(reason => { if (id === generation.current) { setPreview(null); setError(nativeError(reason)) } }).finally(() => { if (id === generation.current) setPending(false) })
    }, 150)
    return () => { clearTimeout(timer); generation.current++ }
  }, [conversationId, request, view])
  const useTopic = (text: string) => { setPending(true); setDraft(value => ({ ...value, direction: { ...value.direction, topic: { kind: 'custom', text } } })) }
  const change = (value: ConversationStartConfig) => { setPending(true); setDraft(value) }
  return <DetailDialog title={tr('Conversation Prompt Creator')} size="wide" onClose={() => { if (!saving) onClose() }}><div className="prompt-creator">
    <h2>{tr('Conversation Prompt Creator')}</h2>
    <div className="prompt-tabs" role="tablist" aria-label={tr('Creator views')}>{(['form', 'yaml', 'preview'] as const).map(tab => <button className="btn" type="button" role="tab" id={`creator-${tab}`} aria-controls={`creator-panel-${tab}`} aria-selected={view === tab} key={tab} disabled={saving || (view === 'yaml' && (pending || !!error)) || (tab === 'yaml' && !preview)} onClick={() => setView(tab)}>{tr({ form: 'Form', yaml: 'YAML', preview: 'Prompt preview' }[tab])}</button>)}</div>
    {error && <p role="alert">{error}</p>}
    {saveError && <p role="alert">{saveError}</p>}
    <section role="tabpanel" id="creator-panel-form" aria-labelledby="creator-form" hidden={view !== 'form'}>
      <label>{tr('Variety')}<select className="field" value={draft.varietyId} disabled={saving} onChange={event => change({ ...draft, varietyId: event.target.value })}>{language.varieties.map(variety => <option value={variety.id} key={variety.id}>{variety.name}</option>)}</select></label>
      <ConversationChoices value={draft} topics={topics} disabled={saving} onChange={change} onCustom={() => setCustom(true)} />
      <label><input type="checkbox" checked={draft.direction.usePersonaDetails} disabled={saving} onChange={event => change({ ...draft, direction: { ...draft.direction, usePersonaDetails: event.target.checked } })} /> {tr('Use persona details')}</label>
      <details><summary>{tr('Persona background')}</summary><pre>{JSON.stringify(persona, null, 2)}</pre></details>
      {draft.direction.topic?.kind === 'custom' && <p className="prompt-topic-summary">{draft.direction.topic.text}</p>}
      <details><summary>{tr('Saved topics')}</summary>{savedTopics.filter(topic => !deletions.includes(topic.id)).map(topic => <div className="prompt-actions" key={topic.id}><button className="btn" disabled={saving} onClick={() => useTopic(topic.text)}>{topic.text}</button><button className="btn" disabled={saving} onClick={() => setDeletions(value => [...value, topic.id])}>{tr('Delete')}</button></div>)}
        {additions.map(text => <div className="prompt-actions" key={text}><button className="btn" disabled={saving} onClick={() => useTopic(text)}>{text} · {tr('Pending save')}</button><button className="btn" disabled={saving} onClick={() => setAdditions(items => items.filter(item => item !== text))}>{tr('Delete')}</button></div>)}
      </details>
      <details><summary>{tr('Compare all difficulty instructions')}</summary>{preview?.difficultyPrompts.map(([level, text]) => <section key={level}><h3>{tr(difficultyLabel(level))}</h3><pre>{text}</pre></section>)}</details>
    </section>
    <section role="tabpanel" id="creator-panel-yaml" aria-labelledby="creator-yaml" hidden={view !== 'yaml'}><label>{tr('Conversation configuration')}<textarea className="field prompt-yaml" spellCheck={false} value={yaml} disabled={saving} onChange={event => { setPending(true); setYaml(event.target.value) }} /></label></section>
    <section role="tabpanel" id="creator-panel-preview" aria-labelledby="creator-preview" hidden={view !== 'preview'}><p>{tr('Opening request preview · no conversation history or model call')}</p>{!pending && preview && <><pre>{preview.systemPrompt}</pre><details><summary>{tr('Request messages')}</summary><pre>{JSON.stringify({ messages: [{ role: 'system', content: preview.systemPrompt }] }, null, 2)}</pre></details></>}</section>
    {pending && <p role="status">{tr('Updating preview…')}</p>}
    <div className="prompt-actions"><button className="btn" disabled={saving} onClick={onClose}>{tr('Cancel')}</button><button className="btn primary" disabled={saving || pending || !preview || !!error} onClick={async () => { setSaving(true); setSaveError(null); try { await onApply(draft, additions, deletions); onClose() } catch (reason) { setSaveError(nativeError(reason)) } finally { setSaving(false) } }}>{tr('Apply')}</button></div>
    {custom && <CustomTopicDialog initial={draft.direction.topic?.kind === 'custom' ? draft.direction.topic.text : ''} onClose={() => setCustom(false)} onUse={async (text, save) => {
      if (save && (additions.includes(text) || savedTopics.some(topic => topic.text === text && !deletions.includes(topic.id)))) throw new Error(tr('This topic is already saved.'))
      useTopic(text); if (save) setAdditions(items => [...items, text])
    }} />}
  </div></DetailDialog>
}
