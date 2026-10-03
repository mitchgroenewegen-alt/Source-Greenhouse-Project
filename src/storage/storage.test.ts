import { describe, expect, it, vi } from 'vitest'
import { decisionsToCsv, mergeDecisions, parseCsvRows, parseDecisionsCsv } from './csv'
import { allHaveSuggestions, buildDecisions } from './decide'
import { LocalStorageDecisionStore, MemoryDecisionStore } from './decisionStore'
import { decisionOutcome, decisionWords } from './outcome'
import { ACTION_LABEL, DECISION_LABEL, type Decision } from './types'

function decision(overrides: Partial<Decision> = {}): Decision {
  return {
    cellId: 'PA-P2-TOV|Temperature (24h)|2025-07-01|target',
    cultivation: 'PA-P2-TOV',
    kpi: 'Temperature (24h)',
    date: '2025-07-01',
    field: 'target',
    rule: 'unit-fahrenheit',
    originalValue: 69,
    kind: 'correct',
    correctedValue: 20.6,
    decidedBy: 'Dana',
    decidedAt: '2025-09-01T10:00:00.000Z',
    note: 'Plan sheet was in °F',
    ...overrides,
  }
}

/** A stand-in for window.localStorage. */
class FakeStorage implements Storage {
  data = new Map<string, string>()
  get length() {
    return this.data.size
  }
  clear() {
    this.data.clear()
  }
  getItem(key: string) {
    return this.data.get(key) ?? null
  }
  key(i: number) {
    return [...this.data.keys()][i] ?? null
  }
  removeItem(key: string) {
    this.data.delete(key)
  }
  setItem(key: string, value: string) {
    this.data.set(key, value)
  }
}

describe('decision store', () => {
  it('saves, replaces by cell, removes and tells listeners', () => {
    const store = new MemoryDecisionStore()
    const listener = vi.fn()
    const stop = store.subscribe(listener)
    store.save([decision()])
    store.save([decision({ kind: 'confirm', correctedValue: null })]) // same cell: replaces
    expect(store.getAll()).toHaveLength(1)
    expect(store.getAll()[0]!.kind).toBe('confirm')
    store.remove([decision().cellId])
    expect(store.getAll()).toEqual([])
    expect(listener).toHaveBeenCalledTimes(3)
    stop()
    store.save([decision()])
    expect(listener).toHaveBeenCalledTimes(3)
  })

  it('hands out a new array after every change (safe as a React snapshot)', () => {
    const store = new MemoryDecisionStore()
    const before = store.getAll()
    expect(store.getAll()).toBe(before)
    store.save([decision()])
    expect(store.getAll()).not.toBe(before)
  })

  it('keeps decisions in localStorage and reads them back', () => {
    const storage = new FakeStorage()
    const first = new LocalStorageDecisionStore(() => storage)
    first.save([decision()])
    const second = new LocalStorageDecisionStore(() => storage)
    expect(second.getAll()).toEqual([decision()])
    expect(second.persistent).toBe(true)
  })

  it('ignores damaged storage instead of crashing', () => {
    const storage = new FakeStorage()
    storage.setItem('crop-performance.decisions.v1', '{not json')
    expect(new LocalStorageDecisionStore(() => storage).getAll()).toEqual([])
    storage.setItem('crop-performance.decisions.v1', JSON.stringify([decision(), { cellId: 'x' }, 7]))
    expect(new LocalStorageDecisionStore(() => storage).getAll()).toEqual([decision()])
  })

  it('carries on in memory when the browser blocks storage', () => {
    const blocked = () => {
      throw new Error('SecurityError')
    }
    const store = new LocalStorageDecisionStore(blocked)
    expect(store.persistent).toBe(false)
    store.save([decision()])
    expect(store.getAll()).toHaveLength(1)

    const readOnly = new FakeStorage()
    readOnly.setItem = () => {
      throw new Error('QuotaExceededError')
    }
    const store2 = new LocalStorageDecisionStore(() => readOnly)
    store2.save([decision()])
    expect(store2.persistent).toBe(false)
    expect(store2.getAll()).toHaveLength(1)
  })

  it('works when there is no localStorage at all', () => {
    const store = new LocalStorageDecisionStore(() => undefined)
    expect(store.persistent).toBe(false)
    store.save([decision()])
    expect(store.getAll()).toHaveLength(1)
  })
})

