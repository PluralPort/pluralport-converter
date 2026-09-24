import { describe, expect, it } from 'vitest'
import {
  btColor,
  btTime,
  countBerrytree,
  exportErrors,
  mainContext,
  memberFolderIds,
  memberTagNames,
  parseBerrytree,
  splitCustomStatuses,
  systemLabel,
  unsupportedSections,
  type BtExport,
} from '../../app/lib/berrytree-client'

describe('btColor', () => {
  it('passes through 6-hex, lowercased', () => {
    expect(btColor('#8B5CF6')).toBe('#8b5cf6')
  })
  it('accepts 6-hex without the hash', () => {
    expect(btColor('8b5cf6')).toBe('#8b5cf6')
  })
  it('expands 3-hex shorthand', () => {
    expect(btColor('#abc')).toBe('#aabbcc')
  })
  it('drops the alpha byte from 8-hex ARGB', () => {
    expect(btColor('#FF8B5CF6')).toBe('#8b5cf6')
  })
  it.each([null, undefined, 42, '', 'not a colour', '#12345'])('rejects %p', (v) => {
    expect(btColor(v)).toBeNull()
  })
})

describe('btTime', () => {
  it('normalises to ISO 8601 UTC', () => {
    expect(btTime('2026-09-16T16:16:57.762230+00:00')).toBe('2026-09-16T16:16:57.762Z')
  })
  it.each([null, undefined, '', 'not a timestamp', 123])('rejects %p', (v) => {
    expect(btTime(v)).toBeNull()
  })
})

describe('splitCustomStatuses', () => {
  // The trap this guards: one array holds two different kinds of thing, and
  // treating them as one list produces a roster full of things that are not
  // members.
  it('separates fronting types from custom fronts', () => {
    const data = {
      custom_statuses: [
        { id: '1', kind: 'type', name: 'Co-conscious' },
        { id: '2', kind: 'status', name: 'Asleep' },
      ],
    } as BtExport
    const [types, fronts] = splitCustomStatuses(data)
    expect(types.map(t => t.name)).toEqual(['Co-conscious'])
    expect(fronts.map(f => f.name)).toEqual(['Asleep'])
  })

  it('treats an unrecognised kind as a custom front so it stays visible', () => {
    const data = { custom_statuses: [{ id: '1', kind: 'sideways', name: 'Odd' }] } as BtExport
    const [types, fronts] = splitCustomStatuses(data)
    expect(types).toHaveLength(0)
    expect(fronts.map(f => f.name)).toEqual(['Odd'])
  })

  it('handles a missing section', () => {
    expect(splitCustomStatuses({} as BtExport)).toEqual([[], []])
  })
})

describe('memberTagNames', () => {
  // Every sample has an empty tags array, so both plausible shapes are
  // accepted rather than guessed between.
  it('reads plain string tags', () => {
    expect(memberTagNames({ tags: ['alpha', 'beta'] })).toEqual(['alpha', 'beta'])
  })
  it('reads objects carrying a name under any known key', () => {
    expect(memberTagNames({ tags: [{ name: 'a' }, { label: 'b' }, { title: 'c' }, { key: 'd' }] }))
      .toEqual(['a', 'b', 'c', 'd'])
  })
  it('skips entries that yield no name', () => {
    expect(memberTagNames({ tags: [{ nope: 'x' }, '', '  ', 7] })).toEqual([])
  })
  it('handles a non-array', () => {
    expect(memberTagNames({ tags: 'nope' })).toEqual([])
  })
})

describe('memberFolderIds', () => {
  it('reads the plural key', () => {
    expect(memberFolderIds({ folder_ids: ['a', 'b'] })).toEqual(['a', 'b'])
  })
  it('reads the older singular key', () => {
    expect(memberFolderIds({ folder_id: 'a' })).toEqual(['a'])
  })
  it('merges both without duplicating', () => {
    expect(memberFolderIds({ folder_ids: ['a'], folder_id: 'a' })).toEqual(['a'])
    expect(memberFolderIds({ folder_ids: ['a'], folder_id: 'b' })).toEqual(['a', 'b'])
  })
})

