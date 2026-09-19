/**
 * Ampersand export parsing + validation.
 *
 * Ampersand (https://codeberg.org/Ampersand/app) exports a single
 * `{ revision, config, database }` JSON document; `database` is an object
 * of per-table arrays. This is the file-source analogue of `sp-client.ts`:
 * it turns an uploaded file into a validated object, pulls out a display
 * name, and produces the per-module counts the configure step shows.
 *
 * The actual record mapping lives in `converters/ampersand-to-op.ts`.
 */

export interface AmpSystem {
  uuid?: string
  name?: string
  description?: string
  color?: string
  parent?: string
  isArchived?: boolean
  isPinned?: boolean
  viewInLists?: boolean
  image?: string
  nameStyle?: unknown
  [k: string]: unknown
}

export interface AmpMember {
  uuid?: string
  name?: string
  system?: string
  pronouns?: string
  description?: string
  color?: string
  age?: number | string
  role?: string
  isArchived?: boolean
  isPinned?: boolean
  isCustomFront?: boolean
  dateCreated?: string
  image?: string
  tags?: string[]
  customFields?: Record<string, unknown>
  [k: string]: unknown
}

export interface AmpFrontingEntry {
  uuid?: string
  member?: string
  startTime?: string
  endTime?: string | null
  isMainFronter?: boolean
  isLocked?: boolean
  customStatus?: string
  [k: string]: unknown
}

export interface AmpTag {
  uuid?: string
  name?: string
  type?: string
  color?: string
  description?: string
  isArchived?: boolean
  [k: string]: unknown
}

export interface AmpCustomField {
  uuid?: string
  name?: string
  priority?: number
  default?: boolean
  [k: string]: unknown
}

export interface AmpJournalPost {
  uuid?: string
  title?: string
  subtitle?: string
  body?: string
  members?: string[]
  tags?: string[]
  date?: string
  isPrivate?: boolean
  isPinned?: boolean
  contentWarning?: string
  cover?: string
  [k: string]: unknown
}

export interface AmpNote {
  uuid?: string
  title?: string
  content?: string
  priority?: number
  isArchived?: boolean
  [k: string]: unknown
}

export interface AmpPollEntry {
  choice?: string
  votes?: { member?: string; reason?: string }[]
}

export interface AmpBoardMessage {
  uuid?: string
  title?: string
  body?: string
  members?: string[]
  date?: string
  isPinned?: boolean
  isArchived?: boolean
  poll?: { multipleChoice?: boolean; entries?: AmpPollEntry[] }
  comments?: { date?: string; comment?: string; member?: string }[]
  [k: string]: unknown
}

export interface AmpReminder {
  uuid?: string
  title?: string
  message?: string
  trigger?: string
  delay?: number
  active?: boolean
  members?: string[]
  [k: string]: unknown
}

export interface AmpAsset {
  uuid?: string
  friendlyName?: string
  file?: string
  tags?: string[]
  [k: string]: unknown
}

export interface AmpDatabase {
  systems?: AmpSystem[]
  members?: AmpMember[]
  frontingEntries?: AmpFrontingEntry[]
  tags?: AmpTag[]
  customFields?: AmpCustomField[]
  journalPosts?: AmpJournalPost[]
  notes?: AmpNote[]
  boardMessages?: AmpBoardMessage[]
  reminders?: AmpReminder[]
  assets?: AmpAsset[]
  filterQueries?: unknown[]
  [k: string]: unknown
}

export interface AmpExport {
  revision?: { count?: number; humanReadable?: string }
  config?: Record<string, unknown>
  database?: AmpDatabase
  [k: string]: unknown
}

/** A database collection as an array of object rows; missing -> []. */
export function coll<T = Record<string, unknown>>(data: AmpExport, name: keyof AmpDatabase): T[] {
  const raw = data.database?.[name]
  if (Array.isArray(raw)) return raw.filter(r => r && typeof r === 'object') as T[]
  return []
}

/**
 * Parse + validate an uploaded Ampersand export. Throws a user-facing
 * Error if the text isn't JSON or doesn't look like an Ampersand export.
 */
export function parseAmpersand(text: string): AmpExport {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error("That file isn't valid JSON. Make sure it's an unedited Ampersand export.")
  }
  if (!data || typeof data !== 'object') {
    throw new Error("That doesn't look like an Ampersand export.")
  }
  const exp = data as AmpExport
  if (!exp.database || typeof exp.database !== 'object' || Array.isArray(exp.database)) {
    throw new Error(
      "That doesn't look like an Ampersand export (no `database` section). " +
      "Export from Ampersand via Settings -> Import & export -> Export.",
    )
  }
  if (!Array.isArray(exp.database.members) && !Array.isArray(exp.database.systems)) {
    throw new Error('That Ampersand export has no members or systems to convert.')
  }
  return exp
}

/**
 * A display name for the "Connected as" line: the configured default
 * system's name, falling back to the first system, then a generic label.
 */
export function systemLabel(data: AmpExport): string {
  const systems = coll<AmpSystem>(data, 'systems')
  const appConfig = (data.config as { appConfig?: { defaultSystem?: string } } | undefined)?.appConfig
  const defaultId = appConfig?.defaultSystem
  const def = systems.find(s => s.uuid === defaultId)
  const name = (def?.name ?? systems[0]?.name ?? '').trim()
  return name || 'Ampersand system'
}

/** Number of board messages carrying a poll (the PluralPort poll count). */
export function pollCount(data: AmpExport): number {
  return coll<AmpBoardMessage>(data, 'boardMessages').filter(b => b.poll && typeof b.poll === 'object').length
}

/** Inline base64 images across members, systems, journal covers, and assets. */
export function imageCount(data: AmpExport): number {
  const hasImg = (v: unknown) => typeof v === 'string' && v.startsWith('data:')
  let n = 0
  for (const m of coll<AmpMember>(data, 'members')) if (hasImg(m.image)) n++
  for (const s of coll<AmpSystem>(data, 'systems')) if (hasImg(s.image)) n++
  for (const j of coll<AmpJournalPost>(data, 'journalPosts')) if (hasImg(j.cover)) n++
  for (const a of coll<AmpAsset>(data, 'assets')) if (hasImg(a.file)) n++
  return n
}

/** Per-module counts for the configure step, computed locally (no network). */
export function countAmpersand(data: AmpExport): Record<string, number> {
  const members = coll<AmpMember>(data, 'members')
  const realMembers = members.filter(m => !m.isCustomFront)
  const customFronts = members.filter(m => m.isCustomFront)
  const memberTags = coll<AmpTag>(data, 'tags').filter(t => t.type === 'member')
  return {
    members: realMembers.length,
    custom_fronts: customFronts.length,
    fronting: coll(data, 'frontingEntries').length,
    notes: coll(data, 'journalPosts').length + coll(data, 'notes').length,
    tags: memberTags.length,
    custom_fields: coll(data, 'customFields').length,
    boards: coll(data, 'boardMessages').length,
    polls: pollCount(data),
    images: imageCount(data),
  }
}
