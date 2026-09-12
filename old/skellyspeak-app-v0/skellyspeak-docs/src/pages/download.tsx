import { useEffect, useRef, useState } from 'react';
import Link from '@docusaurus/Link';
import Head from '@docusaurus/Head';
import Layout from '@theme/Layout';
import { architectureLabel, detectSystem, hintedArchitecture, installers, matchingInstallers, OS_LABELS, parseRelease, recommend, RELEASE_API, RELEASES_URL } from '../lib/downloads';
import type { Architecture, ClientHints, Installer, OperatingSystem, Release, System } from '../lib/downloads';
import './download.css';

type ReleaseState = { status: 'loading' } | { status: 'ready'; release: Release } | { status: 'error'; message: string };
type HintNavigator = Navigator & { userAgentData?: { getHighEntropyValues: (hints: string[]) => Promise<ClientHints> } };

function InstallSteps({ installer }: { installer: Installer }) {
  const instructions: Record<Installer['format'], string> = {
    EXE: 'Download and run the installer, then launch SkellySpeak from the Start menu.',
    MSI: 'Open the package and follow the setup steps.',
    DMG: 'Open the disk image and drag SkellySpeak into Applications. Open it from Applications.',
    APK: 'Open the APK on your Android device and allow your browser to install apps if prompted. Updates must use the same signing key as your installed copy.',
    AppImage: 'Make the downloaded file executable in its properties, then open it. Requires a system with AppImage support.',
    DEB: 'Open with your package installer. For Debian, Ubuntu, and compatible distributions.',
    RPM: 'Open with your package installer. For Fedora and compatible distributions.',
  };
  return <p><strong className="dl-install-term">{installer.format}</strong> {instructions[installer.format]}</p>;
}

function DownloadCard({ installer, primary }: { installer: Installer; primary: boolean }) {
  return <a href={installer.asset.browser_download_url} className={`dl-card${primary ? ' dl-card-recommended' : ''}`}>
    <div className="dl-card-info">
      <div className="dl-card-name">{OS_LABELS[installer.os]} {installer.format === 'MSI' ? 'MSI package' : installer.format === 'EXE' ? 'EXE setup' : `${installer.format} installer`}
        {primary && <span className="dl-badge dl-badge-rec">recommended</span>}
      </div>
      <div className="dl-card-meta">{architectureLabel(installer.arch, installer.os)} · {installer.format}</div>
    </div>
    <div className="dl-card-right"><span className="dl-card-size">{(installer.asset.size / 1024 / 1024).toFixed(1)} MB</span>
      <span className={`dl-card-btn dl-card-btn-${primary ? 'primary' : 'secondary'}`}>Download</span>
    </div>
  </a>;
}

