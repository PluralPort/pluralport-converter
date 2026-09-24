import { describe, expect, it } from 'vitest'
import { converter, runBerrytreeToPp } from '../../app/lib/converters/berrytree-to-pp'
import type { OPWarning, RunOptions, TaskState } from '../../app/lib/converters/types'

/**
 * Synthetic fixture, written here rather than taken from the contributed
 * export. The real sample is a user's own data and stays out of the repo.
 */
function sample(overrides: Record<string, unknown> = {}) {
  return {
    app: 'berrytree',
    schema_version: 3,
    exported_at: '2026-09-16T16:18:28Z',
    system: { username: 'account-name', system_name: 'Test System' },
    system_contexts: [
      {
        id: 'ctx-main', kind: 'main', name: 'Signup Default', description: 'A system',
        color: '#818CF8', tag: 'TS', pronouns: 'they/them', emoji: '*',
        is_private: false, custom_fields: [],
      },
    ],
    layers: [{ id: 'layer-1', name: 'Default', member_ids: ['m-1', 'm-2'], custom_fields: [] }],
    members: [
      {
        id: 'm-1', name: 'Alpha', display_name: 'Al', pronouns: 'she/her',
        description: 'first', color: '#abc', emoji: 'A', avatar: '', banner: '',
        is_private: false, is_template: false, archived: false,
        counts_toward_headcount: true, role: 'driver', mood: 'calm',
        tags: ['alpha-tag'], custom_fields: [{ name: 'Favourite', value: 'green' }],
        folder_ids: ['f-1'], created_at: '2026-09-16T16:16:57.762230+00:00',
      },
      {
        id: 'm-2', name: 'Beta', counts_toward_headcount: false, folder_id: 'f-2',
        is_private: true, tags: [], custom_fields: [],
      },
      { id: 'm-t', name: 'Template', is_template: true, tags: [], custom_fields: [] },
    ],
    custom_statuses: [
      { id: 'ty-1', kind: 'type', name: 'Co-conscious', color: '#8b5cf6' },
      { id: 'st-1', kind: 'status', name: 'Asleep', color: '#94A3B8' },
    ],
    front_entries: [
      { id: 'fe-1', member_id: 'm-1', fronting_type_id: 'ty-1', note: 'at the dentist',
        started_at: '2026-09-16T16:18:11Z', ended_at: '2026-09-16T16:18:22Z' },
      { id: 'fe-2', member_id: null, custom_status_id: 'st-1',
        started_at: '2026-09-16T16:17:56Z', ended_at: null },
    ],
    folders: [
      { id: 'f-1', name: 'Folder One' },
      { id: 'f-2', name: 'Folder Two', parent_id: 'f-1' },
    ],
    journal: [], notes: [], chat: [], polls: [], _partial_errors: [],
    ...overrides,
  }
}

const ALL_MODULES = ['members', 'custom_fronts', 'groups', 'tags', 'custom_fields', 'fronting', 'images']

async function run(data: unknown, options: Partial<RunOptions> = {}) {
  const warnings: OPWarning[] = []
  const tasks: TaskState[] = []
  const result = await runBerrytreeToPp(
    { fileText: JSON.stringify(data) },
    { selectedModules: ALL_MODULES, ...options },
    {
      initTasks: (t) => { tasks.push(...t) },
      updateTask: () => {},
      warning: (w) => { warnings.push(w) },
    },
  )
  return { envelope: JSON.parse(result.json), filename: result.filename, warnings, tasks }
}

const codes = (warnings: OPWarning[]) => warnings.map(w => w.code)

describe('BerryTree converter: envelope', () => {
  it('emits a spec-conformant v0.1 envelope', async () => {
    const { envelope } = await run(sample())
    expect(envelope.pluralport_version).toBe('0.1')
    // The deprecated key must not be emitted by a producer, and the
    // non-spec top-level exporter block must stay gone.
    expect(envelope).not.toHaveProperty('openplural_version')
    expect(envelope).not.toHaveProperty('exporter')
    expect(envelope.producer).toMatchObject({
      app: 'BerryTree', app_id: 'berrytree', exporter_version: '0.1.0',
    })
    expect(envelope.extensions.pluralport_converter.name).toBe('PluralPort Converter')
  })

  it('names the file after the system and the spec version', async () => {
    const { filename } = await run(sample())
    expect(filename).toMatch(/^pluralport-v0\.1-test-system-\d{4}-\d{2}-\d{2}\.json$/)
  })

  it('declares only the modules it actually populated', async () => {
    const { envelope } = await run(sample())
    expect(envelope.capabilities.modules).toEqual(
      expect.arrayContaining(['systems', 'members', 'groups', 'taxonomy', 'custom_fields', 'front_periods']),
    )
    expect(envelope.capabilities.modules).not.toContain('assets')
  })
})

