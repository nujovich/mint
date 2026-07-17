import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { renderHtmlToPng } from './render.mjs'

// Minimal valid PNG signature — stand-in for real screenshot bytes.
const FAKE_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

function makeFakeBrowser() {
  const calls = {
    viewport: null,
    screenshotOpts: null,
    contentSet: false,
    closed: false,
  }
  const page = {
    setViewportSize(vp) {
      calls.viewport = vp
    },
    async setContent() {
      calls.contentSet = true
    },
    async screenshot(opts) {
      calls.screenshotOpts = opts
      return FAKE_PNG
    },
  }
  const browser = {
    async newPage() {
      return page
    },
    async close() {
      calls.closed = true
    },
  }
  return { browser, calls }
}

describe('renderHtmlToPng', () => {
  let dir
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'render-'))
  })
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('renders an HTML file to a PNG at the given width via the injected browser', async () => {
    const htmlPath = join(dir, 'in.html')
    const outPath = join(dir, 'out.png')
    writeFileSync(htmlPath, '<html><body>hi</body></html>')
    const { browser, calls } = makeFakeBrowser()

    const result = await renderHtmlToPng({
      htmlPath,
      outPath,
      width: 1200,
      launch: async () => browser,
    })

    expect(result).toBe(outPath)
    expect(calls.viewport.width).toBe(1200)
    expect(calls.contentSet).toBe(true)
    expect(calls.screenshotOpts.fullPage).toBe(true)
    expect(calls.closed).toBe(true)
    expect(readFileSync(outPath)).toEqual(FAKE_PNG)
  })

  it('defaults width to 1200 when not provided', async () => {
    const htmlPath = join(dir, 'in.html')
    const outPath = join(dir, 'out.png')
    writeFileSync(htmlPath, '<html></html>')
    const { browser, calls } = makeFakeBrowser()

    await renderHtmlToPng({ htmlPath, outPath, launch: async () => browser })

    expect(calls.viewport.width).toBe(1200)
  })
})
