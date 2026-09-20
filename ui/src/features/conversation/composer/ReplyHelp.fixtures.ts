import type { AssistedReply, ReplyExplanation, SuggestedReply } from '../../../generated/contracts'

/** Offline fixture shared by component tests and design-system previews. */
export const replyHelpFixture = {
  brief: 'She asked how you are. Answer, then ask her back.',
  replies: [
    {text:'我很好。',translation:'I am well.',romanization:'Wǒ hěn hǎo.',pronunciation:'woh hun how'},
    {text:'还不错。',translation:'Not bad.',romanization:'Hái bú cuò.',pronunciation:'high boo tswoh'},
  ] satisfies AssistedReply[],
  grammar: [{quote:'你好吗？',title:'Yes-no questions with 吗',body:'Add 吗 to a statement to make it a question.',example:'你累吗？',contrast:'English inverts the verb; Mandarin keeps the word order.'}] satisfies ReplyExplanation[],
  saved: [
    {text:'我很好。',segments:[{start:0,end:1,kind:'gloss',gloss:'I',romanization:'wǒ'},{start:1,end:2,kind:'gloss',gloss:'very'},{start:2,end:3,kind:'gloss',gloss:'good'}]},
    {text:'还不错。',segments:[{start:0,end:3,kind:'gloss',gloss:'not bad'}]},
  ] satisfies SuggestedReply[],
}