describe('CSV export and import', () => {
  it('round-trips decisions, including commas, quotes, new lines and non-ASCII text', () => {
    const decisions = [
      decision({ note: 'He said "20.6, not 69"\nchecked with the plan sheet', decidedBy: 'Zoë, Growing' }),
      decision({
        cellId: 'AZ-P3-Snack|Drain|2025-05-26|target',
        cultivation: 'AZ-P3-Snack',
        kpi: 'Drain',
        date: '2025-05-26',
        rule: 'unit-fraction',
        originalValue: 0.4,
        correctedValue: 40,
      }),
      decision({ kind: 'exclude', correctedValue: null, cellId: 'a|b|2025-01-01|actual', field: 'actual', date: '2025-01-01', cultivation: 'a', kpi: 'b', originalValue: null }),
    ]
    const result = parseDecisionsCsv(decisionsToCsv(decisions))
    expect(result.errors).toEqual([])
    expect(result.decisions).toEqual(decisions)
  })

  it('has a readable header and one row per decision', () => {
    const csv = decisionsToCsv([decision()])
    const [header, row] = csv.trim().split('\r\n')
    expect(header).toBe('cultivation,kpi,date,field,rule,original_value,decision,corrected_value,decided_by,decided_at,note')
    expect(row).toBe('PA-P2-TOV,Temperature (24h),2025-07-01,target,unit-fahrenheit,69,correct,20.6,Dana,2025-09-01T10:00:00.000Z,Plan sheet was in °F')
  })

  it('stops a spreadsheet from running notes that start like formulas, and undoes it on import', () => {
    const risky = decision({ note: '=HYPERLINK("http://example.com")', decidedBy: '+1 555' })
    const csv = decisionsToCsv([risky])
    expect(csv).toContain("'=HYPERLINK")
    expect(csv).toContain("'+1 555")
    expect(parseDecisionsCsv(csv).decisions[0]).toEqual(risky)
  })

  it('does not touch negative numbers in number columns', () => {
    const d = decision({ originalValue: -1.83, correctedValue: null, kind: 'exclude' })
    expect(decisionsToCsv([d])).toContain(',-1.83,exclude,')
    expect(parseDecisionsCsv(decisionsToCsv([d])).decisions[0]!.originalValue).toBe(-1.83)
  })

  it('reads files with a BOM, CRLF or LF line ends, and column order changes', () => {
    const csv = '﻿decision,cultivation,kpi,date,field,rule,original_value,corrected_value,decided_by,decided_at,note\n' +
      'confirm,PA-P1-TOV,Plant load,2025-06-16,target,unit-factor-10,1350,,Sam,2025-09-02T08:00:00Z,ok\n'
    const result = parseDecisionsCsv(csv)
    expect(result.errors).toEqual([])
    expect(result.decisions[0]).toMatchObject({ kind: 'confirm', cellId: 'PA-P1-TOV|Plant load|2025-06-16|target', originalValue: 1350 })
  })

  it('reports bad rows and keeps the good ones', () => {
    const good = decisionsToCsv([decision()]).trimEnd()
    const csv = `${good}\r\nPA-P1-TOV,Plant load,16 June,target,unit-factor-10,1350,confirm,,Sam,2025-09-02T08:00:00Z,\r\nPA-P1-TOV,Plant load,2025-06-16,target,unit-factor-10,1350,correct,,Sam,2025-09-02T08:00:00Z,\r\n`
    const result = parseDecisionsCsv(csv)
    expect(result.decisions).toHaveLength(1)
    expect(result.errors).toHaveLength(2)
    expect(result.errors[0]).toMatch(/Row 3.*date/)
    expect(result.errors[1]).toMatch(/Row 4.*corrected_value/)
  })

  it('rejects a file without the expected columns', () => {
    expect(parseDecisionsCsv('a,b\n1,2').errors[0]).toMatch(/Missing column/)
    expect(parseDecisionsCsv('').errors[0]).toMatch(/empty/)
  })

  it('parses quoted fields on their own', () => {
    expect(parseCsvRows('a,"b,c","d ""e"""\r\n1,2,3')).toEqual([['a', 'b,c', 'd "e"'], ['1', '2', '3']])
  })
})

describe('merging an import with stored decisions', () => {
  it('adds new cells and lets the later decision win', () => {
    const stored = [decision({ decidedAt: '2025-09-01T10:00:00Z' })]
    const imported = [
      decision({ kind: 'exclude', correctedValue: null, decidedAt: '2025-09-02T10:00:00Z' }), // newer: wins
      decision({ cellId: 'other|k|2025-01-01|actual', decidedAt: '2025-09-02T10:00:00Z' }), // new cell
    ]
    const result = mergeDecisions(stored, imported)
    expect(result).toMatchObject({ added: 1, updated: 1, keptExisting: 0 })
    expect(result.merged.find((d) => d.cellId === stored[0]!.cellId)!.kind).toBe('exclude')

    const older = mergeDecisions(stored, [decision({ kind: 'confirm', correctedValue: null, decidedAt: '2025-08-01T10:00:00Z' })])
    expect(older).toMatchObject({ added: 0, updated: 0, keptExisting: 1 })
    expect(older.merged[0]!.kind).toBe('correct')
  })
})

