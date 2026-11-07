import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'

const studio = readFileSync(new URL('../app/composables/useStudio.ts', import.meta.url), 'utf8')
const renderer = readFileSync(new URL('../app/components/RfStudio.vue', import.meta.url), 'utf8')
const drawLines = renderer.slice(renderer.indexOf('function drawLines('), renderer.indexOf('function snapshot('))
const drawFrameText = renderer.slice(renderer.indexOf('function drawFrameText('), renderer.indexOf('function renderPreview('))
const source = `${studio}
let settings: StudioSettings
let globalInfoRegions: unknown[] = []
${drawLines}
${drawFrameText}
export function renderText(next: StudioSettings) {
  settings = next
  globalInfoRegions = []
  const calls: string[] = []
  const context = {
    font: '',
    fillText: (value: string) => calls.push(value),
    measureText: (value: string) => ({ width: value.length * 7, actualBoundingBoxAscent: 12, actualBoundingBoxDescent: 4 }),
    getTransform: () => ({ a: 1, d: 1, e: 0, f: 0 })
  } as unknown as CanvasRenderingContext2D
  drawFrameText(context, ...aspectSize(settings.ratio))
  return { calls, regions: globalInfoRegions }
}`
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } })
const { defaultSettings, globalInfoFields, globalInfoText, templateOptions, renderText } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`)

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
