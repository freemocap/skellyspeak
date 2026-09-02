import { useCallback, useEffect, useState } from 'react'
import { checkForUpdate, restartIntoUpdate, type UpdateOffer } from '../lib/updater'
import { reportFault } from '../lib/faults'
import { logInfo } from '../lib/log'

type Stage = 'idle' | 'offering' | 'installing' | 'ready'

/// Update prompt, shown at the top of the window when a newer version exists.
///
/// The startup check is deliberately eager: it runs once on launch and puts
/// the offer in front of the user rather than hiding it behind a menu. It is
/// dismissible, and dismissing does not install anything.
///
/// A failed check is reported through the fault bar like any other failure —
/// silently never updating is exactly the outcome this is meant to prevent.
export function UpdateBanner() {
  const [update, setUpdate] = useState<UpdateOffer | null>(null)
  const [stage, setStage] = useState<Stage>('idle')
  const [progress, setProgress] = useState<{ done: number; total: number | null } | null>(null)

  useEffect(() => {
    logInfo('[updater] checking for updates on startup')
    void checkForUpdate()
      .then((found) => {
        if (!found) return
        setUpdate(found)
        setStage('offering')
      })
      // A startup check that cannot reach the server is worth saying out loud:
      // otherwise the app looks up to date when it simply never asked.
      .catch((e) => reportFault('Checking for updates', e))
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

  if (stage === 'idle' || !update) return null

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
                void update.open().catch((e) => reportFault('Opening the release page', e))
              }
            >
              Get {update.version}
            </button>
          )}
          <button
            type="button"
            className="btn tiny"
            onClick={() => {
              setUpdate(null)
              setStage('idle')
            }}
          >
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
