/**
 * PluralKit (and Octocon, and its forks) -> PluralPort v0.1.
 *
 * Octocon emits a PluralKit-shaped export, so it is read by this converter
 * rather than one of its own. The converter is built by a factory and
 * registered once per source name, so each file is labelled with the app it
 * actually came from while sharing one mapping.
 *
 * Fronting is the only non-trivial part. PK records point-in-time switch
 * events: each switch names the set fronting *after* it and supersedes the
 * one before. The spec says PK exporters should emit `front_events[]` and
 * may additionally derive `front_periods[]` for importers that need
 * durations, so this emits both: the events are the faithful record, the
 * periods are the convenience.
 *
 * Ported from the Sheaf reference implementation. Sheaf's import caps and
 * quota guards are deliberately not carried over: they exist because Sheaf
 * writes to a shared multi-tenant encrypted database, whereas this writes a
 * file on the visitor's own machine. Two places go further than Sheaf,
 * because PluralPort has a home for data Sheaf has no column for: proxy tags
 * land on Member.proxy_tags, and PK's fine-grained privacy map is preserved
 * whole in the Privacy fragment's `source` rather than collapsed away.
 */
import {
  countPluralkit,
  parsePluralkit,
  pkColor,
  pkBirthday,
  pkList,
  pkProxyTags,
  pkTime,
  pkVisibility,
  nonEmpty,
  systemLabel,
  type PkExport,
  type PkGroup,
  type PkMember,
  type PkSwitch,
} from '../pluralkit-client'
import { defineConverter, type Converter, type ConverterFn, type OPWarning, type TaskState } from './types'
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

/** Identifies which app a given registration reads for. */
interface SourceApp { sourceId: string; appName: string; appId: string }

/**
 * Avatars and banners are CDN URLs, so only a `uri` can be recorded: the
 * bytes are not in the export and this converter never fetches anything.
 * The spec requires an asset carrying only `uri` to emit `asset_uri_only`.
 *
 * Inlining these is worth doing later and is genuinely possible, since PK's
 * CDN and Discord's both send permissive CORS headers, but it belongs with
 * the queued zip-with-media output rather than bloating a single JSON with
 * base64.
 */
class AssetTable {
  private byUri = new Map<string, string>()
  readonly assets: object[] = []
  uriOnly = 0
  dropped = 0

  constructor(private readonly app: SourceApp) {}

