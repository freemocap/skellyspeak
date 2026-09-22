/** Canonical benchmark upload: mono PCM16 WAV, 16 kHz, 0.2–30 seconds. */
export function wavMetrics(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const ascii = (start: number, length: number) => String.fromCharCode(...bytes.slice(start, start + length));
  if (bytes.length < 44 || ascii(0, 4) !== 'RIFF' || ascii(8, 8) !== 'WAVEfmt ' || ascii(36, 4) !== 'data'
      || view.getUint32(16, true) !== 16 || view.getUint16(20, true) !== 1 || view.getUint16(22, true) !== 1
      || view.getUint32(24, true) !== 16000 || view.getUint32(28, true) !== 32000 || view.getUint16(32, true) !== 2
      || view.getUint16(34, true) !== 16 || view.getUint32(40, true) !== bytes.length - 44
      || view.getUint32(4, true) !== bytes.length - 8 || (bytes.length - 44) % 2) throw Error('Expected canonical mono PCM16 16 kHz WAV');
  const samples = (bytes.length - 44) / 2, duration = samples / 16000;
  if (duration < 0.2 || duration > 30) throw Error('Record between 0.2 and 30 seconds');
  let sum = 0, peak = 0, clipped = 0;
  for (let i = 0; i < samples; i++) {
    const sample = Math.abs(view.getInt16(44 + i * 2, true) / 32768);
    sum += sample * sample; peak = Math.max(peak, sample); if (sample >= 0.999) clipped++;
  }
  return { duration, rms: Math.sqrt(sum / samples), peak, clippedFraction: clipped / samples };
}
export function encodeWav(samples: Float32Array): Uint8Array {
  const bytes = new Uint8Array(44 + samples.length * 2), view = new DataView(bytes.buffer);
  for (const [offset, text] of [[0, 'RIFF'], [8, 'WAVEfmt '], [36, 'data']] as const)
    [...text].forEach((char, i) => bytes[offset + i] = char.charCodeAt(0));
  view.setUint32(4, bytes.length - 8, true); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, 1, true); view.setUint32(24, 16000, true); view.setUint32(28, 32000, true);
  view.setUint16(32, 2, true); view.setUint16(34, 16, true); view.setUint32(40, samples.length * 2, true);
  samples.forEach((s, i) => view.setInt16(44 + i * 2, Math.round(Math.max(-1, Math.min(1, s)) * (s < 0 ? 32768 : 32767)), true));
  return bytes;
}
