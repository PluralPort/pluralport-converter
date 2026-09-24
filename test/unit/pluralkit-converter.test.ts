import { describe, expect, it } from 'vitest'
import { octoconConverter, pluralkitConverter } from '../../app/lib/converters/pluralkit-to-pp'
import type { Converter, OPWarning, RunOptions } from '../../app/lib/converters/types'

/** Synthetic PK-shaped export. Members and groups are keyed by HID. */
function sample(overrides: Record<string, unknown> = {}) {
  return {
    version: 1,
    id: 'exmpl',
    uuid: 'sys-uuid',
    name: 'Test System',
    description: 'a system',
    tag: '| TS',
    pronouns: 'they/them',
    color: 'abcdef',
    avatar_url: 'https://cdn.pluralkit.me/sys.png',
    privacy: { visibility: 'public', description_privacy: 'public' },
    accounts: [123456789012345678],
    members: [
      {
        id: 'aaaaa', uuid: 'm-uuid-a', name: 'Alpha', display_name: 'Al',
        description: 'first', pronouns: 'she/her', color: '8b5cf6',
        birthday: '2020-01-02', avatar_url: 'https://cdn.pluralkit.me/a.png',
        created: '2026-01-01T00:00:00Z', keep_proxy: true,
        proxy_tags: [{ prefix: 'a:', suffix: null }, { prefix: null, suffix: '-a' }],
        privacy: { visibility: 'public' },
      },
      {
        id: 'bbbbb', name: 'Beta', proxy_tags: [],
        privacy: { visibility: 'private' },
      },
    ],
    groups: [
      { id: 'ggggg', name: 'Front Crew', description: 'the usual', color: '112233', members: ['aaaaa', 'bbbbb'] },
    ],
    // PK writes newest-first.
    switches: [
      { id: 's3', timestamp: '2026-03-03T00:00:00Z', members: [] },
      { id: 's2', timestamp: '2026-02-02T00:00:00Z', members: ['aaaaa', 'bbbbb'] },
      { id: 's1', timestamp: '2026-01-01T00:00:00Z', members: ['aaaaa'] },
    ],
    ...overrides,
  }
}

const ALL = ['members', 'groups', 'fronting', 'images']

async function run(conv: Converter, data: unknown, options: Partial<RunOptions> = {}) {
  const warnings: OPWarning[] = []
  const result = await conv.run(
    { fileText: JSON.stringify(data) },
    { selectedModules: ALL, ...options },
    { initTasks: () => {}, updateTask: () => {}, warning: (w) => { warnings.push(w) } },
  )
  return { envelope: JSON.parse(result.json), filename: result.filename, warnings }
}

const codes = (w: OPWarning[]) => w.map(x => x.code)

describe('PluralKit converter: envelope', () => {
  it('emits a spec-conformant v0.1 envelope', async () => {
    const { envelope } = await run(pluralkitConverter, sample())
    expect(envelope.pluralport_version).toBe('0.1')
    expect(envelope).not.toHaveProperty('openplural_version')
    expect(envelope).not.toHaveProperty('exporter')
    expect(envelope.producer).toMatchObject({
      app: 'PluralKit', app_id: 'pluralkit', exporter_version: '0.1.0',
    })
  })

  it('declares front_events as well as the derived periods', async () => {
    const { envelope } = await run(pluralkitConverter, sample())
    expect(envelope.capabilities.modules).toEqual(
      expect.arrayContaining(['systems', 'members', 'groups', 'front_events', 'front_periods']),
    )
  })
})