describe('BerryTree converter: system profile', () => {
  it('reads the profile from the main context when account settings are empty', async () => {
    const { envelope } = await run(sample())
    const sys = envelope.systems[0]
    expect(sys.description).toBe('A system')
    expect(sys.tag).toBe('TS')
    expect(sys.color).toBe('#818cf8')
    expect(sys.extensions.berrytree).toEqual({ pronouns: 'they/them', emoji: '*' })
  })

  it('prefers the account settings the app edits over the main context', async () => {
    // The 1.0.16 client writes the profile to user settings and never
    // touches system_contexts, so an edit made in the app lives there.
    const { envelope } = await run(sample({
      user_settings: {
        system_description: 'edited in the app',
        system_avatar: 'https://pub-abc123.r2.dev/sys.png',
        system_banner: 'https://pub-abc123.r2.dev/banner.png',
      },
    }))
    const sys = envelope.systems[0]
    expect(sys.description).toBe('edited in the app')
    const byId = new Map(envelope.assets.map((a: { id: string; uri: string }) => [a.id, a.uri]))
    expect(byId.get(sys.avatar_asset_id)).toBe('https://pub-abc123.r2.dev/sys.png')
    expect(byId.get(sys.banner_asset_id)).toBe('https://pub-abc123.r2.dev/banner.png')

    const blank = await run(sample({ user_settings: { system_description: '  ' } }))
    expect(blank.envelope.systems[0].description).toBe('A system')
  })

  it('takes the name the app edits, then the context name, then the username', async () => {
    expect((await run(sample())).envelope.systems[0].name).toBe('Test System')
    const noAccountName = await run(sample({ system: { username: 'account-name', system_name: '' } }))
    expect(noAccountName.envelope.systems[0].name).toBe('Signup Default')
  })

  it('preserves the profile tags and status line without quoting them in warnings', async () => {
    // Taxonomy assignments cannot target a system, and System has no status
    // field, so these ride in the namespace alongside pronouns and emoji.
    const { envelope, warnings } = await run(sample({
      user_settings: { system_tags: ['secret tag', 'Secret Tag', ''], system_status: 'secret status' },
    }))
    expect(envelope.systems[0].extensions.berrytree).toMatchObject({
      tags: ['secret tag'],
      status: 'secret status',
    })
    expect(JSON.stringify(warnings)).not.toContain('secret')
  })

  it('maps system-level custom fields with the system as their subject', async () => {
    const { envelope } = await run(sample({
      user_settings: { system_custom_fields: [{ label: 'Founded', value: '2019' }, { label: '', value: 'x' }] },
    }))
    const value = envelope.custom_field_values.find(
      (v: { subject_type?: string }) => v.subject_type === 'system',
    )
    expect(value).toMatchObject({ subject_id: envelope.systems[0].id, value: '2019' })
    const field = envelope.custom_fields.find((f: { id: string }) => f.id === value.field_id)
    expect(field.name).toBe('Founded')
  })

  it('honours the context privacy flag rather than assuming private', async () => {
    const pub = await run(sample())
    expect(pub.envelope.systems[0].privacy.visibility).toBe('public')

    const priv = await run(sample({
      system_contexts: [{ id: 'c', kind: 'main', name: 'X', is_private: true }],
    }))
    expect(priv.envelope.systems[0].privacy.visibility).toBe('private')
  })

  it('fails closed to private when the flag is missing or malformed', async () => {
    const { envelope } = await run(sample({
      system_contexts: [{ id: 'c', kind: 'main', name: 'X' }],
    }))
    expect(envelope.systems[0].privacy.visibility).toBe('private')
  })

  it('never carries the account email out of the export', async () => {
    const { envelope } = await run(sample({
      system: { username: 'acct', email: 'someone@example.invalid' },
    }))
    expect(JSON.stringify(envelope)).not.toContain('someone@example.invalid')
  })
})

