import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';

export const team = 'U8LBJLBYPR';
export const identifier = 'com.freemocap.skellyspeak';
const apple = 'src-tauri/gen/apple';

function requireValue(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function env(name: string): string {
  const value = process.env[name];
  requireValue(value, `Missing ${name}`);
  return value;
}

function run(command: string, args: string[]): string {
  const result = spawnSync(command, args, { encoding: 'utf8' });
  // Never include command arguments: security receives certificate passwords.
  requireValue(!result.error && result.status === 0, `${command} failed: ${result.stderr || result.error?.message}`);
  return result.stdout.trim();
}

export function buildNumber(runNumber: string, attempt: string): string {
  requireValue(/^[1-9]\d{0,3}$/.test(runNumber), 'iOS run number must be 1–9999');
  requireValue(/^[1-9]\d?$/.test(attempt), 'iOS attempt must be 1–99');
  return `${runNumber}.${attempt}`;
}

function version(): string {
  const value = env('RELEASE_VERSION');
  requireValue(/^\d+\.\d+\.\d+$/.test(value), 'Expected a stable release version');
  const cargo = readFileSync('src-tauri/Cargo.toml', 'utf8').match(/^version = "([^"]+)"/m)?.[1];
  requireValue(value === cargo, 'Release version differs from Cargo.toml');
  return value;
}

function plist(file: string, key: string): string {
  return run('plutil', ['-extract', key, 'raw', '-o', '-', file]);
}

interface Profile {
  uuid: string;
  teams: string[];
  entitlements: Record<string, unknown>;
  expires: string;
  deviceProvisioning: boolean;
}

export function validateProfile(profile: Profile, now = Date.now()): void {
  requireValue(/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(profile.uuid), 'Invalid profile UUID');
  requireValue(profile.teams.length === 1 && profile.teams[0] === team, 'Wrong provisioning team');
  requireValue(profile.entitlements['application-identifier'] === `${team}.${identifier}`, 'Wrong provisioning application');
  requireValue(profile.entitlements['get-task-allow'] === false, 'Profile allows debugging');
  requireValue(!profile.deviceProvisioning, 'An App Store provisioning profile is required');
  requireValue(Date.parse(profile.expires) > now, 'Invalid or expired provisioning profile');
}

function checkProfile(file: string): string {
  // plutil cannot convert a whole profile to JSON (it contains Date/Data values).
  const xml = run('plutil', ['-convert', 'xml1', '-o', '-', file]);
  const uuid = plist(file, 'UUID');
  validateProfile({
    uuid,
    teams: JSON.parse(run('plutil', ['-extract', 'TeamIdentifier', 'json', '-o', '-', file])),
    entitlements: JSON.parse(run('plutil', ['-extract', 'Entitlements', 'json', '-o', '-', file])),
    expires: plist(file, 'ExpirationDate'),
    deviceProvisioning: /<key>(ProvisionedDevices|ProvisionsAllDevices)<\/key>/.test(xml),
  });
  return uuid;
}

// Stage manual settings ourselves; avoid Tauri's quoted pbxproj signing-key
// writer/reader defects. ExportOptions also supplies the profile explicitly.
// [@tauriIosExport15741]
export function signingProject(source: string, certificate: string, uuid: string): string {
  const settings: Record<string, string> = {
    CODE_SIGN_STYLE: 'Manual',
    CODE_SIGN_IDENTITY: certificate,
    'CODE_SIGN_IDENTITY[sdk=iphoneos*]': certificate,
    DEVELOPMENT_TEAM: team,
    'DEVELOPMENT_TEAM[sdk=iphoneos*]': team,
    PROVISIONING_PROFILE_SPECIFIER: uuid,
    'PROVISIONING_PROFILE_SPECIFIER[sdk=iphoneos*]': uuid,
  };
  let count = 0;
  const result = source.replace(/buildSettings = \{\n([\s\S]*?)\n\s*\};/g, (whole, body: string) => {
    if (!/^\s*CODE_SIGN_ENTITLEMENTS\s*=/m.test(body)) return whole;
    count++;
    const retained = body.split('\n').filter(line => {
      const key = line.trim().split(' = ')[0].replace(/^"|"$/g, '');
      return !(key in settings) && key !== 'PROVISIONING_PROFILE';
    });
    const added = Object.entries(settings).map(([key, value]) => `\t\t\t\t${key.includes('[') ? JSON.stringify(key) : key} = ${JSON.stringify(value)};`);
    return `buildSettings = {\n${[...retained, ...added].join('\n')}\n\t\t\t};`;
  });
  requireValue(count === 2, `Expected two app signing configurations, found ${count}`);
  return result;
}