describe('mainContext and systemLabel', () => {
  // The name the app edits is the account `system_name`; the main context's
  // name is a signup default, used when the account name is empty.
  it('prefers the context whose kind is main', () => {
    const data = {
      system_contexts: [
        { id: '1', kind: 'alt', name: 'Alt' },
        { id: '2', kind: 'main', name: 'Real' },
      ],
    } as BtExport
    expect(mainContext(data).name).toBe('Real')
    expect(systemLabel(data)).toBe('Real')
  })

  it('prefers the account system_name the app edits over the context name', () => {
    const data = {
      system: { system_name: 'Edited', username: 'UN' },
      system_contexts: [{ id: '1', kind: 'main', name: 'Signup Default' }],
    } as BtExport
    expect(systemLabel(data)).toBe('Edited')
  })

  it('falls back to the first context, then system_name, then username', () => {
    expect(systemLabel({ system_contexts: [{ id: '1', name: 'First' }] } as BtExport)).toBe('First')
    expect(systemLabel({ system: { system_name: 'SN', username: 'UN' } } as BtExport)).toBe('SN')
    expect(systemLabel({ system: { username: 'UN' } } as BtExport)).toBe('UN')
    expect(systemLabel({} as BtExport)).toBe('BerryTree system')
  })
})

describe('unsupportedSections', () => {
  it('reports only non-empty sections, with counts', () => {
    const data = { journal: [{}, {}], notes: [], polls: [{}] } as unknown as BtExport
    expect(unsupportedSections(data)).toEqual([
      { name: 'journal entries', count: 2 },
      { name: 'polls', count: 1 },
    ])
  })

  it('ignores the default context and layer, reporting only extras', () => {
    const one = { system_contexts: [{}], layers: [{}] } as unknown as BtExport
    expect(unsupportedSections(one)).toEqual([])

    const many = { system_contexts: [{}, {}], layers: [{}, {}, {}] } as unknown as BtExport
    expect(unsupportedSections(many)).toEqual([
      { name: 'extra system contexts', count: 1 },
      { name: 'layers', count: 2 },
    ])
  })
})

describe('exportErrors', () => {
  it('caps the number of entries and the length of each', () => {
    const data = { _partial_errors: Array.from({ length: 50 }, () => 'x'.repeat(500)) } as BtExport
    const out = exportErrors(data)
    expect(out).toHaveLength(20)
    expect(out[0]).toHaveLength(200)
  })
  it('handles a missing or malformed log', () => {
    expect(exportErrors({} as BtExport)).toEqual([])
    expect(exportErrors({ _partial_errors: 'nope' } as BtExport)).toEqual([])
  })
})

describe('parseBerrytree', () => {
  it('rejects invalid JSON with a message aimed at the visitor', () => {
    expect(() => parseBerrytree('{not json')).toThrow(/valid JSON/i)
  })
  it('rejects a non-object top level', () => {
    expect(() => parseBerrytree('[1,2,3]')).toThrow(/not a BerryTree export/i)
  })
  it('rejects JSON with no recognisable section', () => {
    expect(() => parseBerrytree('{"hello":"world"}')).toThrow(/does not look like a BerryTree export/i)
  })
  it('accepts a document carrying a known section', () => {
    expect(parseBerrytree('{"schema_version":3}').schema_version).toBe(3)
  })
})

describe('countBerrytree', () => {
  it('excludes templates and counts non-headcount members as custom fronts', () => {
    const data = {
      members: [
        { id: 'a', name: 'A', counts_toward_headcount: true },
        { id: 'b', name: 'B', counts_toward_headcount: false },
        { id: 't', name: 'T', is_template: true },
      ],
      custom_statuses: [
        { id: 's', kind: 'status', name: 'Asleep' },
        { id: 'ty', kind: 'type', name: 'Blurry' },
      ],
      front_entries: [{}, {}],
      folders: [{}],
    } as unknown as BtExport

    expect(countBerrytree(data)).toEqual({
      members: 1,
      custom_fronts: 2, // one status row plus one non-headcount member
      fronting: 2,
      groups: 1,
      tags: 0,
      custom_fields: 0,
      images: 0,
    })
  })
})
