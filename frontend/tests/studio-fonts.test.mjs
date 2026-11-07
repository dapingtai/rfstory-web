import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'

const source = readFileSync(new URL('../app/composables/useStudioFont.ts', import.meta.url), 'utf8')
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } })
const { studioFontOptions, studioFontFamily, canvasFont, loadStudioFont, studioTextSize } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`)

test('auto and older settings preserve template typography; unknown fonts fall back safely', () => {
  for (const id of ['auto', undefined, 'unknown']) {
    assert.equal(canvasFont(id, 13, 'monospace'), '13px monospace')
    assert.equal(canvasFont(id, 28), '28px Georgia')
  }
})

test('built-in choices use the same family for text previews and canvas', () => {
  for (const font of studioFontOptions.filter(({ id }) => id !== 'auto')) {
    assert.equal(studioFontFamily(font.id), font.family)
    assert.equal(canvasFont(font.id, 28), `28px ${font.family}`)
  }
})

test('font loading waits for completion and deduplicates preview/export requests', async () => {
  let complete
  const calls = []
  const fonts = { load: (font) => { calls.push(font); return new Promise(resolve => { complete = resolve }) } }
  const first = loadStudioFont('wenkai-tc', fonts)
  const second = loadStudioFont('wenkai-tc', fonts)
  assert.equal(first, second)
  let loaded = false
  first.then(() => { loaded = true })
  await Promise.resolve()
  assert.equal(loaded, false)
  complete([{}])
  await first
  assert.equal(loaded, true)
  await loadStudioFont('wenkai-tc', fonts)
  assert.equal(calls.length, 1)
  assert.equal(calls[0], `16px ${studioFontFamily('wenkai-tc')}`)
})

test('failed or unavailable fonts can be retried instead of being cached forever', async () => {
  let attempts = 0
  const fonts = { load: async () => { if (++attempts === 1) throw new Error('offline'); return [{}] } }
  await assert.rejects(loadStudioFont('noto-serif-tc', fonts), /offline/)
  await loadStudioFont('noto-serif-tc', fonts)
  assert.equal(attempts, 2)
  await assert.rejects(loadStudioFont('noto-sans-tc', { load: async () => [] }), /unavailable/)
  await loadStudioFont('auto', { load: () => { throw new Error('Auto must not download fonts') } })
})

test('each font asset is a real WOFF2 file with a bundled license', () => {
  const css = readFileSync(new URL('../app/assets/studio-fonts.css', import.meta.url), 'utf8')
  const assets = [...css.matchAll(/url\('\/fonts\/([^']+)'\)/g)].map((match) => match[1])
  assert.equal(assets.length, studioFontOptions.length - 1)
  for (const name of assets) {
    const bytes = readFileSync(new URL(`../public/fonts/${name}`, import.meta.url))
    assert.equal(bytes.subarray(0, 4).toString(), 'wOF2')
  }
  for (const name of ['notosanstc', 'notoseriftc', 'lxgwwenkaitc', 'liujianmaocao', 'chenyuluoyan']) {
    assert.match(readFileSync(new URL(`../public/fonts/${name}-OFL.txt`, import.meta.url), 'utf8'), /SIL OPEN FONT LICENSE/)
  }
})

test('cursive loading also waits for the bundled Traditional Chinese handwriting fallback', async () => {
  const calls = []
  let completeFallback
  const fonts = { load: (value) => {
    calls.push(value)
    if (value === `16px ${studioFontFamily('wenkai-tc')}`) return new Promise(resolve => { completeFallback = resolve })
    return Promise.resolve([{}])
  } }
  let loaded = false
  const pending = loadStudioFont('liu-jian-mao-cao', fonts).then(() => { loaded = true })
  await Promise.resolve()
  assert.equal(loaded, false)
  assert.equal(calls.length, 2)
  completeFallback([{}])
  await pending
  assert.equal(loaded, true)
})

test('Traditional Chinese handwriting is offered separately from Simplified Chinese cursive', async () => {
  assert.match(studioFontOptions.find(({ id }) => id === 'liu-jian-mao-cao').name, /簡中/)
  const traditional = studioFontOptions.find(({ id }) => id === 'chenyuluoyan-tc')
  assert.match(traditional.name, /繁中手寫/)
  assert.equal(traditional.fallback, 'wenkai-tc')
  const requests = []
  await loadStudioFont(traditional.id, { load: async (value) => { requests.push(value); return [{}] } })
  assert.deepEqual(requests, [`16px ${traditional.family}`, `16px ${studioFontFamily('wenkai-tc')}`])
})

test('font size defaults follow the template, including older saved settings', () => {
  assert.equal(studioTextSize({ template: 'film-archive' }, 'title'), 28)
  assert.equal(studioTextSize({ template: 'classic-white', fontSizes: {} }, 'title'), 30)
  assert.equal(studioTextSize({ template: 'editorial' }, 'title'), 32)
  assert.equal(studioTextSize({ template: 'editorial' }, 'note'), 16)
  assert.equal(studioTextSize({ template: 'technical-exif' }, 'info'), 15)
})

test('individual font sizes override templates without changing other roles and reject invalid sizes', () => {
  const settings = { template: 'editorial', fontSizes: { title: 48 } }
  assert.equal(studioTextSize(settings, 'title'), 48)
  assert.equal(studioTextSize(settings, 'note'), 16)
  assert.equal(studioTextSize(settings, 'info'), 13)
  assert.equal(studioTextSize({ ...settings, fontSizes: { title: -10 } }, 'title'), 12)
  assert.equal(studioTextSize({ ...settings, fontSizes: { title: 999 } }, 'title'), 72)
  assert.equal(studioTextSize({ ...settings, fontSizes: { title: NaN } }, 'title'), 32)
  assert.equal(studioTextSize({ ...settings, fontSizes: { title: Infinity } }, 'title'), 32)
})
