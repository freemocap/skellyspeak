import { useState } from 'react'
import { DetailDialog } from '../src/components/dialogs/DetailDialog'
import { AnalysisContent, type AnalysedTurn } from '../src/features/conversation/reading/AnalysisContent'
const source = 'مَسكَنتِكَ، هَل تُحِبُّ المَسالِكَ الجَديدَةَ؟'
const turn = {id:1,user:null,analysisState:'done',assistant:{reply:source,tokens:[],user_tokens:[],translation:'Your residence: do you like the new routes?',savedGloss:{attemptId:'fixture',segments:[{start:0,end:10,kind:'gloss',gloss:'your residence',romanization:'maskantik'},{start:12,end:15,kind:'gloss',gloss:'do you'},{start:16,end:23,kind:'gloss',gloss:'like'},{start:24,end:34,kind:'gloss',gloss:'the routes'},{start:35,end:45,kind:'gloss',gloss:'new'}]},errors:[],mechanics:[{title:'Your place/home',quote:'مَسكَنتِكَ',body:'The word مَسكَنتِكَ (maskantikah) refers to your home.',example:'بَدّي أَزور مَسكَنتِك بَكير. (Baddī azūr maskantik bakīr.) - I want to visit your place early.',contrast:''}]}} as unknown as AnalysedTurn
export function ReadingAnalysisFixture() {
  const [open,setOpen] = useState(false)
  return <><button className="btn" onClick={()=>setOpen(true)}>Open Arabic analysis fixture</button>{open && <DetailDialog title="Message analysis" onClose={()=>setOpen(false)}><AnalysisContent turn={turn} nativeLanguageName="English" showRomanization rtl /></DetailDialog>}</>
}
