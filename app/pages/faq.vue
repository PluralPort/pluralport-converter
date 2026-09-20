<template>
  <div class="flex flex-col gap-10 py-16">
    <header class="flex flex-col gap-3">
      <span class="text-[10px] font-bold uppercase tracking-[0.2em] text-accent">Help</span>
      <h1 class="m-0 font-display text-3xl leading-tight text-text-heading max-sm:text-2xl">
        Frequently asked questions
      </h1>
      <p class="m-0 max-w-2xl text-base text-text-secondary">
        Common questions, short answers. Missing one? Open an
        <a href="https://github.com/PluralPort/pluralport-converter/issues" target="_blank" rel="noopener" class="text-accent underline decoration-accent/30 underline-offset-2 hover:decoration-accent">issue on GitHub</a>.
      </p>
    </header>

    <div
      v-for="group in faqs"
      :key="group.heading"
      class="flex flex-col gap-3"
    >
      <h2 class="m-0 font-display text-base text-text-heading">{{ group.heading }}</h2>
      <ul role="list" class="m-0 flex flex-col gap-2 p-0">
        <li v-for="(item, i) in group.items" :key="i">
          <details class="group rounded-field border border-border bg-surface open:border-accent/40">
            <summary class="flex cursor-pointer list-none items-center gap-3 px-4 py-3 text-[14px] font-semibold text-text-heading">
              <ChevronRight class="size-4 shrink-0 text-text-secondary transition-transform group-open:rotate-90" />
              <span class="flex-1">{{ item.q }}</span>
            </summary>
            <div class="flex flex-col gap-3 border-t border-border/60 px-4 py-4 pl-11 text-[14px] text-text-secondary">
              <p v-for="(para, j) in item.a" :key="j" class="m-0" v-html="para" />
            </div>
          </details>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ChevronRight } from 'lucide-vue-next'

useHead({ title: 'FAQ - PluralPort Converter' })

interface FaqItem { q: string; a: string[] }
interface FaqGroup { heading: string; items: FaqItem[] }

/**
 * I apologize for anyone who decides to edit this... prettier keeps forcing single quotes which then adds the \ everywhere...
 */
const faqs: FaqGroup[] = [
  {
    heading: 'Privacy & safety',
    items: [
      {
        q: 'Where does my data go?',
        a: [
          'Nowhere. You pick an export file from your device, it\'s read and converted in the page you already have open, and the result is written straight back to a file you download.',
          'There is no server to send it to. This site is a set of static files, and the converted page makes no requests to anything except the site it was served from. You can verify that yourself in your browser\'s network tab, or read the source.',
        ],
      },
      {
        q: 'Do I have to give you an API token?',
        a: [
          'No, and we\'d rather you never had to. Every source is an export file instead.',
          'Most plural apps issue tokens that carry your whole account, with no way to limit what they can do, so pasting one into any third-party site means trusting that site completely and rotating the token afterwards. Choosing a file avoids that entirely.',
        ],
      },
      {
        q: 'Do I need an account?',
        a: [
          'Nope. There\'s nothing to sign up for and nothing to log in to. Open the page, pick your export, download the result.',
        ],
      },
    ],
  },
  {
    heading: 'Sources & destinations',
    items: [
      {
        q: 'Why isn\'t my source/destination available yet?',
        a: [
          'This converter is new, and so is the spec. Converters get written roughly in order of how badly people need them, which usually means apps that are shutting down or have no other way out. The rest are listed as "Soon" on the <a href="/about" class="text-accent underline decoration-accent/30 underline-offset-2 hover:decoration-accent">About page</a>.',
          'If you need a specific pairing, open an issue or send a PR! A new converter is one file plus a registry entry.',
        ],
      },
      {
        q: 'What is PluralPort?',
        a: [
          'An open standard for plural system data that any app can read or write. Current draft is v0.1. Read the <a href="https://pluralport.com" target="_blank" rel="noopener" class="text-accent underline decoration-accent/30 underline-offset-2 hover:decoration-accent">spec</a> for details.',
        ],
      },
      {
        q: 'Can I import a PluralPort file into my app?',
        a: [
          'That depends on the app. PluralPort is a young spec, and each app has to add its own importer. The <a href="https://pluralport.com" target="_blank" rel="noopener" class="text-accent underline decoration-accent/30 underline-offset-2 hover:decoration-accent">spec site</a> tracks which apps read and write the format.',
          'If your destination app doesn\'t support PluralPort yet, converting still gets your data into an open, documented format that isn\'t going anywhere when an app does.',
        ],
      },
    ],
  },
  {
    heading: 'Contributing',
    items: [
      {
        q: 'How do I add a new converter?',
        a: [
          'A converter is one TypeScript file in <code class="rounded bg-bg-2 px-1.5 py-px font-mono text-[12px] text-text">app/lib/converters/</code> that exports a run function. Sources and destinations are listed in <code class="rounded bg-bg-2 px-1.5 py-px font-mono text-[12px] text-text">app/lib/registry.ts</code>.',
          'A contribution guide is coming to explain more on how everything is setup.',
        ],
      },
      {
        q: 'Where do I report bugs?',
        a: [
          'Open an issue on <a href="https://github.com/PluralPort/pluralport-converter/issues" target="_blank" rel="noopener" class="text-accent underline decoration-accent/30 underline-offset-2 hover:decoration-accent">GitHub</a>. Mention the source, destination, and any warnings you saw.',
        ],
      },
      {
        q: 'Is this affiliated with the apps it converts from?',
        a: [
          'No. This converter started as a PluralSpace project and is now maintained alongside the PluralPort spec. It\'s not affiliated with or endorsed by Simply Plural, Octocon, Tupperbox, or any other app it reads from. Logos and product names belong to their respective owners.',
        ],
      },
    ],
  },
]
</script>