export default function DownloadPage() {
  const [system, setSystem] = useState<System>({ os: 'unknown', arch: 'unknown' });
  const [detection, setDetection] = useState('Checking your device…');
  const manuallySelected = useRef(false);
  const [state, setState] = useState<ReleaseState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    const detected = detectSystem(navigator);
    setSystem(detected);
    setDetection(detected.os === 'unknown' ? 'Choose your operating system below.' : `Your browser reports ${OS_LABELS[detected.os]}. You can change the selection below.`);
    const hints = (navigator as HintNavigator).userAgentData;
    if (hints && ['windows', 'macos', 'linux'].includes(detected.os)) {
      void hints.getHighEntropyValues(['architecture', 'bitness']).then(values => {
        if (active && !manuallySelected.current) {
          const arch = hintedArchitecture(values);
          setSystem({ ...detected, arch });
          setDetection(arch === 'unknown' ? 'Your browser does not report your processor. Compare the labeled downloads below.' : `Detected ${OS_LABELS[detected.os]} · ${architectureLabel(arch, detected.os)}.`);
        }
      }).catch((error: unknown) => {
        if (active && !manuallySelected.current) setDetection(`Processor detection failed: ${String(error)}. Choose your processor below.`);
      });
    }
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: 'loading' });
    void fetch(RELEASE_API, { signal: controller.signal, headers: { Accept: 'application/vnd.github+json' } })
      .then(async response => {
        if (!response.ok) throw new Error(`GitHub returned HTTP ${response.status}.`);
        return parseRelease(await response.json());
      })
      .then(release => { if (!controller.signal.aborted) setState({ status: 'ready', release }); })
      .catch((error: unknown) => { if (!controller.signal.aborted) setState({ status: 'error', message: String(error) }); });
    return () => controller.abort();
  }, [attempt]);

  const available = state.status === 'ready' ? installers(state.release) : [];
  const recommended = recommend(available, system);
  const matching = matchingInstallers(available, system);
  const needsProcessor = ['macos', 'windows', 'linux'].includes(system.os) && system.arch === 'unknown';
  const alternatives = matching.filter(item => item !== recommended);
  const choices: { value: string; label: string }[] = [
    { value: 'windows:x64', label: 'Windows (x64)' },
    { value: 'windows:arm64', label: 'Windows (ARM64)' },
    { value: 'macos:unknown', label: 'Mac (both processors)' },
    { value: 'macos:arm64', label: 'Mac (Apple Silicon)' },
    { value: 'macos:x64', label: 'Mac (Intel)' },
    { value: 'linux:x64', label: 'Linux x64' },
    { value: 'linux:arm64', label: 'Linux ARM64' },
    { value: 'android:unknown', label: 'Android' },
    { value: 'ios:unknown', label: 'iPhone / iPad' },
  ];
  const selected = `${system.os}:${system.arch}`;

  return <Layout>
    <Head><title>Download SkellySpeak</title><meta name="description" content="Download SkellySpeak for desktop and Android. Choose your system and get the latest installer." /></Head>
    <main className="skellyspeak-download">
      <aside className="dl-prealpha" aria-label="Pre-alpha notice">
        <div className="dl-container"><strong>Pre-alpha — expect things to break.</strong> SkellySpeak is a new project in active development. You’re welcome to try it, but it probably won’t work reliably yet. Hosted login is limited to known parties at this time.</div>
      </aside>
      <header className="dl-hero">
        <h1>Download SkellySpeak</h1>
        <p>A multilingual conversation tutor.</p>
        <div className="dl-repo-links"><a href="https://github.com/freemocap/skellyspeak">GitHub</a><span className="dl-repo-sep">·</span><a href={RELEASES_URL}>Release Notes</a><span className="dl-repo-sep">·</span><Link to="/docs/overview">Getting Started</Link></div>
      </header>
      <div className="dl-page"><div className="dl-container">
        <section className="dl-section-block" aria-labelledby="app-installer">
          <p className="dl-access">For AI access, use our hosted login (limited to known parties at this time), or enter your own API keys for <strong>OpenRouter</strong> and <strong>Groq</strong> (G-R-O-Q, not G-R-O-K) in Settings.</p>
          <p className="dl-access">Revisit this page on an Android phone to download the APK. iPhone testing is limited to known parties at this time.</p>
          <div className="dl-section-header">
            <h2 className="dl-section-title" id="app-installer">App Installer</h2>
            <div className="dl-section-lead-row">
              <p className="dl-section-lead">Conversation practice, voice recording, and a private language coach.</p>
              <div className="dl-title-controls">
                <div className="dl-version-row">Version: {state.status === 'ready' ? <a href={state.release.html_url}>{state.release.tag_name} · latest</a> : '—'}</div>
                <label className="dl-os-row" htmlFor="dl-os-select">System:
                  <select id="dl-os-select" className="dl-os-select" value={selected} title={detection} onChange={event => {
                    const [os, arch] = event.target.value.split(':') as [OperatingSystem, Architecture];
                    manuallySelected.current = true;
                    setSystem({ os, arch });
                    setDetection('Showing your selected system.');
                  }}>
                    {!choices.some(choice => choice.value === selected) && <option value={selected}>{system.os === 'unknown' ? 'Choose your system' : `${OS_LABELS[system.os]} — choose processor`}</option>}
                    {choices.map(choice => <option key={choice.value} value={choice.value}>{choice.label}</option>)}
                  </select>
                </label>
              </div>
            </div>
          </div>
          <div aria-live="polite" aria-busy={state.status === 'loading'}>
            {state.status === 'loading' && <p className="dl-no-detect">Loading the latest published release…</p>}
            {state.status === 'error' && <div className="dl-no-detect" role="alert"><p>Couldn’t load downloads: {state.message}</p><button type="button" onClick={() => setAttempt(value => value + 1)}>Try again</button> · <a href={RELEASES_URL}>Open GitHub releases</a></div>}
            {state.status === 'ready' && <>
              {system.os === 'ios' ? <div className="dl-section-details-content"><p>iPhone testing is limited to known parties at this time. Install through your TestFlight invitation. The release IPA is not a direct-install download.</p><Link to="/docs/platforms#ios">iOS distribution details →</Link></div>
                : <>
                  {needsProcessor && <div className="dl-no-detect" role="status"><p>Both processor options are shown until your processor is detected or selected. Check the labels below; neither architecture is recommended without that information.</p>{system.os === 'macos' && <p>Open Apple menu → <strong>About This Mac</strong>. Choose <strong>Mac (Intel)</strong> for an Intel processor, or <strong>Mac (Apple Silicon)</strong> for an Apple M-series chip.</p>}</div>}
                  {recommended && <div className="dl-downloads"><DownloadCard installer={recommended} primary /></div>}
                  {!recommended && !needsProcessor && <p className="dl-no-detect">{system.os === 'unknown' ? 'Could not detect your OS. All available downloads are shown below with their system and processor labels.' : `No matching installer for ${OS_LABELS[system.os]} in this release.`}</p>}
                  {alternatives.length > 0 && <>
                    {recommended && <div className="dl-alt-format-label">Also available for your system:</div>}
                    <div className="dl-downloads">{alternatives.map(installer => <DownloadCard key={installer.asset.name} installer={installer} primary={false} />)}</div>
                  </>}
                  {matching.length > 0 && <div className="dl-section-details-content">{matching.filter((installer, index) => matching.findIndex(item => item.format === installer.format) === index).map(installer => <InstallSteps key={installer.format} installer={installer} />)}</div>}
                </>}
            </>}
          </div>
        </section>

        <div className="dl-detect-zone"><div className="dl-system-help">
          <details className="dl-details">
            <summary className="dl-toggle"><span className="dl-arrow">▶</span> Not sure what system you have?</summary>
            <div className="dl-help-content">
              <div className="dl-help-section"><div className="dl-help-section-title"><strong className="dl-install-term">macOS</strong> Intel or Apple Silicon?</div><p>Apple menu → <strong>About This Mac</strong>. An Apple M-series chip means Apple Silicon; an Intel processor means Intel.</p></div>
              <div className="dl-help-section"><div className="dl-help-section-title"><strong className="dl-install-term">Windows</strong></div><p>Settings → System → About → System type. Choose x64 for Intel/AMD, or ARM64 for an ARM-based processor.</p></div>
              <div className="dl-help-section"><div className="dl-help-section-title"><strong className="dl-install-term">Linux</strong> x64 or ARM64?</div><p>Run <code>uname -m</code>: <code>x86_64</code> means x64; <code>aarch64</code> means ARM64. DEB is for Debian/Ubuntu; RPM is for Fedora-compatible systems.</p></div>
              <p role="status">{detection}</p>
            </div>
          </details>
        </div></div>

        {state.status === 'ready' && <details className="dl-details">
          <summary className="dl-toggle"><span className="dl-arrow">▶</span> All platforms &amp; formats</summary>
          <div className="dl-downloads">{available.map(installer => <DownloadCard key={installer.asset.name} installer={installer} primary={false} />)}</div>
          {!available.length && <p className="dl-no-detect">No supported installers attached to this release.</p>}
        </details>}
        <div className="dl-note">Part of the <a href="https://freemocap.org">FreeMoCap</a> project. Source code on <a href="https://github.com/freemocap/skellyspeak">GitHub</a>. <Link to="/docs/overview">Getting started</Link> · <a href={RELEASES_URL}>Release notes and changelogs</a>.</div>
        <noscript><p><a href={RELEASES_URL}>Browse SkellySpeak releases on GitHub.</a></p></noscript>
      </div></div>
    </main>
  </Layout>;
}
