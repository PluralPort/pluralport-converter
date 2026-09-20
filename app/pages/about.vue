<template>
  <div class="flex flex-col gap-12 py-16">
    <header class="flex flex-col gap-3">
      <span class="text-[10px] font-bold uppercase tracking-[0.2em] text-accent">About PluralPort Converter</span>
      <h1 class="m-0 font-display text-3xl leading-tight text-text-heading max-sm:text-2xl">
        Move your plural data between apps.
      </h1>
      <p class="m-0 text-base text-text-secondary">
        Most plural apps store data in their own shape. This converter reads that shape and writes the shared PluralPort format. It's free, open source, and runs in your browser with no account needed to use.
      </p>
    </header>

    <section class="flex flex-col gap-3">
      <h2 class="m-0 font-display text-xl leading-none text-text-heading">Why it exists</h2>
      <p class="m-0 text-text-secondary">
        The plural community uses a lot of apps. From toolkit apps like Simply Plural, Octocon, and PluralSpace to proxies
        like PluralKit and Tupperbox. Each one stores data differently. Historically it's meant that apps have to add
        support to allow certain exports/imports from other apps, that's where
        <a href="https://pluralport.com" target="_blank" rel="noopener" class="text-accent underline decoration-accent/30 underline-offset-2 hover:decoration-accent">PluralPort</a>
        comes in. It allows for an easy, expected format for exports and imports.
      </p>
    </section>

    <section class="flex flex-col gap-4">
      <div class="flex items-baseline justify-between gap-4">
        <h2 class="m-0 font-display text-xl leading-none text-text-heading">Supported conversions</h2>
        <a
          href="https://github.com/PluralPort/pluralport-converter/blob/main/CONTRIBUTING.md"
          target="_blank"
          rel="noopener"
          class="text-sm text-text-secondary underline decoration-border underline-offset-2 hover:text-text hover:decoration-text-secondary"
        >Add one</a>
      </div>

      <div class="overflow-hidden rounded-card border border-border">
        <div class="border-b border-border bg-accent/5 px-4 py-2">
          <span class="text-[10px] font-bold uppercase tracking-[0.2em] text-accent">Available now</span>
        </div>
        <ul role="list" class="m-0 flex flex-col p-0">
          <li
            v-for="pair in availableConversions"
            :key="`${pair.source.id}-${pair.dest.id}`"
            class="flex items-center gap-3 border-b border-border/50 bg-surface px-4 py-3 last:border-b-0"
          >
            <Check class="size-4 shrink-0 text-success" />
            <ConversionPath :source="pair.source" :dest="pair.dest" />
          </li>
        </ul>

        <div class="border-y border-border bg-surface-2 px-4 py-2">
          <span class="text-[10px] font-bold uppercase tracking-[0.2em] text-text-muted">Planned</span>
        </div>
        <ul role="list" class="m-0 flex flex-col p-0">
          <li
            v-for="pair in plannedConversions"
            :key="`${pair.source.id}-${pair.dest.id}`"
            class="flex items-center gap-3 border-b border-border/50 bg-surface/60 px-4 py-3 last:border-b-0"
          >
            <Circle class="size-4 shrink-0 text-text-muted" />
            <ConversionPath :source="pair.source" :dest="pair.dest" muted />
            <span class="ml-auto shrink-0 rounded bg-surface-2 px-1.5 py-px font-display text-[9px] tracking-wider uppercase text-text-muted">Soon</span>
          </li>
        </ul>
      </div>
    </section>

    <section class="flex flex-col gap-3 rounded-card border border-border bg-surface p-6">
      <h2 class="m-0 font-display text-xl leading-none text-text-heading">About this project</h2>
      <p class="m-0 text-text-secondary">
        PluralPort Converter started out as a
        <a href="https://pluralspace.app" target="_blank" rel="noopener" class="text-accent underline decoration-accent/30 underline-offset-2 hover:decoration-accent">PluralSpace</a>
        project, and is now maintained alongside the
        <a href="https://pluralport.com" target="_blank" rel="noopener" class="text-accent underline decoration-accent/30 underline-offset-2 hover:decoration-accent">PluralPort</a>
        specification. It exists so that getting your data out of an app doesn't depend on that app, or on finding some third app that happens to read both formats.
        It's free and open source. PRs are welcome!
      </p>
      <div class="flex flex-wrap gap-2 pt-1">
        <a
          href="https://pluralport.com"
          target="_blank"
          rel="noopener"
          class="inline-flex items-center gap-2 rounded-button border border-accent bg-accent px-3.5 py-1.5 text-sm font-medium text-accent-foreground transition hover:opacity-90"
        >
          Read the spec
          <ArrowUpRight class="size-4" />
        </a>
        <a
          href="https://github.com/PluralPort/pluralport-converter"
          target="_blank"
          rel="noopener"
          class="inline-flex items-center gap-2 rounded-button border border-border px-3.5 py-1.5 text-sm font-medium text-text-secondary transition hover:border-surface-4 hover:text-text"
        >
          <Github class="size-4" />
          View converter source
        </a>
      </div>
    </section>

    <section class="flex flex-col gap-3">
      <h2 class="m-0 font-display text-xl leading-none text-text-heading">Add a converter</h2>
      <p class="m-0 text-text-secondary">
        A converter is one file in <code class="rounded bg-bg-2 px-1.5 py-px font-mono text-[12px] text-text">app/lib/converters/</code> that handles the export and conversion to a new format.
        <br />
        Sources and destinations are listed in <code class="rounded bg-bg-2 px-1.5 py-px font-mono text-[12px] text-text">app/lib/registry.ts</code> and auto register once added.
      </p>
      <p class="m-0 text-text-secondary">
        Want Octocon, Tupperbox, or something else? Open a PR and contribute!
      </p>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, h } from 'vue'
