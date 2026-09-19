<template>
  <div class="flex flex-col gap-6 py-12">

    <div class="rounded-md bg-yellow-50 p-4 dark:bg-yellow-500/10 dark:outline dark:outline-yellow-500/15">
      <div class="flex">
        <div class="shrink-0">
          <svg viewBox="0 0 20 20" fill="currentColor" data-slot="icon" aria-hidden="true" class="size-5 text-yellow-400 dark:text-yellow-300">
            <path d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 5Zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clip-rule="evenodd" fill-rule="evenodd" />
          </svg>
        </div>
        <div class="ml-3">
          <h3 class="text-sm font-medium text-yellow-800 dark:text-yellow-100">Heads up!</h3>
          <div class="mt-2 text-sm text-yellow-700 dark:text-yellow-100/80">
            <p>This converter is new, and so is the PluralPort spec! Expect some bugs as we work through things :)</p>
          </div>
        </div>
      </div>
    </div>

    <header class="flex flex-col gap-7 mt-3">
      <div class="flex items-start gap-3.5">
        <div class="flex size-10 shrink-0 items-center justify-center rounded-field border border-border bg-surface text-accent">
          <Repeat class="size-5" :stroke-width="2" />
        </div>
        <div class="flex min-w-0 flex-col gap-1">
          <h1 class="m-0 font-display text-lg leading-none text-text-heading">
            PluralPort Converter
          </h1>
          <p class="m-0 text-sm text-text-secondary">
            Turn a plural app's export into a PluralPort file.
            <span class="text-text-muted">Runs in your browser. Open source, no login.</span>
          </p>
        </div>
      </div>

      <ol role="list" class="m-0 flex items-center gap-0 p-0">
        <li
          v-for="(s, i) in steps"
          :key="s.key"
          class="flex min-w-0 flex-1 items-center gap-2"
          :class="stepClasses(s.key)"
        >
          <span class="size-1.5 shrink-0 rounded-full" :class="dotClasses(s.key)" />
          <span class="truncate text-[10px] font-bold uppercase tracking-[0.2em]">{{ s.label }}</span>
        </li>
      </ol>
    </header>

    <section v-if="step === 'connect'" class="overflow-hidden rounded-card border border-border bg-surface">
      <header class="border-b border-accent/10 bg-accent/5 px-5 py-3">
        <h2 class="m-0 font-display text-base leading-none text-text-heading">Connect a source</h2>
      </header>
      <div class="flex flex-col gap-5 p-5">
        <div class="flex flex-col gap-2">
          <div class="text-[10px] font-bold uppercase tracking-[0.2em] text-text-muted">Source</div>
          <div class="grid grid-cols-3 gap-2 max-sm:grid-cols-1">
            <button
              v-for="src in sources"
              :key="src.id"
              type="button"
              :disabled="!src.available"
              class="group flex flex-col items-start gap-1.5 rounded-field border bg-bg-2 px-3 py-2.5 text-left transition disabled:cursor-not-allowed disabled:opacity-55"
              :class="sourceId === src.id
                ? 'border-accent bg-accent/10'
                : 'border-border enabled:hover:border-surface-4'"
              @click="src.available && (sourceId = src.id)"
            >
              <span class="flex w-full items-center justify-between gap-2">
                <span class="flex size-6 items-center justify-center overflow-hidden rounded bg-bg/60">
                  <img
                    v-if="src.logo"
                    :src="src.logo"
                    :alt="`${src.name} logo`"
                    class="size-full object-contain"
                    :class="{ 'opacity-60 grayscale': !src.available }"
                  />
                  <component
                    v-else
                    :is="src.icon"
                    class="size-4"
                    :class="sourceId === src.id ? 'text-accent' : 'text-text-secondary'"
                  />
                </span>
                <span
                  v-if="!src.available"
                  class="shrink-0 rounded bg-surface-2 px-1.5 py-px font-display text-[9px] tracking-wider uppercase text-text-muted"
                >Soon</span>
              </span>
              <span class="text-[13px] font-semibold text-text-heading">{{ src.name }}</span>
              <span class="text-xs text-text-muted">{{ src.description }}</span>
            </button>
          </div>
        </div>

        <!--
          TODO:: Look at how this can be simplified, maybe moving to the converter as a variable so it is not hard coded into the HTML?
          -->
        <template v-if="sourceId === 'simply_plural'">
          <div class="flex flex-col gap-3 border-t border-border pt-5">
            <p class="m-0 text-sm text-text-secondary">
              Requests go through a small proxy (needed for CORS). The token isn't logged or stored.
            </p>

            <details class="group rounded-field border border-border bg-bg-2 open:border-accent/40">
              <summary class="flex cursor-pointer list-none items-center gap-2 px-3.5 py-2.5 text-[13px] font-semibold text-text">
                <ChevronRight class="size-4 text-text-secondary transition-transform group-open:rotate-90" />
                <span>How to get a token from Simply Plural</span>
              </summary>
              <ol class="m-0 flex list-decimal flex-col gap-1.5 border-t border-border/60 px-3.5 py-3 pl-9 text-[13px] text-text-secondary marker:text-text-muted marker:tabular-nums">
                <li>Open the Simply Plural app.</li>
                <li>Open the side menu (hamburger icon).</li>
                <li>Tap the gear icon.</li>
                <li>Go to <span class="text-text-heading">Account</span>.</li>
                <li>Open <span class="text-text-heading">Tokens</span>.</li>
                <li>Tap <span class="text-text-heading">Add Token</span> and choose <span class="rounded bg-accent/15 px-1.5 py-0.5 font-semibold text-accent">Read Only</span>.</li>
                <li>Tap and hold the new token for 2 seconds to copy it.</li>
              </ol>
            </details>

            <div class="flex flex-col gap-2">
              <label for="token" class="text-[13px] font-semibold text-text-heading">Token</label>
              <div class="flex gap-1.5">
                <input
                  id="token"
                  v-model="apiKey"
                  :type="showKey ? 'text' : 'password'"
                  class="focus-accent-ring w-full rounded-field border border-border bg-bg-2 px-3.5 py-[11px] font-mono text-[13px] text-text"
                  placeholder="Paste your SP token"
                  autocomplete="off"
                  spellcheck="false"
                />
                <button
                  type="button"
                  class="inline-flex shrink-0 items-center justify-center rounded-button border border-border bg-bg-2 px-3 text-text-secondary transition hover:border-surface-4 hover:bg-surface hover:text-text"
                  :aria-label="showKey ? 'Hide token' : 'Show token'"
                  @click="showKey = !showKey"
                >
                  <EyeOff v-if="showKey" class="size-4" />
                  <Eye v-else class="size-4" />
                </button>
              </div>
            </div>
          </div>
        </template>

        <template v-else-if="activeSource?.connectionType === 'file'">
          <div class="flex flex-col gap-3 border-t border-border pt-5">
            <p class="m-0 text-sm text-text-secondary">
              Your export is read and converted entirely in your browser. The file never leaves your device.
            </p>

            <details class="group rounded-field border border-border bg-bg-2 open:border-accent/40">
              <summary class="flex cursor-pointer list-none items-center gap-2 px-3.5 py-2.5 text-[13px] font-semibold text-text">
                <ChevronRight class="size-4 text-text-secondary transition-transform group-open:rotate-90" />
                <span>How to export from {{ activeSource?.name }}</span>
              </summary>
              <ol class="m-0 flex list-decimal flex-col gap-1.5 border-t border-border/60 px-3.5 py-3 pl-9 text-[13px] text-text-secondary marker:text-text-muted marker:tabular-nums">
                <li>Open {{ activeSource?.name }}.</li>
                <li>Go to <span class="text-text-heading">Settings</span>.</li>
                <li>Open <span class="text-text-heading">Import / Export</span>.</li>
                <li>Under Export, choose <span class="text-text-heading">Export your data to a JSON file</span>.</li>
                <li>Save the file, then upload it below.</li>
              </ol>
            </details>

            <label
              class="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-field border border-dashed bg-bg-2 px-4 py-8 text-center transition hover:border-surface-4"
              :class="sourceFile ? 'border-accent/50 bg-accent/5' : 'border-border'"
            >
              <input type="file" accept="application/json,.json" class="sr-only" @change="onFileChange" />
              <Upload class="size-5" :class="sourceFile ? 'text-accent' : 'text-text-secondary'" />
              <span class="text-[13px] font-semibold text-text-heading">
                {{ sourceFile ? sourceFile.name : 'Choose an export file' }}
              </span>
              <span class="text-xs text-text-muted">
                {{ sourceFile ? fileSizeLabel : `JSON exported from ${activeSource?.name}` }}
              </span>
            </label>
          </div>
        </template>

        <div
          v-if="authError"
          class="flex items-start gap-3 rounded-field border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger"
        >
          <CircleAlert class="size-4 shrink-0 translate-y-0.5" />
          <span>{{ authError }}</span>
        </div>

        <div class="flex flex-wrap justify-end gap-2">
          <button
            class="inline-flex items-center gap-2 whitespace-nowrap rounded-button border border-accent bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="!canContinue"
            @click="connectAndProceed"
          >
            <Loader2 v-if="verifying" class="size-4 animate-spin" />
            <span>{{ verifying ? 'Connecting' : 'Continue' }}</span>
            <ArrowRight v-if="!verifying" class="size-4" />
          </button>
        </div>
      </div>
    </section>

    <section v-if="step === 'configure'" class="overflow-hidden rounded-card border border-border bg-surface">
      <header class="border-b border-accent/10 bg-accent/5 px-5 py-3">
        <h2 class="m-0 font-display text-base leading-none text-text-heading">Configure</h2>
      </header>
      <div class="flex flex-col gap-5 p-5">
        <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-text-secondary">
          <span class="flex items-center gap-1.5">
            <span class="text-text-muted">Connected as</span>
            <strong class="font-semibold text-text-heading">{{ systemName }}</strong>
          </span>
          <span class="text-text-faint">·</span>
          <span class="flex items-center gap-1.5">
            <span class="text-text-muted">Source</span>
            <strong class="font-semibold text-text-heading">{{ activeSource?.name }}</strong>
          </span>
        </div>

        <div class="flex flex-col gap-2">
          <div class="text-[10px] font-bold uppercase tracking-[0.2em] text-text-muted">Destination format</div>
          <div class="grid grid-cols-2 gap-2 max-sm:grid-cols-1">
            <button
              v-for="dst in destinations"
              :key="dst.id"
              type="button"
              :disabled="!dst.available"
              class="flex flex-col items-start gap-1.5 rounded-field border bg-bg-2 px-3 py-2.5 text-left transition disabled:cursor-not-allowed disabled:opacity-55"
              :class="destinationId === dst.id
                ? 'border-accent bg-accent/10'
                : 'border-border enabled:hover:border-surface-4'"
              @click="dst.available && (destinationId = dst.id)"
            >
              <span class="flex w-full items-baseline justify-between gap-2">
                <span class="text-[13px] font-semibold text-text-heading">{{ dst.name }}</span>
                <span class="font-display text-[11px] text-text-muted">{{ dst.version }}</span>
              </span>
              <span class="text-xs text-text-muted">{{ dst.description }}</span>
            </button>
            <div class="flex flex-col items-start gap-1.5 rounded-field border border-dashed border-border bg-transparent px-3 py-2.5 opacity-60">
              <span class="flex w-full items-baseline justify-between gap-2">
                <span class="text-[13px] font-semibold text-text-muted">More formats</span>
                <span class="rounded bg-surface-2 px-1.5 py-px font-display text-[9px] tracking-wider uppercase text-text-muted">Soon</span>
              </span>
              <span class="text-xs text-text-faint">SP JSON, Octocon, PluralSpace…</span>
            </div>
          </div>
        </div>

        <div v-if="activeDestination" class="flex flex-col gap-2">
          <div class="text-[10px] font-bold uppercase tracking-[0.2em] text-text-muted">Include</div>
          <div class="grid grid-cols-2 gap-2 max-sm:grid-cols-1">
            <label
              v-for="opt in availableModules"
              :key="opt.key"
              class="relative grid cursor-pointer grid-cols-[auto_1fr_auto] items-center gap-2.5 rounded-field border bg-bg-2 px-3 py-2.5 transition"
              :class="selectedModules.includes(opt.key)
                ? 'border-accent bg-accent/10'
                : 'border-border hover:border-surface-4'"
            >
              <input type="checkbox" :value="opt.key" v-model="selectedModules" class="pointer-events-none absolute opacity-0" />
              <span class="inline-flex" :class="selectedModules.includes(opt.key) ? 'text-accent' : 'text-text-secondary'">
                <component :is="opt.icon" class="size-4" />
              </span>
              <span class="flex min-w-0 flex-col gap-px">
                <span class="flex items-baseline justify-between gap-2">
                  <span class="truncate text-[13px] font-semibold text-text-heading">{{ opt.label }}</span>
                  <span class="shrink-0 font-display text-xs tabular-nums" :class="countTextClass(opt.key)">
                    {{ countDisplay(opt.key) }}
                  </span>
                </span>
                <span class="truncate text-xs text-text-muted">{{ opt.description }}</span>
              </span>
              <span
                class="inline-flex size-[18px] shrink-0 items-center justify-center rounded border"
                :class="selectedModules.includes(opt.key)
                  ? 'border-accent bg-accent text-accent-foreground'
                  : 'border-border bg-bg text-transparent'"
              >
                <Check class="size-3.5" />
              </span>
            </label>
          </div>
        </div>

        <div v-if="selectedModules.includes('fronting')" class="flex flex-col gap-2">
          <div class="text-[10px] font-bold uppercase tracking-[0.2em] text-text-muted">
            Front history range <span class="font-medium normal-case tracking-normal text-text-faint">(optional)</span>
          </div>
          <div class="flex gap-2">
            <label class="flex flex-1 flex-col gap-1">
              <span class="text-xs font-semibold text-text-secondary">From</span>
              <input
                type="date"
                v-model="rangeStart"
                class="focus-accent-ring w-full rounded-field border border-border bg-bg-2 px-3.5 py-3 text-sm text-text"
              />
            </label>
            <label class="flex flex-1 flex-col gap-1">
              <span class="text-xs font-semibold text-text-secondary">To</span>
              <input
                type="date"
                v-model="rangeEnd"
                class="focus-accent-ring w-full rounded-field border border-border bg-bg-2 px-3.5 py-3 text-sm text-text"
              />
            </label>
          </div>
          <p class="m-0 text-xs text-text-muted">Leave blank to include all front history.</p>
        </div>

        <div
          v-if="!converterAvailable"
          class="flex items-start gap-3 rounded-field border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning"
        >
          <TriangleAlert class="size-4 shrink-0 translate-y-0.5" />
          <span>No converter is registered for {{ activeSource?.name }} to {{ activeDestination?.name }} yet.</span>
        </div>

        <div class="flex flex-wrap justify-end gap-2">
          <button
            class="inline-flex items-center gap-2 whitespace-nowrap rounded-button border border-border bg-transparent px-4 py-2 text-sm font-medium text-text transition hover:border-surface-4 hover:bg-surface"
            @click="step = 'connect'"
          >
            <ArrowLeft class="size-4" />
            <span>Back</span>
          </button>
          <button
            class="inline-flex items-center gap-2 whitespace-nowrap rounded-button border border-accent bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="!converterAvailable || selectedModules.length === 0"
            @click="step = 'convert'"
          >
            <span>Convert</span>
            <ArrowRight class="size-4" />
          </button>
        </div>
      </div>
    </section>

    <section v-if="step === 'convert'" class="overflow-hidden rounded-card border border-border bg-surface">
      <header class="border-b border-accent/10 bg-accent/5 px-5 py-3">
        <h2 class="m-0 font-display text-base leading-none text-text-heading">
          {{ conversionDone ? 'Conversion complete' : 'Converting' }}
        </h2>
      </header>
      <div class="flex flex-col gap-5 p-5">
        <p v-if="!conversionDone" class="m-0 text-sm text-text-secondary">
          Pulling data from {{ activeSource?.name }}, building your {{ activeDestination?.name }} file.
        </p>
        <p v-else class="m-0 text-sm text-text-secondary">Your {{ activeDestination?.name }} file is ready.</p>

        <ul role="list" class="m-0 flex flex-col overflow-hidden rounded-field border border-border p-0">
          <li
            v-for="task in tasks"
            :key="task.key"
            class="flex items-center gap-2.5 border-b border-border/50 bg-bg-2 px-3.5 py-2.5 text-sm last:border-b-0"
            :class="{ shimmer: task.status === 'running' }"
          >
            <span class="inline-flex size-4.5 shrink-0 items-center justify-center" :class="taskIconColor(task.status)">
              <Check v-if="task.status === 'done'" class="size-4" />
              <Loader2 v-else-if="task.status === 'running'" class="size-4 animate-spin" />
              <X v-else-if="task.status === 'error'" class="size-4" />
              <Minus v-else-if="task.status === 'skipped'" class="size-4" />
              <Circle v-else class="size-4" />
            </span>
            <span class="flex-1" :class="task.status === 'pending' ? 'text-text-muted' : 'text-text'">
              {{ task.label }}
            </span>
            <span v-if="task.count != null" class="text-xs text-text-secondary tabular-nums">
              {{ task.count.toLocaleString() }}
            </span>
            <span v-if="task.note" class="text-xs text-danger">{{ task.note }}</span>
          </li>
        </ul>

        <div
          v-if="warnings.length > 0"
          class="flex max-h-55 flex-col gap-2 overflow-y-auto rounded-field border border-warning/30 bg-warning/10 px-4 py-3"
        >
          <div class="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-warning">
            <TriangleAlert class="size-3.5 shrink-0" />
            <span>{{ warnings.length }} warning{{ warnings.length === 1 ? '' : 's' }}</span>
          </div>
          <ul role="list" class="m-0 flex flex-col gap-1.5 p-0">
            <li
              v-for="(w, i) in warnings"
              :key="i"
              class="flex items-start gap-2 text-[13px] leading-snug text-text-secondary"
            >
              <span
                class="mt-px shrink-0 rounded px-1.5 py-px text-[10px] font-bold tracking-wider uppercase"
                :class="warnBadgeClass(w.level)"
              >{{ w.level }}</span>
              <span>{{ w.message }}</span>
            </li>
          </ul>
        </div>

        <div v-if="conversionDone" class="flex flex-col gap-4">
          <dl class="m-0 grid grid-cols-3 gap-px overflow-hidden rounded-field border border-border bg-border">
            <div class="flex flex-col gap-1 bg-bg-2 px-4 py-3.5">
              <dt class="m-0 text-[10px] font-bold tracking-[0.2em] text-text-muted uppercase">Records</dt>
              <dd class="m-0 font-display text-lg leading-none text-text-heading tabular-nums">
                {{ animatedRecords.toLocaleString() }}
              </dd>
            </div>
            <div class="flex flex-col gap-1 bg-bg-2 px-4 py-3.5">
              <dt class="m-0 text-[10px] font-bold tracking-[0.2em] text-text-muted uppercase">Warnings</dt>
              <dd class="m-0 font-display text-lg leading-none text-text-heading tabular-nums">
                {{ animatedWarnings }}
              </dd>
            </div>
            <div class="flex flex-col gap-1 bg-bg-2 px-4 py-3.5">
              <dt class="m-0 text-[10px] font-bold tracking-[0.2em] text-text-muted uppercase">File size</dt>
              <dd class="m-0 font-display text-lg leading-none text-text-heading tabular-nums">
                {{ animatedFileSize }} KB
              </dd>
            </div>
          </dl>
          <div class="flex flex-wrap justify-end gap-2">
            <button
              class="inline-flex items-center gap-2 whitespace-nowrap rounded-button border border-border bg-transparent px-4 py-2 text-sm font-medium text-text transition hover:border-surface-4 hover:bg-surface"
              @click="reset"
            >
              Start over
            </button>
            <button
              class="inline-flex items-center gap-2 whitespace-nowrap rounded-button border border-accent bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition hover:opacity-90"
              @click="downloadFile"
            >
              <Download class="size-4" />
              <span>Download</span>
            </button>
          </div>
        </div>

        <div v-if="fatalError" class="flex flex-col gap-2 rounded-field border border-danger/30 bg-danger/10 px-4 py-3">
          <div class="flex items-center gap-2 text-sm font-semibold text-danger">
            <CircleAlert class="size-4 shrink-0" />
            <span>Conversion failed</span>
          </div>
          <p class="m-0 text-sm text-text-secondary">{{ fatalError }}</p>
          <div class="flex">
            <button
              class="inline-flex items-center gap-2 whitespace-nowrap rounded-button border border-border bg-transparent px-4 py-2 text-sm font-medium text-text transition hover:border-surface-4 hover:bg-surface"
              @click="step = 'configure'"
            >
              <ArrowLeft class="size-4" />
              <span>Back</span>
            </button>
          </div>
        </div>
      </div>
    </section>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  Circle,
  CircleAlert,
  Download,
  Eye,
  EyeOff,
  Loader2,
  Minus,
  Repeat,
  TriangleAlert,
  Upload,
  X,
} from 'lucide-vue-next'

