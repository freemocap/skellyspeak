import { createServer, type IncomingMessage } from 'node:http';
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { saveStudyFile } from './storage.ts';
import { synthesize, defaultElevenVoice, type SpeechConfig } from './synthesis.ts';
import { phrases, type Phrase } from './corpus.ts';
import { conditions, type Result, type Take, type Provider } from './experiment.ts';
import { wavMetrics } from './audio.ts';
import { keyNames, transcribe } from './providers.ts';
const idPattern = /^[0-9a-f-]{36}$/;
function boundedString(value: unknown, max: number): string {
  if (typeof value !== 'string' || value.length > max) throw Error('Invalid text field'); return value;
}
async function body(request: IncomingMessage) {
  let size = 0; const chunks: Buffer[] = [];
  for await (const chunk of request) { size += chunk.length; if (size > 1_400_000) throw Error('Request too large'); chunks.push(chunk); }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
export function createWorkbench(directory: string, html: string, client: string, stylesheet: string, keys: Partial<Record<Provider, string>> = {}, speech: SpeechConfig = {}) {
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const token = randomUUID(); let running = false, speechRunning = false;
  const speechCache = new Map<string, { audio: string; format: string; metadata: Record<string, unknown> }>();
  const read = <T>(file: string): T => JSON.parse(readFileSync(join(directory, file), 'utf8'));
  const files = (suffix: string) => readdirSync(directory).filter(file => file.endsWith(suffix)).sort();
  const save = (file: string, value: unknown) => {
    saveStudyFile(directory, file, Buffer.from(JSON.stringify(value, null, 2)));
  };
  const getTake = (id: unknown) => {
    if (typeof id !== 'string' || !idPattern.test(id)) throw Error('Invalid take ID'); return read<Take>(`${id}.take.json`);
  };
  const server = createServer(async (request, response) => {
    response.setHeader('Cache-Control', 'no-store'); response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; media-src 'self' blob:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'");
    const json = (value: unknown, status = 200) => { response.writeHead(status, { 'Content-Type': 'application/json' }); response.end(JSON.stringify(value)); };
    const address = server.address();
    const host = typeof address === 'object' && address ? `127.0.0.1:${address.port}` : '';
    if (request.headers.host !== host || (request.headers.origin && request.headers.origin !== `http://${host}`)) { json({ error: 'Local origin required' }, 403); return; }
    const url = new URL(request.url ?? '/', `http://${host}`);
    try {
      if (request.method === 'GET' && (url.pathname === '/dashboard' || url.pathname.startsWith('/dashboard/'))) {
        const asset = url.pathname.replace(/^\/dashboard\/?/, '') || 'index.html';
        if (asset !== 'index.html' && !/^(ar|es|zh|en)\/(01-distributions|02-recording-heatmap|03-paired-changes)\.(png|svg)$/.test(asset)) { json({ error: 'Not found' }, 404); return; }
        const file = join(directory, 'figures', 'latest', asset);
        if (!existsSync(file)) { json({ error: 'Dashboard has not been generated yet' }, 404); return; }
        const bytes = readFileSync(file);
        const hashes = asset.endsWith('.html') ? [...bytes.toString('utf8').matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m => "'sha256-" + createHash('sha256').update(m[1]).digest('base64') + "'").join(' ') : '';
        response.setHeader('Content-Security-Policy', `default-src 'none'; script-src ${hashes || "'none'"}; img-src 'self' data:; style-src 'unsafe-inline'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'`);
        response.setHeader('Content-Type', asset.endsWith('.png') ? 'image/png' : asset.endsWith('.svg') ? 'image/svg+xml' : 'text/html; charset=utf-8');
        response.end(bytes); return;
      }
      if (request.method === 'GET' && ['/', '/client.js', '/style.css'].includes(url.pathname)) {
        const type = url.pathname === '/' ? 'text/html' : url.pathname.endsWith('.js') ? 'text/javascript' : 'text/css';
        response.setHeader('Content-Type', `${type}; charset=utf-8`);
        response.end(url.pathname === '/' ? html.replace('__TOKEN__', token) : url.pathname === '/client.js' ? client : stylesheet); return;
      }
      if (request.headers['x-workbench-token'] !== token && !(url.pathname.startsWith('/audio/') && url.searchParams.get('token') === token)) {
        json({ error: 'Workbench token required' }, 403); return;
      }
      if (request.method === 'GET' && url.pathname.startsWith('/audio/')) {
        const take = getTake(url.pathname.slice(7)); response.setHeader('Content-Type', 'audio/wav');
        response.end(readFileSync(join(directory, `${take.id}.wav`))); return;
      }
      if (request.method === 'GET' && (url.pathname === '/api/state' || url.pathname === '/api/export')) {
        const allTakes = files('.take.json').map(file => read<Take>(file));
        const takes = allTakes.filter(t => !t.removedAt), removedTakes = allTakes.filter(t => t.removedAt);
        const activeIds = new Set(takes.map(t => t.id));
        const results = files('.result.json').map(file => read<Result>(file)).filter(r => activeIds.has(r.takeId));
        if (url.pathname === '/api/export') {
          json({ version: 1, exported: new Date().toISOString(), phrases, conditions, takes, results,
            audio: Object.fromEntries(takes.map(take => [take.id, readFileSync(join(directory, `${take.id}.wav`)).toString('base64')])) });
        } else json({ storageDirectory: directory, phrases, conditions, takes, removedTakes, results, speech: { openrouter: Boolean(speech.openrouterKey), elevenlabs: Boolean(keys.elevenlabs), voiceId: speech.elevenlabsVoiceId || defaultElevenVoice }, providers: Object.fromEntries(Object.keys(keyNames).map(p => [p, Boolean(keys[p as Provider])])) });
        return;
      }
      if (request.method !== 'POST') { json({ error: 'Not found' }, 404); return; }
      const input = await body(request);
      if (url.pathname === '/api/speech') {
        if (!['elevenlabs', 'openrouter'].includes(input.provider)) throw Error('Unknown provider');
        const phrase = phrases.find(p => p.id === input.phraseId); if (!phrase) throw Error('Unknown phrase');
        const text = boundedString(input.text, 500).trim(); if (!text) throw Error('Empty phrase');
        const voice = speech.elevenlabsVoiceId || defaultElevenVoice;
        const signature = createHash('sha256').update(JSON.stringify([input.provider, text, phrase.variety, voice])).digest('hex');
        const cached = speechCache.get(signature); if (cached) { json({ ...cached, cached: true }); return; }
        if (speechRunning) { json({ error: 'Read-aloud is already generating' }, 409); return; }
        speechRunning = true;
        try {
          const result = await synthesize({ provider: input.provider, text, variety: phrase.variety }, input.provider === 'elevenlabs' ? keys.elevenlabs || '' : speech.openrouterKey || '', voice);
          save(`${randomUUID()}.speech.json`, { created: new Date().toISOString(), signature, metadata: result.metadata, error: result.error });
          if (!result.audio) { json({ error: result.error, metadata: result.metadata }, 502); return; }
          const value = { audio: Buffer.from(result.audio).toString('base64'), format: result.format, metadata: result.metadata };
          if (speechCache.size >= 30) speechCache.delete(speechCache.keys().next().value!);
          speechCache.set(signature, value); json({ ...value, cached: false });
        } finally { speechRunning = false; }
        return;
      }
      if (url.pathname === '/api/key') {
        if (!Object.hasOwn(keyNames, input.provider)) throw Error('Unknown provider');
        const key = boundedString(input.key, 512).trim();
        if (key && !/^[\x21-\x7e]+$/.test(key)) throw Error('Invalid key');
        keys[input.provider as Provider] = key; json({ savedInMemory: true }); return;
      }
      if (url.pathname === '/api/take') {
        const source = phrases.find(p => p.id === input.phraseId); if (!source) throw Error('Unknown phrase');
        const text = boundedString(input.text, 500).trim(); if (!text) throw Error('Empty phrase');
        const phrase: Phrase = { ...source, text, english: boundedString(input.english, 500), pronunciation: boundedString(input.pronunciation, 500) };
        const encoded = boundedString(input.wav, 1_300_000);
        if (!/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) throw Error('Invalid audio encoding');
        const wav = Buffer.from(encoded, 'base64'), metrics = wavMetrics(wav);
        const id = randomUUID();
        const take: Take = { id, created: new Date().toISOString(), phrase, sha256: createHash('sha256').update(wav).digest('hex'), ...metrics,
          capture: { browser: boundedString(input.browser, 500), processing: boundedString(input.processing, 500), format: 'PCM16 mono 16000 Hz', referenceVoice: boundedString(input.referenceVoice, 200) }, reference: text, notes: '' };
        saveStudyFile(directory, `${id}.wav`, wav); save(`${id}.take.json`, take);
        json(take); return;
      }
      if (url.pathname === '/api/remove' || url.pathname === '/api/restore') {
        if (running) { json({ error: 'A comparison is running; try again after it finishes' }, 409); return; }
        const take = getTake(input.takeId);
        if (url.pathname === '/api/remove') take.removedAt = new Date().toISOString();
        else delete take.removedAt;
        save(`${take.id}.take.json`, take); json(take); return;
      }
      if (url.pathname === '/api/reference') {
        const take = getTake(input.takeId); take.reference = boundedString(input.reference, 500); take.notes = boundedString(input.notes, 2000);
        save(`${take.id}.take.json`, take); json(take); return;
      }
      if (url.pathname === '/api/run') {
        if (running) { json({ error: 'A comparison is already running' }, 409); return; }
        const take = getTake(input.takeId), condition = conditions.find(c => c.id === input.conditionId);
        if (!condition) throw Error('Unknown condition');
        if (take.removedAt) { json({ error: 'This take was removed from the study' }, 409); return; }
        if (!keys[condition.provider]) { json({ error: `Configure ${keyNames[condition.provider]} first` }, 400); return; }
        const wav = readFileSync(join(directory, `${take.id}.wav`));
        if (createHash('sha256').update(wav).digest('hex') !== take.sha256) throw Error('Audio hash mismatch');
        running = true;
        try {
          const pending: Result = { id: randomUUID(), takeId: take.id, created: new Date().toISOString(), condition, audioSha256: take.sha256,
            status: 'error', error: 'Request started; outcome unknown until completion is saved. Do not assume it was unbilled.', elapsedMs: 0,
            metadata: { stage: 'started', unknownOutcome: true, requestedModel: condition.model, languageSent: condition.mode === 'forced' ? take.phrase.language : null } };
          save(`${pending.id}.result.json`, pending);
          const result: Result = { ...pending, ...await transcribe(condition, take.phrase.language, wav, keys[condition.provider]!) };
          if (result.status === 'ok') delete result.error;
          save(`${result.id}.result.json`, result); json(result);
        } finally { running = false; }
        return;
      }
      json({ error: 'Not found' }, 404);
    } catch (error) {
      const safe = new Set(['Invalid text field', 'Unknown provider', 'Invalid key', 'Unknown phrase', 'Empty phrase', 'Invalid audio encoding', 'Invalid take ID', 'Unknown condition', 'Audio hash mismatch', 'Request too large', 'Expected canonical mono PCM16 16 kHz WAV', 'Record between 0.2 and 30 seconds']);
      json({ error: error instanceof Error && safe.has(error.message) ? error.message : 'Request or local storage failed; input was not accepted', stage: 'local_workbench' }, 400);
    }
  });
  server.requestTimeout = 10000; server.headersTimeout = 10000;
  return server;
}
