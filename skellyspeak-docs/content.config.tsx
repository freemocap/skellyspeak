import type { SkellyDocsConfig } from '@freemocap/skellydocs';

const config: SkellyDocsConfig = {
  hero: {
    title: 'SkellySpeak',
    accentedSuffix: 'SkellySpeak',
    subtitle: 'A multilingual conversation tutor',
    tagline: 'Practice with an in-character partner, private coach, and on-demand language help.',
    logoSrc: '/skellyspeak/img/logo.png',
    parentProject: {
      name: 'FreeMoCap',
      url: 'https://freemocap.org',
    },
    ctaButtons: [
      { label: 'Download SkellySpeak', to: '/download', variant: 'primary' },
      {
        label: 'View the source',
        to: 'https://github.com/freemocap/skellyspeak',
        variant: 'secondary',
      },
    ],
  },

  features: [
    {
      id: 'guided-conversation',
      icon: '💬',
      title: 'Guided conversation',
      description: 'Streamed practice shaped by your language, level, topic, dialect, and persona.',
      summary: (
        <>
          Interrogate either side of the conversation word by word, reveal
          translations, inspect grammar, and use generated reply scaffolds.
        </>
      ),
      issues: [],
      docPath: 'overview',
    },
    {
      id: 'private-coach',
      icon: '🧭',
      title: 'Private coach',
      description: 'Corrections and explanations that never break the conversation partner’s character.',
      summary: (
        <>
          Receive per-message feedback or ask follow-up questions in a private,
          persistent coaching thread.
        </>
      ),
      issues: [],
      docPath: 'coach',
    },
    {
      id: 'local-ownership',
      icon: '🔐',
      title: 'Local ownership',
      description: 'Conversations stay on the device and credentials use the platform vault.',
      summary: (
        <>
          Choose the hosted service, bring your own provider keys, or connect an
          OpenAI-compatible chat server.
        </>
      ),
      issues: [],
      docPath: 'architecture',
    },
  ],

  guarantees: [],
  guaranteeIssues: [],

  guaranteesConfig: {
    title: (
      <>
        The implementation is built around these{' '}
        <span style={{ color: 'var(--sk-accent)' }}>guarantees</span>:
      </>
    ),
    items: [
      'The conversation partner never sees the private coach thread.',
      'Provider modes do not silently fall back to a different route.',
      'Unreadable persisted data is reported instead of replaced with empty state.',
      'The execution graph reconciles its declaration against observed model runs.',
    ],
    issues: [],
  },
};

export default config;