describe('BerryTree converter: roster', () => {
  it('keeps fronting types out of the roster and preserves them', async () => {
    const { envelope } = await run(sample())
    const names = envelope.members.map((m: { name: string }) => m.name)
    expect(names).not.toContain('Co-conscious')
    expect(envelope.extensions.berrytree.fronting_types).toEqual(['Co-conscious'])
  })

  it('converts status rows and non-headcount members as custom fronts', async () => {
    const { envelope } = await run(sample())
    const fronts = envelope.members.filter((m: { is_custom_front: boolean }) => m.is_custom_front)
    expect(fronts.map((m: { name: string }) => m.name).sort()).toEqual(['Asleep', 'Beta'])
  })

  it('holds back template members and says so', async () => {
    const { envelope, warnings } = await run(sample())
    expect(envelope.members.map((m: { name: string }) => m.name)).not.toContain('Template')
    expect(codes(warnings)).toContain('bt_templates_skipped')
    expect(envelope.extensions.berrytree.template_members_held_back).toBe(1)
  })

  it('maps member fields and honours per-member privacy', async () => {
    const { envelope } = await run(sample())
    const alpha = envelope.members.find((m: { name: string }) => m.name === 'Alpha')
    expect(alpha).toMatchObject({
      display_name: 'Al', pronouns: 'she/her', description: 'first',
      color: '#aabbcc', is_custom_front: false, archived: false,
    })
    expect(alpha.privacy.visibility).toBe('public')
    expect(alpha.created_at).toBe('2026-09-16T16:16:57.762Z')
    expect(alpha.source_refs[0]).toEqual({ app: 'berrytree', collection: 'members', id: 'm-1' })
  })
})

describe('BerryTree converter: folders, tags and fields', () => {
  it('preserves folder nesting and membership from both keys', async () => {
    const { envelope } = await run(sample())
    const byName = Object.fromEntries(
      envelope.groups.map((g: { name: string; id: string; parent_group_id: string | null }) => [g.name, g]),
    )
    expect(byName['Folder Two'].parent_group_id).toBe(byName['Folder One'].id)
    expect(byName['Folder One'].parent_group_id).toBeNull()
    expect(envelope.group_memberships).toHaveLength(2)
  })

  it('warns rather than inventing a parent when the reference dangles', async () => {
    const { envelope, warnings } = await run(sample({
      folders: [{ id: 'f-1', name: 'Orphan', parent_id: 'missing' }],
    }))
    expect(envelope.groups[0].parent_group_id).toBeNull()
    expect(codes(warnings)).toContain('dangling_parent_ref')
  })

  it('maps tags to taxonomy terms, deduplicated', async () => {
    const { envelope } = await run(sample())
    expect(envelope.taxonomy_terms.map((t: { name: string }) => t.name)).toEqual(['alpha-tag'])
    expect(envelope.taxonomy_assignments).toHaveLength(1)
    // Spec field names, matching the Ampersand converter.
    const alpha = envelope.members.find((m: { name: string }) => m.name === 'Alpha')
    expect(envelope.taxonomy_assignments[0]).toMatchObject({ subject_type: 'member', subject_id: alpha.id })
    expect(envelope.taxonomy_assignments[0]).not.toHaveProperty('record_type')
  })

  it('gives role and mood a home as custom fields', async () => {
    const { envelope } = await run(sample())
    const fields = envelope.custom_fields.map((f: { name: string }) => f.name).sort()
    expect(fields).toEqual(['Favourite', 'Mood', 'Role'])
  })

  it('writes custom fields in the spec shape', async () => {
    const { envelope } = await run(sample())
    for (const field of envelope.custom_fields) {
      expect(field.field_type).toBe('text')
      expect(field).not.toHaveProperty('type')
    }
    const alpha = envelope.members.find((m: { name: string }) => m.name === 'Alpha')
    for (const value of envelope.custom_field_values) {
      expect(value).toMatchObject({ subject_type: 'member', subject_id: alpha.id })
      expect(value).not.toHaveProperty('member_id')
    }
  })

  it('counts unreadable custom field entries instead of guessing', async () => {
    const data = sample()
    ;(data.members[0] as Record<string, unknown>).custom_fields = [{ nope: 'x' }]
    const { warnings } = await run(data)
    expect(codes(warnings)).toContain('bt_custom_field_unreadable')
  })
})

