// Groq cannot disambiguate our first/last enums alongside the kind enum.
// For alternatives with disjoint kind values, oneOf and anyOf are equivalent.
export function groqSchema(source: any): any {
  if (Array.isArray(source)) return source.map(groqSchema);
  if (source === null || typeof source !== 'object') return source;
  const result: any = Object.fromEntries(Object.entries(source).map(([k, v]) => [k, groqSchema(v)]));
  if (result.oneOf) {
    const seen = new Set();
    for (const branch of result.oneOf) {
      const kinds = branch.properties?.kind?.enum;
      if (!branch.required?.includes('kind') || !Array.isArray(kinds) || !kinds.length) throw new Error('Union is not provably disjoint');
      for (const kind of kinds) {
        if (seen.has(kind)) throw new Error('Union alternatives overlap');
        seen.add(kind);
      }
    }
    result.anyOf = result.oneOf;
    delete result.oneOf;
  }
  return result;
}

// The provider enforces shape; the app's unchanged decoder binds IDs to source.
// Relax only endpoint enums inside the known gloss union, retaining kind tags.
export function groqGlossShape(source: any): any {
  const result = structuredClone(source);
  const variants = result.properties?.spans?.items?.oneOf;
  if (!Array.isArray(variants) || variants.length !== 2) throw new Error('Unexpected gloss schema');
  const kinds = variants.map((v: any) => v.properties?.kind?.enum?.[0]).sort();
  if (JSON.stringify(kinds) !== '["gloss","literal"]') throw new Error('Unexpected gloss kinds');
  for (const variant of variants) for (const key of ['first', 'last']) {
    const endpoint = variant.properties[key];
    if (endpoint?.type !== 'string' || Object.keys(endpoint).some(k => !['type', 'enum'].includes(k))) throw new Error('Unexpected source endpoint schema');
    variant.properties[key] = { type: 'string' };
  }
  return result;
}
