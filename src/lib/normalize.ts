import type { Profile, TeachingPlan } from '../types'

/// The sentinel a model writes into a REQUIRED text field it has nothing to
/// say for. Mirrors `prompts::NOT_APPLICABLE`.
///
/// Every schema is strict (every field required), so a model with nothing to
/// report has to write *something*. This is the sanctioned something — and it
/// must never reach the learner, who would otherwise read "not applicable" in
/// their own profile.
export const NOT_APPLICABLE = 'not applicable'

function blankSentinel(v: string | null | undefined): string {
  const t = (v ?? '').trim()
  return t.toLowerCase() === NOT_APPLICABLE ? '' : t
}

function dropSentinels(xs: string[] | null | undefined): string[] {
  return (xs ?? []).filter((x) => blankSentinel(x) !== '')
}

// Defensive normalization: plan/profile cross the IPC boundary; a missing
// array must never crash a render. (Born from a real crash — see status.md
// audit B-batch.)
export function normalizeDocs(plan: TeachingPlan, profile: Profile) {
  return {
    plan: {
      session_focus: dropSentinels(plan?.session_focus),
      recurring_errors: plan?.recurring_errors ?? [],
      vocab_recycle: dropSentinels(plan?.vocab_recycle),
      avoid: dropSentinels(plan?.avoid),
      learner_interests: dropSentinels(plan?.learner_interests),
      energy_read: blankSentinel(plan?.energy_read),
      correction_budget: plan?.correction_budget ?? 1,
      taught_ledger: plan?.taught_ledger ?? [],
    },
    profile: {
      about: blankSentinel(profile?.about),
      level_notes: blankSentinel(profile?.level_notes),
      strengths: dropSentinels(profile?.strengths),
      weaknesses: dropSentinels(profile?.weaknesses),
      interests: dropSentinels(profile?.interests),
      long_term_errors: profile?.long_term_errors ?? [],
      sessions: profile?.sessions ?? 0,
    },
  }
}
