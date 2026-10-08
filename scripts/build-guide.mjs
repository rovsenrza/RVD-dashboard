// The client user guide (Д35): docs/guide/instrukciya.md → public/docs/rvd-kabinet-instrukciya.pdf,
// which «Помощь» links. pandoc turns the Markdown into HTML, and the Chromium the visual tests
// already use prints it on A4 with page numbers. Pictures are the visual tests' screenshots of the
// demo, so `npm run test:visual:update` refreshes them before a rebuild.
//   npm run guide
import { execFileSync } from 'node:child_process'
import { rmSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { chromium } from 'playwright'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dir = path.join(root, 'docs/guide')
const html = path.join(dir, '.instrukciya.html')
const pdf = path.join(root, 'public/docs/rvd-kabinet-instrukciya.pdf')

execFileSync(
  'pandoc',
  [
    'instrukciya.md',
    '--standalone',
    '--section-divs',
    '--toc',
    '--toc-depth=2',
    '--css',
    'guide.css',
    '-o',
    html,
  ],
  { cwd: dir, stdio: 'inherit' },
)

const browser = await chromium.launch()
try {
  const page = await browser.newPage()
  await page.goto(pathToFileURL(html).href, { waitUntil: 'networkidle' })
  await page.evaluate(() => document.fonts.ready)
  await page.pdf({
    path: pdf,
    format: 'A4',
    preferCSSPageSize: true,
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: '<span></span>',
    footerTemplate:
      '<div style="width:100%;padding:0 18mm;font:8px system-ui,sans-serif;color:#6b6b66;display:flex;justify-content:space-between">' +
      '<span>РВД Кабинет · инструкция для пользователя</span>' +
      '<span>Стр. <span class="pageNumber"></span> из <span class="totalPages"></span></span></div>',
  })
} finally {
  await browser.close()
  rmSync(html, { force: true })
}
console.log(`guide → ${path.relative(root, pdf)}`)
