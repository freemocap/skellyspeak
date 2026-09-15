import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const workflow = readFileSync(new URL('../.github/workflows/ios-distribute.yml', import.meta.url), 'utf8');
function shellStep(name: string): string {
  const section = workflow.split(`      - name: ${name}\n`)[1];
  assert.ok(section, `Missing step ${name}`);
  const body = section.split('\n      - ')[0];
  const inline = body.match(/^        run: (?!\|)(.+)$/m);
  if (inline) return inline[1];
  const lines = body.split('        run: |\n')[1].split('\n');
  const end = lines.findIndex(line => line.length > 0 && !line.startsWith('          '));
  return lines.slice(0, end < 0 ? undefined : end).map(line => line.slice(10)).join('\n');
}

test('distribution stages credentials separately and verifies before artifact consumers', () => {
  const build = workflow.split('\n  attach-release:')[0];
  assert.ok(build.indexOf('Verify the .ipa') < build.indexOf('actions/upload-artifact@'));
  assert.ok(build.includes('if: always()'));
  const command = shellStep('Build the signed .ipa');
  assert.equal(command.trim(), 'npm run tauri -- ios build --export-method app-store-connect');
  for (const job of ['attach-release', 'testflight']) {
    const body = workflow.split(`\n  ${job}:\n`)[1];
    assert.match(body, job === 'testflight'
      ? /needs: \[build-ipa, attach-release\]/
      : /needs: build-ipa/);
    assert.match(body, /gh run download "\$GITHUB_RUN_ID" --name ios-ipa/);
  }
  const release = readFileSync(new URL('../.github/workflows/release.yml', import.meta.url), 'utf8');
  assert.match(release.split('\n  publish-release:\n')[1], /needs: \[version, release-draft, desktop, android\]/);
  assert.ok(!release.includes('\n  ios:'));
});

test('actual verification shell accepts distribution IPA and rejects bad identity, build, signature and debug permission',
  { skip: process.platform !== 'darwin' }, () => {
    const root = mkdtempSync(join(tmpdir(), 'skellyspeak-ipa-test-'));
    try {
      const bin = join(root, 'bin'); mkdirSync(bin);
      // Signing itself needs release credentials. Substitute only codesign;
      // execute the workflow shell, real zip/unzip and Apple's plist parser.
      const codesign = join(bin, 'codesign');
      writeFileSync(codesign, `#!/bin/bash
if [ "$1" = --verify ]; then exit "\${SIGNATURE_STATUS:-0}"; fi
if [ "$2" = --entitlements ]; then cat "$FIXTURE_ENTITLEMENTS"; exit 0; fi
printf 'TeamIdentifier=%s\\n' "$FIXTURE_TEAM" >&2
`);
      chmodSync(codesign, 0o755);
      const script = shellStep('Verify the .ipa is signed for the right team');
      for (const scenario of ['valid', 'wrong-team', 'wrong-bundle', 'wrong-build', 'debug', 'bad-signature', 'no-microphone']) {
        const cwd = join(root, scenario); mkdirSync(cwd);
        const temp = join(cwd, 'temp'); mkdirSync(temp);
        const app = join(cwd, 'Payload', 'SkellySpeak.app'); mkdirSync(app, { recursive: true });
        writeFileSync(join(app, 'Info.plist'), JSON.stringify({
          CFBundleIdentifier: scenario === 'wrong-bundle' ? 'other.app' : 'com.freemocap.skellyspeak',
          CFBundleVersion: scenario === 'wrong-build' ? '4.1' : '52.2',
          NSMicrophoneUsageDescription: scenario === 'no-microphone' ? '' : 'Record your voice',
        }));
        const entitlements = join(cwd, 'entitlements.plist');
        writeFileSync(entitlements, JSON.stringify({
          'get-task-allow': scenario === 'debug',
          'com.apple.developer.team-identifier': 'U8LBJLBYPR',
        }));
        const build = join(cwd, 'native/gen/apple/build'); mkdirSync(build, { recursive: true });
        const zip = spawnSync('zip', ['-qr', join(build, 'app.ipa'), 'Payload'], { cwd, encoding: 'utf8' });
        assert.equal(zip.status, 0, zip.stderr);
        const result = spawnSync('bash', ['-c', script], { cwd, encoding: 'utf8', env: {
          ...process.env, PATH: `${bin}:${process.env.PATH}`, RUNNER_TEMP: temp,
          GITHUB_RUN_NUMBER: '52', GITHUB_RUN_ATTEMPT: '2', FIXTURE_ENTITLEMENTS: entitlements,
          FIXTURE_TEAM: scenario === 'wrong-team' ? 'OTHER' : 'U8LBJLBYPR',
          SIGNATURE_STATUS: scenario === 'bad-signature' ? '1' : '0',
        } });
        if (scenario === 'valid') assert.equal(result.status, 0, result.stdout + result.stderr);
        else assert.notEqual(result.status, 0, `Verifier accepted ${scenario}`);
      }
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
