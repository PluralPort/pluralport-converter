/**
 * BerryTree export parsing + validation.
 *
 * BerryTree exports are a single JSON object with one key per section,
 * written whether or not the section has rows. That makes the feature
 * surface easy to enumerate from one file, which matters here because we
 * have very little else to go on.
 *
 * EXPERIMENTAL, and deliberately narrow. The format was derived from a
 * single synthetic export with most sections empty, from an app that has
 * been pulled from Google Play with its server unreachable since roughly
 * August 2026, so there is no way to generate more samples, plus analysis
 * of the last public Android client (1.0.16), which settles how the app
 * reads and writes several fields the sample left empty. We map only the
 * sections that sample actually demonstrates:
 *
 *     members, custom_statuses, front_entries, folders, and the system
 *     profile (account settings first, then the main system_context)
 *
 * What the client analysis settled, for the parsing below:
 *   - member `tags` are plain strings;
 *   - member `custom_fields` are inline `{label, value, type?, template_id?}`;
 *   - image fields hold a base64 `data:` URI (what the editor submits), a
 *     URL on BerryTree's public image bucket (`https://pub-<id>.r2.dev/`),
 *     or another external URL;
 *   - older versions recorded a front's fronting type as `custom_status_id`
 *     pointing at a `kind: "type"` row, not as `fronting_type_id`.
 * The tolerant parsing of other shapes stays, because the export is written
 * by the server and can differ from what the client sends.
 *
 * Everything else is COUNTED and REPORTED, never guessed at. An export
 * carrying 400 journal entries produces a warning naming the number and
 * asking the user to get in touch, which is a bug report with a data sample
 * attached. Guessing at `journal[]`'s field names would instead produce a
 * clean-looking conversion that silently dropped them, which is the failure
 * mode that is worst for the user and invisible to us.
 *
 * Ported from the reference implementation in Sheaf. The record mapping
 * lives in `converters/berrytree-to-pp.ts`.
 */

/** The `schema_version` we have actually seen. Anything else still converts,
 *  but earns a warning, since our field knowledge may not apply. */
export const KNOWN_SCHEMA_VERSION = 3

export interface BtMember {
  id?: string
  name?: string
  display_name?: string
  pronouns?: string
  description?: string
  color?: string
  emoji?: string
  avatar?: string
  has_avatar?: boolean
  banner?: string
  is_private?: boolean
  is_template?: boolean
  archived?: boolean
  /** False marks a roster entry that does not count as a person, which is
   *  the custom-front pattern. */
  counts_toward_headcount?: boolean
  role?: string
  mood?: string
  tags?: unknown
  custom_fields?: unknown
  folder_ids?: unknown
  folder_id?: string
  created_at?: string
  [k: string]: unknown
}

/** One row of `custom_statuses`, which holds two different kinds of thing.
 *  See {@link splitCustomStatuses}. */
export interface BtCustomStatus {
  id?: string
  kind?: string
  name?: string
  description?: string
  color?: string
  avatar?: string
  image_url?: string
  [k: string]: unknown
}

export interface BtFrontEntry {
  id?: string
  member_id?: string
  custom_status_id?: string
  fronting_type_id?: string
  custom_status?: string
  note?: string
  started_at?: string
  ended_at?: string | null
  [k: string]: unknown
}

export interface BtFolder {
  id?: string
  name?: string
  description?: string
  color?: string
  parent_id?: string
  [k: string]: unknown
}

export interface BtSystemContext {
  id?: string
  kind?: string
  name?: string
  description?: string
  avatar?: string
  color?: string
  tag?: string
  pronouns?: string
  [k: string]: unknown
}

/** Account settings. The app edits the system profile here, as
 *  `system_description`, `system_avatar`, `system_banner`, `system_tags`,
 *  `system_status` and `system_custom_fields`. */
export interface BtUserSettings {
  [k: string]: unknown
}

