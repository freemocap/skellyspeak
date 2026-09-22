import type { Condition, Provider, Result } from './experiment.ts';
import type { Language } from './corpus.ts';
export const keyNames: Record<Provider, string> = { elevenlabs: 'ELEVENLABS_API_KEY', groq: 'GROQ_API_KEY', openai: 'OPENAI_API_KEY' };
const endpoints: Record<Provider, string> = {
  elevenlabs: 'https://api.elevenlabs.io/v1/speech-to-text',
  groq: 'https://api.groq.com/openai/v1/audio/transcriptions',
  openai: 'https://api.openai.com/v1/audio/transcriptions',
};
// [@transcription_workbench_apis_20260921] No answer text or previous transcript is sent.
export function requestFor(condition: Condition, language: Language, wav: Uint8Array, key: string) {
  const body = new FormData();
  body.set('file', new Blob([new Uint8Array(wav)], { type: 'audio/wav' }), 'recording.wav');
  const eleven = condition.provider === 'elevenlabs';
  body.set(eleven ? 'model_id' : 'model', condition.model);
  if (condition.mode === 'forced') body.set(eleven ? 'language_code' : 'language', language);
  if (eleven) {
    body.set('no_verbatim', String(condition.cleaned)); body.set('tag_audio_events', 'false');
    body.set('diarize', 'false'); body.set('timestamps_granularity', 'word');
  } else {
    body.set('response_format', condition.model.includes('whisper') ? 'verbose_json' : 'json');
    body.set('temperature', '0');
  }
  return { url: endpoints[condition.provider], body,
    headers: new Headers(eleven ? { 'xi-api-key': key } : { Authorization: `Bearer ${key}` }) };
}
// Content is stored only in the explicit experiment transcript, never in diagnostics.
// Unknown fields are accounted for, not copied into private metadata wholesale.
const contentFields = new Set(['text', 'word', 'token', 'tokens', 'message', 'prompt', 'audio', 'transcript']);
const identifiers = new Set(['id', 'request_id', 'model', 'language', 'language_code', 'type', 'code', 'status', 'finish_reason', 'task', 'param']);
const numbers = new Set(['duration', 'language_probability', 'start', 'end', 'confidence', 'avg_logprob', 'no_speech_prob', 'compression_ratio', 'temperature', 'seek', 'cost', 'cost_micros', 'prompt_tokens', 'completion_tokens', 'input_tokens', 'output_tokens', 'total_tokens', 'cached_tokens', 'audio_tokens', 'text_tokens', 'seconds']);
const groups = new Set(['usage', 'input_token_details', 'input_tokens_details', 'output_tokens_details', 'x_groq', 'error', 'detail', 'segments', 'words']);
export function metadata(value: unknown, depth = 0): unknown {
  if (depth > 5) return { omitted: 'depth limit' };
  if (Array.isArray(value)) return { items: value.slice(0, 200).map(v => metadata(v, depth + 1)), truncated: value.length > 200 };
  if (!value || typeof value !== 'object') return { omitted: 'unexpected shape' };
  const out: Record<string, unknown> = {}, omitted: string[] = [];
  for (const [key, item] of Object.entries(value).slice(0, 100)) {
    if (contentFields.has(key)) out[key] = '[content removed]';
    else if (identifiers.has(key) && typeof item === 'string' && /^[\p{L}\p{N}_. /:-]{1,128}$/u.test(item)) out[key] = item;
    else if (numbers.has(key) && typeof item === 'number' && Number.isFinite(item)) out[key] = item;
    else if (groups.has(key)) out[key] = metadata(item, depth + 1);
    else omitted.push(/^[a-zA-Z_]{1,64}$/.test(key) ? key : '[unrecognized field name]');
  }
  out.omittedFields = omitted;
  if (Object.keys(value).length > 100) out.truncated = true;
  return out;
}
export async function limitedBody(response: Response, limit: number): Promise<Uint8Array> {
  if (!response.body) throw Error('EMPTY_BODY');
  const reader = response.body.getReader(), chunks: Uint8Array[] = []; let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      length += value.length; if (length > limit) throw Error('RESPONSE_LIMIT'); chunks.push(value);
    }
  } finally { await reader.cancel(); }
  const bytes = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return bytes;
}
export async function transcribe(condition: Condition, language: Language, wav: Uint8Array, key: string,
  fetcher: typeof fetch = fetch): Promise<Pick<Result, 'text' | 'status' | 'error' | 'metadata' | 'elapsedMs'>> {
  const started = performance.now(), details: Record<string, unknown> = { requestedModel: condition.model, languageSent: condition.mode === 'forced' ? language : null, promptSent: false, actualCost: null };
  const result = (status: 'ok' | 'error', extra: { text?: string; error?: string }) => ({ status, ...extra, metadata: details, elapsedMs: Math.round(performance.now() - started) });
  if (!key) return result('error', { error: `Missing ${keyNames[condition.provider]}` });
  try {
    const request = requestFor(condition, language, wav, key);
    details.stage = 'transport';
    const response = await fetcher(request.url, { method: 'POST', body: request.body, headers: request.headers,
      redirect: 'error', signal: AbortSignal.timeout(60000) });
    details.httpStatus = response.status;
    details.headers = Object.fromEntries(['request-id', 'x-request-id', 'retry-after', 'x-ratelimit-remaining-requests', 'x-ratelimit-remaining-tokens']
      .flatMap(name => { const value = response.headers.get(name); return value && /^[a-zA-Z0-9_. :/-]{1,256}$/.test(value) ? [[name, value]] : []; }));
    details.stage = 'response_body';
    const bytes = await limitedBody(response, 1_000_000);
    let value: unknown;
    try { value = JSON.parse(new TextDecoder().decode(bytes)); }
    catch { details.unreadable = true; return result('error', { error: `HTTP ${response.status}: response is not JSON` }); }
    // Remove the active credential even if a provider echoes it in a nominal identifier.
    const scrub = (v: unknown): unknown => typeof v === 'string' ? v.split(key).join('[credential removed]')
      : Array.isArray(v) ? v.map(scrub) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, item]) => [k, scrub(item)])) : v;
    value = scrub(value);
    details.response = metadata(value);
    if (!response.ok) return result('error', { error: `Provider HTTP ${response.status}; expand metadata for provider code and request ID. Provider message removed because it may echo content.` });
    details.stage = 'transcript_validation';
    if (!value || typeof value !== 'object' || !('text' in value) || typeof value.text !== 'string' || value.text.length > 20000)
      return result('error', { error: 'Expected text string (maximum 20,000 characters)' });
    if (!value.text.trim()) return result('error', { error: 'Provider returned an empty transcript' });
    details.stage = 'complete';
    return result('ok', { text: value.text });
  } catch (error) {
    details.exceptionType = error instanceof Error ? error.name : 'Unknown';
    details.unknownOutcome = true;
    details.reason = error instanceof Error && error.message === 'RESPONSE_LIMIT' ? 'response exceeded 1 MB; truncated' : 'transport/read failure; free-form exception omitted';
    return result('error', { error: 'Request failed; no automatic retry. Expand metadata for the failure stage.' });
  }
}
