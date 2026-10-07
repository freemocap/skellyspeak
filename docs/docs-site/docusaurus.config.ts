import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

// Also protect direct Docusaurus CLI calls and npm --ignore-scripts runs.
execFileSync(process.execPath, [join(__dirname, 'scripts/image-size-patch.mts'), '--check'], { stdio: 'inherit' });

import { themes as prismThemes } from 'prism-react-renderer';
import type { Config } from '@docusaurus/types';

const config: Config = {
  title: 'SkellySpeak',
  tagline: 'Documentation for SkellySpeak',
  favicon: 'img/favicon.ico',

  url: 'https://docs.freemocap.org',
  baseUrl: '/skellyspeak/',

  organizationName: 'freemocap',
  projectName: 'skellyspeak',

  onBrokenLinks: 'throw',

  markdown: { mermaid: true },

  themes: ['@docusaurus/theme-mermaid'],

  plugins: [
    // webpack 5 enforces full file extensions on imports from ESM packages.
    // tsup/esbuild strips .js extensions in unbundled output, so we relax
    // that strictness here.
    function skellydocsWebpackFixes() {
      return {
        name: 'skellydocs-webpack-fixes',
        configureWebpack() {
          return {
            // tsup/esbuild strips .js extensions in unbundled output;
            // webpack 5 enforces them on ESM imports, so relax that.
            module: {
              rules: [{ test: /\.m?js$/, resolve: { fullySpecified: false } }],
            },
            // Prevent webpack from reading .docusaurus/ metadata files
            // mid-write during regeneration (causes JSON parse errors on Windows).
            watchOptions: {
              ignored: ['**/.docusaurus/**'],
            },
          };
        },
      };
    },
  ],

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: require.resolve('./sidebars.ts'),
          routeBasePath: 'docs',
          editUrl: 'https://github.com/freemocap/skellyspeak/tree/main/docs/docs-site/',
        },
        blog: false,
        theme: {
          customCss: [require.resolve('@freemocap/skellydocs/css/custom.css')],
        },
      },
    ],
  ],

  themeConfig: {
    image: 'img/og-image.png',
    colorMode: {
      defaultMode: 'dark',
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'SkellySpeak',
      logo: {
        alt: 'SkellySpeak Logo',
        src: 'img/logo.png',
      },
      items: [
        { to: '/download', label: 'Download', position: 'left' },
        { type: 'docSidebar', sidebarId: 'docsSidebar', position: 'left', label: 'User guides' },
        { href: 'https://github.com/freemocap/skellyspeak', label: 'Code', position: 'right' },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Documentation',
          items: [
            { label: 'First session', to: '/docs/overview' },
            { label: 'Interface walkthrough', to: '/docs/navigation' },
            { label: 'Troubleshooting', to: '/docs/troubleshooting' },
          ],
        },
        {
          title: 'Community',
          items: [
            { label: 'Discord', href: 'https://discord.gg/freemocap' },
            { label: 'Source Code', href: 'https://github.com/freemocap/skellyspeak' },
            { label: 'FreeMoCap', href: 'https://freemocap.org' },
          ],
        },
        {
          title: 'App',
          items: [
            { label: 'Download', to: '/download' },
            { label: 'Settings', to: '/docs/settings' },
            { label: 'Privacy and data', to: '/docs/privacy' },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} FreeMoCap Foundation. Built with <a href="https://github.com/freemocap/skellydocs" target="_blank" rel="noopener noreferrer">SkellyDocs</a>.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['bash', 'json', 'python', 'typescript'],
    },
    mermaid: {
      theme: { light: 'neutral', dark: 'dark' },
    },
  },
};

export default config;
