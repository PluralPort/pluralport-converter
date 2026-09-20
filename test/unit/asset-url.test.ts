import { describe, expect, it } from 'vitest'
import { withBase } from '../../app/utils/assetUrl'

/**
 * Regression cover for the bug that broke every source logo on the deployed
 * site: registry logo paths are runtime strings, so Vite cannot rewrite them
 * with the base path, and on Project Pages they resolved to the domain root.
 */
describe('withBase', () => {
  it('prefixes a public path with a subpath base', () => {
    expect(withBase('/logos/ampersand.png', '/pluralport-converter/'))
      .toBe('/pluralport-converter/logos/ampersand.png')
  })

  it('handles a base with no trailing slash', () => {
    expect(withBase('/logos/a.png', '/pluralport-converter'))
      .toBe('/pluralport-converter/logos/a.png')
  })

  it('handles a path with no leading slash', () => {
    expect(withBase('logos/a.png', '/pluralport-converter/'))
      .toBe('/pluralport-converter/logos/a.png')
  })

  it('leaves a root base alone without doubling slashes', () => {
    expect(withBase('/logos/a.png', '/')).toBe('/logos/a.png')
  })

  it('treats an empty base as root', () => {
    expect(withBase('/logos/a.png', '')).toBe('/logos/a.png')
  })

  // Asset URIs from an export are already absolute and must not be mangled.
  it.each([
    'https://cdn.example.com/a.png',
    'http://cdn.example.com/a.png',
    '//cdn.example.com/a.png',
    'data:image/png;base64,AAAA',
  ])('leaves absolute reference %s untouched', (url) => {
    expect(withBase(url, '/pluralport-converter/')).toBe(url)
  })

  it('passes an empty path straight through', () => {
    expect(withBase('', '/base/')).toBe('')
  })
})
