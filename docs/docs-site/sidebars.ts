import type { SidebarsConfig } from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  docsSidebar: [
    { type: 'category', label: 'Start here', collapsed: false, items: ['overview', 'navigation'] },
    { type: 'category', label: 'Use SkellySpeak', collapsed: false, items: ['chat', 'practice', 'coach', 'progress', 'skills'] },
    { type: 'category', label: 'Settings and help', collapsed: false, items: ['settings', 'troubleshooting', 'privacy'] },
  ],
};

export default sidebars;