describe('BerryTree converter: fronting', () => {
  it('resolves entries through member_id and custom_status_id alike', async () => {
    const { envelope } = await run(sample())
    expect(envelope.front_periods).toHaveLength(2)
  })

  it('emits the spec FrontPeriod shape, not a flat member_id', async () => {
    const { envelope } = await run(sample())
    const period = envelope.front_periods[0]
    expect(period).not.toHaveProperty('member_id')
    expect(period).not.toHaveProperty('comment')
    expect(period.source_kind).toBe('interval')
    expect(period.assignments).toHaveLength(1)
    expect(period.assignments[0]).toMatchObject({ front_role: expect.any(String) })
    expect(period.assignments[0].member_id).toEqual(expect.any(String))
  })

  it('maps the fronting type to a front_role and keeps the note per assignment', async () => {
    const { envelope } = await run(sample())
    const period = envelope.front_periods.find(
      (f: { assignments: { note: string | null }[] }) => f.assignments[0].note,
    )
    expect(period.assignments[0].front_role).toBe('co_conscious')
    expect(period.assignments[0].note).toBe('at the dentist')
    expect(period.assignments[0].extensions.berrytree.fronting_type).toBe('Co-conscious')
  })

  it.each([
    ['Fronting', 'primary'],
    ['Co-fronting', 'co_front'],
    ['Co-conscious', 'co_conscious'],
    ['Influencing', 'influencing'],
    // The vocabulary is user-editable, so anything unrecognised must not be
    // guessed into a neighbouring tier.
    ['Blurry', 'unknown'],
    ['Something A User Invented', 'unknown'],
  ])('maps fronting type %s to front_role %s', async (typeName, role) => {
    const { envelope } = await run(sample({
      custom_statuses: [{ id: 'ty-1', kind: 'type', name: typeName }],
      front_entries: [{ id: 'fe', member_id: 'm-1', fronting_type_id: 'ty-1', started_at: '2026-09-16T16:18:11Z' }],
    }))
    expect(envelope.front_periods[0].assignments[0].front_role).toBe(role)
    expect(envelope.front_periods[0].assignments[0].extensions.berrytree.fronting_type).toBe(typeName)
  })

  it('keeps a legacy fronting type given as custom_status_id', async () => {
    // Older BerryTree versions had no fronting_type_id: a typed front was
    // the member plus a custom_status_id naming a kind "type" row. The type
    // must map exactly as the current shape does, and must not be taken for
    // who was fronting.
    const { envelope, warnings } = await run(sample({
      front_entries: [{ id: 'fe', member_id: 'm-1', custom_status_id: 'ty-1', note: 'legacy',
        started_at: '2026-09-16T16:18:11Z' }],
    }))
    expect(envelope.front_periods).toHaveLength(1)
    const assignment = envelope.front_periods[0].assignments[0]
    const alpha = envelope.members.find((m: { name: string }) => m.name === 'Alpha')
    expect(assignment.member_id).toBe(alpha.id)
    expect(assignment.front_role).toBe('co_conscious')
    expect(assignment.extensions.berrytree.fronting_type).toBe('Co-conscious')
    expect(codes(warnings)).not.toContain('bt_front_unresolved_ref')
  })

  it('reports a type-only legacy entry for what it is', async () => {
    // The legacy shape can also carry a type with no member at all. There is
    // nobody to attach it to, and the report must say so rather than blame a
    // member missing from the export.
    const { envelope, warnings } = await run(sample({
      front_entries: [{ id: 'fe', member_id: null, custom_status_id: 'ty-1',
        started_at: '2026-09-16T16:18:11Z' }],
    }))
    expect(envelope.front_periods).toHaveLength(0)
    expect(codes(warnings)).toContain('bt_front_type_only')
    expect(codes(warnings)).not.toContain('bt_front_unresolved_ref')
    expect(codes(warnings)).not.toContain('bt_front_no_ref')
  })

  it('uses the custom_status role for a standalone fronting entity', async () => {
    const { envelope } = await run(sample())
    const viaStatus = envelope.front_periods.find(
      (f: { assignments: { front_role: string }[] }) => f.assignments[0].front_role === 'custom_status',
    )
    expect(viaStatus).toBeDefined()
  })

  it('defaults to the member role when no fronting type is named', async () => {
    const { envelope } = await run(sample({
      custom_statuses: [],
      front_entries: [{ id: 'fe', member_id: 'm-1', started_at: '2026-09-16T16:18:11Z' }],
    }))
    expect(envelope.front_periods[0].assignments[0].front_role).toBe('member')
  })

  it('carries BerryTree status text as the period status', async () => {
    const { envelope } = await run(sample({
      front_entries: [{ id: 'fe', member_id: 'm-1', custom_status: 'at work', started_at: '2026-09-16T16:18:11Z' }],
    }))
    expect(envelope.front_periods[0].status).toBe('at work')
  })

  it.each([
    ['bt_front_no_ref', { id: 'x', started_at: '2026-09-16T16:18:11Z' }],
    ['bt_front_unresolved_ref', { id: 'x', member_id: 'nope', started_at: '2026-09-16T16:18:11Z' }],
    ['bt_front_bad_timestamp', { id: 'x', member_id: 'm-1', started_at: 'nonsense' }],
  ])('skips and reports %s', async (code, entry) => {
    const { envelope, warnings } = await run(sample({ front_entries: [entry] }))
    expect(envelope.front_periods).toHaveLength(0)
    expect(codes(warnings)).toContain(code)
  })

  it('reverses an interval that ends before it starts rather than dropping it', async () => {
    const { envelope, warnings } = await run(sample({
      front_entries: [{ id: 'x', member_id: 'm-1', started_at: '2026-09-16T18:00:00Z', ended_at: '2026-09-16T17:00:00Z' }],
    }))
    expect(codes(warnings)).toContain('bt_front_interval_swapped')
    expect(envelope.front_periods[0].started_at).toBe('2026-09-16T17:00:00.000Z')
    expect(envelope.front_periods[0].ended_at).toBe('2026-09-16T18:00:00.000Z')
  })
})

