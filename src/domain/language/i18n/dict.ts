/// One locale's flat key-to-text map. English is the source of truth;
/// the i18n test checks the others against it.
export type Dict = Record<string, string>
