import { describe, expect, it } from 'vitest'
import { countAmpersand, parseAmpersand, systemLabel } from '../../app/lib/ampersand-client'

/**
 * Cover for the validation messages the visitor actually sees when they pick
 * the wrong file. Ampersand ships two export formats and only the JSON one
 * is readable here, so a clear rejection matters.
 *
 * The converter's record mapping is not covered yet; see the roadmap.
 */
const minimal = {
  revision: { humanReadable: '1.2.3' },
  database: {
    systems: [{ uuid: 's-1', name: 'Test System' }],
    members: [{ uuid: 'm-1', name: 'Alpha', system: 's-1' }],
  },
}

describe('parseAmpersand', () => {
  it('rejects invalid JSON', () => {
    expect(() => parseAmpersand('{not json')).toThrow(/valid JSON/i)
  })

  it('rejects a document with no database section, and says where to export from', () => {
    expect(() => parseAmpersand('{"revision":{}}')).toThrow(/database/i)
    expect(() => parseAmpersand('{"revision":{}}')).toThrow(/Import & export/i)
  })

  it('rejects a database with nothing to convert', () => {
    expect(() => parseAmpersand(JSON.stringify({ database: {} })))
      .toThrow(/no members or systems/i)
  })

  it('accepts a minimal valid export', () => {
    expect(parseAmpersand(JSON.stringify(minimal)).database.members).toHaveLength(1)
  })
})

describe('systemLabel and countAmpersand', () => {
  it('names the system and counts what is there', () => {
    const data = parseAmpersand(JSON.stringify(minimal))
    expect(systemLabel(data)).toContain('Test System')
    expect(countAmpersand(data).members).toBe(1)
  })
})
