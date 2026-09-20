export interface OPWarning {
    level: 'info' | 'warning' | 'error'
    code: string
    record_type?: string | null
    record_id?: string | null
    message: string
    count?: number | null
}

export interface TaskState {
    key: string
    label: string
    status: 'pending' | 'running' | 'done' | 'error' | 'skipped'
    count?: number | null
    note?: string
}

export interface RunOptions {
    selectedModules: string[]
    rangeStart?: string
    rangeEnd?: string
}

export interface RunCallbacks {
    initTasks: (tasks: TaskState[]) => void
    updateTask: (key: string, patch: Partial<TaskState>) => void
    warning: (w: OPWarning) => void
}

export interface RunResult {
    json: string
    filename: string
}

/**
 * Everything a converter might need to reach its source. Every source is
 * currently a file, so converters read `fileText`/`fileName`. `token` is
 * reserved for a future source calling a CORS-enabled API directly from the
 * page; see the note on ConnectionType in registry.ts.
 */
export interface SourceInput {
    token?: string
    fileText?: string
    fileName?: string
}

export type ConverterFn = (
    input: SourceInput,
    options: RunOptions,
    cb: RunCallbacks,
) => Promise<RunResult>

/**
 * What the connect step learns from a file before conversion runs: a name to
 * show, and the per-module record counts the configure step displays.
 * Throws a message meant for the visitor when the file is not readable.
 */
export type InspectFn = (fileText: string) => {
    label: string
    counts: Record<string, number>
}

export interface Converter {
    sourceId: string
    destinationId: string
    /**
     * Destination module keys this converter can actually populate. The UI
     * shows only these as toggles for the source. Undefined = every module
     * the destination declares.
     */
    modules?: string[]
    /**
     * Validates and summarises an uploaded file. Lives on the converter
     * because it is the thing that knows the format; the page just calls it
     * for whichever source is selected.
     */
    inspect?: InspectFn
    run: ConverterFn
}

export function defineConverter(c: Converter): Converter {
    return c
}
