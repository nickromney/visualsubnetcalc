// Headless Chrome driver for the calculator served by control.sh.
// Usage (via control.sh):
//   control.sh drive split <network> <prefix> [<child-cidr-to-split>...]
//        e.g. split 10.0.0.0 16 10.0.0.0/16 10.0.0.0/17 -> enters the base network, presses Go, splits each row
//   control.sh drive mode <standard|aws|azure|oci> <network> <prefix>
//        switch operating mode, then show the base network row (reserved/usable differ per mode)
//   control.sh drive share <network> <prefix> <child-cidr>
//        split once, export the config, open a fresh page, import it, and confirm the same rows appear
//   control.sh drive history <network> <prefix> <child-cidr> <grandchild-cidr>
//        split twice, press browser Back, and confirm the rows return to the first split (popstate restore)
// A plain reload with a clean URL resets the design by design (state lives in history and share links only).
// Each run writes NN-<step>.png, rows.json (visible subnet rows), export.json (Import/Export content), steps.jsonl.
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { chromium } from 'playwright-core'

const base = process.env.VERIFY_BASE_URL
const out = process.env.VERIFY_EVIDENCE_DIR
mkdirSync(out, { recursive: true })
let step = 0
const log = (r) => {
  const line = JSON.stringify({ at: new Date().toISOString(), ...r })
  console.log(line)
  appendFileSync(join(out, 'steps.jsonl'), `${line}\n`)
}
const browser = await chromium.launch({ headless: true, channel: 'chrome' })
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } })
const consoleErrors = []
page.on('pageerror', (e) => consoleErrors.push(String(e)))
page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()))

const rows = () =>
  page.$$eval('#calcbody tr[aria-label]', (trs) =>
    trs.map((tr) => ({
      subnet: tr.getAttribute('aria-label'),
      range: tr.querySelector('.row_range')?.textContent?.trim(),
      usable: tr.querySelector('.row_usable')?.textContent?.trim(),
      hosts: tr.querySelector('.row_hosts')?.textContent?.trim(),
    }))
  )
const capture = async (name) => {
  step += 1
  const prefix = join(out, `${String(step).padStart(2, '0')}-${name}`)
  await page.screenshot({ path: `${prefix}.png`, fullPage: true })
  const r = await rows()
  writeFileSync(`${prefix}.rows.json`, JSON.stringify(r, null, 2))
  log({ step: name, rows: r.map((x) => `${x.subnet} hosts=${x.hosts}`) })
  return r
}
const setNetwork = async (network, prefix) => {
  await page.fill('#network', network)
  await page.fill('#netsize', String(prefix))
  await page.click('#btn_go')
  await page.waitForSelector(`#calcbody tr[aria-label="${network}/${prefix}"]`)
}
const split = async (cidr) => {
  const before = (await rows()).length
  await page.getByLabel(cidr, { exact: true }).getByLabel('Split', { exact: true }).click()
  await page.waitForFunction((n) => document.querySelectorAll('#calcbody tr[aria-label]').length > n, before)
}
const exportConfig = async () => {
  await page.getByRole('button', { name: 'Tools' }).click()
  await page.getByRole('link', { name: 'Import / Export' }).click()
  const area = page.getByLabel('Import/Export Content')
  await area.waitFor()
  const text = await area.inputValue()
  writeFileSync(join(out, 'export.json'), text)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)
  return JSON.parse(text)
}

const [cmd, ...args] = process.argv.slice(2)
let failed = false
try {
  log({ command: cmd, args, base })
  await page.goto(`${base}/index.html`)
  if (cmd === 'split') {
    const [network, prefix, ...targets] = args
    await setNetwork(network, prefix)
    await capture('base')
    for (const t of targets) {
      await split(t)
      await capture(`split-${t.replace('/', '_')}`)
    }
    const cfg = await exportConfig()
    log({ exportedBase: cfg.base_network, exportedTopLevel: Object.keys(cfg.subnets ?? {}) })
  } else if (cmd === 'mode') {
    const [mode, network, prefix] = args
    await page.getByRole('button', { name: 'Tools' }).click()
    await page.locator(`#dropdown_${mode}`).click()
    await page.waitForTimeout(300)
    await setNetwork(network, prefix)
    const r = await capture(`mode-${mode}`)
    log({ mode, base: r[0] })
  } else if (cmd === 'share') {
    const [network, prefix, target] = args
    await setNetwork(network, prefix)
    await split(target)
    const first = await capture('after-split')
    const cfg = await exportConfig()
    const fresh = await browser.newPage({ viewport: { width: 1400, height: 1000 } })
    await fresh.goto(`${base}/index.html`)
    await fresh.getByRole('button', { name: 'Tools' }).click()
    await fresh.getByRole('link', { name: 'Import / Export' }).click()
    await fresh.getByLabel('Import/Export Content').fill(JSON.stringify(cfg, null, 2))
    await fresh.getByRole('button', { name: 'Import' }).click()
    await fresh.waitForSelector(`#calcbody tr[aria-label="${first[0].subnet}"]`)
    const imported = await fresh.$$eval('#calcbody tr[aria-label]', (trs) => trs.map((t) => t.getAttribute('aria-label')))
    await fresh.screenshot({ path: join(out, `${String(++step).padStart(2, '0')}-imported-fresh-page.png`), fullPage: true })
    const same = JSON.stringify(first.map((x) => x.subnet)) === JSON.stringify(imported)
    log({ step: 'imported-fresh-page', rows: imported, matchesExportingPage: same })
    if (!same) throw new Error('imported rows differ from the exporting page')
  } else if (cmd === 'history') {
    const [network, prefix, target, grandchild] = args
    await setNetwork(network, prefix)
    await split(target)
    const first = await capture('first-split')
    await split(grandchild)
    await capture('second-split')
    await page.goBack()
    await page.waitForFunction((n) => document.querySelectorAll('#calcbody tr[aria-label]').length === n, first.length)
    const back = await capture('after-back')
    const same = JSON.stringify(first.map((x) => x.subnet)) === JSON.stringify(back.map((x) => x.subnet))
    log({ restoredByBack: same })
    if (!same) throw new Error('Back did not restore the first split')
  } else {
    throw new Error(`unknown command ${cmd}; use split | mode | share | history`)
  }
} catch (error) {
  failed = true
  await capture('failure').catch(() => {})
  log({ result: 'FAIL', error: String(error) })
} finally {
  log({ consoleErrors })
  if (!failed) log({ result: 'PASS', command: cmd })
  await browser.close()
}
process.exit(failed ? 1 : 0)
