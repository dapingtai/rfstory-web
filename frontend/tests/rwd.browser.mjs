// Run after `npm run build`; requires Chrome (override with CHROME_PATH).
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const cwd = fileURLToPath(new URL('../', import.meta.url))
const artifacts = await mkdtemp(join(process.env.RWD_ARTIFACT_DIR || tmpdir(), 'rfstory-rwd-'))
const server = spawn(process.execPath, ['.output/server/index.mjs'], { cwd, env: { ...process.env, PORT: '3197', HOST: '127.0.0.1' }, stdio: ['ignore', 'pipe', 'pipe'] })
let chrome
let socket
try {
  await new Promise((resolve, reject) => {
    server.stdout.on('data', resolve)
    server.once('error', reject)
    server.once('exit', code => reject(new Error(`Preview server exited: ${code}`)))
    server.stderr.on('data', chunk => process.stderr.write(chunk))
  })
  chrome = spawn(process.env.CHROME_PATH || (process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : 'google-chrome'), ['--headless=new', '--disable-gpu', '--no-first-run', '--remote-debugging-port=0', `--user-data-dir=${join(artifacts, 'profile')}`, 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] })
  const endpoint = await new Promise((resolve, reject) => {
    let output = ''
    chrome.stderr.on('data', chunk => {
      output += chunk
      const match = output.match(/DevTools listening on (ws:\/\/\S+)/)
      if (match) resolve(match[1])
    })
    chrome.once('error', reject)
    chrome.once('exit', code => reject(new Error(`Chrome exited: ${code}`)))
  })
  socket = new WebSocket(endpoint)
  await once(socket, 'open')
  let sequence = 0
  const pending = new Map()
  socket.onmessage = ({ data }) => {
    const message = JSON.parse(data)
    const request = pending.get(message.id)
    if (!request) return
    pending.delete(message.id)
    message.error ? request.reject(message.error) : request.resolve(message.result)
  }
  const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    const id = ++sequence
    pending.set(id, { resolve, reject })
    socket.send(JSON.stringify({ id, method, params, sessionId }))
  })
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' })
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true })
  const cdp = (method, params) => send(method, params, sessionId)
  await cdp('Page.enable')
  const evaluate = async expression => {
    const result = await cdp('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails))
    return result.result.value
  }
  const settle = () => evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))')
  const waitFor = expression => evaluate(`new Promise((resolve, reject) => { const deadline = Date.now() + 10000; function check() { if (${expression}) resolve(true); else if (Date.now() > deadline) reject(new Error('UI timeout')); else requestAnimationFrame(check) } check() })`)
  const click = async selector => { await evaluate(`(() => { const element = document.querySelector(${JSON.stringify(selector)}); element.focus(); element.click() })()`); await settle() }
  const screenshot = async name => {
    const { data } = await cdp('Page.captureScreenshot', { format: 'png' })
    await writeFile(join(artifacts, `${name}.png`), Buffer.from(data, 'base64'))
  }
  for (const [width, height, mobile] of [[320, 640, true], [390, 844, true], [744, 1024, true], [820, 1180, false], [844, 390, true], [1440, 900, false]]) {
    await cdp('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: true })
    await cdp('Page.navigate', { url: 'http://127.0.0.1:3197' })
    await waitFor('document.querySelector(".studio-shell") && document.querySelector("canvas").width > 300')
    await settle()
    const layout = await evaluate(`(() => {
      const rect = s => { const r = document.querySelector(s).getBoundingClientRect(); return { x:r.x, y:r.y, width:r.width, height:r.height, bottom:r.bottom } };
      return { width:innerWidth, scroll:document.documentElement.scrollWidth, canvas:rect('canvas'), footer:rect('.studio-footer'), inspector:!!document.querySelector('.inspector'), tools:rect('.canvas-view-tools') }
    })()`)
    assert.equal(layout.scroll, width, `No horizontal overflow at ${width}×${height}`)
    assert.equal(layout.inspector, !mobile, `Correct inspector mode at ${width}×${height}`)
    assert.ok(layout.canvas.height > 40, `Usable canvas at ${width}×${height}`)
    assert.ok(layout.canvas.bottom <= layout.footer.y + 1, 'Footer must not cover canvas')
    if (width <= 980) {
      await click('.materials-toggle')
      await waitFor('Math.abs(document.querySelector(".studio-sidebar").getBoundingClientRect().x) < 1')
      assert.equal(await evaluate('document.querySelector(".canvas-panel").inert'), true)
      await screenshot(`${width}-${height}-materials`)
      await click('.materials-close')
    }
    if (mobile) {
      await click('.settings-action')
      assert.equal(await evaluate('getComputedStyle(document.querySelector(".control-group input")).fontSize'), '16px')
      assert.equal(await evaluate('document.activeElement.classList.contains("sheet-close")'), true)
      await screenshot(`${width}-${height}-settings`)
      await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape' })
      await settle()
      assert.equal(await evaluate('document.querySelector(".inspector") === null'), true)
      assert.equal(await evaluate('document.activeElement.classList.contains("settings-action")'), true)
    }
    await screenshot(`${width}-${height}-canvas`)
    console.log(`PASS responsive layout ${width}×${height}`)
  }
  // Built-in fonts must actually load and change the canvas, not just the selector.
  await evaluate(`(() => { const title = document.querySelector('.inspector textarea[id$="-title"]'); title.value = '光影之間\\n留下此刻'; title.dispatchEvent(new Event('input', { bubbles: true })) })()`)
  await settle()
  const templatePreview = await evaluate('document.querySelector("canvas").toDataURL()')
  for (const [id, family] of [['noto-sans-tc', 'RF Noto Sans TC'], ['noto-serif-tc', 'RF Noto Serif TC'], ['wenkai-tc', 'RF WenKai TC'], ['liu-jian-mao-cao', 'RF Liu Jian Mao Cao'], ['chenyuluoyan-tc', 'RF Chen Yuluoyan TC']]) {
    await evaluate(`(() => { const select = Array.from(document.querySelectorAll('.inspector select')).find(element => element.querySelector('option[value="auto"]')); select.value = ${JSON.stringify(id)}; select.dispatchEvent(new Event('change', { bubbles: true })) })()`)
    await waitFor(`document.fonts.check('16px "${family}"') && document.querySelector('.studio-footer').textContent.includes('畫布字體已載入')`)
    await settle()
    assert.notEqual(await evaluate('document.querySelector("canvas").toDataURL()'), templatePreview, `${family} updates canvas pixels`)
    await screenshot(`font-${id}`)
    console.log(`PASS bundled font ${id}`)
  }
  // Verify the font used for actual Traditional Chinese glyphs, not merely font loading.
  await evaluate(`(() => { const sample = document.createElement('span'); sample.id = 'traditional-font-probe'; sample.textContent = '繁體中文：作品標題、攝影臺灣、記憶與歲月。'; sample.style.fontFamily = document.querySelector('.font-preview').style.fontFamily; document.querySelector('.font-preview').append(sample) })()`)
  await evaluate('document.fonts.ready.then(() => true)')
  await cdp('DOM.enable')
  await cdp('CSS.enable')
  const { root } = await cdp('DOM.getDocument')
  const { nodeId } = await cdp('DOM.querySelector', { nodeId: root.nodeId, selector: '#traditional-font-probe' })
  const { fonts: traditionalFonts } = await cdp('CSS.getPlatformFontsForNode', { nodeId })
  assert.ok(traditionalFonts.length > 0 && traditionalFonts.every(font => font.isCustomFont && /ChenYuluoyan/i.test(font.postScriptName)), `Traditional Chinese must use Chen Yuluoyan glyphs rather than fallback: ${JSON.stringify(traditionalFonts)}`)
  await evaluate('document.querySelector("#traditional-font-probe").remove()')
  console.log('PASS actual Traditional Chinese glyph coverage (no fallback)')
  await click('.history-controls button:first-child')
  assert.equal(await evaluate('document.querySelector(".font-preview").style.fontFamily.includes("RF Liu Jian Mao Cao")'), true, 'Undo restores previous font')
  await click('.history-controls button:nth-child(2)')
  assert.equal(await evaluate('document.querySelector(".font-preview").style.fontFamily.includes("RF Chen Yuluoyan TC")'), true, 'Redo restores selected font')
  await evaluate(`(() => { const select = Array.from(document.querySelectorAll('.inspector select')).find(element => element.querySelector('option[value="auto"]')); select.value = 'auto'; select.dispatchEvent(new Event('change', { bubbles: true })) })()`)
  await settle()
  assert.equal(await evaluate('document.querySelector("canvas").toDataURL()'), templatePreview, 'Auto restores original template typography')
  await evaluate(`(() => { const select = Array.from(document.querySelectorAll('.inspector select')).find(element => element.querySelector('option[value="auto"]')); select.value = 'chenyuluoyan-tc'; select.dispatchEvent(new Event('change', { bubbles: true })) })()`)
  await waitFor('document.querySelector(".studio-footer").textContent.includes("畫布字體已載入")')

  const defaultSizePreview = await evaluate('document.querySelector("canvas").toDataURL()')
  const setTextSize = async (label, value) => {
    await evaluate(`(() => { const input = document.querySelector('.font-size-controls input[type="range"][aria-label=${JSON.stringify(label)}]'); input.value = ${value}; input.dispatchEvent(new Event('input', { bubbles: true })) })()`)
    await settle()
  }
  await setTextSize('作品標題字級', 48)
  const largerTitlePreview = await evaluate('document.querySelector("canvas").toDataURL()')
  assert.notEqual(largerTitlePreview, defaultSizePreview, 'Font size updates canvas pixels')
  await click('.history-controls button:first-child')
  assert.equal(await evaluate('document.querySelector("canvas").toDataURL()'), defaultSizePreview, 'Undo restores default font size')
  await click('.history-controls button:nth-child(2)')
  assert.equal(await evaluate('document.querySelector("canvas").toDataURL()'), largerTitlePreview, 'Redo restores custom font size')
  await click('.font-size-controls > button')
  assert.equal(await evaluate('document.querySelector("canvas").toDataURL()'), defaultSizePreview, 'Reset restores template sizes')
  await setTextSize('作品標題字級', 42)
  await setTextSize('敘述字級', 22)
  await setTextSize('標記與拍攝資訊字級', 18)
  await screenshot('font-size-controls')
  console.log('PASS font sizes, undo/redo, and reset')

  // Upload two generated local images, exercising touch-accessible photo tools.
  await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true })
  await settle()
  await evaluate(`(() => { const canvas = document.createElement('canvas'); canvas.width=600; canvas.height=400; const ctx=canvas.getContext('2d'); ctx.fillStyle='#986d4a'; ctx.fillRect(0,0,600,400); canvas.toBlob(blob => { const data=new DataTransfer(); data.items.add(new File([blob], 'one.png', {type:'image/png'})); data.items.add(new File([blob], 'two.png', {type:'image/png'})); const input=document.querySelector('.upload-zone input'); input.files=data.files; input.dispatchEvent(new Event('change', {bubbles:true})); }); })()`)
  await waitFor('document.querySelector(".studio-footer button:last-child").disabled === false')
  await cdp('Emulation.setTouchEmulationEnabled', { enabled: true })
  const point = await evaluate('(() => { const r=document.querySelector("canvas").getBoundingClientRect(); return { x:r.x+r.width*0.35, y:r.y+r.height*0.35 } })()')
  const beforeDrag = await evaluate('document.querySelector("canvas").toDataURL()')
  await cdp('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...point, id: 0 }] })
  await cdp('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: point.x + 25, y: point.y + 20, id: 0 }] })
  await cdp('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await settle()
  assert.notEqual(await evaluate('document.querySelector("canvas").toDataURL()'), beforeDrag, 'Touch drag updates preview')
  await click('.settings-action')
  await waitFor('document.querySelectorAll(".scope-tabs button").length === 3')
  assert.equal(await evaluate('document.querySelector(".scope-badge").textContent'), 'PHOTO')
  await click('.photo-actions button:first-child')
  assert.equal(await evaluate('document.querySelector(".photo-crop-dialog").open'), true)
  await screenshot('390-photo-crop')
  await click('.crop-actions button:nth-child(2)')
  await click('.photo-actions button:last-child')
  assert.equal(await evaluate('document.querySelectorAll(".scope-tabs button").length'), 2)
  await click('.history-controls button:first-child')
  assert.equal(await evaluate('document.querySelectorAll(".scope-tabs button").length'), 3)
  await click('.sheet-close')
  await click('.studio-footer button:last-child')
  assert.equal(await evaluate('document.querySelector("dialog[aria-labelledby=export-title]").open'), true)
  await screenshot('390-export')
  await evaluate(`(() => { const fonts = new WeakMap(); const texts = new WeakMap(); const draw = CanvasRenderingContext2D.prototype.fillText; CanvasRenderingContext2D.prototype.fillText = function(...args) { if (!fonts.has(this.canvas)) { fonts.set(this.canvas, []); texts.set(this.canvas, []) }; fonts.get(this.canvas).push(this.font); texts.get(this.canvas).push(args[0]); return draw.apply(this, args) }; const original = HTMLCanvasElement.prototype.toBlob; HTMLCanvasElement.prototype.toBlob = function(...args) { window.__exportFonts = fonts.get(this) || []; window.__exportTexts = texts.get(this) || []; return original.apply(this, args) }; document.addEventListener('click', event => { if (event.target.closest('a[download]')) event.preventDefault() }, true) })()`)
  await click('.export-dialog .primary-action')
  await waitFor('document.querySelector(".studio-footer").textContent.includes("已完成下載")')
  assert.equal(await evaluate('window.__exportFonts.length > 0 && window.__exportFonts.every(font => font.includes("RF Chen Yuluoyan TC"))'), true, 'Export canvas uses the loaded Traditional Chinese handwriting font for every text draw')
  assert.equal(await evaluate('window.__exportTexts.includes("光影之間") && window.__exportTexts.includes("留下此刻") && !window.__exportTexts.some(text => text.includes("\\n"))'), true, 'Export draws title newlines as separate lines')
  assert.equal(await evaluate('window.__exportFonts.some(font => font.startsWith("42px ")) && window.__exportFonts.some(font => font.startsWith("18px "))'), true, 'Export retains chosen title and information sizes')
  console.log(`PASS upload, photo tools, crop, delete/undo, custom-font export. Screenshots: ${artifacts}`)
} finally {
  socket?.close()
  chrome?.kill()
  server.kill()
}
