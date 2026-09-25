export function renderTree(value: unknown, container: HTMLElement) {
  container.replaceChildren()
  function branch(label: string, value: unknown, path: string, depth: number): HTMLElement {
    const wrapper = document.createElement('div'); wrapper.className = 'tree-branch'
    const object = value !== null && typeof value === 'object'
    const entries = object ? Object.entries(value) : []
    const card = document.createElement(entries.length ? 'button' : 'div')
    card.className = `tree-node depth-${depth % 4}`
    card.title = path
    const title = document.createElement('strong'); title.textContent = label
    const type = document.createElement('span'); type.className = 'tree-type'
    type.textContent = Array.isArray(value) ? `array · ${entries.length}` : object ? `object · ${entries.length}` : value === null ? 'null' : typeof value
    card.append(title, type)
    if (!object) { const text = document.createElement('span'); text.className = 'tree-value'; text.dir = 'auto'; text.textContent = String(value); card.append(text) }
    wrapper.append(card)
    if (entries.length) {
      const children = document.createElement('div'); children.className = 'tree-children'
      children.hidden = depth > 1
      card.setAttribute('aria-expanded', String(!children.hidden))
      card.onclick = () => { children.hidden = !children.hidden; card.setAttribute('aria-expanded', String(!children.hidden)) }
      for (const [key, item] of entries) children.append(branch(key, item, `${path}.${key}`, depth + 1))
      wrapper.append(children)
    }
    return wrapper
  }
  container.append(branch('root', value, '$', 0))
}
export function expandTree(container: HTMLElement, expand: boolean) {
  container.querySelectorAll<HTMLElement>('.tree-children').forEach(children => {
    children.hidden = !expand
    children.previousElementSibling?.setAttribute('aria-expanded', String(expand))
  })
}

interface FileTreeEntry { path: string }
interface Folder { folders: Map<string, Folder>; files: FileTreeEntry[] }
const folderState = new Map<string, boolean>()

/** Preserve repository-relative paths, including intermediate folders, in every filter. */
export function renderFileTree(container: HTMLElement, entries: FileTreeEntry[], selected: string | undefined, searching: boolean, openFile: (path: string) => void) {
  const root: Folder = {folders: new Map(), files: []}
  for (const entry of entries) {
    let folder = root
    for (const part of entry.path.split('/').slice(0, -1)) {
      if (!folder.folders.has(part)) folder.folders.set(part, {folders: new Map(), files: []})
      folder = folder.folders.get(part)!
    }
    folder.files.push(entry)
  }
  if (selected && container.dataset.selected !== selected) {
    const parts = selected.split('/').slice(0, -1)
    parts.forEach((_, index) => folderState.set(parts.slice(0, index + 1).join('/'), true))
  }
  container.dataset.selected = selected ?? ''
  container.replaceChildren()
  function render(folder: Folder, target: HTMLElement, parent: string) {
    for (const [name, child] of [...folder.folders].sort(([a], [b]) => a.localeCompare(b))) {
      const path = parent ? `${parent}/${name}` : name
      const details = document.createElement('details'); details.className = 'file-folder'; details.dataset.path = path
      details.open = searching || (folderState.get(path) ?? !parent)
      const summary = document.createElement('summary'); summary.textContent = name; summary.title = path
      const children = document.createElement('div'); children.className = 'folder-children'
      details.append(summary, children); target.append(details)
      details.addEventListener('toggle', () => {
        if (details.isConnected && !searching) folderState.set(path, details.open)
      })
      render(child, children, path)
    }
    for (const entry of folder.files.sort((a, b) => a.path.localeCompare(b.path))) {
      const b = document.createElement('button')
      b.className = `file${entry.path === selected ? ' selected' : ''}`
      b.textContent = entry.path.split('/').at(-1)!
      b.title = entry.path
      b.setAttribute('aria-label', entry.path)
      if (entry.path === selected) b.setAttribute('aria-current', 'page')
      b.onclick = () => openFile(entry.path)
      target.append(b)
    }
  }
  render(root, container, '')
  if (!entries.length) { const empty = document.createElement('p'); empty.className = 'empty'; empty.textContent = 'No matching files.'; container.append(empty) }
}
