<script setup lang="ts">
import { ShieldCheck } from 'lucide-vue-next'
</script>

<template>
  <footer class="border-t border-border bg-bg-2">
    <div class="mx-auto flex max-w-300 flex-wrap items-center gap-x-8 gap-y-4 px-6 py-10 text-sm text-text-muted">
      <span class="flex items-center gap-2 text-text-heading">
        <img src="/images/pluralport-logo.png" alt="" class="block h-7 w-7 shrink-0 rounded" >
        <span class="font-semibold">PluralPort <span class="font-normal text-text-secondary">Converter</span></span>
      </span>

      <nav class="flex flex-wrap items-center gap-x-5 gap-y-2">
        <NuxtLink to="/about" class="text-text-muted no-underline hover:text-text-heading">About</NuxtLink>
        <NuxtLink to="/faq" class="text-text-muted no-underline hover:text-text-heading">FAQ</NuxtLink>
        <a href="https://pluralport.com" target="_blank" rel="noopener" class="text-text-muted no-underline hover:text-text-heading">Spec</a>
        <a href="https://github.com/PluralPort/pluralport-converter" target="_blank" rel="noopener" class="text-text-muted no-underline hover:text-text-heading">GitHub</a>
        <a href="https://github.com/PluralPort/pluralport-converter/issues" target="_blank" rel="noopener" class="text-text-muted no-underline hover:text-text-heading">Report a bug</a>
      </nav>
    </div>

    <div class="border-t border-border">
      <div class="mx-auto flex max-w-300 flex-col gap-2 px-6 py-5 text-xs text-text-muted">
        <div class="flex items-start gap-2">
          <ShieldCheck class="size-3.5 shrink-0 translate-y-0.5" />
          <span>Your export is read and converted entirely in your browser. There is no server: nothing is uploaded, logged, or stored.</span>
        </div>
        <p class="m-0 pl-[22px] text-text-faint">
          Logos, product names, and trademarks shown on this site are the property of their respective owners. This converter is not affiliated with or endorsed by any of the apps it reads from.
        </p>
      </div>
    </div>
  </footer>
</template>