export interface BtExport {
  app?: unknown
  schema_version?: number
  exported_at?: string
  system?: { username?: string; system_name?: string; [k: string]: unknown }
  user_settings?: BtUserSettings
  members?: BtMember[]
  front_entries?: BtFrontEntry[]
  custom_statuses?: BtCustomStatus[]
  folders?: BtFolder[]
  system_contexts?: BtSystemContext[]
  _partial_errors?: unknown
  [k: string]: unknown
}

/**
 * Sections BerryTree writes that this converter does not map, with the label
 * used when reporting how many records were left behind. Order is report
 * order.
 */
export const UNSUPPORTED_SECTIONS: readonly (readonly [string, string])[] = [
  ['journal', 'journal entries'],
  ['notes', 'notes'],
  ['chat', 'chat messages'],
  ['polls', 'polls'],
  ['reminders', 'reminders'],
  ['relationships', 'member relationships'],
  ['cross_system_relationships', 'cross-system relationships'],
  ['external_contacts', 'external contacts'],
  ['external_relationships', 'external relationships'],
  ['sub_systems', 'subsystems'],
  ['places', 'places'],
  ['map_nodes', 'map nodes'],
  ['privacy_buckets', 'privacy buckets'],
  ['useful_links', 'useful links'],
] as const

/** Free-text member attributes with no PluralPort core home. They become
 *  custom fields rather than being dropped: a text field named "Role"
 *  holding "the one who drives" is a faithful enough home. */
export const MEMBER_TEXT_ATTRS: readonly (readonly [string, string])[] = [
  ['role', 'Role'],
  ['mood', 'Mood'],
] as const

/** Keys a BerryTree custom-field entry might carry its name/value under. The
 *  app writes `label` and `value`; the other keys stay because the export
 *  is a server-side dump we have never seen populated. Anything yielding
 *  neither is counted, not guessed at. */
export const FIELD_NAME_KEYS = ['name', 'label', 'title', 'key'] as const
export const FIELD_VALUE_KEYS = ['value', 'text', 'content'] as const

export function coll<T = Record<string, unknown>>(data: BtExport, name: string): T[] {
  const raw = (data as Record<string, unknown>)[name]
  return Array.isArray(raw) ? (raw.filter(r => r && typeof r === 'object') as T[]) : []
}

/** Row count of a section, whether or not we can map it. */
export function sectionLen(data: BtExport, name: string): number {
  const raw = (data as Record<string, unknown>)[name]
  return Array.isArray(raw) ? raw.length : 0
}

export function nonEmpty(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const s = value.trim()
  return s ? s : null
}

/**
 * Normalise a colour to '#rrggbb', or null. BerryTree writes 6-hex with a
 * leading '#'; 3-hex shorthand and 8-hex ARGB are accepted too so a
 * hand-edited or older file lands a usable colour instead of a mangled one.
 */
export function btColor(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  let s = raw.trim().replace(/^#/, '')
  if (s.length === 3) s = s.split('').map(c => c + c).join('')
  else if (s.length === 8) s = s.slice(2) // ARGB, drop the alpha high byte
  if (s.length !== 6 || !/^[0-9a-fA-F]{6}$/.test(s)) return null
  return `#${s.toLowerCase()}`
}

/** Validate and re-serialise a BerryTree timestamp, or null. */
export function btTime(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw.trim()) return null
  const ms = Date.parse(raw)
  return Number.isNaN(ms) ? null : new Date(ms).toISOString()
}

export function isTemplate(m: BtMember): boolean {
  return m.is_template === true
}

/** Tag names off a member row. The app stores plain strings; objects naming
 *  a tag are still accepted, since no populated export has been seen. */
export function memberTagNames(m: BtMember): string[] {
  if (!Array.isArray(m.tags)) return []
  const out: string[] = []
  for (const entry of m.tags) {
    let name: string | null = null
    if (typeof entry === 'string') {
      name = nonEmpty(entry)
    } else if (entry && typeof entry === 'object') {
      const row = entry as Record<string, unknown>
      for (const k of FIELD_NAME_KEYS) {
        name = nonEmpty(row[k])
        if (name) break
      }
    }
    if (name) out.push(name)
  }
  return out
}