function temporary(): string { return join(env('RUNNER_TEMP'), 'skellyspeak-ios-signing'); }
function profileDirectories(): string[] {
  return ['Library/MobileDevice/Provisioning Profiles', 'Library/Developer/Xcode/UserData/Provisioning Profiles']
    .map(path => join(homedir(), path));
}

function stage(): void {
  const directory = temporary();
  mkdirSync(directory, { mode: 0o700 });
  const p12 = join(directory, 'certificate.p12');
  const provision = join(directory, 'profile.mobileprovision');
  writeFileSync(p12, Buffer.from(env('SIGNING_P12'), 'base64'), { mode: 0o600 });
  writeFileSync(provision, Buffer.from(env('SIGNING_PROFILE'), 'base64'), { mode: 0o600 });
  const decoded = join(directory, 'profile.plist');
  writeFileSync(decoded, run('security', ['cms', '-D', '-i', provision]), { mode: 0o600 });
  const uuid = checkProfile(decoded);
  writeFileSync(join(directory, 'uuid'), uuid);
  const original = [...run('security', ['list-keychains', '-d', 'user']).matchAll(/"([^"]+)"/g)].map(match => match[1]);
  requireValue(original.length > 0, 'Cannot read runner keychain search list');
  writeFileSync(join(directory, 'keychains.json'), JSON.stringify(original));
  const keychain = join(directory, 'signing.keychain-db');
  const password = randomBytes(32).toString('hex');
  run('security', ['create-keychain', '-p', password, keychain]);
  run('security', ['set-keychain-settings', '-lut', '7200', keychain]);
  run('security', ['unlock-keychain', '-p', password, keychain]);
  run('security', ['import', p12, '-P', env('SIGNING_PASSWORD'), '-T', '/usr/bin/codesign', '-k', keychain]);
  run('security', ['set-key-partition-list', '-S', 'apple-tool:,apple:,codesign:', '-s', '-k', password, keychain]);
  run('security', ['list-keychains', '-d', 'user', '-s', ...original, keychain]);
  const identities = [...run('security', ['find-identity', '-v', '-p', 'codesigning', keychain])
    .matchAll(/"((?:Apple Distribution|iPhone Distribution):[^"\n]+)"/g)].map(match => match[1]);
  requireValue(identities.length === 1 && identities[0].endsWith(`(${team})`), 'Expected one distribution identity for the release team');
  for (const path of profileDirectories()) {
    mkdirSync(path, { recursive: true });
    copyFileSync(provision, join(path, `${uuid}.mobileprovision`));
  }
  const projects = readdirSync(apple).filter(name => name.endsWith('.xcodeproj'));
  requireValue(projects.length === 1, 'Expected one generated Xcode project');
  const project = join(apple, projects[0], 'project.pbxproj');
  writeFileSync(project, signingProject(readFileSync(project, 'utf8'), identities[0], uuid));
  run('plutil', ['-lint', project]);
  const options = join(apple, 'ExportOptions.plist');
  writeFileSync(options, JSON.stringify({
    method: 'app-store-connect', signingStyle: 'manual', teamID: team,
    signingCertificate: identities[0], provisioningProfiles: { [identifier]: uuid },
    manageAppVersionAndBuildNumber: false,
  }));
  run('plutil', ['-convert', 'xml1', options]);
  rmSync(p12);
  console.log('Prepared App Store signing credentials and Xcode export settings.');
}