import { sources, destinations, findConverter } from '~/lib/registry'
import { countAll, verifyToken } from '~/lib/sp-client'
import { parseAmpersand, systemLabel, countAmpersand } from '~/lib/ampersand-client'
import type { OPWarning, TaskState } from '~/lib/converters/types'
useHead({
  title: 'PluralPort Converter - Turn a plural app export into a PluralPort file',
})

//TODO:: Need to document more of the functions here so it's easier to know what is actually happening and to help others add new converters

type StepKey = 'connect' | 'configure' | 'convert'

const step = ref<StepKey>('connect')
const steps: { key: StepKey; label: string }[] = [
  { key: 'connect',   label: 'Connect' },
  { key: 'configure', label: 'Configure' },
  { key: 'convert',   label: 'Convert' },
]

const sourceId = ref<string>('simply_plural')
const destinationId = ref<string>('pluralport_v0.1')

const activeSource = computed(() => sources.find(s => s.id === sourceId.value))
const activeDestination = computed(() => destinations.find(d => d.id === destinationId.value))
const activeConverter = computed(() => findConverter(sourceId.value, destinationId.value))
const converterAvailable = computed(() => activeConverter.value !== undefined)

// A converter may only be able to fill a subset of the destination's
// modules (e.g. Ampersand has no groups). Show just what it supports.
const availableModules = computed(() => {
  const dst = activeDestination.value
  if (!dst) return []
  const supported = activeConverter.value?.modules
  return supported ? dst.modules.filter(m => supported.includes(m.key)) : dst.modules
})

