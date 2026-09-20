// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import type { Conversation, ConversationSnapshot } from '../../../generated/contracts'
import { ConversationReadingProvider } from './ConversationReadingProvider'
import { ReadingHelp } from '../../../components/reading/ReadingHelp'
import { ReadingScopeContext } from '../../../components/reading/ReadingContext'
import { DetailDialog } from '../../../components/dialogs/DetailDialog'
import { AnalysisContent, type AnalysedTurn } from './AnalysisContent'
import { TargetText } from '../../../components/reading/TargetText'
import { ReplyHelp } from '../composer/ReplyHelp'
vi.mock('../../../platform/ipc/tauri',()=>({languageFor:()=>({languageTag:'es'})}))
const scope={language:'spanish',variety:'spain',explanation:'english',explanationVariety:'us'}
const conversation={id:'chat',languageId:'spanish',settings:{varietyId:'spain',explanationLanguage:'english',explanationVarietyId:'us'}} as Conversation
const snapshot={conversationId:'chat',coachMessages:[],messages:[{id:'message',text:'La playa.',wordGloss:{sourceMessageId:'message',targetLanguageId:'spanish',explanationLanguageId:'english',segments:[{start:3,end:8,kind:'gloss',gloss:'beach',pronunciation:'pla-ya'}]}}]} as unknown as ConversationSnapshot
it('reuses durable message annotations in coaching, replies, frames and starters without a lookup',()=>{
  const read=vi.fn(), onUse=vi.fn()
  render(<ReadingScopeContext value={scope}><ReadingHelp services={{read,speak:vi.fn(),activity:vi.fn()}} languages={[]}><ConversationReadingProvider snapshot={snapshot} conversation={conversation}>
    <TargetText text="Otra playa." />
    <ReplyHelp brief="Reply help" opened={['replies']} replies={[{text:'Voy a la playa.',translation:'Do not show this',pronunciation:'Do not show this either',romanization:''}]} starters={['En la playa ___','La playa…']} busy={false} errors={[]} onUse={onUse} />
  </ConversationReadingProvider></ReadingHelp></ReadingScopeContext>)
  const words=screen.getAllByRole('button',{name:'playa'})
  expect(words).toHaveLength(4)
  for(const word of words){
    fireEvent.click(word)
    expect(screen.getByText('beach')).toBeVisible()
    expect(screen.getByText('pla-ya')).toBeVisible()
    expect(screen.queryByText('Finding word meanings…')).toBeNull()
    fireEvent.click(word)
  }
  expect(read).not.toHaveBeenCalled()
  expect(onUse).not.toHaveBeenCalled()
  expect(screen.queryByText('Do not show this')).toBeNull()
  expect(screen.queryByText('Reading help')).toBeNull()
})

it('shares the exact saved Arabic word with the analysis modal even when the global picker scope differs', () => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open','') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
  const read = vi.fn().mockRejectedValue({code:'admission_held',message:'Server admission refused this operation.'})
  const source = 'مَسكَنتِكَ، هَل تُحِبُّ المَسالِكَ الجَديدَةَ؟'
  const arabicConversation = {...conversation, languageId:'arabic', settings:{...conversation.settings,varietyId:'arabic-levantine'}} as Conversation
  const arabicSnapshot = {...snapshot,messages:[{id:'message',text:source,wordGloss:{sourceMessageId:'message',targetLanguageId:'arabic',explanationLanguageId:'english',segments:[{start:0,end:10,kind:'gloss',gloss:'your residence',romanization:'maskantik'}]}}]} as unknown as ConversationSnapshot
  render(<ReadingScopeContext value={scope}><ReadingHelp services={{read,speak:vi.fn(),activity:vi.fn()}} languages={[]}><ConversationReadingProvider snapshot={arabicSnapshot} conversation={arabicConversation}>
    <DetailDialog title="Message analysis" onClose={()=>{}}><TargetText text="مَسكَنتِكَ" /></DetailDialog>
  </ConversationReadingProvider></ReadingHelp></ReadingScopeContext>)
  fireEvent.click(screen.getByRole('button',{name:'مَسكَنتِكَ'}))
  expect(screen.getByText('your residence')).toBeVisible()
  expect(screen.queryByText('Finding word meanings…')).toBeNull()
  expect(read).not.toHaveBeenCalled()
})

it('the actual analysis modal reuses pinned-turn words and exposes example translations while AI is held', async () => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open','') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
  const read = vi.fn().mockRejectedValue({code:'admission_held',message:'Daily limit reached'})
  const text = 'مَسكَنتِكَ'
  const turn = {id:1,user:null,analysisState:'done',assistant:{reply:text,tokens:[],user_tokens:[],translation:'Your residence',savedGloss:{segments:[{start:0,end:text.length,kind:'gloss',gloss:'your residence',romanization:'maskantik'}]},errors:[],mechanics:[{title:'Your home',quote:text,body:'',example:`${text} (maskantik) - Your home.`,contrast:''}]}} as unknown as AnalysedTurn
  render(<ReadingScopeContext value={{...scope,language:'arabic',variety:'arabic-levantine'}}><ReadingHelp services={{read,speak:vi.fn(),activity:vi.fn()}} languages={[]}>
    <DetailDialog title="Message analysis" onClose={()=>{}}><AnalysisContent turn={turn} inspect={null} nativeLanguageName="English" showRomanization rtl /></DetailDialog>
  </ReadingHelp></ReadingScopeContext>)
  for (const button of screen.getAllByRole('button',{name:text})) {
    fireEvent.click(button)
    expect(screen.getByText('your residence')).toBeVisible()
    fireEvent.click(button)
  }
  for (const button of screen.getAllByRole('button',{name:'Word by word'})) fireEvent.click(button)
  expect(await screen.findAllByText('your residence')).toHaveLength(3)
  for (const button of screen.getAllByRole('button',{name:'Translate'})) fireEvent.click(button)
  expect(screen.getByText('Your residence')).toBeVisible()
  expect(screen.getByText('Your home.')).toBeVisible()
  expect(read).not.toHaveBeenCalled()
})

it('preserves mounted controls when the conversation scope arrives', () => {
  const view = (loaded: boolean) => <ConversationReadingProvider snapshot={loaded ? snapshot : null} conversation={loaded ? conversation : null}><input aria-label="Draft" defaultValue="keep this" /></ConversationReadingProvider>
  const {rerender} = render(view(false))
  const input = screen.getByRole('textbox', {name:'Draft'})
  input.focus()
  rerender(view(true))
  expect(screen.getByRole('textbox', {name:'Draft'})).toBe(input)
  expect(input).toHaveFocus()
  expect(input).toHaveValue('keep this')
})

it('keeps saved glosses in their captured explanation scope after conversation preferences change', () => {
  const read=vi.fn().mockRejectedValue(new Error('Unexpected reading request'))
  const captured={...snapshot,messages:snapshot.messages.map(message=>({...message,readingScope:scope}))}
  const changed={...conversation,settings:{...conversation.settings,explanationLanguage:'french',explanationVarietyId:'france'}} as Conversation
  render(<ReadingScopeContext value={scope}><ReadingHelp services={{read,speak:vi.fn(),activity:vi.fn()}} languages={[]}>
    <ConversationReadingProvider snapshot={captured} conversation={changed}>
      <ReadingScopeContext value={scope}><TargetText text="La playa." /></ReadingScopeContext>
    </ConversationReadingProvider>
  </ReadingHelp></ReadingScopeContext>)
  fireEvent.click(screen.getByRole('button',{name:'playa'}))
  expect(screen.getByText('beach')).toBeVisible()
  expect(read).not.toHaveBeenCalled()
})