/** Folder ids a member belongs to, across both keys BerryTree writes
 *  (`folder_ids` plural, and the older singular `folder_id`). */
export function memberFolderIds(m: BtMember): string[] {
  const ids: string[] = []
  if (Array.isArray(m.folder_ids)) {
    for (const f of m.folder_ids) {
      const id = nonEmpty(f)
      if (id && !ids.includes(id)) ids.push(id)
    }
  }
  const single = nonEmpty(m.folder_id)
  if (single && !ids.includes(single)) ids.push(single)
  return ids
}

/**
 * The main `system_contexts` row. Carries a profile (name, description,
 * avatar, colour, tag, pronouns), but see {@link profileValue} for why it is
 * the fallback source for the fields the app edits rather than the first one.
 */
export function mainContext(data: BtExport): BtSystemContext {
  const contexts = coll<BtSystemContext>(data, 'system_contexts')
  return contexts.find(c => c.kind === 'main') ?? contexts[0] ?? {}
}

export function userSettings(data: BtExport): BtUserSettings {
  const raw = data.user_settings
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
}

/**
 * One system-profile field, from wherever the user actually edited it.
 *
 * BerryTree keeps a system profile in two places. The last public Android
 * client (1.0.16) reads and writes it only as account settings
 * (`user_settings.system_description`, `.system_avatar`, ...), and never
 * references `system_contexts` at all; the main context is a server-side
 * model that the one export we have shows holding defaults written at
 * signup. So an edit made in the app lands in `user_settings`, and the
 * context is the fallback for a file where that is empty.
 */
export function profileValue(data: BtExport, settingsKey: string, contextKey: string): string | null {
  return nonEmpty(userSettings(data)[settingsKey]) ?? nonEmpty(mainContext(data)[contextKey])
}

/** System name: the top-level `system_name` (which the app edits directly),
 *  else the main context's name, else the account `username`. */
export function systemName(data: BtExport): string | null {
  return (
    nonEmpty(data.system?.system_name) ??
    nonEmpty(mainContext(data).name) ??
    nonEmpty(data.system?.username)
  )
}

/**
 * Split `custom_statuses` into [fronting types, custom fronts].
 *
 * BerryTree keeps two different things in one array, discriminated by
 * `kind`: "type" rows are fronting types ("Co-conscious", "Blurry") that
 * annotate a front entry, and "status" rows are standalone fronting entities
 * ("Asleep") that front with no member attached, which is the custom-front
 * pattern. Treating them as one list produces a roster full of things that
 * are not members. An unrecognised `kind` is treated as a custom front,
 * because surfacing it as a row the user can delete beats it vanishing.
 */
export function splitCustomStatuses(data: BtExport): [BtCustomStatus[], BtCustomStatus[]] {
  const types: BtCustomStatus[] = []
  const fronts: BtCustomStatus[] = []
  for (const row of coll<BtCustomStatus>(data, 'custom_statuses')) {
    if (row.kind === 'type') types.push(row)
    else fronts.push(row)
  }
  return [types, fronts]
}

export interface UnsupportedSection { name: string; count: number }

/**
 * Non-empty sections this converter cannot map, in report order.
 *
 * Extra system contexts and layers are reported past the first of each:
 * every export has a main context and a default layer, so those carry no
 * information, but a second one means the user has structure (BerryTree's
 * multi-context / layered roster model) that v0.1 has no equivalent for.
 */
export function unsupportedSections(data: BtExport): UnsupportedSection[] {
  const out: UnsupportedSection[] = []
  for (const [key, label] of UNSUPPORTED_SECTIONS) {
    const count = sectionLen(data, key)
    if (count > 0) out.push({ name: label, count })
  }
  const extraContexts = Math.max(0, sectionLen(data, 'system_contexts') - 1)
  if (extraContexts) out.push({ name: 'extra system contexts', count: extraContexts })
  const extraLayers = Math.max(0, sectionLen(data, 'layers') - 1)
  if (extraLayers) out.push({ name: 'layers', count: extraLayers })
  return out
}

