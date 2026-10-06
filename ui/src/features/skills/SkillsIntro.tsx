import { DetailDialog } from '../../components/dialogs/DetailDialog'
import { useI18n } from '../../components/localization/i18n'

/** What the Skills page shows and how points and levels work, opened on the
 * first visit and again from the page's "How skills work" button. */
export function SkillsIntro({ onClose }: { onClose: () => void }) {
  const tr = useI18n()
  return <DetailDialog title={tr('How skills work')} className="skills-intro" onClose={onClose}>
    <h2>{tr('How skills work')}</h2>
    <p className="skills-intro-lead">{tr('This page tracks eight conversation skills, such as asking questions, describing things and talking about time.')}</p>
    <ol className="skills-intro-steps">
      <li><strong>{tr('Your replies earn points')}</strong>
        <span>{tr('When the coach sees you use a skill correctly in a message, that skill gets a point. One reply can count for several skills. Small mistakes elsewhere in the reply do not stop it counting.')}</span></li>
      <li><strong>{tr('Skills level up')}</strong>
        <span>{tr('A skill reaches level 1 at 1 point, then level 2 at 2, level 3 at 3, level 4 at 5, level 5 at 8, and so on.')}</span></li>
      <li><strong>{tr('Your level is your weakest skill')}</strong>
        <span>{tr('On the chart, the gold ring is the next level. Skills that have not reached it are listed under “To reach level”. These are practice levels, not a proficiency test.')}</span></li>
      <li><strong>{tr('Open a skill to practise it')}</strong>
        <span>{tr('Each skill has a guide with examples, the replies of yours that counted, and a button to start a conversation that uses it.')}</span></li>
    </ol>
    <div className="skills-intro-foot">
      <button type="button" className="btn primary" onClick={onClose}>{tr('Got it')}</button>
    </div>
  </DetailDialog>
}
