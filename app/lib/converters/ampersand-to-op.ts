import {
  coll,
  countAmpersand,
  parseAmpersand,
  systemLabel,
  type AmpAsset,
  type AmpBoardMessage,
  type AmpCustomField,
  type AmpExport,
  type AmpFrontingEntry,
  type AmpJournalPost,
  type AmpMember,
  type AmpNote,
  type AmpSystem,
  type AmpTag,
} from '../ampersand-client'
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

/** Ampersand rows already carry UUIDs; reuse them as PluralPort ids so
 *  cross-references (member.system, member.tags, member.customFields keys)
 *  line up without an id map. Missing/blank -> a fresh UUID. */
function idOf(row: { uuid?: string }): string {
  const u = row.uuid
  return typeof u === 'string' && u.trim() ? u : newUUID()
}

/** Validate an Ampersand ISO-8601 timestamp and re-serialise it, or null. */
function toISO(raw?: string | null): string | null {
  if (typeof raw !== 'string' || !raw) return null
  const ms = Date.parse(raw)
  return Number.isNaN(ms) ? null : new Date(ms).toISOString()
}

/** Normalise a colour to '#rrggbb', or null. Handles 3/6/8-hex with or
 *  without a leading '#'; 8-hex is treated as ARGB (the alpha byte is
 *  dropped), matching Ampersand's colour storage. */