describe('BerryTree converter: reporting what it did not map', () => {
  // The governing rule: anything we have not seen a real example of is
  // counted and reported, never guessed at.
  it('stays quiet when every unsupported section is empty', async () => {
    const { warnings } = await run(sample({ members: [], custom_statuses: [], front_entries: [], folders: [] }))
    expect(codes(warnings)).not.toContain('bt_sections_not_converted')
  })

  it('names each populated section it left behind, with counts', async () => {
    const { envelope, warnings } = await run(sample({
      journal: Array.from({ length: 400 }, () => ({})),
      polls: [{}, {}],
    }))
    const w = warnings.find(x => x.code === 'bt_sections_not_converted')!
    expect(w.message).toContain('400 journal entries')
    expect(w.message).toContain('2 polls')
    expect(w.count).toBe(402)
    expect(envelope.extensions.berrytree.sections_not_converted).toEqual([
      { name: 'journal entries', count: 400 },
      { name: 'polls', count: 2 },
    ])
  })

  it('surfaces the exporter own failure log as an error', async () => {
    const { warnings } = await run(sample({ _partial_errors: ['could not write journal entry 41'] }))
    const w = warnings.find(x => x.code === 'bt_partial_export')!
    expect(w.level).toBe('error')
    expect(w.message).toContain('could not write journal entry 41')
  })

  it.each([
    [{ schema_version: undefined }, 'bt_schema_version_missing'],
    [{ schema_version: 4 }, 'bt_schema_version_unknown'],
  ])('flags provenance: %o', async (patch, code) => {
    const { warnings } = await run(sample(patch))
    expect(codes(warnings)).toContain(code)
  })

  it('counts custom fields hung off a context or layer', async () => {
    const { warnings } = await run(sample({
      system_contexts: [{ id: 'c', kind: 'main', name: 'X', custom_fields: [{ name: 'a', value: 'b' }] }],
    }))
    expect(codes(warnings)).toContain('bt_context_custom_fields')
  })
})

