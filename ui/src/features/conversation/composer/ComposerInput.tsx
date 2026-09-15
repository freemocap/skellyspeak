import { useI18n } from '../../../components/localization/i18n'
interface ComposerInputProps {
  input: string
  available: boolean
  sending: boolean
  recording: boolean
  transcribing: boolean
  autoSend: boolean
  targetLanguage: string
  targetLanguageName: string
  onInput: (value: string) => void
  onSend: (value: string) => void
  onDiscardRecording: () => void
  onToggleRecording: () => void
}

/** Message-entry controls; recording and request ownership stay with the caller. */
export function ComposerInput({ input, available, sending, recording, transcribing, autoSend,
  targetLanguage, targetLanguageName, onInput, onSend, onDiscardRecording, onToggleRecording,
}: ComposerInputProps) {
  const tr = useI18n()
  return (
          <form
            className="crow"
            onSubmit={(e) => {
              e.preventDefault()
              onSend(input)
            }}
          >
            <input
              className="field composer-input"
              value={input}
              onChange={(e) => onInput(e.target.value)}
              placeholder={targetLanguageName ? tr("Write in {value0}…", { value0: String(targetLanguageName) }) : tr("Write…")}
              disabled={!available}
              lang={targetLanguage}
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
              disabled={sending || !input.trim()}
              aria-label={tr("Send")}
            >
              ↑
            </button>
          </form>
  )
}
