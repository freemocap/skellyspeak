import { useCallback, useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import type { Level, Story } from '../types'
import { isTauri, logError, logInfo } from '../lib/tauri'
import { needsSpaceBetween } from '../lib/token-spacing'
import { GlossPopup, popupAnchor, type PopupState } from '../components/GlossPopup'
import { openOverlay } from '../lib/back'

const STORAGE_PREFIX = 'skellyspeak_story_'
const LEVELS: Level[] = ['beginner', 'intermediate', 'advanced']

export default function StoriesPage() {
  const [level, setLevel] = useState<Level>('beginner')
  const [story, setStory] = useState<import('../types').Story | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [popup, setPopup] = useState<PopupState | null>(null)

  const generate = useCallback(async (target: Level) => {
    setLoading(true)
    setError(null)
    setPopup(null)
    logInfo('[stories] generating:', target)
    const started = performance.now()
    try {
      const data = await invoke<Story>('generate_story', {
        level: target,
      })
      logInfo(
        `[stories] generated in ${(performance.now() - started).toFixed(0)}ms:`,
        `"${data.title}", ${data.paragraphs.length} paragraphs,`,
        data.paragraphs.reduce((n, p) => n + p.tokens.length, 0),
        'tokens'
      )
      setStory(data)
      try {
        const lang = localStorage.getItem('skellyspeak_target') ?? 'es-ES'
        localStorage.setItem(`${STORAGE_PREFIX}${lang}_${target}`, JSON.stringify(data))
      } catch {
        /* ignore */
      }
    } catch (e) {
      logError('[stories] generation failed:', e)
      setError(String(e).replace(/^Error:\s*/, ''))
    } finally {
      setLoading(false)
    }
  }, [])

  // Restore cached story on mount.
  useEffect(() => {
    try {
      const lang = localStorage.getItem('skellyspeak_target') ?? 'es-ES'
      const raw = localStorage.getItem(`${STORAGE_PREFIX}${lang}_beginner`)
      if (raw) {
        setStory(JSON.parse(raw))
        logInfo('[stories] restored cached story')
      }
    } catch {
      /* ignore malformed cache */
    }
  }, [])

  const closePopup = useCallback(() => setPopup(null), [])
  // Android back closes the popup instead of exiting the app.
  useEffect(
    () => (popup ? openOverlay(closePopup) : undefined),
    [popup, closePopup]
  )

  function handleWordClick(
    token: { text: string; gloss: string | null },
    event: React.MouseEvent<HTMLSpanElement>
  ) {
    if (!token.gloss) return
    const pos = popupAnchor(event.currentTarget)
    setPopup((prev) =>
      prev && prev.text === token.gloss ? null : {
        text: token.gloss as string,
        ...pos,
      }
    )
  }

  return (
    <div className="stories-wrap">
      <div className="stories-top">
        <div className="level-chips">
          {LEVELS.map((lvl) => (
            <button
              key={lvl}
              type="button"
              disabled={loading || !isTauri}
              onClick={() => {
                setLevel(lvl)
                void generate(lvl)
              }}
              className={`chip ${level === lvl ? 'active' : ''}`}
            >
              {lvl}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="btn"
          disabled={loading || !isTauri}
          onClick={() => void generate(level)}
        >
          New story
        </button>
      </div>
      <p className="tap-hint">Tap any word for its meaning</p>

      <div className="story-canvas">
        {loading && <p className="center-note">Writing your story…</p>}

        {!loading && error && (
          <div style={{ textAlign: 'center' }}>
            <p className="err-note">{error}</p>
            <button type="button" className="btn" onClick={() => void generate(level)}>
              Try again
            </button>
          </div>
        )}

        {!loading && !error && !story && (
          <div style={{ textAlign: 'center' }}>
            <p className="center-note">Pick a level and get a short story written for it.</p>
            <button type="button" className="btn primary" disabled={!isTauri} onClick={() => void generate(level)}>
              New story
            </button>
          </div>
        )}

        {!loading && !error && story && (
          <article>
            <h2 className="story-title">{story.title}</h2>
            {story.paragraphs.map((paragraph, pIdx) => (
              <p key={pIdx} className="story-p">
                {paragraph.tokens.map((token, tIdx) => {
                  const prev = tIdx > 0 ? paragraph.tokens[tIdx - 1].text : ''
                  return (
                    <span key={tIdx}>
                      {tIdx > 0 && needsSpaceBetween(prev, token.text) ? ' ' : ''}
                      <span
                        data-gloss-trigger={token.gloss ? '1' : undefined}
                        onClick={(e) => handleWordClick(token, e)}
                        className={token.gloss ? 'story-word' : undefined}
                      >
                        {token.text}
                      </span>
                    </span>
                  )
                })}
              </p>
            ))}
          </article>
        )}
      </div>

      {popup && <GlossPopup popup={popup} onClose={closePopup} />}
    </div>
  )
}
