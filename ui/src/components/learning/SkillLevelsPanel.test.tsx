// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { SkillLevelsPanel } from './SkillLevelsPanel'
import { skillDemo } from '../../domain/learning/catalog/skillDemo'
import { withFixtureLevels } from '../../../tests/fixtures/skill-levels'

function snapshotWithPoints(points: number[]) {
  const snapshot = structuredClone(skillDemo)
  snapshot.catalog.filter(node => node.kind === 'skill').forEach((skill, index) => {
    for (let n = 0; n < points[index]; n++) snapshot.profile.credits.push({ attempt_id: `${skill.id}-${n}`, skill_id: skill.id, xp: 1 })
  })
  return withFixtureLevels(snapshot)
}

const openChartSettings = () => { if (!screen.queryByRole('group', { name: 'Chart settings' })) fireEvent.click(screen.getByRole('button', { name: 'Chart settings' })) }
const focusHeading = () => document.querySelector('.skill-levels-focus h3')?.textContent

describe('SkillLevelsPanel', () => {
  it('names every arm on the chart and shows a pressed arm right under it', () => {
    render(<SkillLevelsPanel languageName="Spanish" snapshot={snapshotWithPoints([9, 6, 11, 5, 7, 5, 13, 8])} conversation={null} onInspect={null} />)
    expect(screen.getByText('Spanish skill level 4')).toBeTruthy()
    expect(document.querySelectorAll('.skill-radar-label')).toHaveLength(8)
    expect(screen.queryByText(/Lv 5 goal/)).toBeNull()
    const goal = document.querySelectorAll('.skill-radar-ring-hit')
    fireEvent.pointerMove(goal[goal.length - 1], { clientX: 10, clientY: 10 })
    expect(screen.getByText(/^Lv 5 goal · \d+ pt$/)).toBeTruthy()
    expect(focusHeading()).toBe('Managing conversation')
    fireEvent.click(screen.getByRole('button', { name: /^Possibilities and constraints: skill level 4/ }))
    expect(focusHeading()).toBe('Possibilities and constraints')
    expect(screen.getByText('3 more points for level 5')).toBeTruthy()
  })
  it('lists every skill holding the next level back and every skill already ready', () => {
    render(<SkillLevelsPanel languageName="Spanish" snapshot={snapshotWithPoints([9, 6, 11, 5, 7, 5, 13, 8])} conversation={null} onInspect={null} />)
    const next = screen.getByRole('heading', { name: 'To reach level 5' }).parentElement!
    expect(within(next).getAllByRole('button')).toHaveLength(4)
    const ready = screen.getByRole('heading', { name: 'Ready for level 5' }).parentElement!
    expect(within(ready).getAllByRole('button')).toHaveLength(4)
    fireEvent.click(within(next).getByRole('button', { name: /Feelings and viewpoints/ }))
    expect(focusHeading()).toBe('Feelings and viewpoints')
  })
  it('opens more about the focused skill when the owner allows it', () => {
    const inspect = vi.fn()
    render(<SkillLevelsPanel languageName="Spanish" snapshot={snapshotWithPoints([1, 1, 1, 1, 1, 1, 1, 1])} conversation={null} onInspect={inspect} />)
    const next = screen.getByRole('heading', { name: 'To reach level 2' }).parentElement!
    fireEvent.click(within(next).getByRole('button', { name: /Possibilities and constraints/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Possibilities and constraints in Spanish' }))
    expect(inspect).toHaveBeenCalledWith('possibilities_constraints')
  })
  it('tells a new learner how to reach level 1', () => {
    render(<SkillLevelsPanel languageName="Spanish" snapshot={skillDemo} conversation={null} onInspect={null} />)
    expect(screen.getByText('Get a skill point in each skill to reach level 1.')).toBeTruthy()
  })
  it('keeps one selected skill that hover never changes, marked on the chart, the lists and the card', () => {
    render(<SkillLevelsPanel languageName="Spanish" snapshot={snapshotWithPoints([9, 6, 11, 5, 7, 5, 13, 8])} conversation={null} onInspect={null} />)
    const start = focusHeading()
    const ready = screen.getByRole('heading', { name: 'Ready for level 5' }).parentElement!
    const chip = within(ready).getAllByRole('button')[0]
    fireEvent.pointerEnter(chip)
    expect(focusHeading()).toBe(start)
    fireEvent.click(chip)
    const chosen = focusHeading()
    expect(chosen).not.toBe(start)
    expect(chip).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: new RegExp(`^${chosen}: skill level`) })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(chip)
    expect(focusHeading()).toBe(chosen)
  })
  it('switches between radial and bars, keeps the selection, and remembers the choice', () => {
    localStorage.clear()
    const { unmount } = render(<SkillLevelsPanel languageName="Spanish" snapshot={snapshotWithPoints([9, 6, 11, 5, 7, 5, 13, 8])} conversation={null} onInspect={null} />)
    const start = focusHeading()
    openChartSettings()
    fireEvent.click(screen.getByRole('button', { name: 'Bars' }))
    expect(document.querySelector('.skill-radar')).toBeNull()
    expect(document.querySelectorAll('.skill-bar')).toHaveLength(8)
    expect(screen.getByRole('button', { name: new RegExp(`^${start}: skill level`) })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: /^Possibilities and constraints: skill level 4/ }))
    expect(focusHeading()).toBe('Possibilities and constraints')
    unmount()
    render(<SkillLevelsPanel languageName="Spanish" snapshot={snapshotWithPoints([9, 6, 11, 5, 7, 5, 13, 8])} conversation={null} onInspect={null} />)
    openChartSettings()
    expect(screen.getByRole('button', { name: 'Bars' })).toHaveAttribute('aria-pressed', 'true')
    expect(document.querySelectorAll('.skill-bar')).toHaveLength(8)
    localStorage.clear()
  })
  it('draws bars to scale when asked, with the goal line at the target points', () => {
    localStorage.clear()
    render(<SkillLevelsPanel languageName="Spanish" snapshot={snapshotWithPoints([9, 6, 11, 5, 7, 5, 13, 8])} conversation={null} onInspect={null} />)
    openChartSettings()
    fireEvent.click(screen.getByRole('button', { name: 'Bars' }))
    const widths = () => [...document.querySelectorAll<HTMLElement>('.skill-bar-fill')].map(bar => parseFloat(bar.style.width))
    const normalized = widths()
    openChartSettings()
    fireEvent.click(screen.getByRole('button', { name: 'To scale' }))
    const scaled = widths()
    expect(scaled).not.toEqual(normalized)
    // To scale, 13 points is the longest bar and 6 points is 6/13 of it.
    expect(scaled[1] / scaled[6]).toBeCloseTo(6 / 13)
    localStorage.clear()
  })
  it('zooms the radar with the buttons and returns to fit', () => {
    localStorage.clear()
    render(<SkillLevelsPanel languageName="Spanish" snapshot={snapshotWithPoints([9, 6, 11, 5, 7, 5, 13, 8])} conversation={null} onInspect={null} />)
    expect(screen.queryByRole('group', { name: 'Chart settings' })).toBeNull()
    openChartSettings()
    const zoomLabel = () => screen.getByRole('button', { name: 'Fit the whole chart' }).textContent
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }))
    expect(zoomLabel()).toBe('1.5×')
    // Closed, the settings button keeps showing the zoom.
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('group', { name: 'Chart settings' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Chart settings' })).toHaveTextContent('1.5×')
    openChartSettings()
    fireEvent.click(screen.getByRole('button', { name: 'Fit the whole chart' }))
    expect(zoomLabel()).toBe('1×')
    localStorage.clear()
  })
  it('zooms bars to scale, magnifying bars and returning to fit', () => {
    localStorage.clear()
    render(<SkillLevelsPanel languageName="Spanish" snapshot={snapshotWithPoints([9, 6, 11, 5, 7, 5, 13, 8])} conversation={null} onInspect={null} />)
    openChartSettings()
    fireEvent.click(screen.getByRole('button', { name: 'Bars' }))
    openChartSettings()
    fireEvent.click(screen.getByRole('button', { name: 'To scale' }))
    const width = (index: number) => parseFloat(document.querySelectorAll<HTMLElement>('.skill-bar-fill')[index].style.width)
    const fitted = width(1)
    openChartSettings()
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }))
    expect(width(1)).toBeCloseTo(fitted * 1.5)
    expect(document.querySelectorAll('.skill-bar-fill')[6]).toHaveAttribute('data-over', 'true')
    openChartSettings()
    fireEvent.click(screen.getByRole('button', { name: 'Fit the whole chart' }))
    expect(width(1)).toBeCloseTo(fitted)
    localStorage.clear()
  })
})
