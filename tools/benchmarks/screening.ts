// Offline screening helpers. Importing this module reads no files or credentials.
// Only the schema subset present in these fixtures; fail on unsupported keywords.
export function validate(schema: any, value: any): boolean {
  const supported = ['type', 'properties', 'required', 'additionalProperties', 'items', 'oneOf', 'enum', 'minLength', 'maxLength', 'maxItems'];
  for (const key of Object.keys(schema)) if (!supported.includes(key)) throw new Error(`Unsupported schema keyword ${key}`);
  if (schema.oneOf) return schema.oneOf.filter((s: any) => validate(s, value)).length === 1;
  if (schema.enum && !schema.enum.includes(value)) return false;
  const type = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
  if (schema.type && ![schema.type].flat().includes(type)) return false;
  if (type === 'string') return [...value].length >= (schema.minLength ?? 0) && [...value].length <= (schema.maxLength ?? Infinity);
  if (type === 'array') return value.length <= (schema.maxItems ?? Infinity) && value.every((v: any) => validate(schema.items, v));
  if (type === 'object') return (schema.required ?? []).every((k: string) => k in value)
    && Object.keys(value).every(k => schema.properties[k] ? validate(schema.properties[k], value[k]) : schema.additionalProperties !== false);
  return true;
}
export function checks(f: any, content: string): string[] {
  const errors: string[] = [];
  if (!content.trim()) return ['empty'];
  if (!f.schema) return errors; // Conversation semantics require separate review.
  let data: any;
  try { data = JSON.parse(content); } catch { return ['json']; }
  if (!validate(f.schema, data)) return ['schema'];
  if (f.task === 'reaction' && !f.expected.includes(data.kind)) errors.push('reaction-meaning');
  if (f.task === 'coach') {
    const ids = new Set();
    for (const item of data.items) {
      if (!f.source.includes(item.quote)) errors.push('quote-not-in-source');
      if (ids.has(item.construct)) errors.push('duplicate-construct');
      ids.add(item.construct);
      if (/the learner|the speaker|try again/i.test(item.rationale)) errors.push('coach-voice');
      if (item.error) for (const key of ['hint','elicitation','metalinguistic']) {
        if (item.error[key].toLowerCase().includes(item.error.target_hypothesis.toLowerCase())) errors.push('hidden-answer-leak');
      }
    }
    if (f.id === 'coach-clear' && data.items.some((i: any) => i.error)) errors.push('invented-error');
  }
  if (f.task === 'gloss') {
    // Native IDs encode UTF-16 starts, not grapheme ordinals. Use the ordered
    // source-bound enum when present (also supports historical unpadded IDs).
    const ids: string[] = f.schema.properties.spans.items.oneOf[0].properties.first.enum
      ?? [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(f.source)]
        .map(row => `g${row.index.toString().padStart(4, '0')}`);
    let next = 0;
    for (const span of data.spans) {
      const first = ids.indexOf(span.first), last = ids.indexOf(span.last);
      if (first < 0 || last < 0 || first !== next || last < first) errors.push('span-coverage');
      next = last + 1;
      if (f.forbiddenStarts?.includes(first)) errors.push('arabic-word-split');
    }
    if (next !== ids.length) errors.push('span-coverage');
  }
  return errors;
}