const selectedModules = ref<string[]>([])
watch(availableModules, (mods) => {
  selectedModules.value = mods.map(m => m.key)
}, { immediate: true })

const apiKey = ref('')
const showKey = ref(false)
const verifying = ref(false)
const authError = ref('')
const systemName = ref('')
const userId = ref('')

// File-source state (Ampersand and any future file importers).
const sourceFile = ref<File | null>(null)
const fileText = ref('')

const canContinue = computed(() => {
  if (verifying.value) return false
  const t = activeSource.value?.connectionType
  if (t === 'token') return !!apiKey.value.trim()
  if (t === 'file') return !!sourceFile.value
  return false
})

const fileSizeLabel = computed(() => {
  const size = sourceFile.value?.size ?? 0
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
})

function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  sourceFile.value = input.files?.[0] ?? null
  authError.value = ''
}

async function connectAndProceed() {
  authError.value = ''
  verifying.value = true
  try {
    const connType = activeSource.value?.connectionType
    if (connType === 'token') {
      const { userId: uid, systemName: name } = await verifyToken(apiKey.value)
      userId.value = uid
      systemName.value = name
      step.value = 'configure'
      fetchCounts()
    } else if (connType === 'file') {
      if (!sourceFile.value) throw new Error('Choose an export file first.')
      const text = await sourceFile.value.text()
      const parsed = parseAmpersand(text) // throws a user-facing message on a bad file
      fileText.value = text
      userId.value = ''
      systemName.value = systemLabel(parsed)
      step.value = 'configure'
      applyLocalCounts(countAmpersand(parsed))
    }
  } catch (e) {
    authError.value = e instanceof Error ? e.message : 'Could not connect. Check your credentials.'
  } finally {
    verifying.value = false
  }
}

