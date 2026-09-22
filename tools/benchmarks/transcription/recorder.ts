import { encodeWav } from './audio.ts';
export interface Capture { stop: () => void }
export async function startCapture(onSaved: (wav: Uint8Array, processing: string) => Promise<void>, onError: (error: unknown) => void): Promise<Capture> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
  const context = new AudioContext();
  let recorder: MediaRecorder;
  try { await context.resume(); recorder = new MediaRecorder(stream); }
  catch (error) { stream.getTracks().forEach(t => t.stop()); await context.close(); throw error; }
  const settings = stream.getAudioTracks()[0].getSettings();
  const processing = JSON.stringify({ sampleRate: settings.sampleRate, channelCount: settings.channelCount,
    echoCancellation: settings.echoCancellation, noiseSuppression: settings.noiseSuppression, autoGainControl: settings.autoGainControl, mimeType: recorder.mimeType });
  const chunks: Blob[] = []; let stopped = false;
  const stop = () => { if (!stopped) { stopped = true; recorder.stop(); stream.getTracks().forEach(t => t.stop()); } };
  const timeout = window.setTimeout(stop, 29500);
  recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
  recorder.onerror = event => { clearTimeout(timeout); stream.getTracks().forEach(t => t.stop()); void context.close(); onError(event); };
  recorder.onstop = async () => {
    clearTimeout(timeout);
    try {
      const audio = await context.decodeAudioData(await new Blob(chunks, { type: recorder.mimeType }).arrayBuffer());
      if (audio.duration > 30) throw Error('Recording exceeds 30 seconds; please record a shorter take');
      const offline = new OfflineAudioContext(1, Math.ceil(audio.duration * 16000), 16000);
      const source = offline.createBufferSource(); source.buffer = audio; source.connect(offline.destination); source.start();
      const rendered = await offline.startRendering();
      await onSaved(encodeWav(rendered.getChannelData(0)), processing);
    } catch (error) { onError(error); }
    finally { if (context.state !== 'closed') await context.close(); }
  };
  try { recorder.start(); }
  catch (error) { clearTimeout(timeout); stream.getTracks().forEach(t => t.stop()); await context.close(); throw error; }
  return { stop };
}
