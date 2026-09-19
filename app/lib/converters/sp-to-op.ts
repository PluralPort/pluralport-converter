import {
  spFetch,
  type SpCustomFront,
  type SpFrontEntry,
  type SpGroup,
  type SpMember,
  type SpNote,
  type SpPoll,
  type SpUser,
} from '../sp-client'
import { defineConverter, type ConverterFn, type OPWarning, type TaskState } from './types'
import {
  EXPORTER_NAMESPACE,
  EXPORTER_VERSION,
  PLURALPORT_VERSION,
  exporterExtension,
  pluralportFilename,
} from '../pluralport'

function newUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
  })
}

function toISO(ms: number): string {
  return new Date(ms).toISOString()
}

function hexColor(raw?: string): string | null {
  if (!raw) return null
  const s = raw.trim()
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return s
  if (/^[0-9a-fA-F]{6}$/.test(s)) return `#${s}`
  return null
}

function spPrivacy(raw?: unknown): { visibility: string; source: unknown } {
  return { visibility: 'private', source: raw ?? {} }
}

function mapMember(m: SpMember, opId: string, systemOpId: string, isCustomFront: boolean) {
  const c = m.content
  return {
    id: opId,
    system_id: systemOpId,
    name: c.name ?? null,
    display_name: c.displayName ?? null,
    pronouns: c.pronouns ?? null,
    description: c.description ?? null,
    age: (c as Record<string, unknown>).age ?? null,
    birthday: null,
    color: hexColor(c.color as string | undefined),
    avatar_asset_id: null,
    banner_asset_id: null,
    proxy_tags: [],
    is_custom_front: isCustomFront,
    archived: c.archived ?? false,
    created_at: c.created ? toISO(c.created as number) : null,
    sort_order: null,
    privacy: spPrivacy(),
    source_refs: [{ app: 'simply_plural', collection: 'members', id: m.id }],
    extensions: {
      simply_plural: {
        preventsFronting: c.preventsFronting ?? false,
        info: c.info ?? {},
        avatarUrl: c.avatarUrl ?? null,
        avatarUuid: c.avatarUuid ?? null,
      }
    }
  }
}

function mapCustomFront(cf: SpCustomFront, opId: string, systemOpId: string) {
  const c = cf.content
  return {
    id: opId,
    system_id: systemOpId,
    name: c.name ?? null,
    display_name: null,
    pronouns: null,
    description: c.desc ?? null,
    age: null,
    birthday: null,
    color: hexColor(c.color as string | undefined),
    avatar_asset_id: null,
    banner_asset_id: null,
    proxy_tags: [],
    is_custom_front: true,
    archived: false,
    created_at: null,
    sort_order: null,
    privacy: spPrivacy(),
    source_refs: [{ app: 'simply_plural', collection: 'customFronts', id: cf.id }],
    extensions: {
      simply_plural: {
        avatarUrl: c.avatarUrl ?? null,
        avatarUuid: c.avatarUuid ?? null,
      }
    }
  }
}

function mapGroup(g: SpGroup, groupIdMap: Map<string, string>, systemOpId: string) {
  const c = g.content
  return {
    id: groupIdMap.get(g.id)!,
    system_id: systemOpId,
    name: c.name ?? 'Unnamed Group',
    description: c.desc ?? null,
    color: hexColor(c.color as string | undefined),
    emoji: c.emoji ?? null,
    parent_group_id: c.parent ? (groupIdMap.get(c.parent) ?? null) : null,
    sort_order: null,
    source_refs: [{ app: 'simply_plural', collection: 'groups', id: g.id }],
    extensions: {}
  }
}

