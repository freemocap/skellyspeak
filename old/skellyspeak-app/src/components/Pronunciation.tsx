import { useState } from 'react'

export function Pronunciation({ text, alwaysShow }: { text: string; alwaysShow: boolean }) {
  const [revealed, setRevealed] = useState(false)
  return alwaysShow || revealed
    ? <p className="phrase-pronunciation" dir="auto">{text}</p>
    : <button type="button" className="pronunciation-reveal" onClick={event => { event.stopPropagation(); setRevealed(true) }}>Pronunciation</button>
}
