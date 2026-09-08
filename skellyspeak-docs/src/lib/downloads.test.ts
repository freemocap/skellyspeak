import { describe, expect, it } from 'vitest';
import { detectSystem, hintedArchitecture, installers, parseRelease, recommend, RELEASES_URL } from './downloads';
import type { Architecture, OperatingSystem, Release } from './downloads';

describe('device detection', () => {
  it.each([
    ['Mozilla/5.0 (Linux; Android 15; Pixel 9)', 'Linux aarch64', 5, 'android', 'unknown'],
    ['Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', 'iPhone', 5, 'ios', 'unknown'],
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)', 'MacIntel', 5, 'ios', 'unknown'],
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)', 'MacIntel', 0, 'macos', 'unknown'],
    ['Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Win32', 0, 'windows', 'unknown'],
    ['Mozilla/5.0 (X11; Linux x86_64)', 'Linux x86_64', 0, 'linux', 'x64'],
    ['Mozilla/5.0 (X11; Linux aarch64)', 'Linux aarch64', 0, 'linux', 'arm64'],
    ['Mozilla/5.0 (X11; CrOS x86_64 1)', 'Linux x86_64', 0, 'unknown', 'unknown'],
    ['unknown', '', 0, 'unknown', 'unknown'],
  ])('classifies %s without guessing a desktop CPU', (userAgent, platform, maxTouchPoints, os, arch) => {
    expect(detectSystem({ userAgent, platform, maxTouchPoints })).toEqual({ os, arch });
  });

  it('requires a known 64-bit client hint', () => {
    expect(hintedArchitecture({ architecture: 'arm', bitness: '64' })).toBe('arm64');
    expect(hintedArchitecture({ architecture: 'x86', bitness: '64' })).toBe('x64');
    expect(hintedArchitecture({ architecture: 'x86', bitness: '32' })).toBe('unknown');
    expect(hintedArchitecture({ architecture: '', bitness: '' })).toBe('unknown');
  });
});

// Filenames follow the desktop and Android workflow outputs.
const names = [
  'SkellySpeak_0.9.1_aarch64.dmg', 'SkellySpeak_0.9.1_x64.dmg',
  'SkellySpeak_0.9.1_x64-setup.exe', 'SkellySpeak_0.9.1_x64_en-US.msi',
  'SkellySpeak_0.9.1_amd64.AppImage', 'SkellySpeak_0.9.1_amd64.deb',
  'SkellySpeak_0.9.1_arm64.deb', 'SkellySpeak-0.9.1-1.x86_64.rpm',
  'SkellySpeak_0.9.1_universal.apk', 'SkellySpeak_0.9.1.ipa', 'SkellySpeak_0.9.1.aab',
  'latest.json', 'SkellySpeak_aarch64.app.tar.gz', 'SkellySpeak_0.9.1_amd64.AppImage.sig',
];
const release: Release = {
  tag_name: 'v0.9.1', html_url: `${RELEASES_URL}/tag/v0.9.1`,
  assets: names.map(name => ({ name, size: 1024, browser_download_url: `${RELEASES_URL}/download/v0.9.1/${name}` })),
};

describe('published installer selection', () => {
  it('excludes updater and store artifacts', () => {
    expect(installers(release)).toHaveLength(9);
    expect(installers(release).map(item => item.format)).not.toContain('IPA');
  });

  it.each<[OperatingSystem, Architecture, string | null]>([
    ['windows', 'x64', 'EXE'], ['macos', 'arm64', 'DMG'], ['macos', 'x64', 'DMG'],
    ['linux', 'x64', 'AppImage'], ['linux', 'arm64', 'DEB'], ['android', 'unknown', 'APK'],
    ['ios', 'arm64', null], ['windows', 'arm64', null], ['macos', 'unknown', 'DMG'], ['windows', 'unknown', 'EXE'], ['unknown', 'unknown', null],
  ])('recommends only a matching %s / %s installer', (os, arch, format) => {
    const choice = recommend(installers(release), { os, arch });
    expect(choice?.format ?? null).toBe(format);
    if (choice) expect(arch === 'unknown' || choice.arch === arch || choice.arch === 'universal').toBe(true);
  });

  it('does not invent a link for a missing artifact', () => {
    expect(recommend(installers({ ...release, assets: [] }), { os: 'android', arch: 'unknown' })).toBeNull();
  });

  it('validates release data and rejects drafts, prereleases and foreign links', () => {
    const payload = { ...release, draft: false, prerelease: false };
    expect(parseRelease(payload)).toEqual(release);
    expect(() => parseRelease({ ...payload, draft: true })).toThrow();
    expect(() => parseRelease({ ...payload, prerelease: true })).toThrow();
    expect(() => parseRelease({ ...payload, assets: [{ ...release.assets[0], browser_download_url: 'https://example.com/app.exe' }] })).toThrow();
    expect(() => parseRelease({ message: 'API rate limit exceeded' })).toThrow();
  });
});
