import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildNumber, identifier, signingProject, team, validateProfile } from './ios-release.ts';

test('build numbers increase across runs and reruns, with Apple component bounds', () => {
  assert.equal(buildNumber('123', '2'), '123.2');
  assert.equal(buildNumber('124', '1'), '124.1');
  for (const [run, attempt] of [['0', '1'], ['10000', '1'], ['2', '100'], ['-1', '1'], ['1', '1.2']]) {
    assert.throws(() => buildNumber(run, attempt));
  }
});

const validProfile = {
  uuid: '01234567-89AB-CDEF-0123-456789ABCDEF', teams: [team],
  entitlements: { 'application-identifier': `${team}.${identifier}`, 'get-task-allow': false },
  expires: '2030-01-01T00:00:00Z', deviceProvisioning: false,
};
test('only an unexpired App Store profile for this application is admitted', () => {
  const now = Date.parse('2026-09-13T00:00:00Z');
  validateProfile(validProfile, now);
  for (const patch of [
    { uuid: '../unexpected-profile' }, { teams: ['OTHER'] }, { deviceProvisioning: true },
    { expires: '2026-09-12T00:00:00Z' }, { expires: 'invalid' },
    { entitlements: { ...validProfile.entitlements, 'get-task-allow': true } },
    { entitlements: { ...validProfile.entitlements, 'application-identifier': `${team}.other` } },
  ]) assert.throws(() => validateProfile({ ...validProfile, ...patch }, now));
});

const appSettings = `buildSettings = {
                CODE_SIGN_ENTITLEMENTS = app.entitlements;
                CODE_SIGN_STYLE = Automatic;
                "CODE_SIGN_IDENTITY[sdk=iphoneos*]" = "Apple Development";
                PROVISIONING_PROFILE_SPECIFIER = "old-profile";
                PRODUCT_BUNDLE_IDENTIFIER = com.freemocap.skellyspeak;
            };`;
test('manual signing replaces defaults in both app configurations only and is idempotent', () => {
  const unrelated = 'buildSettings = {\n                OTHER = retained;\n            };';
  const source = [appSettings, unrelated, appSettings].join('\n');
  const certificate = `Apple Distribution: Example (${team})`;
  const patched = signingProject(source, certificate, validProfile.uuid);
  assert.ok(patched.includes(unrelated));
  assert.ok(!patched.includes('Automatic'));
  assert.ok(!patched.includes('Apple Development'));
  assert.ok(!patched.includes('old-profile'));
  assert.equal(patched.match(/CODE_SIGN_STYLE = "Manual"/g)?.length, 2);
  assert.equal(patched.match(/"PROVISIONING_PROFILE_SPECIFIER\[sdk=iphoneos\*\]" =/g)?.length, 2);
  assert.equal(signingProject(patched, certificate, validProfile.uuid), patched);
  assert.throws(() => signingProject(unrelated, certificate, validProfile.uuid));
  assert.throws(() => signingProject(appSettings, certificate, validProfile.uuid));
});

test('configure stamps Cargo version and attempt before scaffolding, rejecting version mismatch', () => {
  const directory = mkdtempSync(join(tmpdir(), 'skellyspeak-ios-test-'));
  try {
    mkdirSync(join(directory, 'src-tauri'));
    writeFileSync(join(directory, 'src-tauri/Cargo.toml'), '[package]\nversion = "1.2.3"\n');
    const config = join(directory, 'src-tauri/tauri.release.conf.json');
    writeFileSync(config, JSON.stringify({ identifier }));
    const script = fileURLToPath(new URL('./ios-release.ts', import.meta.url));
    const result = spawnSync(process.execPath, [script, 'configure'], { cwd: directory,
      env: { ...process.env, RELEASE_VERSION: '1.2.3', GITHUB_RUN_NUMBER: '52', GITHUB_RUN_ATTEMPT: '2' }, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    const stamped = readFileSync(config, 'utf8');
    assert.deepEqual(JSON.parse(stamped), { identifier, version: '1.2.3', bundle: {
      iOS: { developmentTeam: team, bundleVersion: '52.2' },
    } });
    const mismatch = spawnSync(process.execPath, [script, 'configure'], { cwd: directory,
      env: { ...process.env, RELEASE_VERSION: '1.2.4' }, encoding: 'utf8' });
    assert.notEqual(mismatch.status, 0);
    assert.match(mismatch.stderr, /differs from Cargo.toml/);
    assert.equal(readFileSync(config, 'utf8'), stamped);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('release publication requires the iOS job and the IPA attachment', () => {
  const workflow = readFileSync(new URL('../.github/workflows/release.yml', import.meta.url), 'utf8');
  const publish = workflow.split('\n  publish-release:\n')[1];
  assert.match(publish, /needs: \[version, release-draft, desktop, android, ios\]/);
  assert.match(publish, /grep -Fx "SkellySpeak_\$\{TAG#v\}\.ipa"/);
  const ios = workflow.split('\n  ios:\n')[1].split('\n  publish-release:\n')[0];
  assert.match(ios, /needs: \[version, release-draft\]/);
  assert.ok(ios.indexOf('ios-release.ts verify') < ios.indexOf('gh release upload'));
  assert.ok(!ios.includes('continue-on-error'));
  assert.ok(!ios.includes('old/'));
});