function hexColor(raw?: unknown): string | null {
  if (typeof raw !== 'string') return null
  let s = raw.trim().replace(/^#/, '')
  if (s.length === 3) s = s.split('').map(ch => ch + ch).join('')
  else if (s.length === 8) s = s.slice(2)
  if (s.length !== 6 || !/^[0-9a-fA-F]{6}$/.test(s)) return null
  return `#${s.toLowerCase()}`
}

/** Ampersand is local-first with no sharing model, so everything is
 *  private; carry the PluralPort Privacy object shape all the same. */
function ampPrivacy(): { visibility: string; source: unknown } {
  return { visibility: 'private', source: {} }
}

function sourceRef(collection: string, id?: string) {
  return { app: 'ampersand', collection, id: id ?? null }
}

/** Collects inline base64 images into deduplicated PluralPort Assets. */
class AssetTable {
  private byUri = new Map<string, string>()
  readonly assets: object[] = []

  /** Register a `data:` URI and return its asset id, or null if not one.
   *  The bytes are self-contained, so they go in `data_uri` (inline) - not
   *  `uri`, which the spec reserves for fragile external URLs. */
  ref(dataUri: unknown, kind: string, extra?: Record<string, unknown>): string | null {
    if (typeof dataUri !== 'string' || !dataUri.startsWith('data:')) return null
    const existing = this.byUri.get(dataUri)
    if (existing) return existing
    const id = newUUID()
    const mimeMatch = /^data:([\w/+.\-]+)[;,]/.exec(dataUri)
    this.assets.push({
      id,
      kind,
      mime_type: mimeMatch ? mimeMatch[1] : null,
      uri: null,
      data_uri: dataUri,
      source_refs: [sourceRef('assets')],
      extensions: extra ? { ampersand: extra } : {},
    })
    this.byUri.set(dataUri, id)
    return id
  }
}

export const runAmpersandToOp: ConverterFn = async (input, options, cb) => {
  const { selectedModules } = options
  const has = (m: string) => selectedModules.includes(m)

  const wantedTasks: TaskState[] = [
    { key: 'system', label: 'Systems', status: 'pending' },
  ]
  if (has('members'))       wantedTasks.push({ key: 'members',       label: 'Members',       status: 'pending' })
  if (has('custom_fronts')) wantedTasks.push({ key: 'custom_fronts', label: 'Custom Fronts', status: 'pending' })
  if (has('tags'))          wantedTasks.push({ key: 'tags',          label: 'Tags',          status: 'pending' })
  if (has('custom_fields')) wantedTasks.push({ key: 'custom_fields', label: 'Custom Fields', status: 'pending' })
  if (has('fronting'))      wantedTasks.push({ key: 'fronting',      label: 'Front History', status: 'pending' })
  if (has('notes'))         wantedTasks.push({ key: 'notes',         label: 'Notes',         status: 'pending' })
  if (has('boards'))        wantedTasks.push({ key: 'boards',        label: 'Message Board',  status: 'pending' })
  if (has('polls'))         wantedTasks.push({ key: 'polls',         label: 'Polls',         status: 'pending' })
  if (has('images'))        wantedTasks.push({ key: 'images',        label: 'Images',        status: 'pending' })
  wantedTasks.push({ key: 'build', label: 'Building PluralPort file', status: 'pending' })
  cb.initTasks(wantedTasks)

  const warnings: OPWarning[] = []
  const emitWarning = (w: OPWarning) => { warnings.push(w); cb.warning(w) }

  let data: AmpExport
  try {
    data = parseAmpersand(input.fileText ?? '')
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    cb.updateTask('system', { status: 'error', note: msg })
    throw new Error(msg)
  }

  const assets = new AssetTable()
  const imagesEnabled = has('images')

  // --- Systems (Ampersand systems map to PluralPort systems, nested) ----
  cb.updateTask('system', { status: 'running' })
  const ampSystems = coll<AmpSystem>(data, 'systems')
  const systemIds = new Set(ampSystems.map(s => idOf(s)))
  // Ampersand systems carry their own uuid; reuse it so member.system FKs
  // resolve directly. The configured default sorts first for readability.
  const appConfig = (data.config as { appConfig?: { defaultSystem?: string } } | undefined)?.appConfig
  const defaultSysId = ampSystems.find(s => s.uuid === appConfig?.defaultSystem)?.uuid
  const fallbackSystemId = defaultSysId ?? ampSystems[0]?.uuid ?? null

  const opSystems = ampSystems.map(s => {
    const id = idOf(s)
    const parent = typeof s.parent === 'string' && systemIds.has(s.parent) ? s.parent : null
    if (typeof s.parent === 'string' && s.parent && !parent) {
      emitWarning({ level: 'warning', code: 'dangling_parent_ref', record_type: 'system', message: `System "${s.name ?? id}" referenced a parent system not present in the export; imported at top level.` })
    }
    return {
      id,
      name: s.name ?? 'System',
      display_name: null,
      description: s.description ?? null,
      tag: null,
      color: hexColor(s.color),
      avatar_asset_id: imagesEnabled ? assets.ref(s.image, 'avatar', { source: 'system' }) : null,
      banner_asset_id: null,
      parent_system_id: parent,
      archived: s.isArchived ?? false,
      privacy: ampPrivacy(),
      settings: {},
      source_refs: [sourceRef('systems', id)],
      extensions: { ampersand: { isPinned: s.isPinned ?? false, viewInLists: s.viewInLists ?? true, nameStyle: s.nameStyle ?? null } },
    }
  })
  if (fallbackSystemId) {
    opSystems.sort((a, b) => (a.id === fallbackSystemId ? -1 : b.id === fallbackSystemId ? 1 : 0))
  }
  cb.updateTask('system', { status: 'done', count: opSystems.length })

  // --- Members + custom fronts ------------------------------------------
  const allMembers = coll<AmpMember>(data, 'members')
  const importedMemberIds = new Set<string>()
  const memberSystemOf = new Map<string, string | null>()
  const opMembers: object[] = []

  const wantMember = (m: AmpMember) =>
    (m.isCustomFront ? has('custom_fronts') : has('members'))

  if (has('members') || has('custom_fronts')) {
    if (has('members'))       cb.updateTask('members', { status: 'running' })
    if (has('custom_fronts')) cb.updateTask('custom_fronts', { status: 'running' })
    let realCount = 0
    let cfCount = 0
    for (const m of allMembers) {
      if (!wantMember(m)) continue
      const id = idOf(m)
      const sysRef = typeof m.system === 'string' && systemIds.has(m.system) ? m.system : fallbackSystemId
      if (typeof m.system === 'string' && m.system && sysRef !== m.system) {
        emitWarning({ level: 'warning', code: 'dangling_system_ref', record_type: 'member', message: `Member "${m.name ?? id}" referenced a system not present in the export.` })
      }
      importedMemberIds.add(id)
      memberSystemOf.set(id, sysRef)
      const age = (typeof m.age === 'number' || typeof m.age === 'string') ? m.age : null
      opMembers.push({
        id,
        system_id: sysRef,
        name: m.name ?? null,
        display_name: null,
        pronouns: m.pronouns ?? null,
        description: m.description ?? null,
        age,
        birthday: null,
        color: hexColor(m.color),
        avatar_asset_id: imagesEnabled ? assets.ref(m.image, 'avatar', { source: 'member' }) : null,
        banner_asset_id: null,
        proxy_tags: [],
        is_custom_front: m.isCustomFront ?? false,
        archived: m.isArchived ?? false,
        created_at: toISO(m.dateCreated),
        sort_order: null,
        privacy: ampPrivacy(),
        source_refs: [sourceRef('members', id)],
        extensions: { ampersand: { isPinned: m.isPinned ?? false, role: m.role ?? null } },
      })
      if (m.isCustomFront) cfCount++
      else realCount++
    }
    if (has('members'))       cb.updateTask('members', { status: 'done', count: realCount })
    if (has('custom_fronts')) cb.updateTask('custom_fronts', { status: 'done', count: cfCount })
  } else {
    // Members always need mapping for reference resolution even if neither
    // module is selected; record their ids/systems without emitting rows.
    for (const m of allMembers) {
      const id = idOf(m)
      const sysRef = typeof m.system === 'string' && systemIds.has(m.system) ? m.system : fallbackSystemId
      importedMemberIds.add(id)
      memberSystemOf.set(id, sysRef)
    }
  }

  const systemForMember = (memberId: string | null | undefined) =>
    (memberId != null ? memberSystemOf.get(memberId) : null) ?? fallbackSystemId

  // --- Tags -> taxonomy terms + assignments -----------------------------
  const opTaxonomyTerms: object[] = []
  const opTaxonomyAssignments: object[] = []
  const memberTagIds = new Set<string>()
  if (has('tags')) {
    cb.updateTask('tags', { status: 'running' })
    for (const t of coll<AmpTag>(data, 'tags')) {
      const id = idOf(t)
      if (t.type === 'member') memberTagIds.add(id)
      opTaxonomyTerms.push({
        id,
        kind: 'tag',
        name: t.name ?? 'tag',
        color: hexColor(t.color),
        source_refs: [sourceRef('tags', id)],
        extensions: { ampersand: { type: t.type ?? null, description: t.description ?? null, isArchived: t.isArchived ?? false } },
      })
    }
    // Member -> member-tag assignments (only for imported members).
    for (const m of allMembers) {
      const id = idOf(m)
      if (!importedMemberIds.has(id) || !wantMember(m)) continue
      for (const ref of m.tags ?? []) {
        if (typeof ref !== 'string' || !memberTagIds.has(ref)) continue
        opTaxonomyAssignments.push({
          id: newUUID(),
          term_id: ref,
          subject_type: 'member',
          subject_id: id,
          source_refs: [],
        })
      }
    }
    cb.updateTask('tags', { status: 'done', count: opTaxonomyTerms.length })
  }

  // --- Custom fields + values -------------------------------------------
  const opCustomFields: object[] = []
  const opCustomFieldValues: object[] = []
  const fieldIds = new Set<string>()
  if (has('custom_fields')) {
    cb.updateTask('custom_fields', { status: 'running' })
    for (const f of coll<AmpCustomField>(data, 'customFields')) {
      const id = idOf(f)
      fieldIds.add(id)
      opCustomFields.push({
        id,
        name: f.name ?? 'field',
        field_type: 'text',
        options: null,
        sort_order: typeof f.priority === 'number' ? f.priority : null,
        privacy: ampPrivacy(),
        source_refs: [sourceRef('customFields', id)],
        extensions: { ampersand: { default: f.default ?? false } },
      })
    }
    // Synthesise an "Age" field if any imported member carries an age.
    let ageFieldId: string | null = null
    if (allMembers.some(m => wantMember(m) && (typeof m.age === 'number' || typeof m.age === 'string'))) {
      ageFieldId = newUUID()
      opCustomFields.push({
        id: ageFieldId,
        name: 'Age',
        field_type: 'text',
        options: null,
        sort_order: opCustomFields.length,
        privacy: ampPrivacy(),
        source_refs: [],
        extensions: { ampersand: { synthesised: 'member.age' } },
      })
    }
    for (const m of allMembers) {
      const id = idOf(m)
      if (!importedMemberIds.has(id) || !wantMember(m)) continue
      const cf = m.customFields
      if (cf && typeof cf === 'object') {
        for (const [fieldRef, value] of Object.entries(cf)) {
          if (value == null || !fieldIds.has(fieldRef)) continue
          opCustomFieldValues.push({
            id: newUUID(),
            field_id: fieldRef,
            subject_type: 'member',
            subject_id: id,
            value: String(value),
          })
        }
      }
      if (ageFieldId && (typeof m.age === 'number' || typeof m.age === 'string')) {
        opCustomFieldValues.push({
          id: newUUID(),
          field_id: ageFieldId,
          subject_type: 'member',
          subject_id: id,
          value: String(m.age),
        })
      }
    }
    cb.updateTask('custom_fields', { status: 'done', count: opCustomFields.length })
  }

  // --- Front history (one period per fronting entry) --------------------
  const opFrontPeriods: object[] = []
  if (has('fronting')) {
    cb.updateTask('fronting', { status: 'running' })
    let missing = 0
    for (const f of coll<AmpFrontingEntry>(data, 'frontingEntries')) {
      const id = idOf(f)
      const started = toISO(f.startTime)
      if (!started) { missing++; continue }
      const memberRef = typeof f.member === 'string' ? f.member : null
      if (!memberRef || !importedMemberIds.has(memberRef)) {
        emitWarning({ level: 'warning', code: 'dangling_member_ref', record_type: 'front_period', message: `Fronting entry references a member not present in the export.` })
      }
      opFrontPeriods.push({
        id,
        system_id: memberRef ? systemForMember(memberRef) : fallbackSystemId,
        started_at: started,
        ended_at: toISO(f.endTime ?? null),
        assignments: [{
          member_id: memberRef ?? null,
          front_role: 'member',
          note: null,
          source_refs: [sourceRef('frontingEntries', id)],
        }],
        status: f.customStatus ?? null,
        note: null,
        source_kind: 'entry',
        source_refs: [sourceRef('frontingEntries', id)],
        extensions: { ampersand: { isMainFronter: f.isMainFronter ?? false, isLocked: f.isLocked ?? false } },
      })
    }
    if (missing) emitWarning({ level: 'warning', code: 'bad_timestamp', record_type: 'front_period', message: `Skipped ${missing} fronting entr${missing === 1 ? 'y' : 'ies'} with an unparseable start time.`, count: missing })
    cb.updateTask('fronting', { status: 'done', count: opFrontPeriods.length })
  }

  // --- Notes (journal posts + sticky notes) -----------------------------
  const opNotes: object[] = []
  if (has('notes')) {
    cb.updateTask('notes', { status: 'running' })
    const nowISO = new Date().toISOString()
    for (const j of coll<AmpJournalPost>(data, 'journalPosts')) {
      const id = idOf(j)
      const authorIds = (j.members ?? []).filter((r): r is string => typeof r === 'string' && importedMemberIds.has(r))
      const subtitle = typeof j.subtitle === 'string' && j.subtitle.trim() ? j.subtitle.trim() : null
      const rawBody = typeof j.body === 'string' ? j.body : ''
      const body = subtitle ? `*${subtitle}*\n\n${rawBody}` : rawBody
      const coverId = imagesEnabled ? assets.ref(j.cover, 'image', { source: 'journal_cover' }) : null
      opNotes.push({
        id,
        system_id: authorIds.length === 1 ? systemForMember(authorIds[0]) : fallbackSystemId,
        member_id: authorIds.length === 1 ? authorIds[0] : null,
        title: j.title ?? null,
        body,
        created_at: toISO(j.date) ?? nowISO,
        updated_at: null,
        entry_date: null,
        author_member_ids: authorIds,
        color: null,
        visibility: j.isPrivate ? 'private' : 'public',
        pinned: j.isPinned ?? false,
        content_warning: typeof j.contentWarning === 'string' ? j.contentWarning : null,
        attachment_asset_ids: coverId ? [coverId] : [],
        source_refs: [sourceRef('journalPosts', id)],
        extensions: { ampersand: { subtitle, tags: j.tags ?? [], kind: 'journal' } },
      })
    }
    for (const n of coll<AmpNote>(data, 'notes')) {
      const id = idOf(n)
      opNotes.push({
        id,
        system_id: fallbackSystemId,
        member_id: null,
        title: n.title ?? null,
        body: typeof n.content === 'string' ? n.content : '',
        created_at: nowISO,
        updated_at: null,
        entry_date: null,
        author_member_ids: [],
        color: null,
        visibility: 'private',
        pinned: false,
        content_warning: null,
        attachment_asset_ids: [],
        source_refs: [sourceRef('notes', id)],
        extensions: { ampersand: { priority: n.priority ?? null, isArchived: n.isArchived ?? false, kind: 'sticky_note' } },
      })
    }
    cb.updateTask('notes', { status: 'done', count: opNotes.length })
  }

  // --- Message board (+ comments as replies) ----------------------------
  const opBoardPosts: object[] = []
  const opPolls: object[] = []
  if (has('boards') || has('polls')) {
    if (has('boards')) cb.updateTask('boards', { status: 'running' })
    if (has('polls'))  cb.updateTask('polls', { status: 'running' })
    let droppedComments = 0
    for (const b of coll<AmpBoardMessage>(data, 'boardMessages')) {
      const id = idOf(b)
      const memberRefs = (b.members ?? []).filter((r): r is string => typeof r === 'string' && importedMemberIds.has(r))
      const author = memberRefs[0] ?? null
      const title = typeof b.title === 'string' && b.title.trim() ? b.title.trim() : null
      const rawBody = typeof b.body === 'string' ? b.body : ''
      const pollData = b.poll && typeof b.poll === 'object' ? b.poll : null
      let pollId: string | null = null

      if (has('polls') && pollData && Array.isArray(pollData.entries) && pollData.entries.length) {
        pollId = newUUID()
        opPolls.push({
          id: pollId,
          system_id: author ? systemForMember(author) : fallbackSystemId,
          question: title ?? 'Poll',
          options: pollData.entries.map(e => ({ name: e?.choice ?? '', vote_count: Array.isArray(e?.votes) ? e.votes.length : 0 })),
          closed: false,
          created_at: toISO(b.date),
          source_refs: [sourceRef('boardMessages', id)],
          extensions: {
            ampersand: {
              multipleChoice: pollData.multipleChoice ?? false,
              votes: pollData.entries.map(e => ({ choice: e?.choice ?? '', voters: (e?.votes ?? []).map(v => ({ member: v?.member ?? null, reason: v?.reason ?? null })) })),
            },
          },
        })
      }

      if (has('boards')) {
        opBoardPosts.push({
          id,
          target_member_id: null,
          author_member_id: author,
          body: title ? `**${title}**\n\n${rawBody}` : rawBody,
          created_at: toISO(b.date),
          updated_at: null,
          source_refs: [sourceRef('boardMessages', id)],
          extensions: { ampersand: { title, isPinned: b.isPinned ?? false, isArchived: b.isArchived ?? false, members: memberRefs, poll_id: pollId } },
        })
        for (const c of b.comments ?? []) {
          if (!c || typeof c !== 'object') continue
          const cAuthor = typeof c.member === 'string' && importedMemberIds.has(c.member) ? c.member : null
          opBoardPosts.push({
            id: newUUID(),
            target_member_id: null,
            author_member_id: cAuthor,
            body: typeof c.comment === 'string' ? c.comment : '',
            created_at: toISO(c.date),
            updated_at: null,
            source_refs: [],
            extensions: { ampersand: { parent_message_id: id } },
          })
        }
      } else if (b.comments) {
        droppedComments += (b.comments ?? []).length
      }
    }
    if (has('boards')) cb.updateTask('boards', { status: 'done', count: opBoardPosts.length })
    if (has('polls'))  cb.updateTask('polls', { status: 'done', count: opPolls.length })
    if (droppedComments) emitWarning({ level: 'info', code: 'comments_skipped', record_type: 'poll', message: `${droppedComments} board comment(s) were not converted because the Message Board module was not selected.`, count: droppedComments })
  }

  // --- Standalone asset-manager images ----------------------------------
  if (has('images')) {
    cb.updateTask('images', { status: 'running' })
    for (const a of coll<AmpAsset>(data, 'assets')) {
      assets.ref(a.file, 'image', { source: 'asset_manager', friendlyName: a.friendlyName ?? null, tags: a.tags ?? [] })
    }
    cb.updateTask('images', { status: 'done', count: assets.assets.length })
  }

  // --- Build envelope ---------------------------------------------------
  cb.updateTask('build', { status: 'running' })

  const capModules: string[] = ['systems', 'members']
  if (opTaxonomyTerms.length)     capModules.push('taxonomy')
  if (opCustomFields.length)      capModules.push('custom_fields')
  if (opFrontPeriods.length)      capModules.push('front_periods')
  if (opNotes.length)             capModules.push('notes')
  if (opBoardPosts.length)        capModules.push('boards')
  if (opPolls.length)             capModules.push('polls')
  if (assets.assets.length)       capModules.push('assets')

  // File-level Ampersand extras with no PluralPort v0.1 core home. Config
  // is deliberately excluded (it carries the app-lock password hash and
  // other device settings that are not the user's system data).
  const fileExtensions: Record<string, unknown> = {}
  const reminders = coll(data, 'reminders')
  if (reminders.length) fileExtensions.reminders = reminders
  const filterQueries = coll(data, 'filterQueries')
  if (filterQueries.length) fileExtensions.filter_queries = filterQueries
  if (data.revision) fileExtensions.revision = data.revision

  const envelope = {
    pluralport_version: PLURALPORT_VERSION,
    exported_at: new Date().toISOString(),
    // SPEC-OPEN(producer-exporter): producer.app is the *source* app, not this
    // tool, because source_refs and the extensions namespace both key off it.
    // The spec gives us producer.exporter_version but no slot naming which
    // converter produced the file, so our identity goes in extensions below.
    // If the spec gains producer.exporter/exporter_id, move it back up here.
    producer: {
      app: 'Ampersand',
      app_id: 'ampersand',
      app_version: data.revision?.humanReadable ?? 'unknown',
      exporter_version: EXPORTER_VERSION,
    },
    capabilities: { modules: capModules },

    systems:              opSystems,
    members:              opMembers,
    groups:               [],
    group_memberships:    [],
    taxonomy_terms:       opTaxonomyTerms,
    taxonomy_assignments: opTaxonomyAssignments,
    custom_fields:        opCustomFields,
    custom_field_values:  opCustomFieldValues,
    front_periods:        opFrontPeriods,
    front_events:         [],
    front_comments:       [],
    notes:                opNotes,
    assets:               assets.assets,

    chat:          null,
    boards:        opBoardPosts.length ? { posts: opBoardPosts } : null,
    relationships: null,
    polls:         opPolls.length ? { polls: opPolls } : null,

    // SPEC-OPEN(producer-exporter): see the producer note above.
    extensions: {
      [EXPORTER_NAMESPACE]: exporterExtension(),
      ...(Object.keys(fileExtensions).length ? { ampersand: fileExtensions } : {}),
    },
    warnings,
  }

  const json = JSON.stringify(envelope, null, 2)
  cb.updateTask('build', { status: 'done', count: 1 })

  const filename = pluralportFilename((opSystems[0] as { name?: string } | undefined)?.name)

  return { json, filename }
}

export const converter = defineConverter({
  sourceId: 'ampersand',
  destinationId: 'pluralport_v0.1',
  modules: ['members', 'custom_fronts', 'fronting', 'notes', 'tags', 'custom_fields', 'boards', 'polls', 'images'],
  inspect: (fileText) => {
    const data = parseAmpersand(fileText)
    return { label: systemLabel(data), counts: countAmpersand(data) }
  },
  run: runAmpersandToOp,
})