// File sources compute counts locally (no network), so populate the same
// moduleCounts map the configure step reads.
function applyLocalCounts(counts: Record<string, number>) {
  const state: Record<string, CountState> = {}
  for (const [key, value] of Object.entries(counts)) state[key] = { status: 'ok', value }
  moduleCounts.value = state
}

type CountState = { status: 'loading' } | { status: 'ok'; value: number } | { status: 'error' }
const moduleCounts = ref<Record<string, CountState>>({})

function fetchCounts() {
  if (sourceId.value !== 'simply_plural') return
  const init: Record<string, CountState> = {}
  for (const m of activeDestination.value?.modules ?? []) init[m.key] = { status: 'loading' }
  moduleCounts.value = init

  // TODO: Known issue here, same as below... counting all can cause hundreds or thousands of requests which can take a while or cause OOM errors. Maybe only apply counts to the specific fields that aren't constrained? eg: SP notes are by member, thousands of members = N+X calls depending on pagination to get a total count
  countAll(apiKey.value, userId.value, (key, value) => {
    if (value === 'error') {
      moduleCounts.value = { ...moduleCounts.value, [key]: { status: 'error' } }
    } else {
      moduleCounts.value = { ...moduleCounts.value, [key]: { status: 'ok', value } }
    }
  })
}

