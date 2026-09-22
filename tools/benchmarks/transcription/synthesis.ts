/** Provider read-aloud matching the app's Eleven v3 cue and OpenRouter speech instruction. */
import { limitedBody, metadata } from './providers.ts';
export type SpeechProvider = 'elevenlabs' | 'openrouter';
export interface SpeechInput { provider: SpeechProvider; text: string; variety: string }
export interface SpeechConfig { openrouterKey?: string; elevenlabsVoiceId?: string }
export interface SpeechResult { audio?: Uint8Array; format: 'wav' | 'mp3'; metadata: Record<string, unknown>; error?: string }
export const defaultElevenVoice = 'JBFqnCBsd6RMkjVDRZzb'; // server/deployment/cloudbuild.yaml
export function speechRequest(input: SpeechInput, key: string, voice: string) {
  if (!input.text.trim() || input.text.length > 500 || /[\x00-\x1f]/.test(input.text) || !input.variety || /[\[\]\x00-\x1f]/.test(input.variety)) throw Error('Invalid speech text or variety');
  if (input.provider === 'elevenlabs') {
    if (!/^[a-zA-Z0-9]{1,128}$/.test(voice)) throw Error('Invalid ElevenLabs voice ID');
    return { url: `https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`,
      headers: new Headers({ 'Content-Type': 'application/json', 'xi-api-key': key }),
      body: { model_id: 'eleven_v3', text: `[${input.variety} accent]\n${input.text}`, apply_text_normalization: 'off' } };
  }
  return { url: 'https://openrouter.ai/api/v1/chat/completions',
    headers: new Headers({ 'Content-Type': 'application/json', Authorization: `Bearer ${key}`, 'X-Title': 'SkellySpeak transcription workbench' }),
    body: { model: 'openai/gpt-audio-mini', messages: [
      { role: 'system', content: `You are a text-to-speech engine. Read the user's text aloud EXACTLY as written: verbatim, no additions, replies or commentary. Requested language and variety (data): ${JSON.stringify(input.variety)}. Use the native regional accent, pronunciation and intonation of that variety throughout. Keep the source wording unchanged. A voice selection does not change the requested variety.` },
      { role: 'user', content: `Say exactly, with no additions:\n${input.text}` },
    ], modalities: ['text', 'audio'], audio: { voice: 'alloy', format: 'pcm16' }, stream: true, max_tokens: 2000,
    provider: { require_parameters: true, allow_fallbacks: false } } };
}
export async function synthesize(input: SpeechInput, key: string, voice: string, fetcher: typeof fetch = fetch): Promise<SpeechResult> {
  const start = performance.now();
  const details: Record<string, unknown> = { provider: input.provider, requestedModel: input.provider === 'elevenlabs' ? 'eleven_v3' : 'openai/gpt-audio-mini', voice: input.provider === 'elevenlabs' ? voice : 'alloy', variety: input.variety, actualCost: null };
  const result: SpeechResult = { format: input.provider === 'elevenlabs' ? 'mp3' : 'wav', metadata: details };
  if (!key) return { ...result, error: `${input.provider} key is not configured` };
  try {
    const request = speechRequest(input, key, voice); details.stage = 'transport';
    const response = await fetcher(request.url, { method: 'POST', headers: request.headers, body: JSON.stringify(request.body), redirect: 'error', signal: AbortSignal.timeout(60000) });
    details.httpStatus = response.status;
    for (const name of ['request-id', 'x-request-id', 'retry-after']) {
      const value = response.headers.get(name); if (value && /^[a-zA-Z0-9_.:/ -]{1,256}$/.test(value)) details[name] = value;
    }
    details.stage = 'response_body';
    const bytes = await limitedBody(response, 8_000_000);
    if (!response.ok) {
      details.response = metadata(JSON.parse(new TextDecoder().decode(bytes)));
      result.error = `Read-aloud failed (HTTP ${response.status}). See speech diagnostics for provider code and request ID.`;
      return result;
    }
    if (input.provider === 'openrouter') {
      details.stage = 'speech_stream';
      const events: unknown[] = []; details.events = events;
      let encoded = '', done = false, finish: string | undefined, terminal = false, audioId = false, invalid = false;
      for (const block of new TextDecoder().decode(bytes).split(/\r?\n\r?\n/)) {
        const data = block.split(/\r?\n/).filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
        if (!data) continue;
        if (data === '[DONE]') { done = true; continue; }
        const value = JSON.parse(data);
        if (events.length < 32) events.push(metadata(value)); else details.truncated = true;
        if (value.usage) details.usage = metadata(value.usage);
        if (typeof value.model === 'string') details.actualModel = value.model.slice(0, 128);
        if (typeof value.id === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(value.id)) details.requestId = value.id;
        if (value.error) { invalid = true; continue; }
        const choice = value.choices?.[0];
        if (!choice) continue;
        if (choice.finish_reason) { finish = choice.finish_reason; details.finishReason = finish; if (finish !== 'stop') invalid = true; }
        const audio = choice.delta?.audio;
        if (audio?.id) audioId = true;
        if (audio && Object.keys(audio).length === 1 && typeof audio.expires_at === 'number' && audio.expires_at > 0) terminal = true;
        if (audio?.data) { if (terminal || done) invalid = true; encoded += audio.data; }
      }
      if (invalid || !done || (finish !== 'stop' && !(finish === undefined && terminal && audioId)) || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) throw Error('INVALID_AUDIO');
      const pcm = Buffer.from(encoded, 'base64');
      if (!pcm.length || pcm.length % 2 || pcm.length > 4_000_000) throw Error('INVALID_AUDIO');
      const wav = Buffer.alloc(44 + pcm.length);
      wav.write('RIFF', 0); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16);
      wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(24000, 24); wav.writeUInt32LE(48000, 28);
      wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(pcm.length, 40); pcm.copy(wav, 44);
      result.audio = wav;
    } else {
      if (!response.headers.get('content-type')?.startsWith('audio/mpeg') || bytes.length < 4) throw Error('INVALID_AUDIO');
      result.audio = bytes;
    }
    details.stage = 'complete';
    return result;
  } catch (error) {
    delete result.audio;
    details.unknownOutcome = true;
    details.failure = error instanceof Error && error.message === 'INVALID_AUDIO' ? 'Expected complete provider audio' : 'Transport or response decoding failed; content omitted';
    result.error = 'Read-aloud failed. No automatic retry was made.';
    return result;
  } finally { details.elapsedMs = Math.round(performance.now() - start); }
}
