import type {Component} from 'vue'
import {
    Ampersand,
    BarChart3,
    Bot,
    Boxes,
    Clock,
    FolderTree,
    Hash,
    Image,
    Layers,
    MessagesSquare,
    SlidersHorizontal,
    StickyNote,
    TreeDeciduous,
    User,
    VenetianMask,
} from 'lucide-vue-next'
import {converter as ampersandToPluralPort} from './converters/ampersand-to-op'
import {converter as berrytreeToPluralPort} from './converters/berrytree-to-pp'
import {octoconConverter, pluralkitConverter} from './converters/pluralkit-to-pp'
import type {Converter} from './converters/types'

/**
 * Every source is an export file the visitor picks, so nothing leaves the
 * browser and the site can be served as static files with nothing behind it.
 *
 * 'token' and 'oauth' are kept only so a future source can be added for an
 * API that sends CORS headers and can be called from the page directly. They
 * must never come back via a proxy we operate: a proxy sees the credential
 * and the plaintext system data, which is exactly what this tool promises
 * not to do.
 */
export type ConnectionType = 'token' | 'file' | 'oauth'

export interface SourceProvider {
    id: string
    name: string
    description: string
    logo?: string
    icon: Component
    available: boolean
    connectionType: ConnectionType
    /**
     * The converter works, but our understanding of the format is thin:
     * built without a reference implementation, real exports of varying
     * vintage, or the ability to generate test data by exercising the app.
     * The UI says so up front, because someone converting the only copy of
     * their data deserves to know how well understood the format is.
     */
    experimental?: boolean
    /** Shown next to the experimental badge, explaining what is uncertain. */
    experimentalNote?: string
    /**
     * How to get an export out of this app, as numbered steps. Written per
     * source: "Settings > Import / Export" is not a universal path, and
     * sending someone down the wrong menu, or to the wrong one of two export
     * formats, wastes their time on a file we cannot read.
     */
    exportSteps?: string[]
    /** Prose shown above the steps, or instead of them when we cannot honestly
     *  describe a menu path (an app we have never been able to run). */
    exportNote?: string
    /** `accept` for the file picker. Defaults to JSON. */
    fileAccept?: string
    /** What the drop zone says the file should be. */
    fileHint?: string
}

export interface ModuleOption {
    key: string
    label: string
    description: string
    icon: Component
}

export interface DestinationFormat {
    id: string
    name: string
    version: string
    description: string
    available: boolean
    modules: ModuleOption[]
}