function countDisplay(key: string): string {
  const c = moduleCounts.value[key]
  if (!c || c.status === 'loading') return '···'
  if (c.status === 'error') return '—'
  return c.value.toLocaleString()
}

function countTextClass(key: string) {
  const c = moduleCounts.value[key]
  if (!c || c.status === 'loading') return 'text-text-muted animate-pulse'
  if (c.status === 'error') return 'text-text-faint'
  return 'text-accent'
}

const rangeStart = ref('')
const rangeEnd = ref('')

const tasks = ref<TaskState[]>([])
const warnings = ref<OPWarning[]>([])
const conversionDone = ref(false)
const fatalError = ref('')
const outputJson = ref('')
const outputFilename = ref('')

const totalRecords = computed(() => tasks.value.reduce((a, t) => a + (t.count ?? 0), 0))
const fileSizeKb = computed(() => Math.ceil(new Blob([outputJson.value]).size / 1024))

watch(step, async (s) => {
  if (s !== 'convert') return
  await runConversion()
})

async function runConversion() {
  conversionDone.value = false
  fatalError.value = ''
  warnings.value = []
  outputJson.value = ''
  outputFilename.value = ''
  tasks.value = []

  const converter = activeConverter.value
  if (!converter) {
    fatalError.value = 'No converter registered for the selected source and destination.'
    return
  }

  try {
    // TODO: Known issue with client side fetching! 6 requests at a time and could run into OOM errors especially on mobile. Need to look at refactoring with possibly a streaming JSON converter or chunking requests
    const result = await converter.run(
      {
        token: apiKey.value,
        userId: userId.value,
        fileText: fileText.value,
        fileName: sourceFile.value?.name,
      },
      {
        selectedModules: selectedModules.value,
        rangeStart: rangeStart.value || undefined,
        rangeEnd: rangeEnd.value || undefined,
      },
      {
        initTasks: (t) => { tasks.value = t },
        updateTask: (key, patch) => {
          const t = tasks.value.find(x => x.key === key)
          if (t) Object.assign(t, patch)
        },
        warning: (w) => { warnings.value.push(w) },
      }
    )
    outputJson.value = result.json
    outputFilename.value = result.filename
    conversionDone.value = true
  } catch (e) {
    fatalError.value = e instanceof Error ? e.message : 'Unexpected error during conversion.'
  }
}

