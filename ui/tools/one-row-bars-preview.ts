/** The top bar and the chat header at every width, from a phone to a wide
 * desktop: the conversation preview in frames, cropped to its two bars, each
 * measured once it has rendered. Sample data only; no native or AI calls.
 *
 * Both bars must stay one row at every width. The table says, per width, which
 * layout each bar picked, whether anything wraps or runs past its bar, whether
 * the language's own name and the partner's name show whole, and where the
 * difficulty select is. Query parameters pass through to every frame:
 * ?lang=irish (or indonesian, spanish, …) and ?coach=closed. */
const WIDTHS = [360, 380, 412, 440, 480, 520, 560, 649, 760, 860, 861, 900, 919, 1000, 1228, 1400]
const SETTLE_MS = 3500

interface Measured { width: number; coach: string; bar: string; language: string; head: string; difficulty: string; partner: string; problems: string[] }

function shown(element: Element | null, view: Window): boolean {
  return !!element && element.getClientRects().length > 0 && view.getComputedStyle(element).visibility !== 'hidden'
}

/// How far apart, vertically, the centres of a bar's visible controls are: 0 when they share one row.
function rowSpread(bar: Element, view: Window): number {
  const centres = [...bar.querySelectorAll('button, select')]
    .filter(control => shown(control, view) && !control.closest('[role=menu], [role=dialog], .progress-card, .language-dropdown-panel'))
    .map(control => { const box = control.getBoundingClientRect(); return box.top + box.height / 2 })
  return centres.length ? Math.round(Math.max(...centres) - Math.min(...centres)) : 0
}

function whole(element: Element | null, box: Element | null | undefined): string {
  if (!element || !box) return '—'
  const needed = Math.round(element.getBoundingClientRect().width)
  return needed > box.clientWidth + 1 ? `cut (${box.clientWidth}/${needed}px)` : 'whole'
}

function measure(frame: HTMLIFrameElement): Measured {
  const view = frame.contentWindow!
  const page = frame.contentDocument!
  const bar = page.querySelector('.topbar')
  const head = page.querySelector('.chat > .chat-head')
  if (!bar || !head) return { width: Number.parseInt(frame.style.width), coach: '—', bar: '—', language: '—', head: '—', difficulty: '—', partner: '—', problems: ['the preview did not render'] }
  const name = head.querySelector('.partner-identity strong')
  const endonym = bar.querySelector('.learning-picker-endonym')
  const problems: string[] = []
  if (rowSpread(bar, view) > 2) problems.push('top bar wraps')
  if (rowSpread(head, view) > 2) problems.push('header wraps')
  if (bar.scrollWidth > bar.clientWidth + 1) problems.push(`top bar overflows ${bar.scrollWidth - bar.clientWidth}px`)
  if (head.scrollWidth > head.clientWidth + 1) problems.push(`header overflows ${head.scrollWidth - head.clientWidth}px`)
  const language = whole(endonym, endonym?.parentElement)
  if (language.startsWith('cut')) problems.push('language name cut')
  return {
    width: view.innerWidth,
    coach: view.innerWidth > 860 ? (page.querySelector('.split > .break.collapsed') ? 'closed' : 'open') : 'modal',
    bar: (bar as HTMLElement).dataset.fit ?? '—',
    language,
    head: (head as HTMLElement).dataset.fit ?? '—',
    difficulty: shown(head.querySelector('.conversation-identity > select'), view) ? 'header' : 'settings',
    partner: name ? (name.scrollWidth > name.clientWidth + 1 ? `cut (${name.clientWidth}/${name.scrollWidth}px)` : 'whole') : '—',
    problems,
  }
}

function frameFor(width: number): Promise<HTMLIFrameElement> {
  const holder = document.createElement('figure')
  holder.className = 'bars'
  const label = document.createElement('figcaption')
  label.textContent = `${width}px`
  const frame = document.createElement('iframe')
  frame.style.width = `${width}px`
  frame.src = `/tools/conversation-preview.html${location.search}`
  holder.append(label, frame)
  document.querySelector('#frames')!.append(holder)
  return new Promise(resolve => {
    frame.addEventListener('load', () => setTimeout(() => {
      // Show the two bars at the top of the crop: the preview's own control strip is not under review.
      const strip = frame.contentDocument!.querySelector<HTMLElement>('.app > div:first-child:not(.topbar)')
      if (strip) strip.style.display = 'none'
      resolve(frame)
    }, SETTLE_MS))
  })
}

function report(rows: Measured[]) {
  const table = document.createElement('table')
  const headings = table.createTHead().insertRow()
  for (const heading of ['Width', 'Coach', 'Top bar', 'Language', 'Header', 'Difficulty', 'Partner', 'Problems']) {
    const cell = document.createElement('th')
    cell.textContent = heading
    headings.append(cell)
  }
  const body = table.createTBody()
  for (const row of rows) {
    const cells = [`${row.width}px`, row.coach, row.bar, row.language, row.head, row.difficulty, row.partner, row.problems.join('; ') || 'none']
    const line = body.insertRow()
    if (row.problems.length) line.dataset.problem = ''
    for (const text of cells) line.insertCell().textContent = text
  }
  document.querySelector('#report')!.replaceChildren(table)
}

const style = document.createElement('style')
style.textContent = `
  body { margin: 0; padding: 12px; background: #8a8f98; color: #111; font: 12px/1.4 system-ui, sans-serif; }
  #report table { border-collapse: collapse; background: #fff; margin-bottom: 12px; font-variant-numeric: tabular-nums; }
  #report :is(th, td) { padding: 3px 8px; border: 1px solid #ccd; text-align: start; white-space: nowrap; }
  #report tr[data-problem] td { background: #fde2e2; }
  .bars { margin: 0 0 10px; }
  .bars figcaption { color: #fff; font-weight: 600; }
  .bars iframe { display: block; height: 900px; border: 0; background: #fff; }
  .bars { height: 118px; overflow: hidden; }
`
document.head.append(style)
const status = Object.assign(document.createElement('div'), { id: 'report', textContent: 'Measuring…' })
document.body.append(status, Object.assign(document.createElement('div'), { id: 'frames' }))
// A few frames at a time: each runs the whole preview, and loading them all at
// once exhausts the browser's request capacity.
const loaded: HTMLIFrameElement[] = []
for (let start = 0; start < WIDTHS.length; start += 4) loaded.push(...await Promise.all(WIDTHS.slice(start, start + 4).map(frameFor)))
report(loaded.map(measure))

export {}
