import type { Settings } from '../src/types'

export const PREVIEW_SETTINGS: Settings = {
  my_languages: [], target_varieties: {},
  provider_mode: 'hosted',

  hosted_email: 'me@example.com',


  custom_base_url: '',

  custom_model: '',

  standard_model: 'google/gemini-2.5-flash',
  observer_model: null,
  target_language: 'spanish',
  target_variety: '',
  native_language: 'english', native_variety: 'english-united-states', interface_locale: 'english',
  microphone_device_id: null,
  auto_speak: false,
  auto_send: false,
  always_romanize: false,
  auto_translate: false,
  always_pronunciation: false,
  text_size: 100,
  text_spacing: 2,
  fast_mode: true, reward_sounds: 'follow_tts',
  master_volume: 100, voice_volume: 100, effects_volume: 100,
  tts_rate: 1,
  shortcuts: { mic: 'ctrl+m', speak: 'ctrl+l', panel: 'ctrl+b', settings: 'ctrl+,' },
}
