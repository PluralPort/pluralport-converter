/**
 * BerryTree -> PluralPort v0.1.
 *
 * EXPERIMENTAL. See the header of `berrytree-client.ts` for why, and for the
 * list of sections this maps. The governing rule is that anything we have
 * not seen a real example of is counted and reported, never guessed at.
 *
 * Ported from the Sheaf reference implementation. Sheaf's import caps and
 * quota guards are deliberately not carried over: they exist because Sheaf
 * writes to a shared multi-tenant encrypted database, whereas this writes a
 * file on the visitor's own machine.
 */
import {
  btColor,
  btTime,
  coll,
  exportErrors,
  isTemplate,
  KNOWN_SCHEMA_VERSION,
  mainContext,
  memberFolderIds,
  memberTagNames,
  MEMBER_TEXT_ATTRS,
  nonEmpty,
  parseBerrytree,
  countBerrytree,
  systemLabel,
  sectionLen,
  splitCustomStatuses,
  templateCount,
  unsupportedSections,
  FIELD_NAME_KEYS,
  FIELD_VALUE_KEYS,
  type BtCustomStatus,
  type BtExport,
  type BtFolder,
  type BtFrontEntry,
  type BtMember,
} from '../berrytree-client'
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

function sourceRef(collection: string, id?: string | null) {
  return { app: 'berrytree', collection, id: id ?? null }
}

/** BerryTree's privacy is a single boolean, and a missing or malformed flag
 *  fails closed to private. */
function btPrivacy(isPrivate: unknown): { visibility: string; source: unknown } {
  return { visibility: isPrivate === false ? 'public' : 'private', source: {} }
}

/**
 * Collects avatar/banner references as PluralPort Assets.
 *
 * BerryTree's server has been down throughout this converter's development,
 * so we have never seen a populated avatar on a real export; the sample
 * carries "" with `has_avatar: false`. Whatever shape a populated one takes,
 * we can only record it as an external `uri`, never inline bytes, because
 * the host is gone. The spec requires an asset carrying only `uri` to emit
 * `asset_uri_only` so importers know it is not self-contained.
 */
class AssetTable {
  private byUri = new Map<string, string>()
  readonly assets: object[] = []
  uriOnly = 0

