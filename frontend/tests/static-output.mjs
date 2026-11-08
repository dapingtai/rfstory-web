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

const manifest = JSON.parse(readFileSync(resolve(output, 'manifest.webmanifest'), 'utf8'))
assert.equal(manifest.id, base)
assert.equal(manifest.start_url, base)
assert.equal(manifest.scope, base)
assert.equal(manifest.display, 'standalone')
assert.ok(html.includes(`${base}manifest.webmanifest`))
assert.ok(html.includes(`${base}icons/apple-touch-icon.png`))
assert.ok(html.includes(`${base}icons/favicon-32.png`))
const favicon = readFileSync(resolve(output, 'icons/favicon-32.png'))
assert.equal(favicon.readUInt32BE(16), 32)
assert.equal(favicon.readUInt32BE(20), 32)
for (const icon of manifest.icons) {
  assert.ok(icon.src.startsWith(base))
  const bytes = readFileSync(resolve(output, icon.src.slice(base.length)))
  assert.equal(bytes.subarray(1, 4).toString(), 'PNG')
  const [width, height] = icon.sizes.split('x').map(Number)
  assert.equal(bytes.readUInt32BE(16), width)
  assert.equal(bytes.readUInt32BE(20), height)
}
assert.ok(manifest.icons.some(icon => icon.purpose === 'maskable'))
const worker = readFileSync(resolve(output, 'sw.js'), 'utf8')
assert.ok(worker.includes(JSON.stringify(base)), 'Offline navigation must stay within the deployment base')
for (const name of ['NotoSansTC', 'NotoSerifTC', 'LXGWWenKaiTC-Regular', 'LiuJianMaoCao-Regular', 'ChenYuluoyan-2.0-Thin']) {
  assert.ok(worker.includes(`${name}.woff2`), `${name} must be precached for offline export`)
}
console.log('PWA manifest, icons and offline precache verified')
