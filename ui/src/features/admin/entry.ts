/** Standalone hosted admin surface. All access decisions remain on the server. */
type Row = Record<string, unknown>
type Usage = { day: string; present: boolean; micros: number; tokens: number; requests: number; micros_credit: number }
type User = { id: string; email: string; name: string; effective_limit_micros: number; daily_limit_micros: number | null; admin_revision: number; token_version: number; usage: Usage; admission: Record<string, number> }
type Overview = { environment: string; administrator: string; generated_at: string; revision: string; policy: Record<string, number>; environment_defaults: Record<string, number>; spending_paused: boolean; account_count: number; global_admission: Record<string, number>; users: User[]; next_cursor: string | null; global_usage: Usage[]; scope: string }
type Logs = { entries: Row[]; next_page_token?: string; scope: string; since: string }
type Command = { operation_id: string; expected_revision: number; action: string; target: string; values: Row }
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string) => { const node = document.createElement(tag); if (text !== undefined) node.textContent = text; return node }
const money = (value: number) => `$${(value / 1e6).toFixed(6)}`
const text = (value: unknown) => value === null || value === undefined ? '—' : typeof value === 'object' ? JSON.stringify(value) : String(value)
let overview: Overview | undefined
let cursor = ''
let command: Command | undefined
let logRows: Row[] = []
let nextLogPage: string | undefined
let activeLogQuery = ''
let logSince = ''
let busy = false
const policyLabels: Record<string, string> = {
  max_users: 'Maximum registered accounts', free_daily_micros: 'Default daily allowance (USD)',
  extended_daily_micros: 'Extended allowance preset (USD)', global_daily_micros: 'Shared daily allowance (USD)',
  account_requests: 'Inference requests / account / day', global_requests: 'Inference requests / service / day',
  diagnostics_requests: 'Account checks / account / day', global_diagnostics: 'Account checks / service / day',
}
async function api<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(path, { credentials: 'same-origin', cache: 'no-store',
    ...(body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Admin-Action': '1' }, body: JSON.stringify(body) }) })
  if (!response.ok) {
    const failure = await response.json().catch(() => ({ detail: `HTTP ${response.status}` }))
    throw new Error(`${failure.detail ?? 'Request failed'}\nHTTP ${response.status}${failure.request_id ? ` · Request ${failure.request_id}` : ''}${failure.diagnostics ? `\n${JSON.stringify(failure.diagnostics, null, 2)}` : ''}${response.status === 401 ? '\nSign in again at /admin/login.' : ''}`)
  }
  return response.status === 204 ? undefined as T : await response.json() as T
}
async function run(work: () => Promise<void>) {
  if (busy) return
  busy = true
  $('error').hidden = true; $('change-error').hidden = true
  document.body.setAttribute('aria-busy', 'true')
  document.querySelectorAll<HTMLButtonElement>('button').forEach(button => button.disabled = true)
  try { await work() } catch (error) { const notice = $<HTMLDialogElement>('confirm').open ? $('change-error') : $('error'); notice.textContent = error instanceof Error ? error.message : String(error); notice.hidden = false; notice.scrollIntoView({ block: 'nearest' }) }
  finally {
    busy = false; document.body.removeAttribute('aria-busy')
    document.querySelectorAll<HTMLButtonElement>('button').forEach(button => button.disabled = false)
    $<HTMLButtonElement>('next-users').disabled = !overview?.next_cursor
  }
}
function table(headers: string[], rows: (unknown | HTMLElement)[][]) {
  const node = el('table'), head = el('thead'), heading = el('tr'), body = el('tbody')
  headers.forEach(value => heading.append(el('th', value))); head.append(heading)
  rows.forEach(values => { const row = el('tr'); values.forEach(value => { const cell = el('td'); if (value instanceof HTMLElement) cell.append(value); else cell.textContent = text(value); row.append(cell) }); body.append(row) })
  node.append(head, body)
  if (!rows.length) { const row = el('tr'), cell = el('td', 'No records in this window.'); cell.colSpan = headers.length; row.append(cell); body.append(row) }
  return node
}
function button(label: string, action: () => void) { const node = el('button', label); node.type = 'button'; node.onclick = action; return node }
function usageView(target: HTMLElement, rows: Usage[]) {
  const max = Math.max(1, ...rows.map(row => row.micros)), bars = el('div'); bars.className = 'bars'
  for (const row of rows) {
    const bar = el('div'), fill = el('div'), label = el('span', row.day.slice(5)); bar.className = 'bar'
    fill.className = row.present ? 'bar-fill' : 'bar-fill missing'; fill.style.height = `${Math.max(1, row.micros / max * 140)}px`
    bar.title = `${row.day}: ${money(row.micros)} · ${row.requests} requests · ${row.tokens} tokens${row.present ? '' : ' · no record'}`
    bar.setAttribute('aria-label', bar.title); bar.tabIndex = 0; bar.append(fill, label); bars.append(bar)
  }
  target.replaceChildren(bars)
}
function usageTable(rows: Usage[]) { return table(['UTC day', 'Record', 'Allowance used', 'Tokens', 'Requests', 'Restored allowance'], rows.map(row => [row.day, row.present ? 'Present' : 'Missing', money(row.micros), row.tokens, row.requests, money(row.micros_credit)])) }
function review(action: string, target: string, revision: number, values: Row, before: unknown, effect: string) {
  command = { operation_id: crypto.randomUUID(), expected_revision: revision, action, target, values }
  const account = overview?.users.find(user => user.id === target)
  const labels: Record<string, string> = { user_limit: 'Change daily allowance', reset_diagnostics: 'Restore account checks', reset_requests: 'Restore inference requests', reset_allowance: 'Restore spending allowance', revoke_sessions: 'Revoke sessions', policy: 'Change service limits' }
  const display = (key: string, value: unknown) => value === null || value === undefined ? 'Use service default' : key.endsWith('_micros') ? money(Number(value)) : String(value)
  const previous = (before && typeof before === 'object' ? before : {}) as Row
  const changes = Object.entries(values).map(([key, value]) => `${policyLabels[key] ?? (key === 'daily_limit_micros' ? 'Daily allowance' : key)}: ${display(key, previous[key])} → ${display(key, value)}`)
  $('change-preview').textContent = `${labels[action] ?? action}\n${account?.email ?? target}${changes.length ? '\n\n' + changes.join('\n') : ''}`
  $('change-effect').textContent = effect
  $<HTMLDialogElement>('confirm').showModal()
}
function parseNumber(input: HTMLInputElement, dollars: boolean) {
  if (!input.value.trim() || !input.checkValidity()) throw new Error(`Invalid value: ${input.labels?.[0]?.textContent ?? input.id}`)
  const scaled = Number(input.value) * (dollars ? 1e6 : 1)
  const number = Math.round(scaled)
  if (!Number.isSafeInteger(number) || number < 0 || Math.abs(number - scaled) > 0.000001) throw new Error('Use a nonnegative whole number or at most six decimal places for USD.')
  return number
}
async function loadOverview() {
  const days = $<HTMLSelectElement>('days').value
  overview = await api<Overview>(`/admin/api/overview?days=${days}&after=${encodeURIComponent(cursor)}`)
  const data = overview, today = data.global_usage.at(-1)!
  $('environment').textContent = data.environment
  $('administrator').textContent = data.administrator
  $('status').textContent = `Snapshot ${new Date(data.generated_at).toLocaleString()} · UTC daily limits reset at 00:00.`
  $('revision').textContent = `Revision: ${data.revision}`
  $('summary').replaceChildren(...[
    ['Registered accounts', `${data.account_count} / ${data.policy.max_users}`],
    ['Spending', data.spending_paused ? 'Paused' : 'Admission enabled'],
    ['Allowance used today', money(today.micros)], ['Shared daily limit', money(data.policy.global_daily_micros)],
    ['Inference admissions', `${data.global_admission.account_requests} / ${data.policy.global_requests}`],
    ['Account checks', `${data.global_admission.diagnostics_requests} / ${data.policy.global_diagnostics}`],
  ].map(([label, value]) => { const card = el('div'); card.append(el('span', label), el('strong', value)); return card }))
  usageView($('usage-chart'), data.global_usage); $('usage-table').replaceChildren(usageTable(data.global_usage))
  $('users').replaceChildren(table(['Account', 'Limit source', 'Daily allowance', 'Used today', 'Account checks / credit', 'Sessions version', 'Inspect'], data.users.map(user => [
    user.email || user.id, user.daily_limit_micros == null ? 'Default' : 'Custom exception', money(user.effective_limit_micros), money(user.usage.micros),
    `${user.admission.diagnostics_requests} / ${user.admission.diagnostics_requests_credit}`, user.token_version,
    button('Inspect account', () => void run(() => inspectUser(user))),
  ])))
  $('user-detail').hidden = true
  const fields = $('policy-fields'); fields.replaceChildren()
  for (const [key, label] of Object.entries(policyLabels)) {
    const wrapper = el('label', label), input = el('input'), hint = el('small')
    input.id = `policy-${key}`; input.type = 'number'; input.min = '0'; input.required = true
    const dollars = key.endsWith('_micros'); input.step = dollars ? '0.000001' : '1'
    input.value = String(data.policy[key] / (dollars ? 1e6 : 1))
    hint.textContent = `Environment default: ${dollars ? money(data.environment_defaults[key]) : data.environment_defaults[key]}${key === 'extended_daily_micros' ? ' · Applied explicitly to individual accounts; existing exceptions keep their values.' : ''}`
    wrapper.append(input, hint); fields.append(wrapper)
  }
}
async function inspectUser(user: User) {
  const result = await api<{ user: User; usage: Usage[]; devices: Row[]; reservations: Row[]; devices_truncated: boolean; reservations_truncated: boolean }>(`/admin/api/users/${encodeURIComponent(user.id)}?days=${$<HTMLSelectElement>('days').value}`)
  user = result.user
  const pane = $('user-detail'); pane.hidden = false; pane.replaceChildren(el('h3', user.email || user.id))
  const chart = el('div'); usageView(chart, result.usage); pane.append(chart)
  const history = el('details'); history.append(el('summary', 'Daily numeric table'), usageTable(result.usage)); pane.append(history)
  const controls = el('div'); controls.className = 'filters'
  const label = el('label', 'Custom daily allowance (USD)'), input = el('input'); input.type = 'number'; input.min = '0'; input.step = '0.000001'; input.value = String(user.effective_limit_micros / 1e6); label.append(input); controls.append(label)
  const limitChange = (limit: number | null) => review('user_limit', user.id, user.admin_revision, { daily_limit_micros: limit }, { daily_limit_micros: user.daily_limit_micros }, 'Applies to subsequent requests. Shared spending and request limits still apply.')
  controls.append(button('Set custom limit', () => { try { limitChange(parseNumber(input, true)) } catch (error) { $('error').textContent = String(error); $('error').hidden = false } }),
    button('Use default', () => limitChange(null)), button('Use extended preset', () => limitChange(overview!.policy.extended_daily_micros)))
  pane.append(controls)
  const resets = el('div'); resets.className = 'filters'
  for (const [action, label, effect] of [
    ['reset_diagnostics', 'Restore account checks', 'Restores today’s personal account-check allowance. Shared request counts remain unchanged.'],
    ['reset_requests', 'Restore inference requests', 'Restores today’s personal inference-request allowance. Shared request counts remain unchanged.'],
    ['reset_allowance', 'Restore spending allowance', 'Grants allowance equal to currently recorded usage, including pending holds. Usage, shared totals, reservations and later settlements remain intact. This can permit additional spending today.'],
    ['revoke_sessions', 'Revoke sessions', 'Invalidates existing app and admin sessions for this account. The user can sign in again; this does not ban the account.'],
  ]) resets.append(button(label, () => review(action, user.id, user.admin_revision, {}, { token_version: user.token_version, today: result.usage.at(-1) }, effect)))
  pane.append(resets, el('h4', 'Registered installations'), table(['Platform', 'App version', 'First seen', 'Last seen'], result.devices.map(row => ['platform', 'app_version', 'first_seen', 'last_seen'].map(key => row[key]))),
    el('h4', `Latest reservations${result.reservations_truncated ? ' · limited to 100' : ''}`),
    table(['Day', 'State', 'Reserved', 'Recorded', 'Basis', 'Provider receipt'], result.reservations.map(row => [row.day, row.status, money(Number(row.reserved_micros)), row.actual_micros == null ? 'Unknown' : money(Number(row.actual_micros)), row.cost_basis ?? 'Pending / unknown', row.provider_id])))
  pane.scrollIntoView({ block: 'start', behavior: 'smooth' })
}
function renderLogs() {
  $('logs').replaceChildren(table(['Time (UTC)', 'Event', 'Route', 'Status', 'Code', 'Request', 'Metadata'], logRows.map(row => {
    const details = el('details'); details.append(el('summary', 'Inspect'), el('pre', JSON.stringify(row, null, 2)))
    return [row.timestamp, row.event, row.route, row.status, row.code, row.request_id, details]
  })))
  const counts = new Map<string, number>(), unique = new Set<string>()
  for (const row of logRows) if (row.event === 'request_started' && typeof row.timestamp === 'string' && typeof row.request_id === 'string' && !unique.has(row.request_id)) {
    const date = new Date(row.timestamp); if (!Number.isFinite(date.getTime())) continue
    unique.add(row.request_id); const key = date.toISOString().slice(0, 13); counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  const days = [...new Set([...counts.keys()].map(key => key.slice(0, 10)))].sort(), max = Math.max(1, ...counts.values())
  const heatmap = table(['UTC day', ...Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, '0'))], days.map(day => [day, ...Array.from({ length: 24 }, (_, hour) => {
    const count = counts.get(`${day}T${String(hour).padStart(2, '0')}`) ?? 0, cell = el('span', String(count)); cell.className = `heat heat-${Math.ceil(count / max * 4)}`; cell.title = `${day} ${hour}:00 UTC: ${count} arrivals in loaded events`; return cell
  })]))
  $('heatmap').replaceChildren(heatmap)
}
async function loadLogs(more = false) {
  if (!more) { const params = new URLSearchParams({ hours: $<HTMLSelectElement>('hours').value, errors: String($<HTMLInputElement>('errors-only').checked), request_id: $<HTMLInputElement>('request-id').value.trim() }); activeLogQuery = params.toString() }
  const data = await api<Logs>(`/admin/api/logs?${activeLogQuery}${more && nextLogPage ? `&page_token=${encodeURIComponent(nextLogPage)}&since=${encodeURIComponent(logSince)}` : ''}`)
  logRows = more ? [...logRows, ...data.entries] : data.entries; nextLogPage = data.next_page_token; logSince = data.since
  $('log-scope').textContent = `${data.scope} Loaded ${logRows.length} events. ${nextLogPage ? 'More events are available; the heat map is incomplete.' : 'No further pages reported.'}`
  $('more-logs').hidden = !nextLogPage; renderLogs()
}
$('refresh').onclick = () => void run(loadOverview)
$('days').onchange = () => void run(loadOverview)
$('first-users').onclick = () => { cursor = ''; void run(loadOverview) }
$('next-users').onclick = () => { cursor = overview?.next_cursor ?? ''; void run(loadOverview) }
$('load-logs').onclick = () => void run(() => loadLogs())
$('more-logs').onclick = () => void run(() => loadLogs(true))
$('load-audit').onclick = () => void run(async () => { const rows = await api<Row[]>('/admin/api/audit'); $('audit-table').replaceChildren(table(['Time', 'Action', 'Target', 'Before', 'After', 'Actor'], rows.map(row => ['created_at', 'action', 'target', 'before', 'after', 'actor'].map(key => row[key])))) })
$('logout').onclick = () => void run(async () => { await api('/admin/logout', {}); location.assign('/admin') })
$('policy-form').onsubmit = event => { event.preventDefault(); if (!overview) return; try {
  const values: Row = {}, before: Row = {}
  for (const key of Object.keys(policyLabels)) { const value = parseNumber($<HTMLInputElement>(`policy-${key}`), key.endsWith('_micros')); if (value !== overview.policy[key]) { values[key] = value; before[key] = overview.policy[key] } }
  if (Object.keys(values).length) review('policy', 'service', overview.policy.revision, values, before, 'Updates effective service limits. Lowering a limit can immediately prevent subsequent requests or new registrations. No existing usage is erased.')
} catch (error) { $('error').textContent = String(error); $('error').hidden = false } }
$('cancel-change').onclick = () => { command = undefined; $<HTMLDialogElement>('confirm').close() }
$('apply-change').onclick = () => void run(async () => {
  if (!command) return
  // Keep the same operation ID after network ambiguity; never automatically resubmit.
  await api('/admin/api/change', command); command = undefined; $<HTMLDialogElement>('confirm').close(); await loadOverview()
  $('status').textContent += ' Change applied and audit record saved.'
})
void run(loadOverview)
