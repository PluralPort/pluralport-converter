import type {Component} from 'vue'
import {
    Ampersand,
    BarChart3,
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
    },
    {
        id: 'octocon',
        name: 'Octocon',
        description: 'Convert an Export',
        logo: '/logos/octocon.png',
        icon: Layers,
        available: false,
        connectionType: 'file',
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
]

export function findConverter(sourceId: string, destinationId: string): Converter | undefined {
    return converters.find(c => c.sourceId === sourceId && c.destinationId === destinationId)
}

export function hasConverter(sourceId: string, destinationId: string): boolean {
    return findConverter(sourceId, destinationId) !== undefined
}
