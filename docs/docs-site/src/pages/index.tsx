import Link from '@docusaurus/Link';
import Head from '@docusaurus/Head';
import Layout from '@theme/Layout';
import config from '../../content.config';
import './guides.css';

export default function Home() {
  return (
    <Layout><Head><title>User guides | SkellySpeak</title><meta name="description" content={config.description} /></Head>
      <main className="guide-home">
        <header className="guide-home-intro">
          <p className="guide-home-eyebrow">User documentation</p>
          <h1>{config.title}</h1>
          <p className="guide-home-lead">Use conversation, reading help, and spoken practice to work on a language. Start here to learn the controls and understand your results.</p>
          <div className="guide-home-actions">
            <Link className="button button--primary button--lg" to="/docs/overview">Start your first session</Link>
            <Link className="button button--secondary button--lg" to="/download">Download SkellySpeak</Link>
          </div>
        </header>
        <section className="guide-home-tour" aria-labelledby="guide-tour-title">
          <div>
            <p className="guide-home-eyebrow">Interactive walkthrough</p>
            <h2 id="guide-tour-title">See where to click</h2>
            <p>The navigation guide includes a demonstration of the app. Explore its views and labeled controls before trying them in your own workspace.</p>
          </div>
          <Link className="button button--outline button--primary" to="/docs/navigation">Open the walkthrough →</Link>
        </section>
        <section aria-labelledby="guide-directory-title">
          <div className="guide-home-section-heading">
            <h2 id="guide-directory-title">Choose a task</h2>
            <p>Each guide explains one part of the app, with steps and related controls.</p>
          </div>
          <div className="guide-home-grid">
            {config.guides.map(guide => (
              <Link className="guide-home-card" key={guide.id} to={`/docs/${guide.id}`}>
                <h3>{guide.title}<span aria-hidden="true">↗</span></h3>
                <p>{guide.description}</p>
              </Link>
            ))}
          </div>
        </section>
        <aside className="guide-home-source">
          <h2>Looking for development details?</h2>
          <p>Build instructions and technical documentation live in the <a href="https://github.com/freemocap/skellyspeak">source repository</a>. For installation packages and release notes, use the <Link to="/download">downloads page</Link>.</p>
        </aside>
      </main>
    </Layout>
  );
}
