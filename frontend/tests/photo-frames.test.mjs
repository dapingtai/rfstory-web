import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'

const source = readFileSync(new URL('../app/composables/usePhotoFrame.ts', import.meta.url), 'utf8')
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } })
const { photoFrameOptions, resolvePhotoFrame, photoFrameLayout, drawFramedPhoto } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`)

test('each canvas template supplies an automatic frame; explicit styles are independent', () => {
  const expected = {
    'film-archive': 'film', 'classic-white': 'white', 'dark-gallery': 'black',
    editorial: 'instant', 'technical-exif': 'double', signature: 'white'
  }
  for (const [template, frame] of Object.entries(expected)) {
    assert.equal(resolvePhotoFrame('auto', template), frame)
    assert.equal(resolvePhotoFrame('none', template), 'none')
    assert.equal(resolvePhotoFrame('instant', template), 'instant')
  }
})

test('frame geometry contains the entire image and preserves its aspect ratio', () => {
  for (const [width, height] of [[1200, 800], [800, 1200], [1000, 1000]]) {
    for (const { id } of photoFrameOptions.filter(({ id }) => id !== 'auto')) {
      for (const border of [1, 4, 12]) {
        const layout = photoFrameLayout(width, height, id, border)
        assert.equal(layout.width - layout.padding * 2, width)
        assert.equal(layout.height - layout.padding - layout.bottom, height)
        assert.equal(layout.bottom, id === 'instant' || id === 'instant-shadow' ? layout.padding * 4 : layout.padding)
        if (id === 'none') assert.deepEqual(layout, { padding: 0, bottom: 0, width, height })
      }
    }
  }
})

test('all styles draw the uncropped image and balance canvas save/restore', () => {
  const image = { width: 1200, height: 800 }
  for (const { id } of photoFrameOptions.filter(({ id }) => id !== 'auto')) {
    const calls = []
    const context = Object.fromEntries(['save', 'restore', 'fillRect', 'strokeRect', 'drawImage'].map((name) => [name, (...args) => calls.push([name, ...args])]))
    context.getTransform = () => ({ a: 1, b: 0 })
    drawFramedPhoto(context, image, id, 4)
    const layout = photoFrameLayout(image.width, image.height, id, 4)
    assert.deepEqual(calls.find(([name]) => name === 'drawImage'), ['drawImage', image, layout.padding, layout.padding, image.width, image.height])
    assert.equal(calls[0][0], 'save')
    assert.equal(calls.at(-1)[0], 'restore')
    assert.equal(calls.filter(([name]) => name === 'save').length, calls.filter(([name]) => name === 'restore').length)
    if (id === 'instant-shadow') {
      assert.ok(context.shadowBlur > 0)
      assert.ok(context.shadowOffsetY > 0)
      const drawIndex = calls.findIndex(([name]) => name === 'drawImage')
      assert.equal(calls[drawIndex - 1][0], 'restore', 'shadow must be restored before drawing the photo')
    }
    if (id === 'film') assert.ok(calls.filter(([name]) => name === 'fillRect').length > 2)
    if (id === 'double') assert.equal(calls.filter(([name]) => name === 'strokeRect').length, 2)
  }
})

test('cropping uses original source coordinates and frames only the retained area', () => {
  const image = { width: 1200, height: 800 }
  const crop = { x: 0.25, y: 0.1, width: 0.5, height: 0.75 }
  const calls = []
  const context = Object.fromEntries(['save', 'restore', 'fillRect', 'strokeRect', 'drawImage'].map((name) => [name, (...args) => calls.push([name, ...args])]))
  drawFramedPhoto(context, image, 'instant', 4, crop)
  assert.deepEqual(calls.find(([name]) => name === 'drawImage'), ['drawImage', image, 300, 80, 600, 600, 24, 24, 600, 600])
  assert.deepEqual(calls.find(([name]) => name === 'fillRect'), ['fillRect', 0, 0, 648, 720])
  assert.deepEqual(image, { width: 1200, height: 800 })
})