describe('PluralKit converter: members', () => {
  it('maps the profile and keeps proxy tags, which are core to a proxy bot', async () => {
    const { envelope } = await run(pluralkitConverter, sample())
    const alpha = envelope.members.find((m: { name: string }) => m.name === 'Alpha')
    expect(alpha).toMatchObject({
      display_name: 'Al', pronouns: 'she/her', description: 'first',
      color: '#8b5cf6', birthday: '2020-01-02',
    })
    expect(alpha.proxy_tags).toEqual([
      { prefix: 'a:', suffix: null },
      { prefix: null, suffix: '-a' },
    ])
  })

  it('drops proxy tags carrying neither prefix nor suffix', async () => {
    const data = sample()
    ;(data.members[0] as Record<string, unknown>).proxy_tags = [{ prefix: null, suffix: null }, { prefix: 'x:' }]
    const { envelope } = await run(pluralkitConverter, data)
    const alpha = envelope.members.find((m: { name: string }) => m.name === 'Alpha')
    expect(alpha.proxy_tags).toEqual([{ prefix: 'x:', suffix: null }])
  })

  it('preserves the whole privacy map rather than collapsing it away', async () => {
    const { envelope } = await run(pluralkitConverter, sample())
    expect(envelope.systems[0].privacy).toEqual({
      visibility: 'public',
      source: { visibility: 'public', description_privacy: 'public' },
    })
  })

  it.each([
    [{ visibility: 'public' }, 'public'],
    [{ visibility: 'private' }, 'private'],
    [{ name_privacy: 'public', description_privacy: 'public' }, 'public'],
    [{ name_privacy: 'public', description_privacy: 'private' }, 'private'],
    [undefined, 'private'],
    ['nonsense', 'private'],
  ])('rounds privacy %p to %s', async (privacy, expected) => {
    const data = sample()
    ;(data.members[0] as Record<string, unknown>).privacy = privacy
    const { envelope } = await run(pluralkitConverter, data)
    const alpha = envelope.members.find((m: { name: string }) => m.name === 'Alpha')
    expect(alpha.privacy.visibility).toBe(expected)
  })

  it('keeps the HID so a round-trip can find its way back', async () => {
    const { envelope } = await run(pluralkitConverter, sample())
    const alpha = envelope.members.find((m: { name: string }) => m.name === 'Alpha')
    expect(alpha.source_refs[0]).toEqual({ app: 'pluralkit', collection: 'members', id: 'aaaaa' })
    expect(alpha.extensions.pluralkit.hid).toBe('aaaaa')
  })
})

describe('PluralKit converter: groups', () => {
  it('resolves HID membership and records that groups do not nest', async () => {
    const { envelope } = await run(pluralkitConverter, sample())
    expect(envelope.groups).toHaveLength(1)
    expect(envelope.groups[0].parent_group_id).toBeNull()
    expect(envelope.group_memberships).toHaveLength(2)
  })

  it('reports membership pointing at a member not in the export', async () => {
    const { envelope, warnings } = await run(pluralkitConverter, sample({
      groups: [{ id: 'g', name: 'G', members: ['aaaaa', 'nope'] }],
    }))
    expect(envelope.group_memberships).toHaveLength(1)
    expect(codes(warnings)).toContain('pk_group_member_unresolved')
  })
})

describe('PluralKit converter: switches', () => {
  it('emits one front event per switch, oldest first', async () => {
    const { envelope } = await run(pluralkitConverter, sample())
    expect(envelope.front_events).toHaveLength(3)
    expect(envelope.front_events.map((e: { at: string }) => e.at)).toEqual([
      '2026-01-01T00:00:00.000Z',
      '2026-02-02T00:00:00.000Z',
      '2026-03-03T00:00:00.000Z',
    ])
  })

  it('records the members fronting after each switch', async () => {
    const { envelope } = await run(pluralkitConverter, sample())
    expect(envelope.front_events[0].assignments).toHaveLength(1)
    expect(envelope.front_events[1].assignments).toHaveLength(2)
    // PK's switch-out: an empty set is valid and means nobody is fronting.
    expect(envelope.front_events[2].assignments).toHaveLength(0)
    expect(envelope.front_events[0].assignments[0].front_role).toBe('member')
  })

  it('derives closed periods from consecutive switches', async () => {
    const { envelope } = await run(pluralkitConverter, sample())
    // s1 opens, s2 closes it and opens another, s3 is a switch-out that
    // closes without opening. So two periods, both ended.
    expect(envelope.front_periods).toHaveLength(2)
    expect(envelope.front_periods[0]).toMatchObject({
      started_at: '2026-01-01T00:00:00.000Z',
      ended_at: '2026-02-02T00:00:00.000Z',
      source_kind: 'event_pair',
    })
    expect(envelope.front_periods[1]).toMatchObject({
      started_at: '2026-02-02T00:00:00.000Z',
      ended_at: '2026-03-03T00:00:00.000Z',
    })
  })

  it('leaves the final period open when the log ends with someone fronting', async () => {
    const { envelope } = await run(pluralkitConverter, sample({
      switches: [{ id: 's1', timestamp: '2026-01-01T00:00:00Z', members: ['aaaaa'] }],
    }))
    expect(envelope.front_periods).toHaveLength(1)
    expect(envelope.front_periods[0].ended_at).toBeNull()
  })

  it('sorts by timestamp rather than trusting file order', async () => {
    const { envelope } = await run(pluralkitConverter, sample({
      switches: [
        { id: 'b', timestamp: '2026-01-01T00:00:00Z', members: ['aaaaa'] },
        { id: 'c', timestamp: '2026-03-03T00:00:00Z', members: ['bbbbb'] },
        { id: 'a', timestamp: '2026-02-02T00:00:00Z', members: ['aaaaa'] },
      ],
    }))
    expect(envelope.front_events.map((e: { at: string }) => e.at)).toEqual([
      '2026-01-01T00:00:00.000Z',
      '2026-02-02T00:00:00.000Z',
      '2026-03-03T00:00:00.000Z',
    ])
  })

  it('skips an unreadable timestamp and keeps a switch whose member is missing', async () => {
    const { envelope, warnings } = await run(pluralkitConverter, sample({
      switches: [
        { id: 'bad', timestamp: 'nonsense', members: ['aaaaa'] },
        { id: 'ok', timestamp: '2026-01-01T00:00:00Z', members: ['aaaaa', 'ghost'] },
      ],
    }))
    expect(codes(warnings)).toContain('pk_switch_bad_timestamp')
    expect(codes(warnings)).toContain('pk_switch_member_unresolved')
    expect(envelope.front_events).toHaveLength(1)
    expect(envelope.front_events[0].assignments).toHaveLength(1)
  })
})

