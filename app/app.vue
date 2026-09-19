<template>
  <div class="isolate flex min-h-dvh flex-col bg-bg text-text antialiased">
    <header class="border-b border-border bg-bg/90 backdrop-blur">
      <div class="mx-auto flex w-full max-w-5xl items-center justify-between gap-6 px-5 py-3">
        <NuxtLink to="/" class="flex items-center gap-2.5 text-text-heading">
          <span class="flex size-7 items-center justify-center rounded-field border border-border bg-surface text-accent">
            <Repeat class="size-4" :stroke-width="2" />
          </span>
          <span class="font-display text-base leading-none">PluralPort Converter</span>
        </NuxtLink>

        <nav class="flex items-center gap-1 text-sm">
          <NuxtLink
            v-for="link in navLinks"
            :key="link.to"
            :to="link.to"
            class="rounded-button px-3 py-1.5 font-medium text-text-secondary transition hover:bg-surface hover:text-text"
            active-class="!text-accent"
          >
            {{ link.label }}
          </NuxtLink>
          <a
            href="https://github.com/PluralPort/pluralport-converter"
            target="_blank"
            rel="noopener"
            class="ml-1 inline-flex items-center gap-1.5 rounded-button border border-border px-3 py-1.5 text-sm font-medium text-text-secondary transition hover:border-surface-4 hover:text-text"
          >
            <Github class="size-4" />
            <span class="max-sm:hidden">GitHub</span>
          </a>
        </nav>
      </div>
    </header>

    <main class="flex-1">
      <div class="mx-auto w-full max-w-5xl px-5">
        <NuxtPage />
      </div>
    </main>

    <footer class="border-t border-border bg-bg-2">
      <div class="mx-auto grid w-full max-w-5xl gap-10 px-5 py-10 md:grid-cols-[1fr_auto_auto_auto]">
        <div class="flex flex-col gap-2">
          <NuxtLink to="/" class="flex items-center gap-2 text-text-heading">
            <span class="flex size-6 items-center justify-center rounded border border-border bg-surface text-accent">
              <Repeat class="size-3.5" :stroke-width="2" />
            </span>
            <span class="font-display text-sm leading-none">PluralPort Converter</span>
          </NuxtLink>
          <p class="m-0 max-w-xs text-xs text-text-muted">
            Turn a plural app's export into a PluralPort file. Runs in your browser, open source.
          </p>
        </div>

        <div class="flex flex-col gap-2">
          <div class="text-[10px] font-bold uppercase tracking-[0.2em] text-text-muted">Resources</div>
          <a href="https://pluralport.com" target="_blank" rel="noopener" class="text-sm text-text-secondary hover:text-text">PluralPort spec</a>
          <a href="https://pluralspace.app" target="_blank" rel="noopener" class="text-sm text-text-secondary hover:text-text">PluralSpace</a>
          <a href="https://github.com/PluralPort/pluralport-converter" target="_blank" rel="noopener" class="text-sm text-text-secondary hover:text-text">GitHub</a>
        </div>

        <div class="flex flex-col gap-2">
          <div class="text-[10px] font-bold uppercase tracking-[0.2em] text-text-muted">Contribute</div>
          <a href="https://github.com/PluralPort/pluralport-converter/issues" target="_blank" rel="noopener" class="text-sm text-text-secondary hover:text-text">Report a bug</a>
          <a href="https://github.com/PluralPort/pluralport-converter/blob/main/CONTRIBUTING.md" target="_blank" rel="noopener" class="text-sm text-text-secondary hover:text-text">Add a converter</a>
        </div>
      </div>

      <div class="border-t border-border">
        <div class="mx-auto flex w-full max-w-5xl flex-col gap-2 px-5 py-5 text-xs text-text-muted">
          <div class="flex items-start gap-2">
            <ShieldCheck class="size-3.5 shrink-0 translate-y-0.5" />
            <span>
              Your data is mapped in your browser. Source API calls pass through a stateless proxy (for CORS). Nothing is logged or stored.
            </span>
          </div>
          <p class="m-0 pl-[22px] text-text-faint">
            Logos, product names, and trademarks shown on this site are the property of their respective owners. This converter is not affiliated with or endorsed by any of the apps it reads from.
          </p>
        </div>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { Github, Repeat, ShieldCheck } from 'lucide-vue-next'

const navLinks = [
  { to: '/about', label: 'About' },
  { to: '/faq',   label: 'FAQ' },
]
</script>
