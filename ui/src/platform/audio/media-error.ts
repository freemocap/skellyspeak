import { errorDetails } from '../diagnostics/error-details'

/** Preserve the browser explanation and cause through the shared redactor. */
export function mediaError(error: unknown, context: string): Error {
  const candidate = error as { name?: unknown; code?: unknown } | null
  const name = typeof candidate?.name === 'string' && /^[A-Za-z]{1,64}$/.test(candidate.name) ? candidate.name : 'MediaError'
  const code = typeof candidate?.code === 'number' && Number.isInteger(candidate.code) ? candidate.code : undefined
  const reasons: Record<string, string> = {
    NotAllowedError: 'Permission or autoplay access was denied.', NotFoundError: 'No matching media device was found.',
    NotReadableError: 'The media device could not be read.', NotSupportedError: 'The media format is unsupported.',
    AbortError: 'The media operation was interrupted.',
  }
  const mediaReasons: Record<number, string> = { 1: 'Playback was aborted.', 2: 'Media loading failed.', 3: 'Audio decoding failed.', 4: 'The audio source or format is unsupported.' }
  const details = errorDetails(error)
  const result = new Error(`${context}: ${name}${code === undefined ? '' : ` (${code})`}. ${reasons[name] ?? (code === undefined ? '' : mediaReasons[code] ?? '')}`, { cause: details })
  result.name = name
  return Object.assign(result, { diagnostics: { stage: 'browser_media', name, code, reason: reasons[name] ?? (code === undefined ? undefined : mediaReasons[code]), ...details } })
}