/**
 * BerryTree's own record of sections its exporter could not write. A file
 * carrying these was already incomplete when it was written.
 *
 * Capped in count and length: this is untrusted text sized by whoever made
 * the file. These strings are written by the exporter *about a record that
 * failed*, so they can quote member content. They may be shown to the person
 * holding the file and may go into that person's own output, but they must
 * never reach a shareable diagnostics report.
 */
export function exportErrors(data: BtExport): string[] {
  const raw = data._partial_errors
  if (!Array.isArray(raw)) return []
  const out: string[] = []
  for (const entry of raw.slice(0, 20)) {
    const text = nonEmpty(entry)
    if (text) out.push(text.slice(0, 200))
  }
  return out
}

export function parseBerrytree(text: string): BtExport {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error("That file isn't valid JSON. Pick the .json export BerryTree wrote.")
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('That JSON file is not a BerryTree export (expected an object at the top level).')
  }

  const obj = data as BtExport
  // The exporter writes a key per section, so a real export has these even
  // when empty. Requiring one of them keeps a different app's export from
  // being half-converted into nonsense.
  const looksLikeBt =
    'schema_version' in obj ||
    'front_entries' in obj ||
    'custom_statuses' in obj ||
    'system_contexts' in obj
  if (!looksLikeBt) {
    throw new Error('That JSON file does not look like a BerryTree export (no recognisable sections).')
  }
  return obj
}

/** Display name for the configure step. Same precedence as the
 *  converted system's name, see {@link systemName}. */
export function systemLabel(data: BtExport): string {
  return systemName(data) ?? 'BerryTree system'
}

/** A `data:` URI, the image BerryTree's editor stores inline. Cheap prefix
 *  check for counting; the converter validates the payload itself. */
export function isEmbeddedImage(value: unknown): boolean {
  return typeof value === 'string' && /^data:/i.test(value.trim())
}

/** Embedded images across the system profile, members and custom statuses:
 *  what the images module would carry. */
export function embeddedImageCount(data: BtExport): number {
  const [, customFronts] = splitCustomStatuses(data)
  const values: unknown[] = [
    profileValue(data, 'system_avatar', 'avatar'),
    profileValue(data, 'system_banner', 'banner'),
  ]
  for (const m of coll<BtMember>(data, 'members')) {
    if (!isTemplate(m)) values.push(m.avatar, m.banner)
  }
  for (const s of customFronts) values.push(s.avatar ?? s.image_url)
  return values.filter(isEmbeddedImage).length
}

/** Per-module counts for the configure step. Templates are excluded from the
 *  member count since they are excluded from conversion by default. */
export function countBerrytree(data: BtExport): Record<string, number> {
  const members = coll<BtMember>(data, 'members')
  const [, customFronts] = splitCustomStatuses(data)
  const headcount = members.filter(m => !isTemplate(m) && m.counts_toward_headcount !== false)
  const rosterFronts = members.filter(m => !isTemplate(m) && m.counts_toward_headcount === false)

  const tagNames = new Set<string>()
  for (const m of members) for (const t of memberTagNames(m)) tagNames.add(t)

  let fieldCount = 0
  for (const m of members) {
    if (Array.isArray(m.custom_fields)) fieldCount += m.custom_fields.length
  }
  for (const [key] of MEMBER_TEXT_ATTRS) {
    if (members.some(m => nonEmpty(m[key]))) fieldCount += 1
  }

  return {
    members: headcount.length,
    custom_fronts: customFronts.length + rosterFronts.length,
    fronting: sectionLen(data, 'front_entries'),
    groups: sectionLen(data, 'folders'),
    tags: tagNames.size,
    custom_fields: fieldCount,
    images: embeddedImageCount(data),
  }
}

/** Members flagged as templates: scaffolding for making new members, not
 *  people. Counted so the UI can say how many were held back. */
export function templateCount(data: BtExport): number {
  return coll<BtMember>(data, 'members').filter(isTemplate).length
}