describe('BerryTree converter: assets', () => {
  it('records an absolute avatar URL and flags it as not self-contained', async () => {
    const data = sample()
    ;(data.members[0] as Record<string, unknown>).avatar = 'https://example.invalid/a.png'
    const { envelope, warnings } = await run(data)
    expect(envelope.assets).toHaveLength(1)
    expect(envelope.assets[0]).toMatchObject({ uri: 'https://example.invalid/a.png', data_uri: null })
    // Required by the spec whenever an asset carries only a uri.
    expect(codes(warnings)).toContain('asset_uri_only')
  })

  it('embeds a data URI image as a self-contained asset', async () => {
    // BerryTree's editor stores images inline, so these carry the picture
    // itself and survive the server being gone.
    const uri = 'data:image/png;base64,iVBORw0KGgo='
    const data = sample()
    ;(data.members[0] as Record<string, unknown>).avatar = uri
    const { envelope, warnings } = await run(data)
    expect(envelope.assets).toHaveLength(1)
    expect(envelope.assets[0]).toMatchObject({ data_uri: uri, uri: null, mime_type: 'image/png' })
    const alpha = envelope.members.find((m: { name: string }) => m.name === 'Alpha')
    expect(alpha.avatar_asset_id).toBe(envelope.assets[0].id)
    expect(codes(warnings)).not.toContain('asset_uri_only')
    expect(envelope.capabilities.modules).toContain('assets')
  })

  it('drops an unreadable data URI and counts it', async () => {
    const data = sample()
    ;(data.members[0] as Record<string, unknown>).banner = 'data:image/png;base64,!!!not base64!!!'
    const { envelope, warnings } = await run(data)
    expect(envelope.assets).toHaveLength(0)
    expect(warnings.find(w => w.code === 'bt_avatar_unresolvable')?.count).toBe(1)
  })

  it('leaves embedded images out when Images is not selected, and says so', async () => {
    const data = sample({ user_settings: { system_avatar: 'data:image/png;base64,iVBORw0KGgo=' } })
    ;(data.members[0] as Record<string, unknown>).avatar = 'data:image/png;base64,iVBORw0KGgo='
    ;(data.members[0] as Record<string, unknown>).banner = 'https://pub-abc123.r2.dev/b.png'
    const { envelope, warnings } = await run(data, {
      selectedModules: ALL_MODULES.filter(m => m !== 'images'),
    })
    // Linked images are only a URL either way, so they stay.
    expect(envelope.assets).toHaveLength(1)
    expect(envelope.assets[0]).toMatchObject({ uri: 'https://pub-abc123.r2.dev/b.png' })
    expect(envelope.systems[0].avatar_asset_id).toBeNull()
    expect(warnings.find(w => w.code === 'bt_images_not_selected')?.count).toBe(2)
    expect(codes(warnings)).not.toContain('bt_avatar_unresolvable')
  })

  it('keeps a bucket URL as a link and never downloads it', async () => {
    const url = 'https://pub-abc123.r2.dev/avatars/a.png'
    const data = sample()
    ;(data.members[0] as Record<string, unknown>).avatar = url
    const { envelope, warnings } = await run(data)
    expect(envelope.assets[0]).toMatchObject({ uri: url, data_uri: null })
    expect(codes(warnings)).toContain('asset_uri_only')
  })

  it('drops a non-URL avatar reference rather than writing a dangling pointer', async () => {
    const data = sample()
    ;(data.members[0] as Record<string, unknown>).avatar = 'storage/local/key'
    const { envelope, warnings } = await run(data)
    expect(envelope.assets).toHaveLength(0)
    expect(codes(warnings)).toContain('bt_avatar_unresolvable')
  })
})

describe('BerryTree converter: module selection', () => {
  it('omits whatever the visitor did not select', async () => {
    const { envelope } = await run(sample(), { selectedModules: ['members'] })
    expect(envelope.members.length).toBeGreaterThan(0)
    expect(envelope.groups).toHaveLength(0)
    expect(envelope.front_periods).toHaveLength(0)
    expect(envelope.taxonomy_terms).toHaveLength(0)
  })
})

describe('BerryTree converter: registration', () => {
  it('registers against the v0.1 destination and declares its modules', () => {
    expect(converter.sourceId).toBe('berrytree')
    expect(converter.destinationId).toBe('pluralport_v0.1')
    expect(converter.modules).toEqual(ALL_MODULES)
  })

  it('inspects a file for a label and per-module counts', () => {
    const { label, counts } = converter.inspect!(JSON.stringify(sample()))
    expect(label).toBe('Test System')
    expect(counts).toMatchObject({ members: 1, custom_fronts: 2, fronting: 2, groups: 2, images: 0 })
  })

  it('counts embedded images for the images module, not linked ones', () => {
    const data = sample({ user_settings: { system_avatar: 'data:image/png;base64,iVBORw0KGgo=' } })
    ;(data.members[0] as Record<string, unknown>).banner = 'data:image/png;base64,iVBORw0KGgo='
    ;(data.members[1] as Record<string, unknown>).avatar = 'https://pub-abc123.r2.dev/a.png'
    const { counts } = converter.inspect!(JSON.stringify(data))
    expect(counts.images).toBe(2)
  })

  it('rejects a file that is not a BerryTree export', () => {
    expect(() => converter.inspect!('{"hello":"world"}')).toThrow(/BerryTree/i)
  })
})
