// Zero-dependency static server for local Penpot plugin testing.
//
//   node penpot-plugin/serve-plugin.mjs   # serves this dir on http://localhost:4400
//   PORT=5000 node penpot-plugin/serve-plugin.mjs
//
// Sets the JS MIME type ES modules need (Penpot loads src/*.mjs as modules) and
// permissive CORS so the Penpot web app can fetch the manifest cross-origin.
// Local dev helper — not loaded by the plugin itself.

import { createServer } from 'node:http'
import { readFile, writeFile } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildPlugin } from './build-plugin.mjs'

// Serve this plugin directory (the folder this script lives in).
const ROOT = fileURLToPath(new URL('.', import.meta.url))
const PORT = Number(process.env.PORT) || 4400

// Rebuild the single-file plugin.js from its sources before serving, so local
// edits to src/*.mjs are always reflected without a separate build step.
await writeFile(
  fileURLToPath(new URL('plugin.js', import.meta.url)),
  buildPlugin()
)

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
}

const server = createServer(async (req, res) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  }
  if (req.method === 'OPTIONS') {
    res.writeHead(204, cors)
    return res.end()
  }

  let pathname = decodeURIComponent(
    new URL(req.url, `http://localhost:${PORT}`).pathname
  )
  if (pathname === '/') pathname = '/manifest.json'

  // Prevent path traversal: resolve within ROOT only.
  const filePath = normalize(join(ROOT, pathname))
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403, cors)
    return res.end('Forbidden')
  }

  try {
    const body = await readFile(filePath)
    res.writeHead(200, {
      ...cors,
      'Content-Type': MIME[extname(filePath)] || 'application/octet-stream',
    })
    res.end(body)
  } catch {
    res.writeHead(404, cors)
    res.end('Not found')
  }
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Penpot plugin served at http://localhost:${PORT}/manifest.json`)
  console.log(
    'Install that URL in Penpot via the Plugin Manager. Ctrl+C to stop.'
  )
})