describe('building decisions from flags', () => {
  const flag = (suggestion: number | null, date = '2025-07-01') => ({
    id: `PA-P2-TOV|Temperature (24h)|${date}|target`,
    cultivation: 'PA-P2-TOV',
    kpi: 'Temperature (24h)',
    date,
    field: 'target' as const,
    value: 69,
    rule: 'unit-fahrenheit' as const,
    severity: 'error' as const,
    explanation: 'x',
    suggestion,
  })
  const now = new Date('2025-09-03T09:30:00Z')

  it('writes one decision per cell with who, when and note', () => {
    const out = buildDecisions([flag(20.6), flag(20.6, '2025-07-02')], { kind: 'correct', value: 'suggestion', decidedBy: ' Dana ', note: ' checked ', now })
    expect(out).toHaveLength(2)
    expect(out[0]).toMatchObject({ kind: 'correct', correctedValue: 20.6, decidedBy: 'Dana', note: 'checked', decidedAt: '2025-09-03T09:30:00.000Z', originalValue: 69 })
  })

  it('uses one typed value for every cell, and none for confirm or exclude', () => {
    expect(buildDecisions([flag(null)], { kind: 'correct', value: 21, decidedBy: 'a', note: '', now })[0]!.correctedValue).toBe(21)
    expect(buildDecisions([flag(20.6)], { kind: 'confirm', decidedBy: 'a', note: '', now })[0]!.correctedValue).toBeNull()
    expect(buildDecisions([flag(20.6)], { kind: 'exclude', decidedBy: 'a', note: '', now })[0]!.correctedValue).toBeNull()
  })

  it('refuses to correct without a value', () => {
    expect(() => buildDecisions([flag(null)], { kind: 'correct', value: 'suggestion', decidedBy: 'a', note: '', now })).toThrow()
    expect(allHaveSuggestions([flag(20.6), flag(null)])).toBe(false)
    expect(allHaveSuggestions([flag(20.6)])).toBe(true)
  })
})

describe('the three actions and their outcomes', () => {
  it('labels the actions exactly Confirm values, Apply correction and Exclude', () => {
    expect(ACTION_LABEL).toEqual({ confirm: 'Confirm values', correct: 'Apply correction', exclude: 'Exclude' })
    expect(DECISION_LABEL).toEqual({ confirm: 'Values confirmed', correct: 'Correction applied', exclude: 'Excluded' })
  })

  it('states the outcome in the same words on the card and in the log', () => {
    expect(decisionOutcome([decision({ kind: 'confirm', correctedValue: null })])).toBe('Values confirmed by Dana')
    expect(decisionOutcome([decision({ kind: 'correct', correctedValue: 20.6 })])).toBe('Correction applied: 20.6 by Dana')
    expect(decisionOutcome([decision({ kind: 'exclude', correctedValue: null })])).toBe('Excluded by Dana')
  })

  it('names the value once for a run of dates, and the range when each date got its own', () => {
    const same = [decision({ cellId: 'a', correctedValue: 20.6 }), decision({ cellId: 'b', correctedValue: 20.6 })]
    expect(decisionWords(same)).toBe('Correction applied: 20.6')
    const each = [decision({ cellId: 'a', correctedValue: 21.4 }), decision({ cellId: 'b', correctedValue: 20.1 }), decision({ cellId: 'c', correctedValue: 20.6 })]
    expect(decisionWords(each)).toBe('Correction applied: 20.1 to 21.4')
  })

  it('does not go wrong on a mix of kinds (an import can hold them) or on a missing name', () => {
    expect(decisionWords([decision({ kind: 'confirm', correctedValue: null }), decision({ cellId: 'b', kind: 'exclude', correctedValue: null })])).toBe('Mixed decisions: Values confirmed, Excluded')
    expect(decisionOutcome([decision({ kind: 'exclude', correctedValue: null, decidedBy: '' })])).toBe('Excluded by unknown')
  })

  it('keeps the stored ids and the CSV columns, so exports made before the new wording still import', () => {
    const csv = decisionsToCsv([decision({ kind: 'confirm', correctedValue: null }), decision({ cellId: 'b|c|2025-07-02|actual', date: '2025-07-02', field: 'actual', kind: 'exclude', correctedValue: null })])
    const [header, ...rows] = csv.trim().split('\r\n')
    expect(header).toBe('cultivation,kpi,date,field,rule,original_value,decision,corrected_value,decided_by,decided_at,note')
    expect(rows.map((r) => r.split(',')[6])).toEqual(['confirm', 'exclude'])
    const oldExport = 'cultivation,kpi,date,field,rule,original_value,decision,corrected_value,decided_by,decided_at,note\r\nPA-P2-TOV,Temperature (24h),2025-07-01,target,unit-fahrenheit,69,correct,20.6,Dana,2025-09-01T10:00:00.000Z,\r\n'
    const parsed = parseDecisionsCsv(oldExport)
    expect(parsed.errors).toEqual([])
    expect(decisionOutcome(parsed.decisions)).toBe('Correction applied: 20.6 by Dana')
  })
})
