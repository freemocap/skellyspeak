/** Real Android WebView UI tests. No IPC calls, mock responses or database writes.
 * Node 24 provides fetch/WebSocket; adb must see one authorized debug device.
 */
import { execFileSync } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

export const cases = [
  { language: 'es', text: 'Ayer fui al parque con mi familia.', words: ['parque', 'familia'] },
  { language: 'ar', text: 'قرأت الكتاب في البيت.', words: ['الكتاب', 'البيت'] },
  { language: 'zh', text: '今天我想和朋友一起喝茶。', words: ['朋友', '喝茶'] },
]
const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
export function deviceFromList(output: string, requested?: string): string {
  const rows = output.split('\n').map(line => line.trim().split(/\s+/)).filter(row => row[1] === 'device')
  if (requested) {
    if (!rows.some(row => row[0] === requested)) throw new Error('Requested Android device is not connected and authorized.')
    return requested
  }
  if (rows.length !== 1) throw new Error(`Expected one authorized Android device; found ${rows.length}. Connect the phone or set ANDROID_SERIAL.`)
  return rows[0][0]
}
class Devtools {
  socket: WebSocket
  sequence = 0
  pending = new Map<number, {resolve: (value: any) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout>}>()
  errors: string[] = []
  constructor(url: string) {
    this.socket = new WebSocket(url)
    this.socket.addEventListener('message', event => {
      const message = JSON.parse(String(event.data))
      if (message.method === 'Runtime.exceptionThrown') this.errors.push(message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text)
      const request = this.pending.get(message.id)
      if (!request) return
      clearTimeout(request.timer); this.pending.delete(message.id)
      if (message.error) request.reject(new Error(message.error.message))
      else request.resolve(message.result)
    })
    this.socket.addEventListener('close', () => {
      for (const request of this.pending.values()) { clearTimeout(request.timer); request.reject(new Error('Device debugging connection closed.')) }
      this.pending.clear()
    })
  }
  async connect() {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Device debugging connection timed out.')), 10000)
      this.socket.addEventListener('open', () => {clearTimeout(timer); resolve()}, {once:true})
      this.socket.addEventListener('error', () => {clearTimeout(timer); reject(new Error('Cannot connect to WebView.'))}, {once:true})
    })
    await this.call('Runtime.enable')
  }
  call(method: string, params: object = {}): Promise<any> {
    const id = ++this.sequence
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {this.pending.delete(id); reject(new Error(`CDP timeout: ${method}`))}, 15000)
      this.pending.set(id, {resolve, reject, timer})
      this.socket.send(JSON.stringify({id, method, params}))
    })
  }
  async evaluate(expression: string): Promise<any> {
    const result = await this.call('Runtime.evaluate', {expression, returnByValue:true, awaitPromise:true, userGesture:true})
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text)
    return result.result.value
  }
  async wait(expression: string, label: string, timeout = 120000) {
    const until = Date.now() + timeout
    while (Date.now() < until) {
      if (this.errors.length) throw new Error(`WebView exception: ${this.errors.at(-1)}`)
      if (await this.evaluate(expression)) return
      await pause(500)
    }
    throw new Error(`Timed out waiting for ${label}`)
  }
  async click(selector: string) {
    await this.wait(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});return e && !e.disabled && e.getClientRects().length})()`, selector, 15000)
    await this.evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`)
  }
  async fill(selector: string, value: string, select = false) {
    await this.evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e || e.disabled) throw Error('Input unavailable');Object.getOwnPropertyDescriptor(${select ? 'HTMLSelectElement' : 'HTMLInputElement'}.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event(${JSON.stringify(select ? 'change' : 'input')},{bubbles:true}));})()`)
  }
}

async function main() {
  const live = process.argv.includes('--live')
  const voice = process.argv.includes('--voice')
  if (voice && !live) throw new Error('--voice requires --live')
  const directory = resolve('.local/e2e', new Date().toISOString().replaceAll(':','-'))
  await mkdir(directory, {recursive:true, mode:0o700})
  const report: {mode:string; status:string; results:object[]; limitation:string; error?:string} = {mode:voice ? 'live-text-and-injected-audio' : live ? 'live-text' : 'preflight', status:'running', results:[], limitation:'Injected audio tests MediaRecorder, native transcription and live providers, not the physical microphone or speaker.'}
  let devtools: Devtools | undefined
  let serial: string | undefined
  const adb = (...args: string[]) => execFileSync('adb', [...(serial ? ['-s', serial] : []), ...args], {encoding:'utf8', timeout:30000})
  let port: string | undefined
  try {
    serial = deviceFromList(adb('devices'), process.env.ANDROID_SERIAL)
    adb('shell','am','start','-n','com.freemocap.skellyspeak/.MainActivity')
    await pause(1500)
    const pid = adb('shell','pidof','com.freemocap.skellyspeak').trim()
    if (!/^\d+$/.test(pid)) throw new Error('Open the SkellySpeak debug app before running the suite.')
    const socket = `webview_devtools_remote_${pid}`
    if (!adb('shell','cat','/proc/net/unix').includes(socket)) throw new Error('The app does not expose a debug WebView. Install the development APK.')
    port = adb('forward','tcp:0',`localabstract:${socket}`).trim()
    const pages = await fetch(`http://127.0.0.1:${port}/json/list`).then(response => response.json()) as {url:string; webSocketDebuggerUrl:string}[]
    const page = pages.find(page => /^http:\/\/(127\.0\.0\.1|localhost):1420\/$/.test(page.url))
    if (!page) throw new Error('Expected the real local app page; refusing fixtures or unrelated WebViews.')
    devtools = new Devtools(page.webSocketDebuggerUrl)
    await devtools.connect()
    await devtools.wait(`!!document.querySelector('[aria-label="New chat"]')`, 'app shell', 20000)
    if (!await devtools.evaluate(`!!window.__TAURI_INTERNALS__`)) throw new Error('Native Tauri bridge is absent; this is not a device app test.')
    if (await devtools.evaluate(`document.body.innerText.includes('Sign in with Google')`)) throw new Error('Device AI access is not configured. Sign in once or configure the local test server; credentials are never copied by this runner.')
    report.results.push({case:'native-app-preflight',status:'passed'})
    if (live) for (const scenario of cases) {
      console.log(`Testing ${scenario.language}: real chat, feedback and glosses`)
      const languageSelect = '[aria-label="Target language"]'
      const value = await devtools.evaluate(`(()=>{const s=document.querySelector(${JSON.stringify(languageSelect)});return [...s.options].find(o=>o.lang===${JSON.stringify(scenario.language)})?.value})()`)
      if (!value) throw new Error(`Missing language ${scenario.language}`)
      await devtools.fill(languageSelect, value, true)
      await devtools.wait(`document.querySelector('.crow input')?.lang===${JSON.stringify(scenario.language)} && !document.querySelector(${JSON.stringify(languageSelect)})?.disabled`, 'language saved')
      await devtools.click('[aria-label="New chat"]')
      await devtools.wait(`!!document.querySelector('.start-conversation-button') && !document.querySelector('.msg')`, 'empty chat')
      await devtools.click('.start-conversation-button')
      await devtools.wait(`!!document.querySelector('.msg.bot:not(.pending)')`, 'partner opening')
      if (await devtools.evaluate(`!!document.querySelector('.msg.me')`)) throw new Error('Partner opening fabricated a learner message.')
      await devtools.fill('.crow input', scenario.text)
      await devtools.click('[aria-label="Send"]')
      await devtools.wait(`document.querySelectorAll('.msg.bot:not(.pending)').length>=2 && [...document.querySelectorAll('.feedback-badge')].some(e=>/Feedback|Try again|One suggestion/.test(e.textContent))`, 'reply and feedback')
      await devtools.wait(`!document.querySelector('.activity-indicator')`, 'all generation stages', 180000)
      const failure = await devtools.evaluate(`document.querySelector('.feedback-error, [aria-label="Word meanings"] .error-details, [role="alert"]')?.textContent || document.body.innerText.match(/Feedback failed|Word meanings failed|Word meanings rejected|Could not|failed:/i)?.[0]`)
      if (failure) {
        if (await devtools.evaluate(`!!document.querySelector('.feedback-error')`)) await devtools.click('.feedback-error')
        throw new Error(`Live ${scenario.language} workflow reported ${failure}`)
      }
      if (!await devtools.evaluate(`!!document.querySelector('.msg.bot .saved-word')`)) throw new Error('No partner gloss was published.')
      if (!await devtools.evaluate(`!!document.querySelector('.msg.me .saved-word')`)) throw new Error('No learner gloss was published.')
      if (scenario.language === 'ar' && !await devtools.evaluate(`[...document.querySelectorAll('.msg.me .saved-word > .w')].some(e=>e.textContent==='الكتاب' && e.childNodes.length===1)`)) throw new Error('Arabic source word is not a single shaping run.')
      await devtools.click('.msg.me .saved-word > .w')
      if (!await devtools.evaluate(`!!document.querySelector('.msg.me .wg')`)) throw new Error('Gloss disclosure did not open.')
      if (voice) {
        const audio = await readFile(resolve('test-fixtures/speech', `${scenario.language}.wav`))
        // A test-only MediaStream replaces just the microphone source. The real
        // Record/Stop buttons, MediaRecorder, encoding, IPC and provider still run.
        await devtools.evaluate(`(async()=>{const context=new AudioContext();await context.resume();const bytes=Uint8Array.from(atob(${JSON.stringify(audio.toString('base64'))}),c=>c.charCodeAt(0));const buffer=await context.decodeAudioData(bytes.buffer);window.__smokeAudio={context,duration:buffer.duration,original:navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices)};navigator.mediaDevices.getUserMedia=async()=>{const source=context.createBufferSource();source.buffer=buffer;const destination=context.createMediaStreamDestination();source.connect(destination);source.start(context.currentTime+0.3);return destination.stream;};})()`)
        try {
          await devtools.click('[aria-label="Record audio"]')
          const duration = await devtools.evaluate('window.__smokeAudio.duration') as number
          if (!(duration > 0 && duration < 30)) throw new Error('Voice fixture must be 0–30 seconds long.')
          await pause(Math.ceil((duration + 0.6) * 1000))
          await devtools.click('.mic.recording')
          await devtools.wait(`!document.querySelector('.activity-indicator') && (!!document.querySelector('.crow input')?.value || document.querySelectorAll('.msg.me').length>=2)`, 'transcription', 180000)
          const transcript = await devtools.evaluate(`document.querySelector('.crow input').value || [...document.querySelectorAll('.msg.me')].at(-1).innerText`) as string
          if (!scenario.words.every(word => transcript.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().includes(word.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase()))) throw new Error(`Transcription missed expected ${scenario.language} content`)
          if (await devtools.evaluate(`!!document.querySelector('.crow input').value`)) await devtools.click('[aria-label="Send"]')
          await devtools.wait(`document.querySelectorAll('.msg.bot:not(.pending)').length>=3 && [...document.querySelectorAll('.feedback-badge')].filter(e=>/Feedback|Try again|One suggestion/.test(e.textContent)).length>=2 && !document.querySelector('.activity-indicator')`, 'voice reply and feedback', 180000)
          if (await devtools.evaluate(`!!document.querySelector('.feedback-error, [aria-label="Word meanings"] .error-details, [role="alert"]')`)) throw new Error('Voice exchange reported a feedback, gloss or application failure.')
        } finally {
          await devtools.evaluate(`navigator.mediaDevices.getUserMedia=window.__smokeAudio.original;window.__smokeAudio.context.close();delete window.__smokeAudio`)
        }
      }
      const screenshot = await devtools.call('Page.captureScreenshot', {format:'png'})
      await writeFile(resolve(directory,`${scenario.language}.png`), Buffer.from(screenshot.data,'base64'), {mode:0o600})
      report.results.push({case:scenario.language,status:'passed',voice:voice ? 'injected-speech' : 'not-run'})
    }
    report.status='passed'
  } catch (error) {
    report.status='failed'; report.error=error instanceof Error ? error.message : String(error)
    if (devtools) {
      try {
        const screenshot = await devtools.call('Page.captureScreenshot', {format:'png'})
        await writeFile(resolve(directory,'failure.png'),Buffer.from(screenshot.data,'base64'),{mode:0o600})
        // Only UI text, never storage, credentials, IPC payloads or network bodies.
        await writeFile(resolve(directory,'failure-ui.txt'),await devtools.evaluate('document.body.innerText'),{mode:0o600})
      } catch { report.results.push({case:'failure-artifacts',status:'unavailable'}) }
    }
    process.exitCode=1
  } finally {
    devtools?.socket.close()
    if (port) {
      try { adb('forward','--remove',`tcp:${port}`) }
      catch { report.status='failed'; report.results.push({case:'debug-port-cleanup',status:'failed'}); process.exitCode=1 }
    }
    await writeFile(resolve(directory,'report.json'),JSON.stringify(report,null,2),{mode:0o600})
    console.log(`${report.status}: ${report.error ?? 'completed'}\nReport: ${directory}/report.json`)
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) void main().catch(error => {console.error(error.message);process.exitCode=1})