export const runSpToOp: ConverterFn = async (input, options, cb) => {
  const token = input.token ?? ''
  const userId = input.userId ?? ''
  const { selectedModules, rangeStart, rangeEnd } = options

  const wantedTasks: TaskState[] = [
    { key: 'system', label: 'System profile', status: 'pending' },
  ]

  // TODO: Maybe rewrite this, it works, but it looks gross...
  if (selectedModules.includes('members'))       wantedTasks.push({ key: 'members',       label: 'Members',       status: 'pending' })
  if (selectedModules.includes('custom_fronts')) wantedTasks.push({ key: 'custom_fronts', label: 'Custom Fronts', status: 'pending' })
  if (selectedModules.includes('groups'))        wantedTasks.push({ key: 'groups',        label: 'Groups',        status: 'pending' })
  if (selectedModules.includes('fronting'))      wantedTasks.push({ key: 'fronting',      label: 'Front History', status: 'pending' })
  if (selectedModules.includes('notes'))         wantedTasks.push({ key: 'notes',         label: 'Notes',         status: 'pending' })
  if (selectedModules.includes('polls'))         wantedTasks.push({ key: 'polls',         label: 'Polls',         status: 'pending' })
  wantedTasks.push({ key: 'build', label: 'Building PluralPort file', status: 'pending' })

  cb.initTasks(wantedTasks)

  const warnings: OPWarning[] = []
  const emitWarning = (w: OPWarning) => { warnings.push(w); cb.warning(w) }

  const memberIdMap = new Map<string, string>()
  const groupIdMap  = new Map<string, string>()
  const memberSpIds: string[] = []
  const systemOpId  = newUUID()

  let opMembers:          ReturnType<typeof mapMember>[]  = []
  let opGroups:           ReturnType<typeof mapGroup>[]   = []
  const opGroupMemberships: object[] = []
  let opFrontPeriods:     object[]   = []
  let opNotes:            object[]   = []
  let opPollsModule:      object | null = null

  cb.updateTask('system', { status: 'running' })
  let spUser: SpUser
  try {
    spUser = await spFetch<SpUser>('/me', token)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    cb.updateTask('system', { status: 'error', note: msg })
    throw new Error(`Failed to fetch system profile: ${msg}`)
  }

  const opSystem = {
    id: systemOpId,
    name: spUser.username || 'My System',
    display_name: null,
    description: null,
    tag: null,
    color: null,
    avatar_asset_id: null,
    banner_asset_id: null,
    parent_system_id: null,
    archived: false,
    privacy: spPrivacy(),
    settings: {},
    source_refs: [{ app: 'simply_plural', collection: 'users', id: spUser.id }],
    extensions: { simply_plural: { fields: spUser.fields ?? {} } }
  }
  cb.updateTask('system', { status: 'done', count: 1 })

  if (selectedModules.includes('members')) {
    cb.updateTask('members', { status: 'running' })
    try {
      const raw = await spFetch<SpMember[]>(`/members/${userId}`, token)
      opMembers = raw.map(m => {
        const opId = newUUID()
        memberIdMap.set(m.id, opId)
        memberSpIds.push(m.id)
        return mapMember(m, opId, systemOpId, false)
      })
      cb.updateTask('members', { status: 'done', count: opMembers.length })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      cb.updateTask('members', { status: 'error', note: msg })
      emitWarning({ level: 'error', code: 'fetch_failed', record_type: 'members', message: `Members fetch failed: ${msg}` })
    }
  }

  if (selectedModules.includes('custom_fronts')) {
    cb.updateTask('custom_fronts', { status: 'running' })
    try {
      const raw = await spFetch<SpCustomFront[]>(`/customFronts/${userId}`, token)
      const cfMembers = raw.map(cf => {
        const opId = newUUID()
        memberIdMap.set(cf.id, opId)
        return mapCustomFront(cf, opId, systemOpId)
      })
      opMembers = [...opMembers, ...cfMembers]
      cb.updateTask('custom_fronts', { status: 'done', count: cfMembers.length })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      cb.updateTask('custom_fronts', { status: 'error', note: msg })
      emitWarning({ level: 'warning', code: 'fetch_failed', record_type: 'custom_fronts', message: `Custom fronts fetch failed: ${msg}` })
    }
  }

  if (selectedModules.includes('groups')) {
    cb.updateTask('groups', { status: 'running' })
    try {
      const raw = await spFetch<SpGroup[]>(`/groups/${userId}`, token)
      for (const g of raw) groupIdMap.set(g.id, newUUID())
      opGroups = raw.map(g => mapGroup(g, groupIdMap, systemOpId))
      for (const g of raw) {
        const opGroupId = groupIdMap.get(g.id)!
        for (const spMemberId of (g.content.members ?? [])) {
          const opMemberId = memberIdMap.get(spMemberId)
          if (!opMemberId) {
            emitWarning({ level: 'warning', code: 'dangling_member_ref', record_type: 'group_membership', message: `Group "${g.content.name}" references unknown member ${spMemberId}` })
            continue
          }
          opGroupMemberships.push({
            id: newUUID(),
            group_id: opGroupId,
            member_id: opMemberId,
            sort_order: null,
            source_refs: []
          })
        }
      }
      cb.updateTask('groups', { status: 'done', count: opGroups.length })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      cb.updateTask('groups', { status: 'error', note: msg })
      emitWarning({ level: 'warning', code: 'fetch_failed', record_type: 'groups', message: `Groups fetch failed: ${msg}` })
    }
  }

  if (selectedModules.includes('fronting')) {
    cb.updateTask('fronting', { status: 'running' })
    try {
      const startMs = rangeStart ? new Date(rangeStart).getTime() : 0
      const endMs   = rangeEnd   ? new Date(rangeEnd + 'T23:59:59Z').getTime() : Number.POSITIVE_INFINITY

      const rawAll = await spFetch<SpFrontEntry[]>('/frontHistory', token)
      const raw = rawAll.filter(e => {
        const s = e.content.startTime
        return s >= startMs && s <= endMs
      })

      const periodMap = new Map<string, SpFrontEntry[]>()
      for (const entry of raw) {
        const key = `${entry.content.startTime}__${entry.content.endTime ?? 'live'}`
        if (!periodMap.has(key)) periodMap.set(key, [])
        periodMap.get(key)!.push(entry)
      }

      opFrontPeriods = [...periodMap.values()].map(entries => {
        const first = entries[0]
        const assignments = entries.map(e => {
          const opMemberId = memberIdMap.get(e.content.member)
          if (!opMemberId) {
            emitWarning({ level: 'warning', code: 'dangling_member_ref', record_type: 'front_period', record_id: null, message: `Front entry references unknown member ${e.content.member}` })
          }
          return {
            member_id: opMemberId ?? e.content.member,
            front_role: 'member',
            note: e.content.comment ?? null,
            source_refs: [{ app: 'simply_plural', collection: 'frontHistory', id: e.id }]
          }
        })

        return {
          id: newUUID(),
          system_id: systemOpId,
          started_at: toISO(first.content.startTime),
          ended_at: first.content.endTime ? toISO(first.content.endTime) : null,
          assignments,
          status: null,
          note: null,
          source_kind: 'grouped',
          source_refs: entries.map(e => ({ app: 'simply_plural', collection: 'frontHistory', id: e.id })),
          extensions: {}
        }
      })

      cb.updateTask('fronting', { status: 'done', count: opFrontPeriods.length })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      cb.updateTask('fronting', { status: 'error', note: msg })
      emitWarning({ level: 'error', code: 'fetch_failed', record_type: 'front_periods', message: `Front history fetch failed: ${msg}` })
    }
  }

  if (selectedModules.includes('notes')) {
    cb.updateTask('notes', { status: 'running' })
    try {
      const perMember = await Promise.all(
        memberSpIds.map(id =>
          spFetch<SpNote[]>(`/notes/${userId}/${id}`, token)
            .then(d => Array.isArray(d) ? d : [])
            .catch(() => [] as SpNote[])
        )
      )
      const raw: SpNote[] = perMember.flat()
      opNotes = raw.map(n => {
        const opMemberId = n.content.member ? memberIdMap.get(n.content.member) : null
        if (n.content.member && !opMemberId) {
          emitWarning({ level: 'warning', code: 'dangling_member_ref', record_type: 'note', record_id: null, message: `Note references unknown member ${n.content.member}` })
        }
        return {
          id: newUUID(),
          system_id: systemOpId,
          member_id: opMemberId ?? null,
          title: n.content.title ?? null,
          body: n.content.note ?? '',
          created_at: n.content.date ? toISO(n.content.date) : new Date().toISOString(),
          updated_at: null,
          entry_date: null,
          author_member_ids: [],
          color: hexColor(n.content.color as string | undefined),
          visibility: 'private',
          pinned: false,
          content_warning: null,
          attachment_asset_ids: [],
          source_refs: [{ app: 'simply_plural', collection: 'notes', id: n.id }],
          extensions: {}
        }
      })
      cb.updateTask('notes', { status: 'done', count: opNotes.length })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      cb.updateTask('notes', { status: 'error', note: msg })
      emitWarning({ level: 'warning', code: 'fetch_failed', record_type: 'notes', message: `Notes fetch failed: ${msg}` })
    }
  }

  if (selectedModules.includes('polls')) {
    cb.updateTask('polls', { status: 'running' })
    try {
      const raw = await spFetch<SpPoll[]>(`/polls/${userId}`, token)
      opPollsModule = {
        polls: raw.map(p => ({
          id: newUUID(),
          system_id: systemOpId,
          question: p.content.question ?? null,
          options: (p.content.options ?? []).map(o => ({
            name: o.name,
            vote_count: (o.votes ?? []).length
          })),
          closed: p.content.closed ?? false,
          created_at: p.content.created ? toISO(p.content.created) : null,
          source_refs: [{ app: 'simply_plural', collection: 'polls', id: p.id }],
          extensions: {}
        }))
      }
      cb.updateTask('polls', { status: 'done', count: (opPollsModule as { polls: object[] }).polls.length })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      cb.updateTask('polls', { status: 'error', note: msg })
      emitWarning({ level: 'warning', code: 'fetch_failed', record_type: 'polls', message: `Polls fetch failed: ${msg}` })
    }
  }

  cb.updateTask('build', { status: 'running' })

  const capModules: string[] = ['systems', 'members']
  if (opGroups.length)       capModules.push('groups')
  if (opFrontPeriods.length) capModules.push('front_periods')
  if (opNotes.length)        capModules.push('notes')
  if (opPollsModule)         capModules.push('polls')

  const envelope = {
    pluralport_version: PLURALPORT_VERSION,
    exported_at: new Date().toISOString(),
    // SPEC-OPEN(producer-exporter): producer.app is the *source* app, not this
    // tool, because source_refs and the extensions namespace both key off it.
    // The spec gives us producer.exporter_version but no slot naming which
    // converter produced the file, so our identity goes in extensions below.
    // If the spec gains producer.exporter/exporter_id, move it back up here.
    producer: {
      app: 'Simply Plural',
      app_id: 'simply_plural',
      app_version: 'v1',
      exporter_version: EXPORTER_VERSION,
    },
    capabilities: { modules: capModules },

    systems:             [opSystem],
    members:             opMembers,
    groups:              opGroups,
    group_memberships:   opGroupMemberships,
    taxonomy_terms:      [],
    taxonomy_assignments:[],
    custom_fields:       [],
    custom_field_values: [],
    front_periods:       opFrontPeriods,
    front_events:        [],
    front_comments:      [],
    notes:               opNotes,
    assets:              [],

    chat:          null,
    boards:        null,
    relationships: null,
    polls:         opPollsModule,

    // SPEC-OPEN(producer-exporter): see the producer note above.
    extensions: { [EXPORTER_NAMESPACE]: exporterExtension() },
    warnings,
  }

  const json = JSON.stringify(envelope, null, 2)
  cb.updateTask('build', { status: 'done', count: 1 })

  const filename = pluralportFilename(spUser.username)

  return { json, filename }
}

export const converter = defineConverter({
  sourceId: 'simply_plural',
  destinationId: 'pluralport_v0.1',
  modules: ['members', 'custom_fronts', 'groups', 'fronting', 'notes', 'polls'],
  run: runSpToOp,
})