const animatedRecords = ref(0)
const animatedWarnings = ref(0)
const animatedFileSize = ref(0)

watch(conversionDone, (done) => {
  if (!done) {
    animatedRecords.value = 0
    animatedWarnings.value = 0
    animatedFileSize.value = 0
    return
  }
  const start = performance.now()
  const duration = 700
  const targetR = totalRecords.value
  const targetW = warnings.value.length
  const targetF = fileSizeKb.value
  function frame(t: number) {
    const p = Math.min(1, (t - start) / duration)
    const eased = 1 - Math.pow(1 - p, 3)
    animatedRecords.value = Math.round(targetR * eased)
    animatedWarnings.value = Math.round(targetW * eased)
    animatedFileSize.value = Math.round(targetF * eased)
    if (p < 1) requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)
})

const stepOrder: Record<StepKey, number> = { connect: 0, configure: 1, convert: 2 }

function stepState(key: StepKey): 'complete' | 'current' | 'upcoming' {
  if (stepOrder[key] < stepOrder[step.value]) return 'complete'
  if (key === step.value) return 'current'
  return 'upcoming'
}

function stepClasses(key: StepKey) {
  const s = stepState(key)
  return {
    'text-text-heading': s === 'current',
    'text-text-secondary': s === 'complete',
    'text-text-muted': s === 'upcoming',
  }
}

