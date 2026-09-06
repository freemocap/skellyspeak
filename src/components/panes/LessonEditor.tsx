import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { LessonChoices, LessonState } from '../../types'
import { openOverlay } from '../../lib/back'

export type LessonSaveResult = { lesson: LessonState } | { error: string }
type Draft = { goal: string; preferences: string; budget: string }

function draftFrom(choices: LessonChoices): Draft {
  return { goal: choices.goal, preferences: choices.preferences.join('\n'), budget: String(choices.correction_budget ?? 'auto') }
}
function choicesFrom(draft: Draft): LessonChoices {
  const preferences = draft.preferences.split('\n').map((p) => p.trim()).filter(Boolean)
  if (preferences.length > 10 || preferences.some((p) => p.length > 256)) {
    throw new Error('Use up to 10 preferences, each no longer than 256 characters.')
  }
  return { goal: draft.goal.trim(), preferences, correction_budget: draft.budget === 'auto' ? null : Number(draft.budget) }
}

export function LessonEditor({ lesson, onSave, onClose }: {
  lesson: LessonState
  onSave: (choices: LessonChoices, revision: number) => Promise<LessonSaveResult>
  onClose: () => void
}) {
  const [draft, setDraft] = useState<Draft>(() => draftFrom(lesson.choices))
  const [status, setStatus] = useState('All changes saved')
  const [error, setError] = useState<string | null>(null)
  const [closing, setClosing] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)
  const desired = useRef(draft)
  const saved = useRef(lesson)
  const failed = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const running = useRef<Promise<boolean> | null>(null)
  const saveRef = useRef(onSave)
  saveRef.current = onSave

  const flush = (): Promise<boolean> => {
    if (timer.current) clearTimeout(timer.current)
    if (running.current) return running.current
    if (failed.current) return Promise.resolve(false)
    const work = async (): Promise<boolean> => {
      try {
        while (true) {
          const choices = choicesFrom(desired.current)
          if (JSON.stringify(choices) === JSON.stringify(saved.current.choices)) {
            setStatus('All changes saved')
            return true
          }
          setStatus('Saving…')
          const result = await saveRef.current(choices, saved.current.revision)
          if ('error' in result) throw new Error(result.error)
          saved.current = result.lesson
        }
      } catch (failure) {
        failed.current = true
        setError(String(failure).replace(/^Error:\s*/, ''))
        setStatus('Changes not saved')
        return false
      }
    }
    running.current = work().finally(() => { running.current = null })
    return running.current
  }
  const dismiss = async (): Promise<void> => {
    setClosing(true)
    if (await flush()) { dialog.current?.close(); onClose() }
    else setClosing(false)
  }
  const dismissRef = useRef(dismiss)
  dismissRef.current = dismiss
  useEffect(() => {
    dialog.current?.showModal()
    const release = openOverlay(() => { void dismissRef.current() })
    return () => { release(); if (timer.current) clearTimeout(timer.current) }
  }, [])

  const edit = (next: Draft): void => {
    desired.current = next; setDraft(next); setError(null); failed.current = false
    setStatus('Unsaved changes')
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => { void flush() }, 450)
  }
  return createPortal(<dialog ref={dialog} className="lesson-editor-dialog" aria-labelledby="lesson-editor-title"
    onCancel={(event) => { event.preventDefault(); void dismiss() }}
    onClick={(event) => { if (event.target === event.currentTarget) void dismiss() }}>
    <div className="lesson-editor-body">
      <div className="lesson-heading"><h2 id="lesson-editor-title">Edit your lesson</h2><button type="button" className="lesson-action" aria-label="Close lesson editor" disabled={closing} onClick={() => { void dismiss() }}>✕</button></div>
      <p className="lesson-meta">Changes save automatically. Close this window or click outside when you’re done.</p>
      <div className="lesson-editor">
        <label>Your learning goal<textarea autoFocus maxLength={600} value={draft.goal} disabled={closing} onChange={(e) => edit({ ...draft, goal: e.target.value })} /></label>
        <label>Preferences &amp; memory corrections<textarea value={draft.preferences} disabled={closing} placeholder="One per line, up to 10. For example: I already know basic greetings." onChange={(e) => edit({ ...draft, preferences: e.target.value })} /></label>
        <label>Corrections per partner reply<select value={draft.budget} disabled={closing} onChange={(e) => edit({ ...draft, budget: e.target.value })}><option value="auto">Automatic</option><option value="0">None</option><option value="1">Up to one</option><option value="2">Up to two</option></select></label>
        <p className="lesson-meta">This controls partner recasts. Feedback on your messages remains available.</p>
      </div>
      {error && <div role="alert" className="lesson-save-error"><p>{error}</p><p>Your unsaved text is still here. Correct it or reload the saved version.</p><button type="button" className="lesson-action" onClick={() => {
        if (timer.current) clearTimeout(timer.current)
        saved.current = lesson; desired.current = draftFrom(lesson.choices); setDraft(desired.current)
        failed.current = false; setError(null); setStatus('All changes saved')
      }}>Reload saved version</button></div>}
      <div className="lesson-editor-footer"><span role="status" className="lesson-meta">{status}</span><button type="button" className="lesson-action" disabled={closing} onClick={() => { void dismiss() }}>Done</button></div>
    </div>
  </dialog>, document.body)
}
