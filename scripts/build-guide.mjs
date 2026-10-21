// The user guides (Д35): docs/guide/*.md → public/docs/*.pdf, which «Помощь» links — the
// client's, or the supplier's section for its staff. pandoc turns the Markdown into HTML, and
// the Chromium the visual tests already use prints it on A4 with page numbers. Pictures are the visual tests' screenshots of the
// demo, so `npm run test:visual:update` refreshes them before a rebuild.
//   npm run guide
import { execFileSync } from 'node:child_process'
import { rmSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { chromium } from 'playwright'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dir = path.join(root, 'docs/guide')

/** The client's guide, and the supplier staff's own (customer, 2026-10-22). */
const GUIDES = [
  {
    source: 'instrukciya.md',
    pdf: 'apps/web/public/docs/rvd-kabinet-instrukciya.pdf',
    footer: 'РВД Кабинет · инструкция для пользователя',
  },
  {
    source: 'postavshchik.md',
    pdf: 'apps/web/public/docs/rvd-kabinet-postavshchik.pdf',
    footer: 'РВД Кабинет · раздел поставщика',
  },
]

const browser = await chromium.launch()
try {
  for (const guide of GUIDES) {
    const html = path.join(dir, `.${guide.source}.html`)
    const pdf = path.join(root, guide.pdf)
    execFileSync(
      'pandoc',
      [
        guide.source,
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
          `<span>${guide.footer}</span>` +
          '<span>Стр. <span class="pageNumber"></span> из <span class="totalPages"></span></span></div>',
      })
      await page.close()
    } finally {
      rmSync(html, { force: true })
    }
    console.log(`guide → ${guide.pdf}`)
  }
} finally {
  await browser.close()
}
