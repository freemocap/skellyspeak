import { invoke } from './tauri'
export interface TopicNote { explanation: string; example: string; translation: string }
export interface TopicNoteRequest { chatId: string; topic: string; level: string }
type NoteState = { status: 'idle' | 'loading'; note: null; error: null } | { status: 'ready'; note: TopicNote; error: null } | { status: 'error'; note: null; error: string }
const idle: NoteState = { status: 'idle', note: null, error: null }
export function createTopicNotes() {
  const entries = new Map<string, { promise: Promise<TopicNote>; state: NoteState }>()
  const listeners = new Map<string, Set<() => void>>()
  const keyOf = (request: TopicNoteRequest): string => JSON.stringify(request)
  const notify = (key: string): void => { listeners.get(key)?.forEach(listener => listener()) }
  const prune = (): void => {
    for (const [key, entry] of entries) {
      if (entries.size <= 64) return
      if (entry.state.status !== 'loading' && !listeners.get(key)?.size) entries.delete(key)
    }
  }
  return {
    snapshot(request: TopicNoteRequest): NoteState { return entries.get(keyOf(request))?.state ?? idle },
    subscribe(request: TopicNoteRequest, listener: () => void): () => void {
      const key = keyOf(request)
      const group = listeners.get(key) ?? new Set<() => void>()
      group.add(listener); listeners.set(key, group)
      return () => { group.delete(listener); if (!group.size) listeners.delete(key); prune() }
    },
    read(request: TopicNoteRequest): Promise<TopicNote> {
      const key = keyOf(request)
      const existing = entries.get(key)
      if (existing) return existing.promise
      const entry = { promise: invoke<TopicNote>('lesson_topic_note', { ...request }), state: { status: 'loading', note: null, error: null } as NoteState }
      entries.set(key, entry); notify(key)
      void entry.promise.then(note => { entry.state = { status: 'ready', note, error: null }; notify(key); prune() }, (error: unknown) => { entry.state = { status: 'error', note: null, error: String(error) }; notify(key); prune() })
      return entry.promise
    },
    retry(request: TopicNoteRequest): void { const key = keyOf(request); entries.delete(key); notify(key) },
  }
}
