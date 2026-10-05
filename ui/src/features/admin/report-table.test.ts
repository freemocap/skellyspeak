// @vitest-environment jsdom
import { expect, it } from 'vitest'
import { fireEvent, getByRole } from '@testing-library/dom'
import { ReportTable, dateTime, duration } from './report-table'

it('sorts numeric observations, keeps missing values last and retains choices across snapshots', () => {
  type Row = { name: string; duration: number | null; secret: string }
  const report = new ReportTable<Row>([
    { key: 'name', label: 'Name', required: true, value: r => r.name, render: r => r.name },
    { key: 'duration', label: 'Duration', numeric: true, value: r => r.duration, render: r => duration(r.duration) },
    { key: 'secret', label: 'Extra', hidden: true, render: r => r.secret },
  ], { label: 'Test report', scope: 'Loaded records', sort: 'name', search: { label: 'Search', text: r => r.name } })
  document.body.replaceChildren(report.node)
  const rows: Row[] = [{ name: 'Slow', duration: 12000, secret: 'extra' }, { name: 'Fast', duration: 200, secret: 'extra' }, { name: 'Unknown', duration: null, secret: 'extra' }]
  report.update(rows)
  const names = () => [...report.node.querySelectorAll('tbody tr')].map(r => r.firstElementChild!.textContent)
  fireEvent.click(getByRole(report.node, 'button', { name: 'Sort by Duration' }))
  expect(names()).toEqual(['Slow', 'Fast', 'Unknown'])
  fireEvent.click(getByRole(report.node, 'button', { name: 'Sort by Duration, ascending' }))
  expect(names()).toEqual(['Fast', 'Slow', 'Unknown'])
  expect(document.activeElement?.textContent).toContain('Duration')
  expect(report.node.querySelector('th[aria-sort=ascending]')!.textContent).toContain('Duration')
  fireEvent.click(getByRole(report.node, 'checkbox', { name: 'Extra' }))
  expect(report.node.querySelector('thead')!.textContent).toContain('Extra')
  fireEvent.click(getByRole(report.node, 'checkbox', { name: 'Duration' }))
  report.update([...rows].reverse())
  expect(names()).toEqual(['Fast', 'Slow', 'Unknown'])
  expect(report.node.querySelector('thead')!.textContent).not.toContain('Duration')
  fireEvent.input(getByRole(report.node, 'searchbox'), { target: { value: 'slow' } })
  report.update(rows)
  expect(names()).toEqual(['Slow'])
  expect(report.node.textContent).toContain('1 of 3 loaded records')
  fireEvent.input(getByRole(report.node, 'searchbox'), { target: { value: 'absent' } })
  expect(report.node.textContent).toContain('No loaded records match')
})

it('renders untrusted text literally and formats zero, long and unknown durations', () => {
  const report = new ReportTable<string>([{ key: 'name', label: 'Name', required: true, render: r => r }], { label: 'Safety', scope: 'Test', sort: 'name' })
  report.update(['<img src=x onerror=alert(1)>'])
  expect(report.node.querySelector('img')).toBeNull()
  expect(report.node.textContent).toContain('<img src=x')
  expect(duration(null)).toBe('—')
  expect(duration(0)).toBe('0 ms')
  expect(duration(1500)).toBe('1.50 s')
  expect(duration(125500)).toBe('2m 5.5s')
  expect(dateTime(null)).toBe('—')
  expect(dateTime('2026-10-03T04:05:06Z')).toContain('04:05:06')
})
