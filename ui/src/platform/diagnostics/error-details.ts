/** Error prose is diagnostic data. Redact sensitive spans, not the whole error.
 * Callers must label/structure echoed content; arbitrary unlabelled prose cannot
 * reliably be distinguished from an error explanation by a generic scrubber.
 */
const sensitive = /secret|password|authorization|api[_-]?key|access[_-]?token|refresh[_-]?token|cookie|^(?:token|key|content|text|transcript|prompt|messages|input|output|audio|data|arguments|reasoning|request|body|url|email)$/i
const publicField = /^(?:name|message|detail|error|code|type|status|reason|stage|path|expected|function|source_file|id|request_?id|model|requested_model|actual_model|provider|finish_reason|cost_basis|retry_after|stack|componentStack)$/i

export function scrubErrorText(value: string, privateValues: string[] = []): string {
  let text = value
  for (const secret of [...privateValues].filter(Boolean).sort((a, b) => b.length - a.length)) text = text.split(secret).join('[redacted]')
  text = text
    .replace(/-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?(?:-----END [^-]*PRIVATE KEY-----|$)/g, '[redacted: private key]')
    .replace(/\b(?:authorization|api[_-]?key|access[_-]?token|refresh[_-]?token|password|secret|token|cookie)["']?\s*[=:]\s*(?:(?:Bearer|Basic)\s+)?(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi, match => `${match.split(/[=:]/, 1)[0]}=[redacted]`)
    .replace(/\bBearer\s+[^\s,;<>]+/gi, 'Bearer [redacted]')
    .replace(/\b(?:sk-|gsk_)[A-Za-z0-9_-]+|\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[redacted]')
    .replace(/https?:\/\/[^\s<>"')]+/g, '[redacted: URL]')
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|\b[A-Za-z0-9_-]{48,}\b/g, '[redacted]')
    .replace(/\b(prompt|transcript|content|request body|response body|input|output)["']?\s*[=:]\s*[^\n]*/gi, '$1=[redacted: content]')
    .replace(/\(reading (["'])([A-Za-z_$][\w$]*)\1\)/g, '(reading property $2)')
    .replace(/["'`]([^"'`\n]*)["'`]/g, (match, value: string) => /^[A-Za-z0-9_/.-]+$/.test(value) && /[_/.-]/.test(value) ? match : '[redacted: quoted value]')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
  return text.length > 4096 ? `${text.slice(0, 4096)}[truncated: string limit]` : text
}

function keys(value: object): string[] {
  try { return Object.keys(value) } catch { return [] }
}

function field(value: unknown, key: string): unknown {
  if (typeof value !== 'object' || value === null) return undefined
  try { return Reflect.get(value, key) } catch { return '[unreadable: property]' }
}

/** Only code locations survive stack URL/path handling, never URL credentials,
 * queries, fragments, absolute home paths or the repeated raw error headline. */
export function errorStack(value: unknown, privateValues: string[] = []): string | undefined {
  if (typeof value !== 'string') return undefined
  const lines = value.split('\n').filter(line => /^\s*at\s|@.*:\d+/.test(line)).slice(0, 32)
  return lines.map(line => scrubErrorText(line.replace(/(?:https?:\/\/|file:\/\/\/|\/)[^\s()]+/g, location => {
    const clean = location.replace(/[?#].*?(?=:\d+(?::\d+)?$|$)/, '')
    const source = /(?:^|\/)((?:src|assets)\/[^?#]*:\d+(?::\d+)?)$/.exec(clean)
    return source?.[1] ?? /[^/]+:\d+(?::\d+)?$/.exec(clean)?.[0] ?? '[redacted: location]'
  }), privateValues)).join('\n') || undefined
}

export function errorDetails(error: unknown, extra: unknown = undefined): Record<string, unknown> {
  const privateValues: string[] = []
  const seen = new WeakSet<object>()
  let collectionBudget = 256
  function collect(value: unknown, depth = 0) {
    if (!value || typeof value !== 'object' || seen.has(value) || depth > 6 || collectionBudget-- <= 0) return
    seen.add(value)
    for (const key of keys(value).slice(0, 64)) {
      const item = field(value, key)
      if (sensitive.test(key) && typeof item === 'string') privateValues.push(item)
      else collect(item, depth + 1)
    }
  }
  collect(error); collect(extra)
  const visited = new WeakSet<object>()
  let budget = 256
  function metadata(value: unknown, key = '', depth = 0): unknown {
    if (depth > 6 || budget-- <= 0) return '[truncated: metadata limit]'
    if (typeof value === 'string') return publicField.test(key) ? scrubErrorText(value, privateValues) : '[redacted: unclassified string]'
    if (value == null || typeof value === 'number' || typeof value === 'boolean') return value
    if (typeof value !== 'object') return '[omitted: unsupported value]'
    if (visited.has(value)) return '[omitted: circular reference]'
    visited.add(value)
    if (Array.isArray(value)) return value.slice(0, 32).map(item => metadata(item, key, depth + 1))
    return Object.fromEntries(keys(value).slice(0, 64).map((name, index) => {
      if (!/^[\w.-]{1,64}$/.test(name) || privateValues.includes(name)) return [`redacted_field_${index}`, '[redacted: field name]']
      return [name, sensitive.test(name) ? '[redacted: content or credential]' : metadata(field(value, name), name, depth + 1)]
    }))
  }
  const causes = new WeakSet<object>()
  function describe(value: unknown, depth = 0): Record<string, unknown> {
    if (depth > 4) return { message: '[truncated: cause limit]' }
    if (value && typeof value === 'object') {
      if (causes.has(value)) return { message: '[omitted: circular cause]' }
      causes.add(value)
    }
    const message = typeof value === 'string' ? value : field(value, 'message')
    const cause = field(value, 'cause')
    return {
      name: typeof field(value, 'name') === 'string' ? scrubErrorText(String(field(value, 'name')), privateValues) : undefined,
      message: typeof message === 'string' ? scrubErrorText(message, privateValues) : '[omitted: no error message]',
      stack: errorStack(field(value, 'stack'), privateValues),
      ...(cause !== undefined ? { cause: describe(cause, depth + 1) } : {}),
    }
  }
  return { ...describe(error), metadata: metadata(field(error, 'diagnostics')), ...(extra !== undefined ? { context: metadata(extra) } : {}), redaction: 'sensitive spans and unclassified fields removed' }
}
