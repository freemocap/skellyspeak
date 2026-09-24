/** An illustrative shape, not a validator or runtime prompt composer. */
export interface SchemaPreview { fields: {path: string; presence: string; type: string}[]; sample: unknown; notes: string[] }
export function schemaPreview(root: any): SchemaPreview {
  const fields: SchemaPreview['fields'] = []
  const notes = new Set<string>(['Illustrative instance with placeholders. Not validated content or a composed runtime prompt. Optional keys are included; arrays show one illustrative item.'])
  function visit(schema: any, path: string, presence: string, refs: string[], depth: number): unknown {
    if (depth > 16) { notes.add('Deep structures are truncated after 16 levels.'); return '<depth limit>' }
    if (schema === false) return '<not allowed>'
    if (schema === true || !schema || typeof schema !== 'object') return '<any value>'
    if (schema.$ref) {
      const ref = String(schema.$ref)
      if (!ref.startsWith('#/')) { notes.add(`External reference not loaded: ${ref}`); return `<reference: ${ref}>` }
      if (refs.includes(ref)) { notes.add(`Recursive reference shown once: ${ref}`); return `<recursive: ${ref}>` }
      const resolved = ref.slice(2).split('/').map(s => s.replaceAll('~1','/').replaceAll('~0','~')).reduce((o, k) => o?.[k], root)
      if (!resolved) { notes.add(`Unresolved reference: ${ref}`); return `<unresolved: ${ref}>` }
      return visit({...resolved, ...Object.fromEntries(Object.entries(schema).filter(([key]) => key !== '$ref'))}, path, presence, [...refs, ref], depth + 1)
    }
    const alternatives = schema.oneOf ?? schema.anyOf
    if (alternatives) {
      notes.add(`${path}: ${alternatives.length} alternatives; the specimen displays the first non-null alternative. Inspect source/tree for all branches.`)
      const selected = alternatives.find((s: any) => s.type !== 'null') ?? alternatives[0]
      return visit(selected, path, presence, refs, depth + 1)
    }
    if (schema.allOf) {
      notes.add(`${path}: allOf constraints apply together; specimen merges object shapes only.`)
      const pieces = schema.allOf.map((s: any) => visit(s, path, presence, refs, depth + 1))
      return Object.assign({}, ...pieces.filter((v: unknown) => v && typeof v === 'object' && !Array.isArray(v)))
    }
    const types = Array.isArray(schema.type) ? schema.type : [schema.type ?? (schema.properties ? 'object' : 'unspecified')]
    const type = types.find((t: string) => t !== 'null') ?? 'null'
    fields.push({path, presence, type: schema.enum ? `enum: ${schema.enum.map(String).join(' | ')}` : types.join(' | ')})
    if (schema.const !== undefined) return schema.const
    if (schema.default !== undefined) return schema.default
    if (schema.enum) return schema.enum[0]
    if (type === 'object') {
      const output: Record<string, unknown> = {}
      for (const [key, child] of Object.entries(schema.properties ?? {})) output[key] = visit(child, `${path}.${key}`, schema.required?.includes(key) ? 'required' : 'optional', refs, depth + 1)
      if (schema.additionalProperties && typeof schema.additionalProperties === 'object') output['<key>'] = visit(schema.additionalProperties, `${path}.<key>`, 'map entry', refs, depth + 1)
      return output
    }
    if (type === 'array') return [visit(Array.isArray(schema.items) ? schema.items[0] : schema.items, `${path}[]`, 'example item', refs, depth + 1)]
    if (type === 'null') return null
    return `<${type}>`
  }
  return {sample: visit(root, '$', 'root', [], 0), fields, notes: [...notes]}
}
