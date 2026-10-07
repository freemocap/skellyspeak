import React from 'react'
import useBaseUrl from '@docusaurus/useBaseUrl'
import '../css/user-demo.css'

const titles = {
  navigation: 'Main navigation', chat: 'Chat and the message composer',
  practice: 'Practice cards and recording controls', progress: 'Progress counters', skills: 'Skill chart',
}

/** The app and its styles run in their own document; documentation styles cannot alter its controls. */
export default function UserDemo({ view }: { view: keyof typeof titles }) {
  const source = useBaseUrl(`/demos/?view=${view}`)
  return <figure className="user-demo">
    <figcaption><strong>Try it: {titles[view]}</strong><span>Sample data · no microphone, AI requests, or saved changes.</span></figcaption>
    <iframe src={source} title={`${titles[view]} interactive example`} loading="lazy"
      sandbox="allow-scripts allow-same-origin" allow="microphone 'none'; camera 'none'" />
    <p><a href={source} target="_blank" rel="noopener noreferrer">Open example in a full window</a>. Reload the example to reset it.</p>
  </figure>
}
