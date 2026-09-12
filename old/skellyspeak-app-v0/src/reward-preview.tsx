import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { PartnerReaction } from './components/chat/PartnerReaction'
import { configureRewardSounds, playRewardSound, type RewardSoundMode } from './lib/reward-sounds'
import { installPlaybackLifecycle } from './lib/playback-lifecycle'
import './styles.css'
installPlaybackLifecycle()
configureRewardSounds('yes', false)
function Preview() {
  const [mode, setMode] = useState<RewardSoundMode>('yes')
  const [played, setPlayed] = useState(false)
  return <main style={{padding:24,background:'var(--paper)',minHeight:'100dvh',color:'var(--ink)'}}>
    <label>Play reward sounds <select value={mode} aria-label="Play reward sounds" onChange={event => { const value = event.target.value as RewardSoundMode; setMode(value); configureRewardSounds(value, false) }}><option value="yes">Yes</option><option value="no">No</option><option value="follow_tts">Follow TTS</option></select></label>
    <div style={{display:'flex',gap:8,flexWrap:'wrap',margin:'24px 0'}}>{[2,10,30].map(xp => <button key={xp} onClick={event => setPlayed(playRewardSound({kind:'xp',xp},event.currentTarget))}>+{xp} XP</button>)}<button onClick={event => setPlayed(playRewardSound({kind:'pop'},event.currentTarget))}>Pop</button><button onClick={event => setPlayed(playRewardSound({kind:'confused'},event.currentTarget))}>Confused</button><button onClick={event => setPlayed(playRewardSound({kind:'understood'},event.currentTarget))}>Understood</button></div>
    <p role="status">{played ? 'Cue played' : 'Silent'}</p>
    <div className="msg bot" style={{position:'relative',marginTop:30}}>Trabajo mucho.<PartnerReaction reaction={{kind:'confused',interpretation:'I read your message as a reason rather than a question.',explanation:'I may have misunderstood your intent. Did you mean to ask why I am tired?'}} error={undefined} message="Estoy bien porque estás cansada." reply="Trabajo mucho." onEdit={() => {}} /></div>
  </main>
}
createRoot(document.getElementById('root')!).render(<Preview />)
