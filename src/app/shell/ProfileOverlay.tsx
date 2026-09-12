import { DetailDialog } from '../../ui/DetailDialog'
import { ProgressSummary } from '../../features/guided/ProgressSummary'
import { useNavigationStore } from '../../state/navigation'
import { useSkillEvidence } from '../../state/useSkillEvidence'

/// The language profile, opened from the topbar, and the failure that stands in
/// for it when evidence is not connected.
///
/// It opens on the evidence for the active language. `ProgressSummary` then
/// presents every language to its own subtree, which is why that subtree reads a
/// different snapshot than this one.
export function ProfileOverlay() {
  const { snapshot, error, reload } = useSkillEvidence()
  const open = useNavigationStore((state) => state.overlay === 'profile')
  const closeOverlay = useNavigationStore((state) => state.closeOverlay)
  return <>
    {error && <div role="alert">{error}<button onClick={reload}>Retry profile</button></div>}
    {open && !snapshot && <DetailDialog title="Language profile" onClose={closeOverlay}><p>Language evidence is not connected.</p></DetailDialog>}
    {open && snapshot && <ProgressSummary key={snapshot.target} snapshot={snapshot} onClose={closeOverlay} />}
  </>
}
