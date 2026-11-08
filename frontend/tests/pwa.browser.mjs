// Run after generate, with the same NUXT_APP_BASE_URL.
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { resolve, extname, sep } from 'node:path'
import { chromium } from '@playwright/test'

const base = process.env.NUXT_APP_BASE_URL || '/'
const root = resolve('.output/public')
let workerVersion = 0
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.woff2': 'font/woff2' }
const server = createServer(async (request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname)
  if (!pathname.startsWith(base)) { response.writeHead(404).end(); return }
  const file = resolve(root, pathname.slice(base.length) || 'index.html')
  if (!file.startsWith(`${root}${sep}`)) { response.writeHead(403).end(); return }
  try {
    let body = await readFile(file)
    if (file === resolve(root, 'sw.js')) body = Buffer.concat([body, Buffer.from(`\n// Test version ${workerVersion}\n`)])
    response.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' }).end(body)
  } catch { console.error('Not found:', pathname); response.writeHead(404).end() }
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
let browser
try {
  browser = await chromium.launch({ channel: process.env.PWA_BROWSER_CHANNEL || (process.platform === 'win32' ? 'chrome' : undefined) })
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') console.error(message.text()) })
  page.on('requestfailed', request => console.error('Request failed:', request.url(), request.failure()?.errorText))
  const url = `http://127.0.0.1:${server.address().port}${base}`
  await page.goto(url)
  console.log('Loaded static page')
  await page.waitForSelector('.studio-shell')
  console.log('Studio rendered; waiting for service worker')
  const scope = await page.evaluate(() => Promise.race([
    navigator.serviceWorker.ready.then(registration => registration.scope),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Service worker activation timed out')), 30000))
  ]))
  console.log('Service worker activated')
  assert.equal(scope, url, 'Service worker must only control this project')
  await page.getByRole('button', { name: '知道了' }).click()
  await context.setOffline(true)
  const response = await page.reload()
  assert.equal(response.status(), 200)
  assert.ok(response.fromServiceWorker(), 'Offline navigation must be served by the service worker')
  await page.waitForSelector('.studio-shell')
  await page.waitForFunction(() => document.querySelector('canvas')?.width > 300)
  const fonts = await page.evaluate(async () => {
    const families = ['RF Noto Sans TC', 'RF Noto Serif TC', 'RF WenKai TC', 'RF Liu Jian Mao Cao', 'RF Chen Yuluoyan TC']
    return Promise.all(families.map(async family => (await document.fonts.load(`16px "${family}"`)).length))
  })
  assert.ok(fonts.every(count => count > 0), 'All studio fonts must load offline')
  await context.setOffline(false)
  workerVersion++
  await page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update())
  const updateButton = page.getByRole('button', { name: '更新並重新載入' })
  await updateButton.waitFor()
  page.once('dialog', dialog => dialog.dismiss())
  await updateButton.click()
  assert.ok(await updateButton.isVisible(), 'Cancelling update must preserve the current editor')
  page.once('dialog', dialog => dialog.accept())
  await Promise.all([page.waitForEvent('domcontentloaded'), updateButton.click()])
  await page.waitForSelector('.studio-shell')
  assert.deepEqual(errors, [], 'No runtime errors online or offline')
  console.log(`PWA browser checks passed: scope ${base}, offline reload, canvas, all five fonts and confirmed updates`)
} finally {
  await browser?.close()
  server.closeAllConnections()
  await new Promise(resolve => server.close(resolve))
}
