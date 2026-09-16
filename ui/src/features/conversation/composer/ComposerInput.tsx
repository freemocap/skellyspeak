import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { useI18n } from '../../../components/localization/i18n'
interface ComposerInputProps {
  waveform?: ReactNode
  micShortcut?: string
  input: string
  available: boolean
  sending: boolean
  recording: boolean
  transcribing: boolean
  autoSend: boolean
  targetLanguageTag?: string
  targetLanguageName: string
  onInput: (value: string) => void
  onSend: (value: string) => void
  onDiscardRecording: () => void
  onToggleRecording: () => void
}

/** Message-entry controls; recording and request ownership stay with the caller. */
export function ComposerInput({ input, available, sending, recording, transcribing, autoSend,
  targetLanguageTag, targetLanguageName, waveform, micShortcut, onInput, onSend, onDiscardRecording, onToggleRecording,
}: ComposerInputProps) {
  const tr = useI18n()
  const inputRef = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => {
    const field = inputRef.current
    if (field) { field.style.height = 'auto'; field.style.height = `${Math.min(field.scrollHeight, 160)}px` }
  }, [input])
  return (
          <>
          <form
            className="crow"
            onSubmit={(e) => {
              e.preventDefault()
              if (available && !sending && !recording && !transcribing && input.trim()) onSend(input)
            }}
          >
            {waveform}
            <div className="composer-field-row">
            <textarea
              ref={inputRef}
              rows={1}
              aria-label={tr("Message")}
              onKeyDown={event => {
                if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing && event.keyCode !== 229) {
                  event.preventDefault(); event.currentTarget.form?.requestSubmit()
                }
              }}
              className="field composer-input"
              value={input}
              onChange={(e) => onInput(e.target.value)}
              placeholder={targetLanguageName ? tr("Write in {value0}…", { value0: String(targetLanguageName) }) : tr("Write…")}
              disabled={!available}
              lang={targetLanguageTag}
              dir="auto"
              enterKeyHint="send"
              autoCorrect="off"
              spellCheck={false}
            />
            {recording && (
              <button
                type="button"
                className="mic-cancel"
                onClick={onDiscardRecording}
                title={tr("Discard recording without transcribing")}
                aria-label={tr("Discard recording")}
              >
                {tr("Discard")}</button>
            )}
            <button
              type="button"
              className={`mic ${recording ? 'recording' : ''}`}
              onClick={onToggleRecording}
              disabled={!available || sending || transcribing}
              title={recording ? (autoSend ? tr("Stop and send recording") : tr("Stop and transcribe recording")) : tr("Record audio")}
              aria-label={recording ? (autoSend ? tr("Stop and send recording") : tr("Stop and transcribe recording")) : tr("Record audio")}
            >
              <span aria-hidden="true">{recording ? '■' : '●'}</span>
              <span>{recording ? tr("Stop") : tr("Record")}</span>
            </button>

            <button
              type="submit"
              className="send"
              disabled={!available || sending || recording || transcribing || !input.trim()}
              aria-label={tr("Send")}
            >
              ↑
            </button>
            </div>
          </form>
          <div className="composer-shortcuts"><span>{tr("Enter: send")}</span><span>{tr("Shift+Enter: new line")}</span>{micShortcut && <span>{micShortcut} · {tr("Record")}</span>}</div>
          </>
  )
}
