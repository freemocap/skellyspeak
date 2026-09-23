/** Error prose is diagnostic data. Redact sensitive spans, not the whole error.
 * Callers must label/structure echoed content; arbitrary unlabelled prose cannot
 * reliably be distinguished from an error explanation by a generic scrubber.
 */
import { diagnosticPolicy as policy } from '../../generated/diagnostic-policy'
const isSecret = (key: string) => (policy.secretFields as readonly string[]).includes(key.toLowerCase()) || policy.secretFieldFragments.some(part => key.toLowerCase().includes(part))
const sensitive = { test: (key: string) => isSecret(key) || (policy.contentFields as readonly string[]).includes(key.toLowerCase()) }
const publicField = { test: (key: string) => policy.publicFields.some(field => field.toLowerCase() === key.toLowerCase()) }
const rules = policy.rules.map(rule => ({ ...rule, regex: new RegExp(rule.pattern, `${rule.flags}g`) }))
export function scrubErrorText(value: string, privateValues: string[] = []): string {
  let text = value
  for (const rule of rules.filter(rule => rule.kind === 'secret')) text = text.replace(rule.regex, ('prefix' in rule && rule.prefix ? '$1' : '') + policy.secretTag)
  for (const content of [...privateValues].filter(Boolean).sort((a, b) => b.length - a.length)) text = text.split(content).join(policy.contentTag)
  for (const rule of rules.filter(rule => rule.kind !== 'secret')) text = text.replace(rule.regex, ('prefix' in rule && rule.prefix ? '$1' : '') + policy.contentTag)
  text = text.replace(/\(reading (["'])([A-Za-z_$][\w$]*)\1\)/g, '(reading property $2)').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
  return text.length > policy.limits.string ? `${text.slice(0, policy.limits.string)}[truncated: string limit]` : text
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
    if (!value || typeof value !== 'object' || seen.has(value) || depth > policy.limits.depth || collectionBudget-- <= 0) return
    seen.add(value)
    for (const key of keys(value).slice(0, 64)) {
      const item = field(value, key)
      if (sensitive.test(key) && typeof item === 'string') privateValues.push(item)
      else collect(item, depth + 1)
    }
  }
  collect(error); collect(extra)
  const visited = new WeakSet<object>()
  let budget = policy.limits.nodes as number
  function metadata(value: unknown, key = '', depth = 0): unknown {
    if (depth > policy.limits.depth || budget-- <= 0) return '[truncated: metadata limit]'
    if (typeof value === 'string') return publicField.test(key) ? scrubErrorText(value, privateValues) : policy.contentTag
    if (value == null || typeof value === 'number' || typeof value === 'boolean') return value
    if (typeof value !== 'object') return '[omitted: unsupported value]'
    if (visited.has(value)) return '[omitted: circular reference]'
    visited.add(value)
    if (Array.isArray(value)) {
      const items = value.slice(0, policy.limits.array).map(item => metadata(item, key, depth + 1))
      if (value.length > policy.limits.array) items.push({ truncated_items: value.length - policy.limits.array })
      return items
    }
    const names = keys(value).sort((a, b) => Number(!['error', 'message', 'code', 'reason', 'stage', 'diagnostics', 'cause'].includes(a)) - Number(!['error', 'message', 'code', 'reason', 'stage', 'diagnostics', 'cause'].includes(b)))
    const result = Object.fromEntries(names.slice(0, policy.limits.fields).map((name, index) => {
      if (!/^[\w.-]{1,64}$/.test(name) || privateValues.includes(name)) return [`redacted_field_${index}`, policy.contentTag]
      return [name, sensitive.test(name) ? (isSecret(name) ? policy.secretTag : policy.contentTag) : metadata(field(value, name), name, depth + 1)]
    }))
    if (names.length > policy.limits.fields) result.truncated_fields = names.length - policy.limits.fields
    return result
  }
  const causes = new WeakSet<object>()
  function describe(value: unknown, depth = 0): Record<string, unknown> {
    if (depth > 4) return { message: '[truncated: cause limit]' }
    if (value && typeof value === 'object') {
      if (causes.has(value)) return { message: '[omitted: circular cause]' }
      causes.add(value)
    }
    const message = typeof value === 'string' ? value : field(value, 'message') ?? field(value, 'detail') ?? field(value, 'error')
    const cause = field(value, 'cause')
    return {
      name: typeof field(value, 'name') === 'string' ? scrubErrorText(String(field(value, 'name')), privateValues) : undefined,
      message: typeof message === 'string' && message.trim() ? scrubErrorText(message, privateValues) : 'The error did not include an explanation. Inspect the recorded details.',
      code: field(value, 'code') == null ? undefined : metadata(field(value, 'code'), 'code'),
      stack: errorStack(field(value, 'stack'), privateValues),
      ...(cause !== undefined ? { cause: describe(cause, depth + 1) } : {}),
    }
  }
  // Tauri argument-validation failures arrive as plain strings. They are error
  // explanations, just like an object's `message`, not unclassified content.
  // Apply the same span scrubber in both representations instead of retaining
  // the headline while replacing its duplicate in `fields` with a content tag.
  const envelope = metadata(typeof error === 'string' ? { message: error } : error)
  const diagnosticMetadata = field(envelope, 'diagnostics')
  return { ...describe(error), metadata: diagnosticMetadata, fields: envelope, ...(extra !== undefined ? { context: metadata(extra) } : {}), redaction: 'sensitive spans and unclassified fields removed' }
}

/** A readable explanation for every error surface, using only reviewed envelopes. */
export function errorMessage(error: unknown): string {
  const details = errorDetails(error)
  const messages: string[] = [String(details.message)]
  const visit = (value: unknown, depth = 0) => {
    if (!value || typeof value !== 'object' || depth > 5) return
    if (Array.isArray(value)) { value.forEach(item => visit(item, depth + 1)); return }
    for (const key of ['message', 'detail', 'reason']) {
      const text = field(value, key)
      if (typeof text === 'string' && text.trim() && !text.startsWith('[')) messages.push(text)
    }
    for (const key of ['error', 'cause', 'causes', 'choices', 'diagnostics', 'response']) {
      const child = field(value, key)
      if (typeof child === 'string' && !child.startsWith('[')) messages.push(child)
      else visit(child, depth + 1)
    }
  }
  visit(details.cause); visit(details.fields)
  return [...new Set(messages)].join(' — ')
}
