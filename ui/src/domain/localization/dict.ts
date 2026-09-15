/** Each plural category is authored explicitly; no English or category fallback. */
export type PluralMessage = Record<Intl.LDMLPluralRule, string>
export type Message = string | PluralMessage
export type Dict = Record<string, Message>
