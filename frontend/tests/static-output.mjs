import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

const output = resolve('.output/public')
const base = process.env.NUXT_APP_BASE_URL || '/'
const html = readFileSync(resolve(output, 'index.html'), 'utf8')
assert.ok(html.includes(`${base}_nuxt/`), `HTML must reference assets under ${base}_nuxt/`)

const styles = readdirSync(resolve(output, '_nuxt')).filter(name => name.endsWith('.css'))
const css = styles.map(name => readFileSync(resolve(output, '_nuxt', name), 'utf8')).join('\n')
const fontURLs = [...css.matchAll(/url\(["']?([^\s"')]+\.woff2)["']?\)/g)].map(match => match[1])
assert.ok(fontURLs.length >= 5, 'All bundled studio fonts must appear in the generated CSS')
for (const url of fontURLs) {
  const resolved = new URL(url, `https://pages.example${base}_nuxt/entry.css`)
  assert.equal(resolved.origin, 'https://pages.example', `Font must be self-hosted: ${url}`)
  assert.ok(resolved.pathname.startsWith(base), `Font URL must use the deployment base: ${url}`)
  assert.ok(existsSync(resolve(output, resolved.pathname.slice(base.length))), `Font asset must exist: ${url}`)
}
console.log(`Static HTML and ${fontURLs.length} font URLs verified for ${base}`)
