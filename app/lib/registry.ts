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
    User,
    VenetianMask,
} from 'lucide-vue-next'
import {converter as spToPluralPort} from './converters/sp-to-op'
import {converter as ampersandToPluralPort} from './converters/ampersand-to-op'
import type {Converter} from './converters/types'

export type ConnectionType = 'token' | 'file' | 'oauth'

export interface SourceProvider {
    id: string
    name: string
    description: string
    logo?: string
    icon: Component
    available: boolean
    connectionType: ConnectionType
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
        description: 'Connect via API token',
        logo: '/logos/simplyplural.png',
        icon: Boxes,
        available: true,
        connectionType: 'token',
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
        description: 'Connect via API token',
        logo: '/logos/pluralspace.jpg',
        icon: Layers,
        available: false,
        connectionType: 'token',
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
    spToPluralPort,
    ampersandToPluralPort,
]

export function findConverter(sourceId: string, destinationId: string): Converter | undefined {
    return converters.find(c => c.sourceId === sourceId && c.destinationId === destinationId)
}

export function hasConverter(sourceId: string, destinationId: string): boolean {
    return findConverter(sourceId, destinationId) !== undefined
}