function cleanup(): void {
  const directory = temporary();
  if (!existsSync(directory)) return;
  const saved = join(directory, 'keychains.json');
  if (existsSync(saved)) run('security', ['list-keychains', '-d', 'user', '-s', ...JSON.parse(readFileSync(saved, 'utf8'))]);
  const keychain = join(directory, 'signing.keychain-db');
  if (existsSync(keychain)) run('security', ['delete-keychain', keychain]);
  const savedUuid = join(directory, 'uuid');
  if (existsSync(savedUuid)) {
    const uuid = readFileSync(savedUuid, 'utf8');
    requireValue(/^[0-9a-f-]{36}$/i.test(uuid), 'Invalid cleanup profile UUID');
    for (const path of profileDirectories()) rmSync(join(path, `${uuid}.mobileprovision`), { force: true });
  }
  rmSync(directory, { recursive: true });
}

function verify(): void {
  const releaseVersion = version();
  const expectedBuild = buildNumber(env('GITHUB_RUN_NUMBER'), env('GITHUB_RUN_ATTEMPT'));
  const ipas = readdirSync(join(apple, 'build'), { recursive: true, encoding: 'utf8' }).filter(path => path.endsWith('.ipa'));
  requireValue(ipas.length === 1, `Expected exactly one IPA, found ${ipas.length}`);
  const ipa = join(apple, 'build', ipas[0]);
  const extracted = join(env('RUNNER_TEMP'), 'skellyspeak-ipa-verification');
  requireValue(!existsSync(extracted), 'IPA verification directory already exists');
  run('unzip', ['-q', ipa, '-d', extracted]);
  const payload = join(extracted, 'Payload');
  const apps = readdirSync(payload).filter(path => path.endsWith('.app'));
  requireValue(apps.length === 1, 'Expected exactly one app in IPA');
  const app = join(payload, apps[0]);
  run('codesign', ['--verify', '--deep', '--strict', app]);
  const info = join(app, 'Info.plist');
  requireValue(plist(info, 'CFBundleIdentifier') === identifier, 'Wrong IPA bundle identifier');
  requireValue(plist(info, 'CFBundleShortVersionString') === releaseVersion, 'Wrong IPA release version');
  requireValue(plist(info, 'CFBundleVersion') === expectedBuild, 'Wrong IPA build number');
  requireValue(plist(info, 'NSMicrophoneUsageDescription').length > 0, 'IPA microphone usage description missing');
  const entitlements = join(extracted, 'entitlements.plist');
  writeFileSync(entitlements, run('codesign', ['-d', '--entitlements', ':-', app]));
  requireValue(plist(entitlements, 'com.apple.developer.team-identifier') === team, 'Wrong IPA signing team');
  requireValue(plist(entitlements, 'application-identifier') === `${team}.${identifier}`, 'Wrong IPA signing application');
  requireValue(plist(entitlements, 'get-task-allow') === 'false', 'IPA allows debugging');
  const profile = join(extracted, 'profile.plist');
  writeFileSync(profile, run('security', ['cms', '-D', '-i', join(app, 'embedded.mobileprovision')]));
  checkProfile(profile);
  mkdirSync('dist-ios');
  copyFileSync(ipa, `dist-ios/SkellySpeak_${releaseVersion}.ipa`);
  console.log(`Verified SkellySpeak ${releaseVersion}, iOS build ${expectedBuild}.`);
}

function main(): void {
  switch (process.argv[2]) {
    case 'configure': {
      const config = JSON.parse(readFileSync('src-tauri/tauri.release.conf.json', 'utf8'));
      requireValue(config.identifier === identifier, 'Release identity changed');
      config.version = version();
      config.bundle = { ...config.bundle, iOS: { ...config.bundle?.iOS,
        developmentTeam: team, bundleVersion: buildNumber(env('GITHUB_RUN_NUMBER'), env('GITHUB_RUN_ATTEMPT')),
      } };
      writeFileSync('src-tauri/tauri.release.conf.json', `${JSON.stringify(config, null, 2)}\n`);
      break;
    }
    case 'stage': stage(); break;
    case 'verify': verify(); break;
    case 'cleanup': cleanup(); break;
    default: throw new Error('Usage: node scripts/ios-release.ts configure|stage|verify|cleanup');
  }
}

if (import.meta.main) main();
