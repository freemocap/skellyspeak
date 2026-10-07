import Link from '@docusaurus/Link';
import Head from '@docusaurus/Head';
import Layout from '@theme/Layout';
import './guides.css';

export default function Roadmap() {
  return (
    <Layout><Head><title>Development and user guides | SkellySpeak</title><meta name="description" content="Find current SkellySpeak user guides and development discussions." /></Head>
      <main className="guide-home guide-home-wayfinding">
        <p className="guide-home-eyebrow">Development</p>
        <h1>Development and user guides</h1>
        <p>This documentation site now focuses on using SkellySpeak. Start with the <Link to="/docs/overview">first-session guide</Link> or <Link to="/docs/navigation">explore the interface</Link>.</p>
        <p>For development work and open questions, see the <a href="https://github.com/freemocap/skellyspeak">source repository</a> and <a href="https://github.com/freemocap/skellyspeak/issues">issue tracker</a>. Proposals there may describe work that is not available in the app.</p>
      </main>
    </Layout>
  );
}
