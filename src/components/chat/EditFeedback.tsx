import type { CoachFeedback } from '../../types'
import { CoachEntry } from '../panes/CoachEntry'

export function EditFeedback({ id, feedback, error, reviewing, targetLangCode, nativeLangCode }: {
  id: number; feedback: CoachFeedback | undefined; error: string | undefined
  reviewing: boolean; targetLangCode: string; nativeLangCode: string
}) {
  return <details className="edit-feedback" open>
    <summary>Coach feedback <span>for your original attempt</span></summary>
    <div className="edit-feedback-body" role="region" aria-label="Coach feedback while editing" tabIndex={0}>
      {feedback || error ? <CoachEntry turn={{ id, user: null, coach: feedback, coachError: error }} targetLangCode={targetLangCode} nativeLangCode={nativeLangCode} /> : <p>{reviewing ? 'The coach is still reviewing this attempt.' : 'No feedback was saved for this attempt.'}</p>}
    </div>
  </details>
}
