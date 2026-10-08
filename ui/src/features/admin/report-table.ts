/** Admin report controls retain presentation choices across live snapshots. */
export type SortValue = string | number | null | undefined
export type Column<T> = {
  key: string; label: string; headerLines?: [string, string]; value?: (row: T) => SortValue
  render: (row: T) => unknown | HTMLElement
  numeric?: boolean; hidden?: boolean; required?: boolean
}
const element = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string) => {
  const node = document.createElement(tag)
  if (text !== undefined) node.textContent = text
  return node
}
export const number = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : null
export const count = (value: unknown) => number(value)?.toLocaleString('en-US') ?? '—'
export const timestamp = (value: unknown) => {
  if (typeof value !== 'string') return null
  const time = Date.parse(value)
  return Number.isFinite(time) ? time : null
}
export const dateTime = (value: unknown) => {
  const time = timestamp(value)
  return time === null ? '—' : new Date(time).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'UTC',
  })
}
export const duration = (value: unknown) => {
  const ms = number(value)
  if (ms === null || ms < 0) return '—'
  if (ms < 1000) return `${ms.toLocaleString('en-US')} ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(2)} s`
  return `${Math.floor(ms / 60000)}m ${((ms % 60000) / 1000).toFixed(1)}s`
}
export function metadata(value: unknown) {
  const details = element('details')
  details.className = 'metadata-details'
  details.append(element('summary', 'Inspect'), element('pre', JSON.stringify(value, null, 2)))
  return details
}
export function badge(value: unknown, tone = '') {
  const node = element('span', value == null ? '—' : String(value))
  node.className = `report-badge ${tone}`
  return node
}

export class ReportTable<T> {
  private rows: T[] = []
  private sortKey: string
  private descending: boolean
  private visible: Set<string>
  private query = ''
  private body = element('div')
  private summary = element('span')
  readonly node = element('div')
  constructor(private columns: Column<T>[], options: {
    label: string; scope: string; sort: string; descending?: boolean
    search?: { label: string; text: (row: T) => string }
  }) {
    this.sortKey = options.sort; this.descending = options.descending ?? false
    this.visible = new Set(columns.filter(c => !c.hidden || c.required).map(c => c.key))
    this.node.className = 'report-table'
    this.body.className = 'scroll report-scroll'
    const tools = element('div'); tools.className = 'table-tools'
    if (options.search) {
      const label = element('label', options.search.label), input = element('input')
      input.type = 'search'; input.placeholder = options.search.label
      input.oninput = () => { this.query = input.value; this.render() }
      label.append(input); tools.append(label)
    }
    const choices = element('details'); choices.className = 'column-choices'
    choices.append(element('summary', 'Columns'))
    const list = element('div'); list.className = 'column-list'
    columns.forEach(column => {
      const label = element('label'), input = element('input')
      input.type = 'checkbox'; input.checked = this.visible.has(column.key); input.disabled = !!column.required
      input.onchange = () => {
        if (input.checked) this.visible.add(column.key); else this.visible.delete(column.key)
        if (!this.visible.size) { this.visible.add(column.key); input.checked = true }
        this.render()
      }
      label.append(input, document.createTextNode(column.label)); list.append(label)
    })
    choices.append(list); tools.append(this.summary, choices)
    const scope = element('p', options.scope); scope.className = 'table-scope'
    this.body.setAttribute('aria-label', options.label)
    this.node.append(tools, scope, this.body)
    this.label = options.label; this.search = options.search
  }
  private label: string
  private search?: { text: (row: T) => string }
  update(rows: T[]) { this.rows = rows; this.render() }
  private render() {
    const query = this.query.toLocaleLowerCase()
    const selected = this.search && query ? this.rows.filter(row => this.search!.text(row).toLocaleLowerCase().includes(query)) : [...this.rows]
    const sorter = this.columns.find(c => c.key === this.sortKey)
    if (sorter?.value) selected.sort((a, b) => {
      const left = sorter.value!(a), right = sorter.value!(b)
      // Missing observations stay last in both directions; never invent zero.
      if (left == null) return right == null ? 0 : 1
      if (right == null) return -1
      const order = typeof left === 'number' && typeof right === 'number' ? left - right : String(left).localeCompare(String(right))
      return this.descending ? -order : order
    })
    const columns = this.columns.filter(c => this.visible.has(c.key)), table = element('table')
    table.setAttribute('aria-label', this.label)
    const head = element('thead'), heading = element('tr'), body = element('tbody')
    columns.forEach(column => {
      const th = element('th'); th.scope = 'col'
      if (column.numeric) th.className = 'numeric'
      if (column.value) {
        const active = column.key === this.sortKey
        th.setAttribute('aria-sort', active ? this.descending ? 'descending' : 'ascending' : 'none')
        const control = element('button', `${column.label} ${active ? this.descending ? '↓' : '↑' : '↕'}`)
        if (column.headerLines) {
          const first = element('span', column.headerLines[0]), second = element('span', `${column.headerLines[1]} ${active ? this.descending ? '↓' : '↑' : '↕'}`)
          first.className = second.className = 'column-heading-line'
          control.replaceChildren(first, document.createTextNode(' '), second)
        }
        control.type = 'button'; control.className = 'sort-button'
        control.dataset.sortKey = column.key
        control.setAttribute('aria-label', `Sort by ${column.label}${active ? this.descending ? ', ascending' : ', descending' : ''}`)
        control.onclick = () => {
          this.descending = active ? !this.descending : !!column.numeric; this.sortKey = column.key; this.render()
          this.body.querySelector<HTMLButtonElement>(`[data-sort-key="${column.key}"]`)?.focus()
        }
        th.append(control)
      } else th.textContent = column.label
      heading.append(th)
    })
    head.append(heading)
    selected.forEach(row => {
      const tr = element('tr')
      columns.forEach(column => {
        const td = element('td'), value = column.render(row)
        if (column.numeric) td.className = 'numeric'
        if (value instanceof HTMLElement) td.append(value)
        else td.textContent = value == null ? '—' : String(value)
        tr.append(td)
      }); body.append(tr)
    })
    if (!selected.length) {
      const tr = element('tr'), td = element('td', query ? 'No loaded records match this search.' : 'No records loaded in this window.')
      td.colSpan = columns.length; td.className = 'empty-table'; tr.append(td); body.append(tr)
    }
    table.append(head, body); this.body.replaceChildren(table)
    this.summary.textContent = `${count(selected.length)} of ${count(this.rows.length)} loaded records`
    this.summary.setAttribute('role', 'status')
  }
}
