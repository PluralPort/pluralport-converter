import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  // Self-hosts Inter at build time. Deliberately not a Google Fonts link:
  // this tool promises that using it doesn't phone anywhere, and a webfont
  // request would hand every visitor's IP to a third party.
  modules: ['@nuxt/fonts'],
  css: ['~/assets/css/main.css'],
  // Fully static output. Every source is an export file read in the browser,
  // so there is no server route left and nothing to run behind the site.
  // The preset also drops .nojekyll so GitHub Pages serves _nuxt/ assets.
  nitro: {
    preset: 'github-pages',
    prerender: {
      crawlLinks: true,
      routes: ['/', '/about', '/faq'],
      failOnError: true,
    },
  },
  app: {
    // '/' suits a custom domain or an org page. Project Pages serve from a
    // subpath, so CI sets NUXT_APP_BASE_URL=/<repo>/ for that case.
    baseURL: process.env.NUXT_APP_BASE_URL || '/',
    head: {
      script: [
        // Resolve the theme before first paint, otherwise the page flashes
        // light before the dark palette lands. Mirrors the spec site so the
        // two surfaces behave identically, including the storage key.
        {
          innerHTML: `
try {
  const stored = localStorage.getItem('theme')
  const prefersDark = matchMedia('(prefers-color-scheme: dark)').matches
  const theme = stored === 'light' || stored === 'dark'
    ? stored
    : prefersDark ? 'dark' : 'light'

  const root = document.documentElement
  root.setAttribute('data-theme', theme)
  root.classList.add(theme)
  root.style.colorScheme = theme
} catch (error) {}
`,
          tagPosition: 'head',
          tagPriority: 'critical',
        },
      ],
    },
  },
  vite: {
    plugins: [tailwindcss()],
  },
})
