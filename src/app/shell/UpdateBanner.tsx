import { useCallback, useEffect, useRef, useState } from 'react'
import { checkForUpdate, restartIntoUpdate, type UpdateOffer } from '../../platform/updater'
import { reportFault } from '../../platform/diagnostics/faults'
import { logInfo } from '../../platform/diagnostics/log'

type Stage = 'idle' | 'offering' | 'installing' | 'ready' | 'notice'

/// Update prompt, shown at the top of the window when a newer version exists.
///
/// The startup check runs once on launch and speaks only when there is an
/// update. A check the learner asks for (Settings) always answers: an update,
/// "current", or why this build does not take updates here.
///
/// A failed check is reported through the fault bar like any other failure —
/// silently never updating is exactly the outcome this is meant to prevent.
export function UpdateBanner() {
  const [update, setUpdate] = useState<UpdateOffer | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [stage, setStage] = useState<Stage>('idle')
  const [progress, setProgress] = useState<{ done: number; total: number | null } | null>(null)

  const checking = useRef(false)
  useEffect(() => {
    const check = (requested: boolean) => {
      if (checking.current) return
      checking.current = true
      logInfo(`[updater] checking for updates (${requested ? 'requested' : 'startup'})`)
      void checkForUpdate()
        .then((result) => {
          if (result.kind === 'install' || result.kind === 'download') {
            setUpdate(result)
            setStage('offering')
          } else if (requested) {
            setNotice(result.kind === 'current'
              ? `SkellySpeak ${result.currentVersion} is the latest release.`
              : `SkellySpeak ${result.currentVersion}: ${result.reason}`)
            setStage('notice')
          }
        })
        // A check that cannot reach the server is worth saying out loud:
        // otherwise the app looks up to date when it simply never asked.
        .catch((e) => reportFault('Checking for updates', e))
        .finally(() => { checking.current = false })
    }
    const requested = () => check(true)
    check(false)
    window.addEventListener('skellyspeak-check-update', requested)
    return () => window.removeEventListener('skellyspeak-check-update', requested)
  }, [])

  const install = useCallback(async () => {
    if (!update || update.kind !== 'install') return
    setStage('installing')
    try {
      await update.install((done, total) => setProgress({ done, total }))
      setStage('ready')
    } catch (e) {
      reportFault('Installing update', e)
      setStage('offering')
    }
  }, [update])

  const dismiss = () => {
    setUpdate(null)
    setNotice(null)
    setStage('idle')
  }

  if (stage === 'idle') return null

  if (stage === 'notice') {
    return (
      <div className="update-bar" role="status">
        <span className="update-text">{notice}</span>
        <button type="button" className="btn tiny" onClick={dismiss}>Dismiss</button>
      </div>
    )
  }

  if (!update) return null

  const pct =
    progress && progress.total
      ? Math.min(100, Math.round((progress.done / progress.total) * 100))
      : null

  return (
    <div className="update-bar" role="status">
      {stage === 'offering' && (
        <>
          <span className="update-text">
            <b>SkellySpeak {update.version}</b> is available — you have {update.currentVersion}.
          </span>
          {update.kind === 'install' ? (
            <button type="button" className="btn primary tiny" onClick={() => void install()}>
              Install &amp; restart
            </button>
          ) : (
            // Mobile installs the package itself; the app can only take the
            // user to it.
            <button
              type="button"
              className="btn primary tiny"
              onClick={() =>
                void update.open().catch((e) => reportFault('Opening the download page', e))
              }
            >
              Get {update.version}
            </button>
          )}
          <button type="button" className="btn tiny" onClick={dismiss}>
            Later
          </button>
        </>
      )}

      {stage === 'installing' && (
        <span className="update-text">
          Downloading {update.version}
          {pct === null ? '…' : ` — ${pct}%`}
        </span>
      )}

      {stage === 'ready' && (
        <>
          <span className="update-text">
            <b>{update.version}</b> is installed. Restart to use it.
          </span>
          <button
            type="button"
            className="btn primary tiny"
            onClick={() => void restartIntoUpdate().catch((e) => reportFault('Restarting', e))}
          >
            Restart now
          </button>
        </>
      )}
    </div>
  )
}