import { ArrowUpRight, ArrowRight, Check, Circle, Github } from 'lucide-vue-next'
import { sources, destinations, converters, type SourceProvider, type DestinationFormat } from '~/lib/registry'

// See index.vue: runtime asset paths need the base applied by hand.
const assetUrl = useAssetUrl()

useHead({ title: 'About - PluralPort Converter' })

const ConversionPath = (props: { source: SourceProvider; dest: DestinationFormat; muted?: boolean }) => {
  const labelTone = props.muted ? 'text-text-secondary' : 'text-text-heading'
  const versionTone = props.muted ? 'text-text-faint' : 'text-text-muted'
  return h('div', { class: 'flex min-w-0 flex-1 items-center gap-2' }, [
    h('span', { class: 'flex size-5 shrink-0 items-center justify-center overflow-hidden rounded bg-bg-2' }, [
      props.source.logo
        ? h('img', { src: assetUrl(props.source.logo), alt: `${props.source.name} logo`, class: 'size-full object-contain' })
        : h(props.source.icon, { class: 'size-3.5 text-text-secondary' }),
    ]),
    h('span', { class: `truncate text-sm font-semibold ${labelTone}` }, props.source.name),
    h(ArrowRight, { class: 'size-3.5 shrink-0 text-text-faint' }),
    h('span', { class: `truncate text-sm font-semibold ${labelTone}` }, props.dest.name),
    h('span', { class: `shrink-0 font-display text-[11px] ${versionTone}` }, props.dest.version),
  ])
}

const allPairs = computed(() => {
  const out: { source: SourceProvider; dest: DestinationFormat }[] = []
  for (const s of sources) for (const d of destinations) out.push({ source: s, dest: d })
  return out
})

const availableConversions = computed(() =>
  allPairs.value.filter(p =>
    converters.some(c => c.sourceId === p.source.id && c.destinationId === p.dest.id)
  )
)

const plannedConversions = computed(() =>
  allPairs.value.filter(p =>
    !converters.some(c => c.sourceId === p.source.id && c.destinationId === p.dest.id)
  )
)
</script>