  ref(raw: unknown, kind: string): string | null {
    const value = nonEmpty(raw)
    if (!value) return null
    // Only an absolute http(s) URL is a usable reference. A bare storage key
    // or app-relative path would be a dangling pointer, so it is dropped and
    // counted rather than written out as something that cannot resolve.
    if (!/^https?:\/\//i.test(value)) return null

    const existing = this.byUri.get(value)
    if (existing) return existing

    const id = newUUID()
    this.assets.push({
      id,
      kind,
      mime_type: null,
      uri: value,
      data_uri: null,
      source_refs: [sourceRef('assets')],
      extensions: {},
    })
    this.byUri.set(value, id)
    this.uriOnly += 1
    return id
  }
}

export const runBerrytreeToPp: ConverterFn = async (input, options, cb) => {
  const { selectedModules } = options
  const has = (m: string) => selectedModules.includes(m)

  const wantedTasks: TaskState[] = [
    { key: 'system', label: 'System profile', status: 'pending' },
  ]
  if (has('members'))       wantedTasks.push({ key: 'members',       label: 'Members',       status: 'pending' })
  if (has('custom_fronts')) wantedTasks.push({ key: 'custom_fronts', label: 'Custom Fronts', status: 'pending' })
  if (has('groups'))        wantedTasks.push({ key: 'groups',        label: 'Folders',       status: 'pending' })
  if (has('tags'))          wantedTasks.push({ key: 'tags',          label: 'Tags',          status: 'pending' })
  if (has('custom_fields')) wantedTasks.push({ key: 'custom_fields', label: 'Custom Fields', status: 'pending' })
  if (has('fronting'))      wantedTasks.push({ key: 'fronting',      label: 'Front History', status: 'pending' })
  wantedTasks.push({ key: 'build', label: 'Building PluralPort file', status: 'pending' })
  cb.initTasks(wantedTasks)

  const warnings: OPWarning[] = []
  const emit = (w: OPWarning) => { warnings.push(w); cb.warning(w) }

  let data: BtExport
  try {
    data = parseBerrytree(input.fileText ?? '')
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    cb.updateTask('system', { status: 'error', note: msg })
    throw new Error(msg)
  }

  const assets = new AssetTable()

  // --- Provenance checks before any mapping ------------------------------
  const schemaVersion = data.schema_version
  if (typeof schemaVersion !== 'number') {
    emit({
      level: 'warning',
      code: 'bt_schema_version_missing',
      message:
        'This export has no schema_version, which BerryTree\'s own exporter always writes. ' +
        'It may have been hand-edited or produced by another tool, so fields may not line up.',
    })
  } else if (schemaVersion !== KNOWN_SCHEMA_VERSION) {
    emit({
      level: 'warning',
      code: 'bt_schema_version_unknown',
      message:
        `This export is schema_version ${schemaVersion}; the only version we have been able to ` +
        `examine is ${KNOWN_SCHEMA_VERSION}. Conversion continued, but please check the result ` +
        'and get in touch, because a sample of this version would let us support it properly.',
    })
  }

  // BerryTree's exporter logs its own failures. A file carrying these was
  // already incomplete before it reached us, so say so rather than
  // presenting a clean conversion.
  const errors = exportErrors(data)
  if (errors.length) {
    emit({
      level: 'error',
      code: 'bt_partial_export',
      count: errors.length,
      message:
        `BerryTree's exporter recorded ${errors.length} section(s) it could not write when this ` +
        'file was created, so data is missing from the export itself, not from this conversion. ' +
        `Reported by BerryTree as: ${errors.join(' | ')}`,
    })
  }

  // --- System profile ----------------------------------------------------
  cb.updateTask('system', { status: 'running' })
  const ctx = mainContext(data)
  const systemId = newUUID()
  const systemPronouns = nonEmpty(ctx.pronouns)
  const opSystem = {
    id: systemId,
    name: nonEmpty(ctx.name) || nonEmpty(data.system?.system_name) || nonEmpty(data.system?.username) || 'System',
    display_name: null,
    description: nonEmpty(ctx.description),
    tag: nonEmpty(ctx.tag),
    color: btColor(ctx.color),
    avatar_asset_id: assets.ref(ctx.avatar, 'avatar'),
    banner_asset_id: assets.ref(ctx.banner, 'banner'),
    parent_system_id: null,
    archived: false,
    // Read from the context, the same way members read theirs. Hardcoding
    // private here would quietly contradict the user's own setting.
    privacy: btPrivacy(ctx.is_private),
    settings: {},
    source_refs: [sourceRef('system_contexts', nonEmpty(ctx.id))],
    // v0.1 has no pronouns or emoji field on System, so they are preserved
    // rather than dropped. The account email on the top-level `system`
    // object is deliberately not carried: it is a login credential, not
    // system data.
    extensions: systemExtensions(systemPronouns, nonEmpty(ctx.emoji)),
  }

  // BerryTree hangs custom fields off contexts and layers as well as
  // members. We have never seen a populated one, so rather than guess at
  // the shape, count them and say so.
  const contextFieldCount =
    coll<Record<string, unknown>>(data, 'system_contexts')
      .concat(coll<Record<string, unknown>>(data, 'layers'))
      .reduce((n, row) => n + (Array.isArray(row.custom_fields) ? row.custom_fields.length : 0), 0)
  if (contextFieldCount) {
    emit({
      level: 'warning',
      code: 'bt_context_custom_fields',
      count: contextFieldCount,
      message:
        `${contextFieldCount} custom field(s) are attached to a system context or layer rather than ` +
        'to a member, and were not converted. Every sample we have has these empty, so we have never ' +
        'seen the record shape. Please get in touch and bring your export.',
    })
  }
  cb.updateTask('system', { status: 'done', count: 1 })

  // --- Members and custom fronts -----------------------------------------
  // Two things become custom fronts: `custom_statuses` rows with kind
  // "status", and roster members flagged as not counting toward headcount.
  const allMembers = coll<BtMember>(data, 'members')
  const [frontingTypes, statusFronts] = splitCustomStatuses(data)

  const typeNames = new Map<string, string>()
  for (const t of frontingTypes) {
    const id = nonEmpty(t.id)
    const name = nonEmpty(t.name)
    if (id && name) typeNames.set(id, name)
  }

  const idMap = new Map<string, string>()   // BerryTree id -> PluralPort id
  const opMembers: object[] = []
  let templatesHeld = 0
  let avatarsDropped = 0

  const mapMember = (m: BtMember, isCustomFront: boolean) => {
    const btId = nonEmpty(m.id)
    const ppId = newUUID()
    if (btId) idMap.set(btId, ppId)

    const avatarId = assets.ref(m.avatar, 'avatar')
    if (nonEmpty(m.avatar) && !avatarId) avatarsDropped += 1

    return {
      id: ppId,
      system_id: systemId,
      name: nonEmpty(m.name),
      display_name: nonEmpty(m.display_name),
      pronouns: nonEmpty(m.pronouns),
      description: nonEmpty(m.description),
      age: null,
      birthday: null,
      color: btColor(m.color),
      avatar_asset_id: avatarId,
      banner_asset_id: assets.ref(m.banner, 'banner'),
      proxy_tags: [],
      is_custom_front: isCustomFront,
      archived: m.archived === true,
      created_at: btTime(m.created_at),
      sort_order: null,
      privacy: btPrivacy(m.is_private),
      source_refs: [sourceRef('members', btId)],
      extensions: {
        berrytree: {
          emoji: nonEmpty(m.emoji),
          counts_toward_headcount: m.counts_toward_headcount !== false,
        },
      },
    }
  }

  if (has('members') || has('custom_fronts')) {
    if (has('members'))       cb.updateTask('members', { status: 'running' })
    if (has('custom_fronts')) cb.updateTask('custom_fronts', { status: 'running' })

    let memberCount = 0
    let frontCount = 0

    for (const m of allMembers) {
      // Templates are scaffolding for making new members, not people.
      if (isTemplate(m)) { templatesHeld += 1; continue }
      const asCustomFront = m.counts_toward_headcount === false
      if (asCustomFront && !has('custom_fronts')) continue
      if (!asCustomFront && !has('members')) continue
      opMembers.push(mapMember(m, asCustomFront))
      if (asCustomFront) frontCount += 1
      else memberCount += 1
    }

    if (has('custom_fronts')) {
      for (const s of statusFronts) {
        const btId = nonEmpty(s.id)
        const ppId = newUUID()
        if (btId) idMap.set(btId, ppId)
        if (s.kind !== 'status' && nonEmpty(s.kind)) {
          emit({
            level: 'info',
            code: 'bt_unknown_status_kind',
            record_type: 'member',
            record_id: btId,
            message:
              `A custom_statuses row had kind "${s.kind}", which we do not recognise. It was ` +
              'converted as a custom front so it is visible rather than silently lost.',
          })
        }
        opMembers.push({
          id: ppId,
          system_id: systemId,
          name: nonEmpty(s.name),
          display_name: null,
          pronouns: null,
          description: nonEmpty(s.description),
          age: null,
          birthday: null,
          color: btColor(s.color),
          avatar_asset_id: assets.ref(s.avatar ?? s.image_url, 'avatar'),
          banner_asset_id: null,
          proxy_tags: [],
          is_custom_front: true,
          archived: false,
          created_at: null,
          sort_order: null,
          privacy: btPrivacy(undefined),
          source_refs: [sourceRef('custom_statuses', btId)],
          extensions: {},
        })
        frontCount += 1
      }
    }

    if (templatesHeld) {
      emit({
        level: 'info',
        code: 'bt_templates_skipped',
        count: templatesHeld,
        message:
          `${templatesHeld} template member(s) were not converted. BerryTree templates are ` +
          'scaffolding for creating new members rather than people in the system.',
      })
    }

    if (has('members'))       cb.updateTask('members', { status: 'done', count: memberCount })
    if (has('custom_fronts')) cb.updateTask('custom_fronts', { status: 'done', count: frontCount })
  }

  // --- Folders -> groups --------------------------------------------------
  const opGroups: object[] = []
  const opGroupMemberships: object[] = []
  const folderIdMap = new Map<string, string>()

  if (has('groups')) {
    cb.updateTask('groups', { status: 'running' })
    const folders = coll<BtFolder>(data, 'folders')
    for (const f of folders) {
      const btId = nonEmpty(f.id)
      if (btId) folderIdMap.set(btId, newUUID())
    }
    for (const f of folders) {
      const btId = nonEmpty(f.id)
      const ppId = btId ? folderIdMap.get(btId)! : newUUID()
      const parentBt = nonEmpty(f.parent_id)
      const parent = parentBt ? folderIdMap.get(parentBt) ?? null : null
      if (parentBt && !parent) {
        emit({
          level: 'warning',
          code: 'dangling_parent_ref',
          record_type: 'group',
          record_id: btId,
          message: `Folder "${nonEmpty(f.name) ?? btId}" referenced a parent folder not present in the export; converted at top level.`,
        })
      }
      opGroups.push({
        id: ppId,
        system_id: systemId,
        name: nonEmpty(f.name) ?? 'Unnamed Folder',
        description: nonEmpty(f.description),
        color: btColor(f.color),
        emoji: null,
        parent_group_id: parent,
        sort_order: null,
        source_refs: [sourceRef('folders', btId)],
        extensions: {},
      })
    }

    for (const m of allMembers) {
      if (isTemplate(m)) continue
      const memberPp = idMap.get(nonEmpty(m.id) ?? '')
      if (!memberPp) continue
      for (const fid of memberFolderIds(m)) {
        const groupPp = folderIdMap.get(fid)
        if (!groupPp) continue
        opGroupMemberships.push({
          id: newUUID(),
          group_id: groupPp,
          member_id: memberPp,
          source_refs: [sourceRef('members', nonEmpty(m.id))],
          extensions: {},
        })
      }
    }
    cb.updateTask('groups', { status: 'done', count: opGroups.length })
  }

  // --- Tags -> taxonomy ---------------------------------------------------
  const opTaxonomyTerms: object[] = []
  const opTaxonomyAssignments: object[] = []

  if (has('tags')) {
    cb.updateTask('tags', { status: 'running' })
    const termIds = new Map<string, string>()
    for (const m of allMembers) {
      if (isTemplate(m)) continue
      const memberPp = idMap.get(nonEmpty(m.id) ?? '')
      if (!memberPp) continue
      for (const name of memberTagNames(m)) {
        let termId = termIds.get(name)
        if (!termId) {
          termId = newUUID()
          termIds.set(name, termId)
          opTaxonomyTerms.push({
            id: termId,
            system_id: systemId,
            kind: 'tag',
            name,
            description: null,
            color: null,
            source_refs: [sourceRef('members')],
            extensions: {},
          })
        }
        opTaxonomyAssignments.push({
          id: newUUID(),
          term_id: termId,
          record_type: 'member',
          record_id: memberPp,
          source_refs: [sourceRef('members', nonEmpty(m.id))],
          extensions: {},
        })
      }
    }
    cb.updateTask('tags', { status: 'done', count: opTaxonomyTerms.length })
  }

  // --- Custom fields ------------------------------------------------------
  const opCustomFields: object[] = []
  const opCustomFieldValues: object[] = []

  if (has('custom_fields')) {
    cb.updateTask('custom_fields', { status: 'running' })
    const defIds = new Map<string, string>()
    const defineField = (name: string) => {
      let id = defIds.get(name)
      if (!id) {
        id = newUUID()
        defIds.set(name, id)
        opCustomFields.push({
          id,
          system_id: systemId,
          name,
          type: 'text',
          description: null,
          sort_order: null,
          source_refs: [sourceRef('field_templates')],
          extensions: {},
        })
      }
      return id
    }

    let unreadableFields = 0

    for (const m of allMembers) {
      if (isTemplate(m)) continue
      const memberPp = idMap.get(nonEmpty(m.id) ?? '')
      if (!memberPp) continue

      // Free-text attributes with no core home become text fields.
      for (const [key, label] of MEMBER_TEXT_ATTRS) {
        const value = nonEmpty(m[key])
        if (!value) continue
        opCustomFieldValues.push({
          id: newUUID(),
          field_id: defineField(label),
          member_id: memberPp,
          value,
          source_refs: [sourceRef('members', nonEmpty(m.id))],
          extensions: {},
        })
      }

      // The sample's custom_fields arrays are all empty, so this is tolerant
      // by necessity. Anything that does not yield both a name and a value
      // is counted and reported rather than guessed at.
      if (!Array.isArray(m.custom_fields)) continue
      for (const raw of m.custom_fields) {
        if (!raw || typeof raw !== 'object') { unreadableFields += 1; continue }
        const row = raw as Record<string, unknown>
        let name: string | null = null
        for (const k of FIELD_NAME_KEYS) { name = nonEmpty(row[k]); if (name) break }
        let value: string | null = null
        for (const k of FIELD_VALUE_KEYS) { value = nonEmpty(row[k]); if (value) break }
        if (!name || !value) { unreadableFields += 1; continue }
        opCustomFieldValues.push({
          id: newUUID(),
          field_id: defineField(name),
          member_id: memberPp,
          value,
          source_refs: [sourceRef('members', nonEmpty(m.id))],
          extensions: {},
        })
      }
    }

    if (unreadableFields) {
      emit({
        level: 'warning',
        code: 'bt_custom_field_unreadable',
        count: unreadableFields,
        message:
          `${unreadableFields} custom field entr(ies) did not carry a name and a value in any shape ` +
          'we recognise, so they were not converted. Every sample we have has an empty custom_fields ' +
          'array, so this is a shape we have never seen. Please get in touch with your export.',
      })
    }
    cb.updateTask('custom_fields', { status: 'done', count: opCustomFields.length })
  }

  // --- Front history ------------------------------------------------------
  const opFrontPeriods: object[] = []

  if (has('fronting')) {
    cb.updateTask('fronting', { status: 'running' })
    let missingRef = 0
    let unresolved = 0
    let badTimestamp = 0
    let swapped = 0

    for (const f of coll<BtFrontEntry>(data, 'front_entries')) {
      // An entry names EITHER a member or a custom status. Both id fields
      // are looked up in the one map so a status mis-filed by `kind` still
      // resolves.
      const ref = nonEmpty(f.member_id) || nonEmpty(f.custom_status_id)
      if (!ref) { missingRef += 1; continue }
      const memberPp = idMap.get(ref)
      if (!memberPp) { unresolved += 1; continue }

      let started = btTime(f.started_at)
      if (!started) { badTimestamp += 1; continue }
      let ended = btTime(f.ended_at)

      // An interval that ends before it starts is reversed rather than
      // dropped: the two timestamps are still the real bounds of the period.
      if (ended && ended < started) {
        [started, ended] = [ended, started]
        swapped += 1
      }

      opFrontPeriods.push({
        id: newUUID(),
        system_id: systemId,
        member_id: memberPp,
        started_at: started,
        ended_at: ended,
        comment: frontComment(f, typeNames),
        source_refs: [sourceRef('front_entries', nonEmpty(f.id))],
        extensions: {},
      })
    }

    if (missingRef) {
      emit({ level: 'warning', code: 'bt_front_no_ref', count: missingRef,
        message: `${missingRef} front entr(ies) named neither a member nor a custom status and were skipped.` })
    }
    if (unresolved) {
      emit({ level: 'warning', code: 'bt_front_unresolved_ref', count: unresolved,
        message: `${unresolved} front entr(ies) referenced a member or status not present in the export and were skipped.` })
    }
    if (badTimestamp) {
      emit({ level: 'warning', code: 'bt_front_bad_timestamp', count: badTimestamp,
        message: `${badTimestamp} front entr(ies) had an unreadable start time and were skipped.` })
    }
    if (swapped) {
      emit({ level: 'info', code: 'bt_front_interval_swapped', count: swapped,
        message: `${swapped} front entr(ies) ended before they started; the interval was reversed.` })
    }
    cb.updateTask('fronting', { status: 'done', count: opFrontPeriods.length })
  }

  // --- What we deliberately did not map -----------------------------------
  const left = unsupportedSections(data)
  if (left.length) {
    const listed = left.map(s => `${s.count} ${s.name}`).join(', ')
    emit({
      level: 'warning',
      code: 'bt_sections_not_converted',
      count: left.reduce((a, s) => a + s.count, 0),
      message:
        `Left behind: ${listed}. BerryTree support is experimental: it maps members, custom fronts, ` +
        'fronting history and folders, because those are the only parts of the format we have been ' +
        'able to see a real example of. If you need any of the above, please get in touch and bring ' +
        'your export, because that is what lets us add it.',
    })
  }

  if (assets.uriOnly) {
    // Required by the spec whenever an asset carries only a `uri`.
    emit({
      level: 'warning',
      code: 'asset_uri_only',
      count: assets.uriOnly,
      message:
        `${assets.uriOnly} image(s) are referenced by URL rather than embedded, so the file is not ` +
        'self-contained. BerryTree\'s servers have been unreachable since around August 2026, so ' +
        'these URLs are unlikely to resolve.',
    })
  }
  if (avatarsDropped) {
    emit({
      level: 'warning',
      code: 'bt_avatar_unresolvable',
      count: avatarsDropped,
      message:
        `${avatarsDropped} avatar reference(s) were not absolute URLs, so they could not be carried ` +
        'as a resolvable reference and were dropped.',
    })
  }

  // --- Envelope -----------------------------------------------------------
  cb.updateTask('build', { status: 'running' })

  const capModules: string[] = ['systems']
  if (opMembers.length)             capModules.push('members')
  if (opGroups.length)              capModules.push('groups')
  if (opTaxonomyTerms.length)       capModules.push('taxonomy')
  if (opCustomFields.length)        capModules.push('custom_fields')
  if (opFrontPeriods.length)        capModules.push('front_periods')
  if (assets.assets.length)         capModules.push('assets')

  const envelope = {
    pluralport_version: PLURALPORT_VERSION,
    exported_at: new Date().toISOString(),
    // SPEC-OPEN(producer-exporter): producer.app is the *source* app, not this
    // tool, because source_refs and the extensions namespace both key off it.
    // The spec gives us producer.exporter_version but no slot naming which
    // converter produced the file, so our identity goes in extensions below.
    // If the spec gains producer.exporter/exporter_id, move it back up here.
    producer: {
      app: 'BerryTree',
      app_id: 'berrytree',
      app_version: typeof data.schema_version === 'number' ? `schema ${data.schema_version}` : 'unknown',
      exporter_version: EXPORTER_VERSION,
    },
    capabilities: { modules: capModules },

    systems:              [opSystem],
    members:              opMembers,
    groups:               opGroups,
    group_memberships:    opGroupMemberships,
    taxonomy_terms:       opTaxonomyTerms,
    taxonomy_assignments: opTaxonomyAssignments,
    custom_fields:        opCustomFields,
    custom_field_values:  opCustomFieldValues,
    front_periods:        opFrontPeriods,
    front_events:         [],
    front_comments:       [],
    notes:                [],
    assets:               assets.assets,

    chat:          null,
    boards:        null,
    relationships: null,
    polls:         null,

    // SPEC-OPEN(producer-exporter): see the producer note above.
    extensions: {
      [EXPORTER_NAMESPACE]: exporterExtension(),
      berrytree: {
        experimental: true,
        schema_version: data.schema_version ?? null,
        exported_at: nonEmpty(data.exported_at),
        sections_not_converted: left,
        template_members_held_back: templateCount(data),
        fronting_types: frontingTypes
          .map(t => nonEmpty(t.name))
          .filter((n): n is string => !!n),
      },
    },
    warnings,
  }

  const json = JSON.stringify(envelope, null, 2)
  cb.updateTask('build', { status: 'done', count: 1 })

  return { json, filename: pluralportFilename(opSystem.name) }
}

/** Only emit the namespace when it actually carries something, so a system
 *  with neither pronouns nor an emoji doesn't get an empty stub. */
function systemExtensions(pronouns: string | null, emoji: string | null) {
  const bt: Record<string, string> = {}
  if (pronouns) bt.pronouns = pronouns
  if (emoji) bt.emoji = emoji
  return Object.keys(bt).length ? { berrytree: bt } : {}
}

/** Front comment: the fronting type's name, BerryTree's own status text and
 *  any note, joined. v0.1 has no first-class fronting-type vocabulary, so
 *  the type name rides along here rather than being dropped. */
function frontComment(f: BtFrontEntry, typeNames: Map<string, string>): string | null {
  const parts = [
    typeNames.get(nonEmpty(f.fronting_type_id) ?? ''),
    nonEmpty(f.custom_status),
    nonEmpty(f.note),
  ].filter((p): p is string => !!p)
  return parts.length ? parts.join(' - ') : null
}

export const converter = defineConverter({
  sourceId: 'berrytree',
  destinationId: 'pluralport_v0.1',
  modules: ['members', 'custom_fronts', 'groups', 'tags', 'custom_fields', 'fronting'],
  inspect: (fileText) => {
    const data = parseBerrytree(fileText)
    return { label: systemLabel(data), counts: countBerrytree(data) }
  },
  run: runBerrytreeToPp,
})