  ref(raw: unknown, kind: string): string | null {
    const value = nonEmpty(raw)
    if (!value) return null
    if (!/^https?:\/\//i.test(value)) { this.dropped += 1; return null }

    const existing = this.byUri.get(value)
    if (existing) return existing

    const id = newUUID()
    this.assets.push({
      id,
      kind,
      mime_type: null,
      uri: value,
      data_uri: null,
      source_refs: [{ app: this.app.appId, collection: 'assets', id: null }],
      extensions: {},
    })
    this.byUri.set(value, id)
    this.uriOnly += 1
    return id
  }
}

function makeRun(app: SourceApp): ConverterFn {
  const sourceRef = (collection: string, id?: string | null) =>
    ({ app: app.appId, collection, id: id ?? null })

  return async (input, options, cb) => {
    const { selectedModules } = options
    const has = (m: string) => selectedModules.includes(m)

    const wantedTasks: TaskState[] = [
      { key: 'system', label: 'System profile', status: 'pending' },
    ]
    if (has('members'))  wantedTasks.push({ key: 'members',  label: 'Members',       status: 'pending' })
    if (has('groups'))   wantedTasks.push({ key: 'groups',   label: 'Groups',        status: 'pending' })
    if (has('fronting')) wantedTasks.push({ key: 'fronting', label: 'Switch History', status: 'pending' })
    if (has('images'))   wantedTasks.push({ key: 'images',   label: 'Images',        status: 'pending' })
    wantedTasks.push({ key: 'build', label: 'Building PluralPort file', status: 'pending' })
    cb.initTasks(wantedTasks)

    const warnings: OPWarning[] = []
    const emit = (w: OPWarning) => { warnings.push(w); cb.warning(w) }

    let data: PkExport
    try {
      data = parsePluralkit(input.fileText ?? '')
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      cb.updateTask('system', { status: 'error', note: msg })
      throw new Error(msg)
    }

    const assets = new AssetTable(app)
    const imagesEnabled = has('images')
    const img = (raw: unknown, kind: string) => (imagesEnabled ? assets.ref(raw, kind) : null)

    // --- System profile ---------------------------------------------------
    cb.updateTask('system', { status: 'running' })
    const systemId = newUUID()

    // Linked Discord accounts and similar app-specific data have no v0.1
    // core home. The spec lists a `proxy` optional module for account links
    // but does not define its record shape in v0.1, so inventing one would
    // be guessing. Namespaced extensions is where app-specific data belongs.
    const systemExtras: Record<string, unknown> = {}
    if (nonEmpty(data.id)) systemExtras.hid = nonEmpty(data.id)
    if (nonEmpty(data.uuid)) systemExtras.uuid = nonEmpty(data.uuid)
    if (Array.isArray(data.accounts) && data.accounts.length) {
      systemExtras.accounts = data.accounts
    }

    const opSystem = {
      id: systemId,
      name: nonEmpty(data.name) || nonEmpty(data.id) || 'System',
      display_name: null,
      description: nonEmpty(data.description),
      tag: nonEmpty(data.tag),
      color: pkColor(data.color),
      avatar_asset_id: img(data.avatar_url, 'avatar'),
      banner_asset_id: img(data.banner, 'banner'),
      parent_system_id: null,
      archived: false,
      privacy: { visibility: pkVisibility(data.privacy), source: data.privacy ?? {} },
      settings: {},
      source_refs: [sourceRef('system', nonEmpty(data.id))],
      extensions: {
        [app.appId]: {
          ...systemExtras,
          // v0.1 System has no pronouns field.
          ...(nonEmpty(data.pronouns) ? { pronouns: nonEmpty(data.pronouns) } : {}),
        },
      },
    }
    cb.updateTask('system', { status: 'done', count: 1 })

    // --- Members ----------------------------------------------------------
    // Keyed by HID, because that is what groups and switches reference.
    const hidToId = new Map<string, string>()
    const opMembers: object[] = []
    let missingHid = 0

    if (has('members')) {
      cb.updateTask('members', { status: 'running' })
      for (const m of pkList<PkMember>(data, 'members')) {
        const hid = nonEmpty(m.id)
        const ppId = newUUID()
        if (hid) hidToId.set(hid, ppId)
        else missingHid += 1

        opMembers.push({
          id: ppId,
          system_id: systemId,
          name: nonEmpty(m.name),
          display_name: nonEmpty(m.display_name),
          pronouns: nonEmpty(m.pronouns),
          description: nonEmpty(m.description),
          age: null,
          birthday: pkBirthday(m.birthday),
          color: pkColor(m.color),
          avatar_asset_id: img(m.avatar_url, 'avatar'),
          banner_asset_id: img(m.banner, 'banner'),
          // Core to a proxy bot, and PluralPort has a field for it even
          // though Sheaf, which this mapping is ported from, does not.
          proxy_tags: pkProxyTags(m.proxy_tags),
          is_custom_front: false,
          archived: false,
          created_at: pkTime(m.created),
          sort_order: null,
          privacy: { visibility: pkVisibility(m.privacy), source: m.privacy ?? {} },
          source_refs: [sourceRef('members', hid)],
          extensions: {
            [app.appId]: {
              ...(hid ? { hid } : {}),
              ...(nonEmpty(m.uuid) ? { uuid: nonEmpty(m.uuid) } : {}),
              ...(typeof m.keep_proxy === 'boolean' ? { keep_proxy: m.keep_proxy } : {}),
              ...(nonEmpty(m.webhook_avatar_url) ? { webhook_avatar_url: nonEmpty(m.webhook_avatar_url) } : {}),
            },
          },
        })
      }
      if (missingHid) {
        emit({
          level: 'warning',
          code: 'pk_member_missing_hid',
          count: missingHid,
          message:
            `${missingHid} member(s) had no id, so anything referencing them (group membership, ` +
            'switches) could not be linked to them.',
        })
      }
      cb.updateTask('members', { status: 'done', count: opMembers.length })
    }

    // --- Groups -----------------------------------------------------------
    const opGroups: object[] = []
    const opGroupMemberships: object[] = []
    let unresolvedGroupMembers = 0

    if (has('groups')) {
      cb.updateTask('groups', { status: 'running' })
      for (const g of pkList<PkGroup>(data, 'groups')) {
        const hid = nonEmpty(g.id)
        const groupId = newUUID()
        opGroups.push({
          id: groupId,
          system_id: systemId,
          name: nonEmpty(g.name) ?? 'Unnamed Group',
          description: nonEmpty(g.description),
          color: pkColor(g.color),
          emoji: null,
          // PluralKit groups do not nest.
          parent_group_id: null,
          sort_order: null,
          source_refs: [sourceRef('groups', hid)],
          extensions: {
            [app.appId]: {
              ...(hid ? { hid } : {}),
              ...(nonEmpty(g.uuid) ? { uuid: nonEmpty(g.uuid) } : {}),
              ...(nonEmpty(g.display_name) ? { display_name: nonEmpty(g.display_name) } : {}),
              ...(nonEmpty(g.icon) ? { icon: nonEmpty(g.icon) } : {}),
            },
          },
        })

        for (const memberHid of Array.isArray(g.members) ? g.members : []) {
          const memberPp = hidToId.get(nonEmpty(memberHid) ?? '')
          if (!memberPp) { unresolvedGroupMembers += 1; continue }
          opGroupMemberships.push({
            id: newUUID(),
            group_id: groupId,
            member_id: memberPp,
            source_refs: [sourceRef('groups', hid)],
            extensions: {},
          })
        }
      }
      if (unresolvedGroupMembers) {
        emit({
          level: 'warning',
          code: 'pk_group_member_unresolved',
          count: unresolvedGroupMembers,
          message:
            `${unresolvedGroupMembers} group membership(s) referenced a member not present in the ` +
            'export and were skipped. This is expected if you did not export every member.',
        })
      }
      cb.updateTask('groups', { status: 'done', count: opGroups.length })
    }

    // --- Switches -> front events, and derived periods ---------------------
    const opFrontEvents: object[] = []
    const opFrontPeriods: object[] = []

    if (has('fronting')) {
      cb.updateTask('fronting', { status: 'running' })
      let badTimestamp = 0
      let unresolvedFronters = 0

      // PK writes switches newest-first; the period derivation needs them
      // oldest-first, and sorting by timestamp is safer than trusting order.
      const switches = pkList<PkSwitch>(data, 'switches')
        .map(s => ({ raw: s, at: pkTime(s.timestamp) }))
        .filter(s => {
          if (!s.at) { badTimestamp += 1; return false }
          return true
        })
        .sort((a, b) => (a.at! < b.at! ? -1 : a.at! > b.at! ? 1 : 0))

      // One open period at a time: each switch closes the previous and, if
      // anyone is fronting after it, opens the next. An empty member set is
      // PK's switch-out, which closes without opening.
      let open: { started_at: string; assignments: object[] } | null = null
      const closePeriod = (endedAt: string | null) => {
        if (!open) return
        opFrontPeriods.push({
          id: newUUID(),
          system_id: systemId,
          started_at: open.started_at,
          ended_at: endedAt,
          assignments: open.assignments,
          status: null,
          note: null,
          // Derived from a pair of switch events rather than stored as an
          // interval by the source app.
          source_kind: 'event_pair',
          source_refs: [sourceRef('switches')],
          extensions: {},
        })
        open = null
      }

      for (const { raw, at } of switches) {
        const hids = Array.isArray(raw.members) ? raw.members : []
        const assignments: object[] = []
        for (const hid of hids) {
          const memberPp = hidToId.get(nonEmpty(hid) ?? '')
          if (!memberPp) { unresolvedFronters += 1; continue }
          assignments.push({
            member_id: memberPp,
            // PK has flat co-fronting with no tiers, which the spec says to
            // record as "member".
            front_role: 'member',
            note: null,
            source_refs: [sourceRef('switches', nonEmpty(raw.id))],
          })
        }

        opFrontEvents.push({
          id: newUUID(),
          system_id: systemId,
          at: at!,
          assignments,
          note: null,
          source_refs: [sourceRef('switches', nonEmpty(raw.id))],
          extensions: {},
        })

        closePeriod(at!)
        if (assignments.length) open = { started_at: at!, assignments }
      }
      // Whoever is fronting at the end of the log still is: null ended_at.
      closePeriod(null)

      if (badTimestamp) {
        emit({
          level: 'warning',
          code: 'pk_switch_bad_timestamp',
          count: badTimestamp,
          message: `${badTimestamp} switch(es) had an unreadable timestamp and were skipped.`,
        })
      }
      if (unresolvedFronters) {
        emit({
          level: 'warning',
          code: 'pk_switch_member_unresolved',
          count: unresolvedFronters,
          message:
            `${unresolvedFronters} switch entr(ies) referenced a member not present in the export. ` +
            'The switch was kept, without that member.',
        })
      }
      cb.updateTask('fronting', { status: 'done', count: opFrontEvents.length })
    }

    if (imagesEnabled) {
      cb.updateTask('images', { status: 'done', count: assets.assets.length })
    }

    if (assets.uriOnly) {
      emit({
        level: 'warning',
        code: 'asset_uri_only',
        count: assets.uriOnly,
        message:
          `${assets.uriOnly} image(s) are referenced by URL rather than embedded, so the file is not ` +
          'self-contained. They stay readable only while the hosting CDN keeps serving them, so ' +
          'keep your original export too.',
      })
    }
    if (assets.dropped) {
      emit({
        level: 'warning',
        code: 'pk_image_unresolvable',
        count: assets.dropped,
        message: `${assets.dropped} image reference(s) were not absolute URLs and were dropped.`,
      })
    }

    // --- Envelope ---------------------------------------------------------
    cb.updateTask('build', { status: 'running' })

    const capModules: string[] = ['systems']
    if (opMembers.length)      capModules.push('members')
    if (opGroups.length)       capModules.push('groups')
    if (opFrontEvents.length)  capModules.push('front_events')
    if (opFrontPeriods.length) capModules.push('front_periods')
    if (assets.assets.length)  capModules.push('assets')

    const envelope = {
      pluralport_version: PLURALPORT_VERSION,
      exported_at: new Date().toISOString(),
      // SPEC-OPEN(producer-exporter): producer.app is the *source* app, not this
      // tool, because source_refs and the extensions namespace both key off it.
      // The spec gives us producer.exporter_version but no slot naming which
      // converter produced the file, so our identity goes in extensions below.
      // If the spec gains producer.exporter/exporter_id, move it back up here.
      producer: {
        app: app.appName,
        app_id: app.appId,
        app_version: typeof data.version === 'number' ? `export v${data.version}` : 'unknown',
        exporter_version: EXPORTER_VERSION,
      },
      capabilities: { modules: capModules },

      systems:              [opSystem],
      members:              opMembers,
      groups:               opGroups,
      group_memberships:    opGroupMemberships,
      taxonomy_terms:       [],
      taxonomy_assignments: [],
      custom_fields:        [],
      custom_field_values:  [],
      front_periods:        opFrontPeriods,
      front_events:         opFrontEvents,
      front_comments:       [],
      notes:                [],
      assets:               assets.assets,

      chat:          null,
      boards:        null,
      relationships: null,
      polls:         null,

      // SPEC-OPEN(producer-exporter): see the producer note above.
      extensions: { [EXPORTER_NAMESPACE]: exporterExtension() },
      warnings,
    }

    const json = JSON.stringify(envelope, null, 2)
    cb.updateTask('build', { status: 'done', count: 1 })

    return { json, filename: pluralportFilename(opSystem.name) }
  }
}

function makeConverter(app: SourceApp): Converter {
  return defineConverter({
    sourceId: app.sourceId,
    destinationId: 'pluralport_v0.1',
    modules: ['members', 'groups', 'fronting', 'images'],
    inspect: (fileText) => {
      const data = parsePluralkit(fileText)
      return { label: systemLabel(data), counts: countPluralkit(data) }
    },
    run: makeRun(app),
  })
}

export const pluralkitConverter = makeConverter({
  sourceId: 'pluralkit', appName: 'PluralKit', appId: 'pluralkit',
})

/** Octocon emits a PluralKit-shaped export, so it shares the mapping. The
 *  file is still labelled as Octocon's, because the HIDs in `source_refs`
 *  are Octocon's and a round-trip needs to know that. */
export const octoconConverter = makeConverter({
  sourceId: 'octocon', appName: 'Octocon', appId: 'octocon',
})
