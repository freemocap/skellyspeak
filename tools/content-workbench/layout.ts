const key = 'content-workbench-layout-v1'
export function setupLayout() {
  const shell = document.querySelector<HTMLElement>('.shell')!
  const panes = ['files-pane', 'document-pane', 'connections-pane']
  let saved: Record<string, string | boolean> = {}
  try { saved = JSON.parse(localStorage.getItem(key) ?? '{}') } catch { /* Default layout if storage is unavailable. */ }
  function persist() { try { localStorage.setItem(key, JSON.stringify(saved)) } catch { /* Layout remains usable without storage. */ } }
  function toggle(id: string, hidden: boolean) {
    document.getElementById(id)!.hidden = hidden
    document.querySelectorAll<HTMLButtonElement>(`[data-pane="${id}"]`).forEach(b => b.setAttribute('aria-expanded', String(!hidden)))
    shell.classList.toggle(`${id}-hidden`, hidden)
    saved[`${id}-hidden`] = hidden
    persist()
  }
  for (const id of panes) {
    toggle(id, saved[`${id}-hidden`] === true)
    document.querySelectorAll<HTMLButtonElement>(`[data-pane="${id}"]`).forEach(b => b.onclick = () => toggle(id, !document.getElementById(id)!.hidden))
  }
  for (const section of document.querySelectorAll<HTMLDetailsElement>('.connection-section')) {
    section.open = saved[`${section.id}-open`] !== false
    section.addEventListener('toggle', () => { saved[`${section.id}-open`] = section.open; persist() })
  }
  for (const grip of document.querySelectorAll<HTMLElement>('[data-resize]')) {
    const target = document.getElementById(grip.dataset.resize!)!
    const vertical = grip.dataset.axis === 'height'
    const prop = vertical ? 'height' : 'width'
    const min = vertical ? 100 : 180
    const set = (value: number) => {
      const size = Math.round(Math.max(min, Math.min(vertical ? window.innerHeight * 2 : window.innerWidth - 100, value)))
      target.style[prop] = `${size}px`
      grip.setAttribute('aria-valuenow', String(size))
      saved[`${target.id}-${prop}`] = `${size}px`
    }
    const previous = saved[`${target.id}-${prop}`]
    if (typeof previous === 'string') set(parseFloat(previous))
    else grip.setAttribute('aria-valuenow', String(Math.round(target.getBoundingClientRect()[prop])))
    grip.onpointerdown = event => {
      const start = vertical ? event.clientY : event.clientX
      const size = target.getBoundingClientRect()[prop]
      const sign = grip.dataset.reverse === 'true' ? -1 : 1
      grip.setPointerCapture(event.pointerId)
      grip.onpointermove = move => set(size + sign * ((vertical ? move.clientY : move.clientX) - start))
      const finish = () => { grip.onpointermove = null; persist() }
      grip.onpointerup = finish; grip.onpointercancel = finish
      event.preventDefault()
    }
    grip.onkeydown = event => {
      const direction = ['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : ['ArrowLeft', 'ArrowUp'].includes(event.key) ? -1 : 0
      if (!direction) return
      event.preventDefault()
      set(target.getBoundingClientRect()[prop] + direction * (event.shiftKey ? 50 : 10) * (grip.dataset.reverse === 'true' ? -1 : 1)); persist()
    }
  }
  document.getElementById('reset-layout')!.onclick = () => {
    saved = {}; persist()
    panes.forEach(id => { document.getElementById(id)!.style.width = ''; toggle(id, false) })
    document.querySelectorAll<HTMLDetailsElement>('.connection-section').forEach(section => { section.style.height = ''; section.open = true })
  }
}
