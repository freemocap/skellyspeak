// Mirrors the Rust IR (ir.rs) and orchestrator TurnResult.
export interface Token { text: string; lemma: string; pos: string; gloss: string; }
export interface Feature { key: string; value: string; token_index: number; }
export interface Construction { id: string; token_span: [number, number]; }
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
  id: string; title: string; cefr: string; trigger: Trigger;
  explanation: string; example: string; contrast: string;
}
export interface TurnResult {
  reply: string;
  analysis: FeatureEvent;
  cards: Card[];
  new_words: string[];
}
export interface ChatTurn { role: "user" | "assistant"; text: string; result?: TurnResult; }
