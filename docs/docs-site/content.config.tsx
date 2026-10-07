export type Guide = { id: string; title: string; description: string };

const config = {
  title: 'SkellySpeak guides',
  description: 'Learn to use Chat, Practice, coaching, and Progress in SkellySpeak.',
  guides: [
    { id: 'navigation', title: 'Find your way around', description: 'Locate Chat, Practice, Progress, and the controls you use across the app.' },
    { id: 'chat', title: 'Have a conversation', description: 'Start a chat, write or record a reply, and open reading help.' },
    { id: 'practice', title: 'Practice a phrase', description: 'Choose a phrase, record an attempt, and inspect the result.' },
    { id: 'coach', title: 'Use the coach', description: 'Read feedback and ask questions about your conversation.' },
    { id: 'progress', title: 'Read your progress', description: 'Find skill evidence, XP, and activity reports.' },
    { id: 'skills', title: 'Explore a skill', description: 'Read skill guides, inspect evidence, and start a focused conversation.' },
    { id: 'settings', title: 'Adjust your settings', description: 'Manage language, appearance, audio, and AI access.' },
    { id: 'troubleshooting', title: 'Resolve a problem', description: 'Check connection and recording problems, then find useful error details.' },
    { id: 'privacy', title: 'Understand your data', description: 'Learn what stays in your workspace and what is sent for AI processing.' },
  ] satisfies Guide[],
};

export default config;
