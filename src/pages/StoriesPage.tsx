import { useCallback, useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import type { Level, Story } from '../types'
import { getSettings, isTauri, logInfo } from '../lib/tauri'
import { needsSpaceBetween } from '../lib/token-spacing'
import { GlossPopup, popupAnchor, type PopupState } from '../components/GlossPopup'
import { openOverlay } from '../lib/back'
import { reportFault } from '../lib/faults'

const STORAGE_PREFIX = 'skellyspeak_story_'
const STORAGE_LEVEL = 'skellyspeak_story_level'
const LEVELS: Level[] = ['beginner', 'intermediate', 'advanced']

interface StoriesPageProps {
  settingsVersion: number
}

function isLevel(value: string): value is Level {
  return LEVELS.some((level: Level): boolean => level === value)
}

function parseCachedStory(raw: string): Story {
  const value: unknown = JSON.parse(raw)
  if (typeof value !== 'object' || value === null) {
    throw new Error('The saved story is not an object.')
  }
  const candidate = value as { title?: unknown; paragraphs?: unknown }
  if (typeof candidate.title !== 'string' || !Array.isArray(candidate.paragraphs)) {
    throw new Error('The saved story has an invalid title or paragraph list.')
  }
  for (const paragraph of candidate.paragraphs) {
    if (typeof paragraph !== 'object' || paragraph === null) {
      throw new Error('The saved story contains an invalid paragraph.')
    }
    const tokens = (paragraph as { tokens?: unknown }).tokens
    if (!Array.isArray(tokens)) {
      throw new Error('The saved story contains a paragraph without tokens.')
    }
    for (const token of tokens) {
      if (typeof token !== 'object' || token === null) {
        throw new Error('The saved story contains an invalid token.')
      }
      const candidateToken = token as { text?: unknown; gloss?: unknown }
      if (
        typeof candidateToken.text !== 'string'
        || (candidateToken.gloss !== null && typeof candidateToken.gloss !== 'string')
      ) {
        throw new Error('The saved story contains invalid token text or gloss data.')
      }
    }
  }
  return value as Story
}

export default function StoriesPage({ settingsVersion }: StoriesPageProps) {
  const [level, setLevel] = useState<Level>('beginner')
  const [story, setStory] = useState<import('../types').Story | null>(null)
  const [targetLanguage, setTargetLanguage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [popup, setPopup] = useState<PopupState | null>(null)

  const generate = useCallback(async (target: Level) => {
    if (targetLanguage === null) {
      throw new Error('Cannot generate a story before settings have loaded.')
    }
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
      localStorage.setItem(`${STORAGE_PREFIX}${targetLanguage}_${target}`, JSON.stringify(data))
    } catch (e) {
      reportFault('Story generation', e)
      setError(String(e).replace(/^Error:\s*/, ''))
    } finally {
      setLoading(false)
    }
  }, [targetLanguage])

  // Restore the selected level and the current language's matching story.
  useEffect(() => {
    if (!isTauri) return
    void getSettings()
      .then((settings) => {
        const savedLevel = localStorage.getItem(STORAGE_LEVEL)
        if (savedLevel !== null && !isLevel(savedLevel)) {
          throw new Error(`The saved story level is invalid: ${savedLevel}`)
        }
        const restoredLevel: Level = savedLevel ?? 'beginner'
        const raw = localStorage.getItem(
          `${STORAGE_PREFIX}${settings.target_language}_${restoredLevel}`
        )
        setTargetLanguage(settings.target_language)
        setLevel(restoredLevel)
        setStory(raw === null ? null : parseCachedStory(raw))
        setError(null)
        if (raw !== null) logInfo('[stories] restored cached story')
      })
      .catch((cause: unknown) => {
        reportFault('Restoring saved story', cause)
        setError(String(cause).replace(/^Error:\s*/, ''))
      })
  }, [settingsVersion])

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
              disabled={loading || !isTauri || targetLanguage === null}
              onClick={() => {
                try {
                  localStorage.setItem(STORAGE_LEVEL, lvl)
                  setLevel(lvl)
                  void generate(lvl)
                } catch (cause: unknown) {
                  reportFault('Saving story level', cause)
                  setError(String(cause).replace(/^Error:\s*/, ''))
                }
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
          disabled={loading || !isTauri || targetLanguage === null}
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
            <button type="button" className="btn primary" disabled={!isTauri || targetLanguage === null} onClick={() => void generate(level)}>
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
