import { languageNames, type Language, type Phrase } from './corpus.ts';
import { score, type Condition, type Provider, type Result, type Take } from './experiment.ts';
import { startCapture, type Capture } from './recorder.ts';
const element = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const token = document.querySelector<HTMLMetaElement>('meta[name="workbench-token"]')!.content;
const language = element<HTMLSelectElement>('language'), phraseSelect = element<HTMLSelectElement>('phrase');
const target = element<HTMLTextAreaElement>('target'), english = element<HTMLInputElement>('english'), pronunciation = element<HTMLInputElement>('pronunciation');
const voiceSelect = element<HTMLSelectElement>('voice'), rate = element<HTMLSelectElement>('rate');
const record = element<HTMLButtonElement>('record'), stop = element<HTMLButtonElement>('stop'), run = element<HTMLButtonElement>('run');
const cancel = element<HTMLButtonElement>('cancel'), listen = element<HTMLButtonElement>('listen');
interface State { storageDirectory: string; phrases: Phrase[]; conditions: Condition[]; takes: Take[]; removedTakes: Take[]; results: Result[]; providers: Record<Provider, boolean>; speech: { openrouter: boolean; elevenlabs: boolean; voiceId: string } }
let state: State, selected: string | undefined, capture: Capture | undefined, busy = false, capturing = false, cancelRequested = false;
let speechLoading = false, speechGeneration = 0, speechUrl: string | undefined, lastReferenceVoice = 'none';
const referenceAudio = element<HTMLAudioElement>('referenceAudio');
function stopReference() { speechGeneration++; referenceAudio.pause(); }
const selectedConditions = new Set(['scribe-forced-clean', 'scribe-forced-verbatim', 'whisper-large-v3-forced']);
function status(message: string, error = false) { const area = element('status'); area.textContent = message; area.classList.toggle('error', error); }
function showError(error: unknown) { status(error instanceof Error ? error.message : 'Action failed', true); }
async function api<T>(path: string, data?: unknown): Promise<T> {
  const response = await fetch(path, { method: data === undefined ? 'GET' : 'POST', headers: { 'x-workbench-token': token, 'Content-Type': 'application/json' }, body: data === undefined ? undefined : JSON.stringify(data) });
  const value = await response.json(); if (!response.ok) throw Error(value.error ?? `Request failed (${response.status})`); return value;
}
function node<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, className?: string) {
  const result = document.createElement(tag); if (text !== undefined) result.textContent = text; if (className) result.className = className; return result;
}
function chosenTake() { return state.takes.find(t => t.id === selected); }
function updateControls() {
  record.disabled = busy || capturing || speechLoading; stop.disabled = !capture || busy;
  run.disabled = busy || capturing || !selected || !state.conditions.some(c => selectedConditions.has(c.id) && state.providers[c.provider]);
  cancel.disabled = !busy; listen.disabled = capturing || speechLoading || !voiceSelect.value;
  for (const input of [language, phraseSelect, target, english, pronunciation]) input.disabled = capturing;
  document.querySelectorAll<HTMLButtonElement>('.take, .take-remove').forEach(button => button.disabled = capturing || busy);
  document.querySelectorAll<HTMLButtonElement>('.take-play').forEach(button => button.disabled = capturing);
  document.querySelectorAll<HTMLInputElement>('#conditions input').forEach(input => { const condition = state.conditions.find(c => c.id === input.value)!; input.disabled = busy || !state.providers[condition.provider]; });
}
function populateVoices() {
  const previous = voiceSelect.value;
  voiceSelect.replaceChildren();
  for (const [id, label] of [['elevenlabs', 'ElevenLabs · Eleven v3'], ['openrouter', 'OpenRouter · GPT Audio Mini']] as const) {
    const option = new Option(label + (state.speech[id] ? '' : ' · key needed'), id);
    option.disabled = !state.speech[id]; voiceSelect.add(option);
  }
  voiceSelect.value = previous && state.speech[previous as 'elevenlabs' | 'openrouter'] ? previous : state.speech.elevenlabs ? 'elevenlabs' : state.speech.openrouter ? 'openrouter' : '';
  listen.disabled = capturing || speechLoading || !voiceSelect.value;
}
function selectPhrase() {
  stopReference(); referenceAudio.hidden = true;
  const phrase = state.phrases.find(p => p.id === phraseSelect.value)!;
  target.value = phrase.text; target.lang = phrase.language; english.value = phrase.english; pronunciation.value = phrase.pronunciation;
  element('tip').textContent = `${phrase.variety} — ${phrase.tip}`; lastReferenceVoice = 'none';
}
function selectLanguage() {
  stopReference();
  phraseSelect.replaceChildren(...state.phrases.filter(p => p.language === language.value).map(p => new Option(p.focus ? `${p.focus} — ${p.text}${p.variety === 'Modern Standard Arabic' ? ' (formal)' : ''}` : p.text, p.id)));
  selectPhrase(); populateVoices();
}
function renderTakes() {
  const list = element('takes');
  list.querySelectorAll('audio').forEach(audio => audio.pause());
  list.replaceChildren();
  for (const take of [...state.takes].sort((a, b) => b.created.localeCompare(a.created))) {
    const row = node('div', undefined, 'take-row');
    const button = node('button', take.phrase.text, `take${take.id === selected ? ' selected' : ''}`);
    button.dir = 'auto'; button.append(node('small', `${take.phrase.variety} · ${take.duration.toFixed(1)} s · ${new Date(take.created).toLocaleTimeString()}`));
    button.onclick = () => { selected = take.id; renderTakes(); renderReview(); renderResults(); updateControls(); };
    const remove = node('button', 'Remove', 'take-remove');
    remove.onclick = () => void changeTake('/api/remove', take.id);
    const audio = node('audio'); audio.preload = 'none'; audio.hidden = true;
    audio.src = `/audio/${take.id}?token=${token}`;
    const play = node('button', '▶ Play', 'take-play');
    play.setAttribute('aria-label', `Play take from ${new Date(take.created).toLocaleTimeString()}`);
    const resetPlay = () => { play.textContent = '▶ Play'; play.setAttribute('aria-pressed', 'false'); };
    audio.onpause = resetPlay; audio.onended = resetPlay;
    audio.onerror = () => { resetPlay(); status('Could not play this saved take.', true); };
    play.onclick = async () => {
      if (!audio.paused) { audio.pause(); return; }
      stopReference();
      document.querySelectorAll('audio').forEach(other => { if (other !== audio) other.pause(); });
      try { await audio.play(); play.textContent = 'Ⅱ Pause'; play.setAttribute('aria-pressed', 'true'); }
      catch { resetPlay(); status('Could not play this saved take.', true); }
    };
    row.append(button, play, remove, audio); list.append(row);
  }
  if (!state.takes.length) list.append(node('p', 'No takes yet. Start with a short phrase.', 'empty'));
  const removed = element('removedTakes'); removed.replaceChildren();
  for (const take of state.removedTakes ?? []) {
    const restore = node('button', `Restore: ${take.phrase.text} · ${new Date(take.created).toLocaleTimeString()}`);
    restore.onclick = () => void changeTake('/api/restore', take.id); removed.append(restore);
  }

}
async function changeTake(path: string, id: string) {
  try {
    await api(path, { takeId: id });
    state = await api<State>('/api/state');
    if (!state.takes.some(t => t.id === selected)) selected = [...state.takes].sort((a,b) => b.created.localeCompare(a.created))[0]?.id;
    renderTakes(); renderReview(); renderResults(); updateControls();
    status(path === '/api/remove' ? 'Take removed from the study. Undo it under Removed takes.' : 'Take restored.');
  } catch (error) { showError(error); }
}
function renderReview() {
  const container = element('review'); container.replaceChildren(); const take = chosenTake(); if (!take) { container.append(node('p', 'Select or record a take.', 'empty')); return; }
  container.append(node('p', `${take.phrase.variety} · intended: ${take.phrase.text}`));
  const audio = node('audio'); audio.controls = true; audio.src = `/audio/${take.id}?token=${token}`; container.append(audio);
  const db = (value: number) => value > 0 ? `${(20 * Math.log10(value)).toFixed(1)} dBFS` : 'silence';
  container.append(node('p', `${take.duration.toFixed(2)} s · level ${db(take.rms)} · peak ${db(take.peak)} · ${(take.clippedFraction * 100).toFixed(2)}% clipped samples`, 'muted'));
  if (take.rms < 0.003 || take.clippedFraction > 0.01) container.append(node('p', 'Check playback: this recording is very quiet or contains clipping.', 'muted'));
  const referenceLabel = node('label', 'Scoring reference · edit to what you actually said');
  const reference = node('textarea'); reference.id = 'reference'; reference.value = take.reference; reference.maxLength = 500; reference.dir = 'auto'; referenceLabel.append(reference);
  const notesLabel = node('label', 'Listening notes'); const notes = node('input'); notes.id = 'notes'; notes.value = take.notes; notes.maxLength = 2000; notes.placeholder = 'Wrong language? Missed word? Mic problem?'; notesLabel.append(notes);
  const save = node('button', 'Save reference & notes'); save.onclick = () => void saveReference().then(() => { renderResults(); status('Reference and notes saved.'); }).catch(showError);
  container.append(referenceLabel, notesLabel, save);
  const details = node('details'); details.append(node('summary', 'Recording provenance'), node('pre', JSON.stringify(take, null, 2))); container.append(details);
}
async function saveReference() {
  const take = chosenTake(); if (!take) return;
  const updated = await api<Take>('/api/reference', { takeId: take.id, reference: element<HTMLTextAreaElement>('reference').value, notes: element<HTMLInputElement>('notes').value });
  state.takes = state.takes.map(t => t.id === take.id ? updated : t);
}
function renderConditions() {
  const container = element('conditions'); container.replaceChildren();
  for (const condition of state.conditions) {
    const label = node('label', undefined, 'condition'), input = node('input'); input.type = 'checkbox'; input.value = condition.id;
    input.checked = selectedConditions.has(condition.id); input.disabled = !state.providers[condition.provider];
    input.onchange = () => { if (input.checked) selectedConditions.add(condition.id); else selectedConditions.delete(condition.id); updateControls(); };
    label.append(input, document.createTextNode(condition.label + (state.providers[condition.provider] ? '' : ' · key needed'))); container.append(label);
  }
  element('accessSummary').textContent = `· ${Object.entries(state.providers).filter(([, ready]) => ready).map(([p]) => p).join(', ') || 'no keys configured'}`;
}
function renderResults() {
  const container = element('results'); container.replaceChildren(); const take = chosenTake(); if (!take) return;
  const rows = state.results.filter(r => r.takeId === take.id).sort((a, b) => a.created.localeCompare(b.created));
  for (const result of rows) {
    const article = node('article', undefined, 'result'); article.append(node('h3', result.condition.label));
    const transcript = node('div', result.text ?? result.error, 'transcript'); transcript.dir = 'auto'; article.append(transcript);
    const measure = result.status === 'ok' ? score(take.reference, result.text!, take.phrase.language) : null;
    const percentage = (value: number | null) => value === null ? '—' : `${(value * 100).toFixed(1)}%`;
    article.append(node('div', `CER ${measure ? percentage(measure.cer) : '—'} · WER ${measure ? percentage(measure.wer) : '—'} · ${(result.elapsedMs / 1000).toFixed(2)} s · ${new Date(result.created).toLocaleTimeString()}`, 'metrics'));
    const details = node('details'); details.append(node('summary', 'Request settings & diagnostics'), node('pre', JSON.stringify(result, null, 2))); article.append(details); container.append(article);
  }
  if (!rows.length) container.append(node('p', 'No methods have been run on this take.', 'empty'));
}
function renderKeys() {
  const container = element('keys');
  for (const provider of ['elevenlabs', 'groq', 'openai'] as const) {
    const row = node('div', undefined, 'key-row'), label = node('label', provider), input = node('input'); input.type = 'password'; input.autocomplete = 'off'; input.placeholder = 'API key'; label.append(input);
    const button = node('button', 'Use key'); button.onclick = async () => {
      try { await api('/api/key', { provider, key: input.value }); input.value = ''; state = await api<State>('/api/state'); renderConditions(); populateVoices(); updateControls(); status(`${provider} access updated. Availability is not verified until a request succeeds.`); } catch (error) { showError(error); }
    }; row.append(label, button); container.append(row);
  }
}
listen.onclick = async () => {
  stopReference(); const generation = speechGeneration;
  speechLoading = true; updateControls(); status('Generating reference speech…');
  try {
    const provider = voiceSelect.value;
    const response = await fetch('/api/speech', { method: 'POST', headers: { 'x-workbench-token': token, 'Content-Type': 'application/json' }, body: JSON.stringify({ provider, phraseId: phraseSelect.value, text: target.value }) });
    const value = await response.json();
    element('speechDiagnostics').textContent = JSON.stringify(value.metadata ?? value, null, 2);
    if (!response.ok) throw Error(value.error);
    if (generation !== speechGeneration) return;
    if (speechUrl) URL.revokeObjectURL(speechUrl);
    const bytes = Uint8Array.from(atob(value.audio), c => c.charCodeAt(0));
    speechUrl = URL.createObjectURL(new Blob([bytes], { type: value.format === 'wav' ? 'audio/wav' : 'audio/mpeg' }));
    referenceAudio.src = speechUrl; referenceAudio.hidden = false; referenceAudio.playbackRate = Number(rate.value);
    lastReferenceVoice = `${provider}: ${value.metadata.requestedModel} / ${value.metadata.voice}; ${value.metadata.variety}; rate ${rate.value}`;
    status(value.cached ? 'Playing cached reference speech.' : 'Reference speech ready. Replay uses this audio without another charge.');
    try { await referenceAudio.play(); } catch { status('Speech is ready. Press Play on the audio control.'); }
  } catch (error) { showError(error); }
  finally { speechLoading = false; updateControls(); }
};
rate.onchange = () => { referenceAudio.playbackRate = Number(rate.value); };
voiceSelect.onchange = () => { stopReference(); referenceAudio.hidden = true; lastReferenceVoice = 'none'; updateControls(); };
target.oninput = () => { stopReference(); referenceAudio.hidden = true; lastReferenceVoice = 'none'; };
element('stopVoice').onclick = stopReference;
language.onchange = selectLanguage; phraseSelect.onchange = selectPhrase;
record.onclick = async () => {
  stopReference(); document.querySelectorAll('audio').forEach(audio => audio.pause());
  capturing = true; updateControls(); status('Requesting microphone…');
  const fields = { phraseId: phraseSelect.value, text: target.value, english: english.value, pronunciation: pronunciation.value, referenceVoice: lastReferenceVoice };
  let timer = 0;
  const finish = () => { clearInterval(timer); capture = undefined; capturing = false; updateControls(); };
  try {
    capture = await startCapture(async (wav, processing) => {
      status('Saving recording locally…'); let binary = ''; for (const byte of wav) binary += String.fromCharCode(byte);
      const take = await api<Take>('/api/take', { ...fields, wav: btoa(binary), browser: navigator.userAgent, processing });
      state.takes.push(take); selected = take.id; finish(); renderTakes(); renderReview(); renderResults(); updateControls(); status('Take saved for Codex to compare. Keep recording, or remove an unwanted take.');
    }, error => { finish(); showError(error); });
    const started = Date.now(); timer = window.setInterval(() => { element('timer').textContent = `0:${String(Math.floor((Date.now() - started) / 1000)).padStart(2, '0')}`; }, 250);
    updateControls(); status('Recording…');
  } catch (error) { finish(); showError(error); }
};
stop.onclick = () => { capture?.stop(); stop.disabled = true; status('Processing recording…'); };
run.onclick = async () => {
  const take = chosenTake(); if (!take) return; busy = true; cancelRequested = false; updateControls();
  try {
    await saveReference();
    const chosen = state.conditions.filter(c => selectedConditions.has(c.id) && state.providers[c.provider]);
    // Shuffle order to reduce systematic latency/order effects; every result retains its timestamp.
    for (let i = chosen.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [chosen[i], chosen[j]] = [chosen[j], chosen[i]]; }
    for (const [i, condition] of chosen.entries()) {
      if (cancelRequested) break;
      status(`Running ${i + 1}/${chosen.length}: ${condition.label}`);
      state.results.push(await api<Result>('/api/run', { takeId: take.id, conditionId: condition.id })); renderResults();
    }
    status(cancelRequested ? 'Stopped. Completed results are saved.' : 'Comparison complete. Results, including failures, are saved.');
  } catch (error) { showError(error); }
  finally { busy = false; updateControls(); }
};
cancel.onclick = () => { cancelRequested = true; status('Will stop after the current request; it may already be billable.'); };
element('export').onclick = async () => {
  try {
    if (selected) await saveReference();
    const bundle = await api('/api/export'), url = URL.createObjectURL(new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' }));
    const link = node('a'); link.href = url; link.download = `transcription-study-${new Date().toISOString().slice(0, 10)}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    status('Export includes recordings and transcripts. Local copies remain saved.');
  } catch (error) { showError(error); }
};
window.addEventListener('beforeunload', event => { if (busy || capturing) { event.preventDefault(); event.returnValue = ''; } });
async function init() {
  state = await api<State>('/api/state');
  element('storageLocation').textContent = state.storageDirectory;
  language.replaceChildren(...Object.entries(languageNames).map(([id, name]) => new Option(name, id))); language.value = 'ar' satisfies Language;
  selectLanguage();
  selected = [...state.takes].sort((a,b) => b.created.localeCompare(a.created))[0]?.id; renderKeys(); renderConditions(); renderTakes(); renderReview(); renderResults(); updateControls();
  status('Ready. Record your takes; Codex runs the model comparisons.');
  window.setInterval(async () => {
    if (capturing || busy) return;
    try {
      const next = await api<State>('/api/state');
      const changed = JSON.stringify(state.results) !== JSON.stringify(next.results);
      state.results = next.results;
      element('resultsRefresh').textContent = '';
      if (changed) renderResults();
    } catch { element('resultsRefresh').textContent = 'Results refresh failed. Reload after the workbench reconnects.'; }
  }, 5000);
}
void init().catch(showError);
