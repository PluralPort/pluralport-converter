/**
 * Shared PluralPort output constants and envelope construction.
 *
 * Every converter writes the same envelope shape; only the producer block
 * and the record arrays differ. Keeping that in one place means a spec bump
 * is a single edit rather than one per converter.
 */

/** PluralPort spec version this converter targets. */
export const PLURALPORT_VERSION = '0.1'

/** Version of this converter implementation, reported as producer.exporter_version. */
export const EXPORTER_VERSION = '0.1.0'

/** Extension namespace for converter-specific provenance. */
export const EXPORTER_NAMESPACE = 'pluralport_converter'

export const EXPORTER_NAME = 'PluralPort Converter'
export const EXPORTER_URL = 'https://github.com/PluralPort/pluralport-converter'

/** Identifies the app the data came from. Per spec, producer.app is the
 *  source app rather than this tool: it is what source_refs and the
 *  extensions namespace key off, and what an importer needs to know. */
export interface Producer {
    app: string
    app_id: string
    app_version?: string
}

/**
 * Provenance for a third-party conversion. The spec's producer block only
 * carries exporter_version, with no slot naming the tool that did the
 * conversion, so the detail goes in a namespaced extension. See the note in
 * the README about proposing producer.exporter upstream.
 */
export function exporterExtension() {
    return {
        name: EXPORTER_NAME,
        version: EXPORTER_VERSION,
        url: EXPORTER_URL,
    }
}

/** `pluralport-v0.1-<system>-<date>.json`, with the slug made filename-safe. */
export function pluralportFilename(rawSlug: string | undefined | null): string {
    const date = new Date().toISOString().slice(0, 10)
    const slug = (rawSlug || 'system')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'system'
    return `pluralport-v${PLURALPORT_VERSION}-${slug}-${date}.json`
}
