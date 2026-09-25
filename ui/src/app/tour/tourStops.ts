import type { ComponentType } from 'react'
import type { useI18n } from '../../components/localization/i18n'
import { ChatDemo } from './demo/ChatDemo'
import { DrillDemo } from './demo/DrillDemo'
import { ProgressDemo } from './demo/ProgressDemo'
import { AiDemo } from './demo/AiDemo'

export type TourViewId = 'chat' | 'drill' | 'progress' | 'ai'

export interface TourStop {
  key: string
  /// Where this stop's control sits in its view's demo page. One selector: the
  /// demo always has this content, unlike the learner's own, possibly empty, app.
  selector: string
  title: (tr: ReturnType<typeof useI18n>) => string
  text: (tr: ReturnType<typeof useI18n>) => string
}

export interface TourView {
  id: TourViewId
  label: (tr: ReturnType<typeof useI18n>) => string
  Demo: ComponentType
  stops: readonly TourStop[]
}

/// The tour walks a filled-in demo of each surface — the same production
/// components the real app mounts, fed fixed content — rather than the
/// learner's own app, which may have nothing in it yet.
export const TOUR_VIEWS: readonly TourView[] = [
  {
    id: 'chat', label: tr => tr('Chat'), Demo: ChatDemo,
    stops: [
      { key: 'word', selector: '.partner-turn .reading-word',
        title: tr => tr('Tap a word'),
        text: tr => tr('Tap any word in a partner message to see its meaning. Word by word shows every word at once.') },
      { key: 'speak', selector: '.partner-turn .speak-btn',
        title: tr => tr('Play aloud'),
        text: tr => tr('Plays the message in the partner’s voice.') },
      { key: 'tools', selector: '.partner-turn .message-actions',
        title: tr => tr('Translate and Analysis'),
        text: tr => tr('Translate shows the whole message in your language. Analysis explains the grammar and usage in it.') },
      { key: 'record', selector: '.composer .mic',
        title: tr => tr('Reply'),
        text: tr => tr('Type, or press Record and speak. Your recording is transcribed before it is sent.') },
      { key: 'score', selector: '.stream .feedback-badge',
        title: tr => tr('Feedback on your message'),
        text: tr => tr('Grammar and conversation-fit scores for what you wrote. Select it to open the corrections in Coach.') },
      { key: 'coach', selector: '.coach-heading',
        title: tr => tr('Coach'),
        text: tr => tr('Corrections for your last message. Ask the coach about any message, or use Help with this reply for suggestions.') },
      { key: 'deck', selector: '.stream .message-add-drill',
        title: tr => tr('Add to Drill'),
        text: tr => tr('Saves the message as a phrase to practise aloud in Drill. Press again to remove it.') },
      { key: 'progress', selector: '.profile-trigger',
        title: tr => tr('Progress'),
        text: tr => tr('Opens your practice XP and skills.') },
      { key: 'ai', selector: '.connection-state',
        title: tr => tr('AI status'),
        text: tr => tr('Shows whether AI access is connected. Opens the AI panel with every model request for each turn.') },
    ],
  },
  {
    id: 'drill', label: tr => tr('Drill'), Demo: DrillDemo,
    stops: [
      { key: 'phrases', selector: '.drill-rail, .drill-phrase-bar',
        title: tr => tr('Phrases'),
        text: tr => tr('Phrases you added from conversations or typed yourself. Select one to practise.') },
      { key: 'hear', selector: '.drill-reference .drill-play',
        title: tr => tr('Hear it'),
        text: tr => tr('Plays the reference recording. The speed control slows the voice. The spectrogram shows pitch and timing.') },
      { key: 'record', selector: '.drill-dock',
        title: tr => tr('Record a take'),
        text: tr => tr('Say the phrase. Tap, Hold or Auto sets how recording starts and stops.') },
      { key: 'yours', selector: '.drill-media-take .drill-play',
        title: tr => tr('Play yours'),
        text: tr => tr('Plays your take. Its spectrogram sits under the reference for comparison.') },
      { key: 'compare', selector: '.drill-comparison-panel',
        title: tr => tr('Word match'),
        text: tr => tr('The target words against what was heard. Coloured words differ from the target.') },
      { key: 'history', selector: '.drill-progress',
        title: tr => tr('This phrase'),
        text: tr => tr('Scores across your takes and the words that most often differ.') },
    ],
  },
  {
    id: 'progress', label: tr => tr('Progress'), Demo: ProgressDemo,
    stops: [
      { key: 'totals', selector: '.practice-metrics',
        title: tr => tr('Totals'),
        text: tr => tr('Practice XP, saved conversations, recorded attempts and practice dates across all languages.') },
      { key: 'tabs', selector: '.practice-language-tabs',
        title: tr => tr('Languages'),
        text: tr => tr('One tab per language you practise.') },
      { key: 'category', selector: '.practice-overview select',
        title: tr => tr('Category'),
        text: tr => tr('Filters the skills by category.') },
      { key: 'skills', selector: '.skill-list',
        title: tr => tr('Skills'),
        text: tr => tr('XP per skill, from the skills the assessment finds in your messages. Select a skill to see the messages that earned it.') },
    ],
  },
  {
    id: 'ai', label: tr => tr('AI panel'), Demo: AiDemo,
    stops: [
      { key: 'summary', selector: '.ai-view-head',
        title: tr => tr('Activity'),
        text: tr => tr('What is running for the current turn, and how many requests have finished.') },
      { key: 'graph', selector: '.ai-graph',
        title: tr => tr('Requests'),
        text: tr => tr('Each box is one model request. Lines show which results a request waits for.') },
      { key: 'kinds', selector: '.ai-graph',
        title: tr => tr('Three kinds of model'),
        text: tr => tr('Text to text writes replies, glosses, translations, coaching and assessments. Speech to text transcribes your recordings. Text to speech reads messages aloud.') },
      { key: 'details', selector: '.ai-inspector',
        title: tr => tr('Details'),
        text: tr => tr('Model, token counts and timing for the selected request. Expand it to read the exact request and response.') },
    ],
  },
]

export function tourView(id: TourViewId): TourView {
  const view = TOUR_VIEWS.find(item => item.id === id)
  if (!view) throw new Error(`Unknown tour view: ${id}`)
  return view
}