function dotClasses(key: StepKey) {
  const s = stepState(key)
  return {
    'bg-accent ring-4 ring-accent/25 animate-pulse': s === 'current',
    'bg-success': s === 'complete',
    'bg-border': s === 'upcoming',
  }
}

function connectorClasses(prevKey: StepKey) {
  return stepState(prevKey) === 'complete' ? 'connector-fill' : 'bg-border'
}

function taskIconColor(status: TaskState['status']) {
  return {
    'text-success': status === 'done',
    'text-accent': status === 'running',
    'text-danger': status === 'error',
    'text-text-muted': status === 'skipped' || status === 'pending',
  }
}

function warnBadgeClass(level: OPWarning['level']) {
  return {
    'bg-warning/20 text-warning': level === 'warning',
    'bg-danger/20 text-danger': level === 'error',
    'bg-accent/20 text-accent': level === 'info',
  }
}

function downloadFile() {
  const blob = new Blob([outputJson.value], { type: 'application/json' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = outputFilename.value || 'pluralport-output.json'
  a.click()
  URL.revokeObjectURL(url)
}

function reset() {
  step.value = 'connect'
  tasks.value = []
  warnings.value = []
  conversionDone.value = false
  fatalError.value = ''
  outputJson.value = ''
  outputFilename.value = ''
  moduleCounts.value = {}
  sourceFile.value = null
  fileText.value = ''
}
</script>
