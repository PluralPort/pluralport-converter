<script setup lang="ts">
import { Github, Menu, Moon, Sun, X } from 'lucide-vue-next'
import { PLURALPORT_VERSION } from '~/lib/pluralport'

const route = useRoute()

const navLinks = [
  { label: 'Convert', to: '/' },
  { label: 'About', to: '/about' },
  { label: 'FAQ', to: '/faq' },
]

const isActive = (to: string) =>
  to === '/' ? route.path === '/' : route.path === to || route.path.startsWith(`${to}/`)

const theme = ref<'light' | 'dark'>('light')
const open = ref(false)

const applyTheme = (value: 'light' | 'dark', persist = false) => {
  if (typeof document !== 'undefined') {
    const root = document.documentElement
    root.setAttribute('data-theme', value)
    root.classList.toggle('dark', value === 'dark')
    root.classList.toggle('light', value === 'light')
    root.style.colorScheme = value
  }

  theme.value = value

  if (persist && typeof window !== 'undefined') {
    window.localStorage.setItem('theme', value)
  }
}

const toggleTheme = () => {
  applyTheme(theme.value === 'dark' ? 'light' : 'dark', true)
}

onMounted(() => {
  if (typeof window === 'undefined') return

  const storedTheme = window.localStorage.getItem('theme')
  const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches

  if (storedTheme === 'light' || storedTheme === 'dark') {
    applyTheme(storedTheme)
  } else {
    applyTheme(systemPrefersDark ? 'dark' : 'light')
  }

  // Follow the system only while the visitor has made no explicit choice.
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  const handleSystemThemeChange = (event: MediaQueryListEvent) => {
    if (!window.localStorage.getItem('theme')) {
      applyTheme(event.matches ? 'dark' : 'light')
    }
  }
  mediaQuery.addEventListener('change', handleSystemThemeChange)
})

// A route change should never leave the mobile panel hanging open.
watch(() => route.path, () => { open.value = false })
</script>

<template>
  <header class="sticky top-0 z-50 border-b border-border bg-bg/95 backdrop-blur-sm">
    <div class="mx-auto flex h-15 max-w-300 items-center gap-5.5 px-6">
      <NuxtLink to="/" class="flex items-center gap-2 text-text-heading no-underline">
        <img src="/images/pluralport-logo.png" alt="" class="h-7 w-7 rounded" >
        <span class="font-bold">PluralPort <span class="font-normal text-text-secondary">Converter</span></span>
      </NuxtLink>

      <nav class="hidden shrink-0 items-center gap-5 whitespace-nowrap text-sm md:flex">
        <NuxtLink
          v-for="link in navLinks"
          :key="link.to"
          :to="link.to"
          :aria-current="isActive(link.to) ? 'page' : undefined"
          :class="[
            'transition',
            isActive(link.to)
              ? 'text-text-heading underline decoration-accent decoration-2 underline-offset-8'
              : 'text-text-muted no-underline hover:text-text-heading',
          ]"
        >{{ link.label }}</NuxtLink>
      </nav>

      <div class="ml-auto flex shrink-0 items-center gap-3 whitespace-nowrap text-sm text-text-muted">
        <a
          href="https://pluralport.com"
          target="_blank"
          rel="noopener"
          class="hidden rounded border border-border-strong px-2 py-1 text-[11px] uppercase tracking-[0.16em] text-text-secondary no-underline transition hover:text-text-heading sm:block"
        >Spec v{{ PLURALPORT_VERSION }}</a>
        <button
          type="button"
          :aria-label="theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'"
          class="flex cursor-pointer items-center text-text-secondary transition hover:text-text-heading"
          @click="toggleTheme"
        >
          <Sun v-if="theme === 'dark'" class="size-5" />
          <Moon v-else class="size-5" />
        </button>
        <a
          href="https://github.com/PluralPort/pluralport-converter"
          target="_blank"
          rel="noopener"
          aria-label="Source on GitHub"
          class="flex items-center text-text-secondary no-underline transition hover:text-text-heading"
        ><Github class="size-5" /></a>
        <button
          type="button"
          class="relative inline-flex cursor-pointer items-center justify-center rounded-md p-2 text-text-secondary transition hover:text-text-heading md:hidden"
          :aria-expanded="open"
          @click="open = !open"
        >
          <span class="sr-only">Toggle main menu</span>
          <Menu v-if="!open" class="size-5" />
          <X v-else class="size-5" />
        </button>
      </div>
    </div>

    <div v-if="open" class="border-t border-border md:hidden">
      <div class="mx-auto max-w-300 px-6 py-4">
        <nav class="grid gap-2 text-sm">
          <NuxtLink
            v-for="link in navLinks"
            :key="link.to"
            :to="link.to"
            :aria-current="isActive(link.to) ? 'page' : undefined"
            :class="[
              'rounded px-2 py-2 no-underline transition',
              isActive(link.to)
                ? 'bg-bg-2 text-text-heading'
                : 'text-text-muted hover:bg-bg-2 hover:text-text-heading',
            ]"
          >{{ link.label }}</NuxtLink>
        </nav>
      </div>
    </div>
  </header>
</template>