export const sources: SourceProvider[] = [
    {
        id: 'simply_plural',
        name: 'Simply Plural',
        description: 'Convert an Export',
        logo: '/logos/simplyplural.png',
        icon: Boxes,
        available: false,
        connectionType: 'file',
    },
    {
        id: 'ampersand',
        name: 'Ampersand',
        description: 'Convert an Export',
        logo: '/logos/ampersand.png',
        icon: Ampersand,
        available: true,
        connectionType: 'file',
        // Ampersand offers two export formats. The .ampar self-backup archive
        // is an undocumented internal format and deliberately not supported:
        // its author implemented the JSON export specifically as the stable
        // interchange format, so JSON is the one to read. The steps are
        // explicit about that, since picking .ampar just wastes the user's
        // time on a file we reject.
        exportSteps: [
            'Open Ampersand.',
            'Go to Settings.',
            'Open Import & export.',
            'Under Export, choose the JSON option, not the .ampar backup archive.',
            'Save the file, then upload it below.',
        ],
        fileAccept: 'application/json,.json',
        fileHint: 'JSON exported from Ampersand',
    },
    {
        id: 'berrytree',
        name: 'BerryTree',
        description: 'Convert an Export',
        logo: '/logos/berrytree.png',
        icon: TreeDeciduous,
        available: true,
        connectionType: 'file',
        experimental: true,
        experimentalNote:
            'BerryTree was pulled from Google Play and its server has been unreachable since around ' +
            'August 2026, so we have only ever seen one export, with most sections empty. Members, ' +
            'custom fronts, fronting history and folders are converted. Anything else in your file is ' +
            'counted and reported rather than guessed at, so check the warnings when it finishes.',
        // No menu path here on purpose: we have never been able to run
        // BerryTree, so we would be inventing one. Better to describe the
        // file than to send someone hunting for a screen we made up.
        exportNote:
            'BerryTree was removed from Google Play and its server has been unreachable since around ' +
            'August 2026, so this works with an export you saved while it was still running. The file ' +
            'is a single .json document, usually named something like ' +
            'berrytree-export-<system>-<date>.json.',
        fileAccept: 'application/json,.json',
        fileHint: 'JSON exported from BerryTree',
    },
    {
        id: 'pluralkit',
        name: 'PluralKit',
        description: 'Convert an Export',
        // No logo asset for PluralKit yet; the card falls back to the icon.
        // Pointing at a file that is not there is how the source logos
        // broke on the deployed site in the first place.
        icon: Bot,
        available: true,
        connectionType: 'file',
        exportSteps: [
            'In any Discord channel or DM with PluralKit, send "pk;export".',
            'PluralKit replies in DM with a link to your export file.',
            'Open the link and save the .json file.',
            'Upload it below.',
        ],
        fileAccept: 'application/json,.json',
        fileHint: 'JSON exported from PluralKit',
    },
    {
        id: 'octocon',
        name: 'Octocon',
        description: 'Convert an Export',
        logo: '/logos/octocon.png',
        icon: Layers,
        available: true,
        connectionType: 'file',
        // Octocon and its forks emit a PluralKit-shaped export, so they are
        // read by the same converter. Listed as its own source anyway:
        // someone looking for a way out of Octocon searches for Octocon,
        // not for the format its export happens to use.
        // No menu path: we have not run Octocon, so any steps would be
        // invented. Describe the file instead.
        exportNote:
            'Octocon exports in PluralKit\'s format, so this reads the same file. Export your data ' +
            'from Octocon and upload the .json it gives you. Octocon forks that kept the export ' +
            'format work here too.',
        fileAccept: 'application/json,.json',
        fileHint: 'JSON exported from Octocon',
    },
    {
        id: 'pluralspace',
        name: 'PluralSpace',
        description: 'Convert an Export',
        logo: '/logos/pluralspace.jpg',
        icon: Layers,
        available: false,
        connectionType: 'file',
    },
]

export const destinations: DestinationFormat[] = [
    {
        id: 'pluralport_v0.1',
        name: 'PluralPort',
        version: 'v0.1 (draft)',
        description: 'Open standard for plural system data',
        available: true,
        modules: [
            {
                key: 'members',
                label: 'Members',
                description: 'Profiles, bios, custom fields',
                icon: User
            },
            {
                key: 'groups',
                label: 'Groups',
                description: 'Folders and subsystem groupings',
                icon: FolderTree
            },
            {
                key: 'fronting',
                label: 'Front history',
                description: 'All front periods',
                icon: Clock
            },
            {
                key: 'notes',
                label: 'Notes',
                description: 'Per-member notes and journals',
                icon: StickyNote
            },
            {
                key: 'custom_fronts',
                label: 'Custom fronts',
                description: 'Stored as members (is_custom_front)',
                icon: VenetianMask
            },
            {
                key: 'tags',
                label: 'Tags',
                description: 'Mapped to taxonomy terms',
                icon: Hash
            },
            {
                key: 'custom_fields',
                label: 'Custom fields',
                description: 'Field definitions and values',
                icon: SlidersHorizontal
            },
            {
                key: 'boards',
                label: 'Message board',
                description: 'Board posts, replies, comments',
                icon: MessagesSquare
            },
            {
                key: 'polls',
                label: 'Polls',
                description: 'Stored in optional polls module',
                icon: BarChart3
            },
            {
                key: 'images',
                label: 'Images',
                description: 'Avatars and covers, inline',
                icon: Image
            },
        ],
    },
]

export const converters: Converter[] = [
    ampersandToPluralPort,
    berrytreeToPluralPort,
    pluralkitConverter,
    octoconConverter,
]

export function findConverter(sourceId: string, destinationId: string): Converter | undefined {
    return converters.find(c => c.sourceId === sourceId && c.destinationId === destinationId)
}

export function hasConverter(sourceId: string, destinationId: string): boolean {
    return findConverter(sourceId, destinationId) !== undefined
}
