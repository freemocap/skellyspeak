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
  return (
          <form
            className="crow"
            onSubmit={(e) => {
              e.preventDefault()
              onSend(input)
            }}
          >
            <input
              className="field"
              value={input}
              onChange={(e) => onInput(e.target.value)}
              placeholder={targetLanguageName ? `Write in ${targetLanguageName}…` : 'Write…'}
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
                title="Discard recording without transcribing"
                aria-label="Discard recording"
              >
                Discard
              </button>
            )}
            <button
              type="button"
              className={`mic ${recording ? 'recording' : ''}`}
              onClick={onToggleRecording}
              disabled={!available || sending || transcribing}
              title={recording ? (autoSend ? 'Stop and send recording' : 'Stop and transcribe recording') : 'Record audio'}
              aria-label={recording ? (autoSend ? 'Stop and send recording' : 'Stop and transcribe recording') : 'Record audio'}
            >
              <span aria-hidden="true">{recording ? '■' : '●'}</span>
              <span>{recording ? 'Stop' : 'Record'}</span>
            </button>

            <button
              type="submit"
              className="send"
              disabled={sending || !input.trim()}
              aria-label="Send"
            >
              ↑
            </button>
          </form>
  )
}
