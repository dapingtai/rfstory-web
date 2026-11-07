import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'

const studio = readFileSync(new URL('../app/composables/useStudio.ts', import.meta.url), 'utf8')
const studioFont = readFileSync(new URL('../app/composables/useStudioFont.ts', import.meta.url), 'utf8')
const renderer = readFileSync(new URL('../app/components/RfStudio.vue', import.meta.url), 'utf8')
const drawLines = renderer.slice(renderer.indexOf('function drawLines('), renderer.indexOf('function snapshot('))
const drawFrameText = renderer.slice(renderer.indexOf('function drawFrameText('), renderer.indexOf('function renderPreview('))
const source = `${studioFont}\n${studio}
let settings: StudioSettings
let globalInfoRegions: unknown[] = []
${drawLines}
${drawFrameText}
export { wrapCanvasText }
export function renderText(next: StudioSettings) {
  settings = next
  globalInfoRegions = []
  const calls: string[] = []
  const fonts: string[] = []
  const draws: { value: string; x: number; y: number; font: string }[] = []
  const context = {
    font: '',
    fillText: (value: string, x: number, y: number) => { calls.push(value); fonts.push(context.font); draws.push({ value, x, y, font: context.font }) },
    measureText: (value: string) => ({ width: value.length * 7, actualBoundingBoxAscent: 12, actualBoundingBoxDescent: 4 }),
    getTransform: () => ({ a: 1, d: 1, e: 0, f: 0 })
  } as unknown as CanvasRenderingContext2D
  drawFrameText(context, ...aspectSize(settings.ratio))
  return { calls, fonts, draws, regions: globalInfoRegions }
}`
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } })
const { defaultSettings, globalInfoFields, globalInfoText, templateOptions, studioFontOptions, renderText, wrapCanvasText } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`)

test('global information defaults remain visible for existing saved presets', () => {
  const settings = { ...defaultSettings, title: 'My work' }
  assert.equal(globalInfoText(settings, ['frameLabel']), 'RFSTORY / FRAME 01')
  assert.equal(globalInfoText(settings, ['title']), 'My work')
})

test('hidden and empty metadata leave no separators and do not erase stored content', () => {
  const settings = { ...defaultSettings, camera: 'Camera', lens: '', iso: 'ISO 100', globalInfoVisibility: { camera: false } }
  assert.equal(globalInfoText(settings, ['camera', 'lens', 'iso']), 'ISO 100')
  assert.equal(settings.camera, 'Camera')
  assert.equal(globalInfoText({ ...settings, globalInfoVisibility: {} }, ['camera', 'lens', 'iso']), 'Camera · ISO 100')
  assert.equal(globalInfoText({ ...settings, lens: '   ' }, ['lens']), '')
})

test('film archive renders the edited label instead of a hard-coded brand', () => {
  const { calls } = renderText({ ...defaultSettings, frameLabel: 'RESTORY / FRAME 12' })
  assert.ok(calls.includes('RESTORY / FRAME 12'))
  assert.ok(!calls.includes('RFSTORY / FRAME 01'))
})

test('description is hidden by default and can be shown in every template and ratio', () => {
  assert.equal(defaultSettings.globalInfoVisibility.note, false)
  for (const { id: template } of templateOptions) {
    for (const ratio of ['3:2', '9:16']) {
      const settings = { ...defaultSettings, template, ratio, note: 'MY DESCRIPTION' }
      assert.ok(!renderText(settings).calls.includes(settings.note), `${template}/${ratio} hides description by default`)
      const visible = { ...settings, globalInfoVisibility: { ...settings.globalInfoVisibility, note: true } }
      assert.ok(renderText(visible).calls.includes(settings.note), `${template}/${ratio} shows checked description`)
      assert.equal(settings.note, 'MY DESCRIPTION')
    }
  }
})

test('every global field can be hidden independently across all templates and ratios', () => {
  for (const { id: template } of templateOptions) {
    for (const ratio of ['3:2', '9:16']) {
      const settings = { ...defaultSettings, template, ratio }
      for (const { key } of globalInfoFields) settings[key] = key.toUpperCase()
      for (const { key } of globalInfoFields) {
        const { calls } = renderText({ ...settings, globalInfoVisibility: { [key]: false } })
        assert.ok(!calls.join(' ').includes(settings[key]), `${template}/${ratio} must hide ${key}`)
      }
      const globalInfoVisibility = Object.fromEntries(globalInfoFields.map(({ key }) => [key, false]))
      const hidden = renderText({ ...settings, globalInfoVisibility })
      assert.deepEqual(hidden.calls.filter(Boolean), [])
      assert.deepEqual(hidden.regions, [], 'hidden information must not remain draggable')
    }
  }
})

test('clearing the title does not restore placeholder text', () => {
  for (const { id: template } of templateOptions) {
    assert.ok(!renderText({ ...defaultSettings, template, title: '' }).calls.includes('Untitled Frame'))
  }
})

test('every template draws all global text with the chosen built-in font', () => {
  for (const { id: template } of templateOptions) {
    for (const font of studioFontOptions.filter(({ id }) => id !== 'auto')) {
      const { fonts } = renderText({ ...defaultSettings, template, font: font.id, globalInfoVisibility: { note: true } })
      assert.ok(fonts.length > 0)
      assert.ok(fonts.every((value) => value.endsWith(font.family)), `${template} uses ${font.id} consistently`)
    }
  }
})

test('text wrapping respects manual newlines, blank lines, CRLF, and automatic wrapping', () => {
  const context = { measureText: (value) => ({ width: Array.from(value).length * 7 }) }
  assert.deepEqual(wrapCanvasText(context, '第一行\r\n\r\n第三行', 100, 4), ['第一行', '', '第三行'])
  assert.deepEqual(wrapCanvasText(context, '甲乙丙\n丁', 14, 4), ['甲乙', '丙', '丁'])
  assert.deepEqual(wrapCanvasText(context, '🌙光影', 14, 4), ['🌙光', '影'])
  assert.deepEqual(wrapCanvasText(context, '一\n二\n三\n四\n五', 100, 4), ['一', '二', '三', '四'])
  assert.deepEqual(wrapCanvasText(context, '', 100, 4), [])
})

test('title templates render four separate lines inside the canvas without metadata collisions', () => {
  for (const { id: template } of templateOptions.filter(({ id }) => id !== 'technical-exif')) {
    for (const ratio of ['3:2', '9:16']) {
      const settings = { ...defaultSettings, template, ratio, title: '第一行\n第二行\n第三行\n第四行', note: '作品敘述', globalInfoVisibility: { note: true } }
      const { draws } = renderText(settings)
      const rows = ['第一行', '第二行', '第三行', '第四行'].map((value) => draws.find((draw) => draw.value === value))
      assert.ok(rows.every(Boolean), `${template}/${ratio} draws all title lines`)
      assert.ok(rows.every((row, index) => index === 0 || row.y > rows[index - 1].y))
      const note = draws.find(({ value }) => value === settings.note)
      assert.ok(note.y < rows[0].y - 20 || note.y > rows[3].y + 20, 'Description does not overlap title')
      assert.ok(!draws.some(({ value }) => value.includes('\n')))
      if (template === 'signature') {
        const rightEdges = rows.map(({ value, x }) => x + value.length * 7)
        assert.ok(rightEdges.every((edge) => edge === rightEdges[0]), 'Signature lines are right aligned')
      }
    }
  }
})

test('blank title lines retain their spacing, and visibility still hides multiline titles', () => {
  const settings = { ...defaultSettings, title: '第一行\n\n第三行' }
  const { draws } = renderText(settings)
  assert.equal(draws.find(({ value }) => value === '第三行').y - draws.find(({ value }) => value === '第一行').y, 68)
  const hidden = renderText({ ...settings, globalInfoVisibility: { title: false } })
  assert.ok(!hidden.calls.includes('第一行'))
  assert.ok(!hidden.calls.includes('第三行'))
})

test('custom sizes apply to each text role in every template, with independent line spacing', () => {
  for (const { id: template } of templateOptions) {
    for (const ratio of ['3:2', '9:16']) {
      const settings = { ...defaultSettings, template, ratio, title: '第一行\n第二行', note: '作品敘述', fontSizes: { title: 48, note: 24, info: 20 }, globalInfoVisibility: { note: true } }
      const { draws } = renderText(settings)
      const note = draws.find(({ value }) => value === settings.note)
      assert.ok(note.font.startsWith('24px '), `${template}/${ratio} uses description size`)
      if (template !== 'technical-exif') {
        const first = draws.find(({ value }) => value === '第一行')
        const second = draws.find(({ value }) => value === '第二行')
        assert.ok(first.font.startsWith('48px '))
        assert.ok(second.y - first.y >= 48, 'Line spacing grows with the title size')
        assert.ok(note.y < first.y - 24 || note.y > second.y + 24, 'Description remains separated')
      }
      const info = draws.filter(({ value }) => value !== settings.note && !['第一行', '第二行'].includes(value))
      assert.ok(info.length > 0)
      assert.ok(info.every(({ font }) => font.startsWith('20px ')), `${template}/${ratio} uses information size`)
    }
  }
})
