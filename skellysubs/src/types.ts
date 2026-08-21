export interface TutorReply {
  reply: string;
  target_phrase: string | null;
  romanization: string | null;
  explanation: string | null;
}

export interface Token {
  text: string;
  lemma: string;
  pos: string;
  gloss: string;
}

export interface Feature {
  key: string;
  value: string;
  token_index: number;
}

export interface Construction {
  id: string;
  token_span: [number, number];
}

export interface FeatureEvent {
  language: string;
  source_text: string;
  tokens: Token[];
  features: Feature[];
  constructions: Construction[];
}

export type Trigger =
  | { type: "feature"; key: string; value: string }
  | { type: "construction"; id: string };

export interface Card {
  id: string;
  title: string;
  cefr: string;
  trigger: Trigger;
  explanation: string;
  example: string;
  contrast: string;
}

export interface Suggestion {
  es: string;
  en: string;
  note: string;
}

export interface TutorTurn {
  reply: TutorReply;
  analysis: FeatureEvent;
  cards: Card[];
  new_words: string[];
  suggestions: Suggestion[];
}

export interface ChatTurn {
  role: "user" | "assistant";
  text: string;
  reply?: TutorReply;
  turn?: TutorTurn;
}

export interface SttStatus {
  modelId: string;
  downloaded: boolean;
  loaded: boolean;
}

export interface HistoryTurn {
  role: string;
  text: string;
}

export type ProviderMode = "local" | "remote";
export type ApiFormat = "openai" | "anthropic";

export interface ProviderConfig {
  mode: ProviderMode;
  format: ApiFormat;
  baseUrl: string;
  apiKey: string;
  model: string;
}

export type LlmProviderConfig = ProviderConfig;
export type SttProviderConfig = ProviderConfig;

export interface ProviderSettings {
  llm: LlmProviderConfig;
  stt: SttProviderConfig;
}
