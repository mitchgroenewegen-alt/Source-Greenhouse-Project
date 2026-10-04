import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { applyDecisions, buildWeekly } from '../../scoring/effective'
import { scoreCultivationWeek } from '../../scoring/summary'
import { loadTestData } from '../../test/loadData'
import type { WorkspaceCultivation } from '../../workspace/types'
import { CultivationCard } from './CultivationCard'

const base = loadTestData()
const added: WorkspaceCultivation = { id: 'ON-P2-TOV', facility: 'Ontario', greenhouse: 'Phase 2', crop: 'Tomato', variety: 'TOV', plantingDate: '2026-03-10', areaM2: 1000, cropWeekAtEnd: 0, fruitType: 'tov', plannedEndDate: null, archived: false }
const score = scoreCultivationWeek(buildWeekly(applyDecisions(base.daily, [], [], true)), added.id, '2025-W34')

function card(state: 'ready' | 'no-budget' | 'no-data') {
  return renderToStaticMarkup(
    createElement(
      MemoryRouter,
      null,
      createElement(CultivationCard, { cultivation: added, score, state, weekEnd: '2025-08-24', weekLabel: 'W34', openFlags: 0, openFlagsThisWeek: 0 }),
    ),
  )
}

describe('the Scorecard card of a new cultivation', () => {
  it('says "No budget yet" instead of showing scores', () => {
    const html = card('no-budget')
    expect(html).toContain('No budget yet')
    expect(html).not.toContain('Cumulative harvest')
    expect(html).not.toContain('Not scored')
  })

  it('says "No data yet" when there are budgets but nothing recorded', () => {
    const html = card('no-data')
    expect(html).toContain('No data yet')
    expect(html).not.toContain('Cumulative harvest')
  })

  it('shows the numbers as usual when ready', () => {
    expect(card('ready')).toContain('Cumulative harvest')
  })
})