describe('PluralKit converter: assets', () => {
  it('records CDN images as uri-only and says the file is not self-contained', async () => {
    const { envelope, warnings } = await run(pluralkitConverter, sample())
    expect(envelope.assets.length).toBeGreaterThan(0)
    expect(envelope.assets[0]).toMatchObject({ data_uri: null })
    expect(codes(warnings)).toContain('asset_uri_only')
  })

  it('skips images entirely when the module is deselected', async () => {
    const { envelope } = await run(pluralkitConverter, sample(), { selectedModules: ['members'] })
    expect(envelope.assets).toHaveLength(0)
    expect(envelope.members[0].avatar_asset_id).toBeNull()
  })
})

describe('Octocon shares the mapping but keeps its own identity', () => {
  it('labels the file as Octocon, since the HIDs are Octocon\'s', async () => {
    const { envelope } = await run(octoconConverter, sample())
    expect(envelope.producer).toMatchObject({ app: 'Octocon', app_id: 'octocon' })
    expect(envelope.members[0].source_refs[0].app).toBe('octocon')
    expect(envelope.members[0].extensions).toHaveProperty('octocon')
  })

  it('produces the same records as PluralKit for the same file', async () => {
    const pk = await run(pluralkitConverter, sample())
    const oc = await run(octoconConverter, sample())
    expect(oc.envelope.members).toHaveLength(pk.envelope.members.length)
    expect(oc.envelope.front_events).toHaveLength(pk.envelope.front_events.length)
    expect(oc.envelope.front_periods).toHaveLength(pk.envelope.front_periods.length)
  })

  it('registers both sources against the v0.1 destination', () => {
    expect(pluralkitConverter.sourceId).toBe('pluralkit')
    expect(octoconConverter.sourceId).toBe('octocon')
    for (const c of [pluralkitConverter, octoconConverter]) {
      expect(c.destinationId).toBe('pluralport_v0.1')
      expect(c.modules).toEqual(ALL)
    }
  })
})

describe('PluralKit converter: file validation', () => {
  it('rejects invalid JSON', () => {
    expect(() => pluralkitConverter.inspect!('{not json')).toThrow(/valid JSON/i)
  })

  it('tells the visitor how to export when the file is not PK-shaped', () => {
    expect(() => pluralkitConverter.inspect!('{"hello":"world"}')).toThrow(/pk;export/i)
  })

  it('inspects a file for a label and per-module counts', () => {
    const { label, counts } = pluralkitConverter.inspect!(JSON.stringify(sample()))
    expect(label).toBe('Test System')
    expect(counts).toMatchObject({ members: 2, groups: 1, fronting: 3, proxy_tags: 1 })
  })
})
