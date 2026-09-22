/** Durable study storage, outside the checkout; no credentials are copied. */
import { homedir } from 'node:os';
import { resolve, join, isAbsolute } from 'node:path';
import { mkdirSync, readFileSync, writeFileSync, renameSync, readdirSync, existsSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
export function studyDirectory(): string {
  const configured = process.env.TRANSCRIPTION_LAB_DATA_DIR;
  if (configured && !isAbsolute(configured)) throw Error('TRANSCRIPTION_LAB_DATA_DIR must be absolute');
  return configured || join(homedir(), 'SkellySpeak Recordings', 'transcription-study');
}
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
function atomic(path: string, bytes: Uint8Array) {
  const temp = `${path}.${randomUUID()}.tmp`;
  writeFileSync(temp, bytes, { mode: 0o600, flush: true }); renameSync(temp, path);
}
export function saveStudyFile(directory: string, file: string, bytes: Uint8Array) {
  const recovery = join(directory, 'recovery'); mkdirSync(recovery, { recursive: true, mode: 0o700 });
  // Fail visibly if either copy cannot be saved. Recovery is on the same disk.
  atomic(join(recovery, file), bytes);
  atomic(join(directory, file), bytes);
}
export function snapshotStudy(directory: string): string | undefined {
  if (!existsSync(directory)) return;
  const entries = readdirSync(directory, { withFileTypes: true }).filter(e => e.isFile() && !e.name.endsWith('.tmp'));
  if (!entries.length) return;
  const destination = join(directory, 'snapshots', `${new Date().toISOString().replaceAll(':','-')}-${randomUUID().slice(0,8)}`);
  mkdirSync(destination, { recursive: true, mode: 0o700 });
  const manifest: Record<string, string> = {};
  for (const entry of entries) {
    const bytes = readFileSync(join(directory, entry.name));
    writeFileSync(join(destination, entry.name), bytes, { mode: 0o600, flush: true });
    manifest[entry.name] = hash(bytes);
    if (hash(readFileSync(join(destination, entry.name))) !== manifest[entry.name]) throw Error('Snapshot verification failed');
  }
  writeFileSync(join(destination, 'snapshot-manifest.json'), JSON.stringify(manifest,null,2), { mode: 0o600, flush: true });
  return destination;
}
export function prepareStudy(directory: string, legacy = resolve('.local/transcription-workbench')) {
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const marker = join(directory, 'legacy-import.json');
  if (resolve(directory) !== resolve(legacy) && existsSync(legacy) && !existsSync(marker)) {
    const entries = readdirSync(legacy, { withFileTypes: true }).filter(e => e.isFile() && !e.name.endsWith('.tmp'));
    // Preflight all conflicts before copying; never overwrite another corpus.
    for (const e of entries) {
      const target = join(directory,e.name);
      if (existsSync(target) && hash(readFileSync(target)) !== hash(readFileSync(join(legacy,e.name)))) throw Error(`Study import conflict: ${e.name}`);
    }
    const manifest: Record<string,string> = {};
    for (const e of entries) {
      const bytes = readFileSync(join(legacy,e.name));
      saveStudyFile(directory,e.name,bytes);
      manifest[e.name] = hash(bytes);
      if (hash(readFileSync(join(directory,e.name))) !== manifest[e.name]) throw Error('Study import verification failed');
    }
    writeFileSync(marker, JSON.stringify({ source:legacy, imported:new Date().toISOString(), sha256:manifest },null,2), { mode:0o600, flush:true });
  }
  snapshotStudy(directory);
}
