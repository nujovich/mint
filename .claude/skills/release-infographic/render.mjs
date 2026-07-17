// Deterministic HTML→PNG renderer for the release-infographic skill.
//
//   node render.mjs <htmlPath> <outPath> [width]
//
// Rendering is done by a headless browser so the mint-branded HTML (exact
// brand tokens + accurate technical text) renders faithfully. Fonts load from
// Google Fonts over the network; offline runs fall back to system fonts. The
// `launch` parameter is injectable so unit tests run without a real browser.

import { readFileSync, writeFileSync } from 'node:fs'
import { argv } from 'node:process'
import { fileURLToPath } from 'node:url'

// Lazily import Playwright only when actually rendering, so tests that inject
// their own `launch` never load the browser package.
async function defaultLaunch() {
  const { chromium } = await import('playwright')
  return chromium.launch()
}

export async function renderHtmlToPng({
  htmlPath,
  outPath,
  width = 1200,
  launch = defaultLaunch,
}) {
  const browser = await launch()
  try {
    const page = await browser.newPage()
    // Height is a seed; fullPage screenshot captures the real content height.
    await page.setViewportSize({ width, height: 100 })
    const html = readFileSync(htmlPath, 'utf8')
    await page.setContent(html, { waitUntil: 'networkidle' })
    const buffer = await page.screenshot({ fullPage: true, type: 'png' })
    writeFileSync(outPath, buffer)
    return outPath
  } finally {
    await browser.close()
  }
}

// CLI entry point.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [, , htmlPath, outPath, widthArg] = argv
  if (!htmlPath || !outPath) {
    console.error('Usage: node render.mjs <htmlPath> <outPath> [width]')
    process.exit(1)
  }
  const width = widthArg ? Number(widthArg) : 1200
  if (Number.isNaN(width) || width <= 0) {
    console.error('Usage: node render.mjs <htmlPath> <outPath> [width]')
    console.error(`Invalid width: ${widthArg}`)
    process.exit(1)
  }
  renderHtmlToPng({ htmlPath, outPath, width })
    .then((p) => console.log(`Wrote ${p}`))
    .catch((err) => {
      console.error(err)
      process.exit(1)
    })
}
