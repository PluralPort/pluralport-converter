/**
 * Resolve paths in `public/` against the app's base URL.
 *
 * Vite rewrites asset paths written literally in a template, so
 * `<img src="/images/logo.png">` picks up the base path automatically. It
 * cannot rewrite a string that only exists at runtime, which is what the
 * registry's `logo` fields are. On GitHub Project Pages the site is served
 * from `/<repo>/`, so an unrewritten "/logos/x.png" resolves to the domain
 * root and 404s while the real file sits one level down.
 *
 * Note `import.meta.env.BASE_URL` is NOT usable for this: it is "/" in the
 * server bundle that prerenders the HTML, so the generated markup comes out
 * unprefixed even when the client would have got it right. The base has to
 * come from runtime config, which is correct on both sides.
 */

/** Pure join, so it can be tested without a Nuxt context. */
export function withBase(path: string, base: string): string {
  if (!path) return path
  // Already absolute (an external avatar URL, or a data: URI): leave it.
  if (/^(https?:)?\/\//i.test(path) || path.startsWith('data:')) return path
  const b = (base || '/').replace(/\/$/, '')
  return `${b}/${path.replace(/^\//, '')}`
}

/**
 * Call in `setup()`. Returns a resolver bound to the app's base URL, for
 * binding runtime asset paths: `:src="assetUrl(src.logo)"`.
 */
export function useAssetUrl(): (path: string) => string {
  const base = useRuntimeConfig().app.baseURL
  return (path: string) => withBase(path, base)
}
