/**
 * PluralKit export parsing + validation.
 *
 * PK exports are a single JSON document at the system level: the system
 * profile at the top, then `members`, `groups` and `switches`. Members and
 * groups are keyed by PK's short human-ID ("HID"), and a group's `members`
 * array holds HIDs rather than nested objects.
 *
 * **Octocon and its forks emit the same shape**, which is why they are read
 * by this module rather than one of their own. Anything Octocon-specific
 * would be a difference in the values, not the structure, so the parsing
 * stays tolerant and the converter is registered once per source name.
 *
 * The record mapping lives in `converters/pluralkit-to-pp.ts`.
 */

export interface PkProxyTag {
  prefix?: string | null
  suffix?: string | null
  [k: string]: unknown
}

/** PK's fine-grained privacy map. `visibility` is the member-level flag;
 *  the rest are per-field and end in `_privacy`. */
export interface PkPrivacy {
  visibility?: string
  [k: string]: unknown
}

export interface PkMember {
  /** Short human ID. Group membership and switches reference this. */
  id?: string
  uuid?: string
  name?: string
  display_name?: string
  description?: string
  pronouns?: string
  color?: string
  birthday?: string
  avatar_url?: string
  webhook_avatar_url?: string
  banner?: string
  created?: string
  proxy_tags?: PkProxyTag[]
  keep_proxy?: boolean
  privacy?: PkPrivacy
  [k: string]: unknown
}

export interface PkGroup {
  id?: string
  uuid?: string
  name?: string
  display_name?: string
  description?: string
  icon?: string
  banner?: string
  color?: string
  created?: string
  /** Member HIDs. PK groups do not nest, so there is no parent field. */
  members?: string[]
  privacy?: PkPrivacy
  [k: string]: unknown
}

/** A point-in-time switch. `members` is the set fronting *after* it, and may
 *  be empty, which is PK's switch-out. */
export interface PkSwitch {
  id?: string
  timestamp?: string
  members?: string[]
  [k: string]: unknown
}

export interface PkExport {
  version?: number
  id?: string
  uuid?: string
  name?: string
  description?: string
  tag?: string
  pronouns?: string
  avatar_url?: string
  banner?: string
  color?: string
  created?: string
  privacy?: PkPrivacy
  members?: PkMember[]
  groups?: PkGroup[]
  switches?: PkSwitch[]
  /** Linked Discord account IDs. */
  accounts?: unknown
  [k: string]: unknown
}

export function pkList<T>(data: PkExport, key: string): T[] {
  const raw = (data as Record<string, unknown>)[key]
  return Array.isArray(raw) ? (raw.filter(r => r && typeof r === 'object') as T[]) : []
}

export function nonEmpty(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const s = value.trim()
  return s ? s : null
}

/** Normalise a colour to '#rrggbb'. PK stores bare 6-hex without a '#'. */
export function pkColor(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  let s = raw.trim().replace(/^#/, '')
  if (s.length === 3) s = s.split('').map(c => c + c).join('')
  if (s.length !== 6 || !/^[0-9a-fA-F]{6}$/.test(s)) return null
  return `#${s.toLowerCase()}`
}

/** Validate a PK timestamp and re-serialise as ISO-8601 UTC. */
export function pkTime(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw.trim()) return null
  const ms = Date.parse(raw)
  return Number.isNaN(ms) ? null : new Date(ms).toISOString()
}

/**
 * PK birthdays are `YYYY-MM-DD`, and a hidden year is written as year 0004
 * (PK's sentinel). Kept as a plain date string; the sentinel year is
 * preserved rather than invented away, since the day and month are real.
 */
export function pkBirthday(raw: unknown): string | null {
  const s = nonEmpty(raw)
  if (!s) return null
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null
}

/**
 * Collapse PK's privacy map to the spec's conservative bucket.
 *
 * The full map is preserved separately in the Privacy fragment's `source`,
 * so this only has to pick a bucket. PK has no middle ground, so anything
 * not explicitly public rounds to private, which is the strict direction the
 * spec asks for.
 */
export function pkVisibility(privacy: unknown): string {
  if (!privacy || typeof privacy !== 'object') return 'private'
  const map = privacy as Record<string, unknown>
  if (map.visibility === 'public') return 'public'
  if (map.visibility === 'private') return 'private'
  const flags = Object.entries(map)
    .filter(([k, v]) => k.endsWith('_privacy') && typeof v === 'string')
    .map(([, v]) => v)
  if (flags.length && flags.every(v => v === 'public')) return 'public'
  return 'private'
}

/** Proxy tags, dropping entries that carry neither a prefix nor a suffix. */
export function pkProxyTags(raw: unknown): { prefix: string | null; suffix: string | null }[] {
  if (!Array.isArray(raw)) return []
  const out: { prefix: string | null; suffix: string | null }[] = []
  for (const t of raw) {
    if (!t || typeof t !== 'object') continue
    const tag = t as PkProxyTag
    const prefix = nonEmpty(tag.prefix)
    const suffix = nonEmpty(tag.suffix)
    if (prefix || suffix) out.push({ prefix, suffix })
  }
  return out
}

export function parsePluralkit(text: string): PkExport {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error("That file isn't valid JSON. Pick the .json export file, not a screenshot or a link.")
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('That JSON file is not a PluralKit-style export (expected an object at the top level).')
  }
  const exp = data as PkExport
  // A system-level export always carries at least one of these, even empty.
  const looksRight = Array.isArray(exp.members) || Array.isArray(exp.switches) || Array.isArray(exp.groups)
  if (!looksRight) {
    throw new Error(
      'That JSON file does not look like a PluralKit-style export: it has no members, groups or switches. ' +
      'Export from PluralKit with "pk;export", which DMs you a link to the file.',
    )
  }
  if (!Array.isArray(exp.members) && !Array.isArray(exp.groups)) {
    throw new Error('That export has no members or groups to convert.')
  }
  return exp
}

export function systemLabel(data: PkExport): string {
  return nonEmpty(data.name) || nonEmpty(data.id) || 'PluralKit system'
}

/** Per-module counts for the configure step. */
export function countPluralkit(data: PkExport): Record<string, number> {
  const members = pkList<PkMember>(data, 'members')
  const groups = pkList<PkGroup>(data, 'groups')
  const switches = pkList<PkSwitch>(data, 'switches')

  const withProxy = members.filter(m => pkProxyTags(m.proxy_tags).length).length
  const images = members.filter(m => nonEmpty(m.avatar_url) || nonEmpty(m.banner)).length
    + groups.filter(g => nonEmpty(g.icon) || nonEmpty(g.banner)).length
    + (nonEmpty(data.avatar_url) || nonEmpty(data.banner) ? 1 : 0)

  return {
    members: members.length,
    groups: groups.length,
    fronting: switches.length,
    proxy_tags: withProxy,
    images,
  }
}
