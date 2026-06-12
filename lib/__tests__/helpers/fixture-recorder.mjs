import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true })
}

const RECORD_MODE = () => process.env.RECORD_FIXTURES === '1'

/** Build a fixture recorder scoped to a single provider.
 *  Fixtures live under lib/__fixtures__/<provider>/<name>.json. */
export function createFixtureRecorder(provider, { testFile = 'lib/__tests__/clients.test.mjs' } = {}) {
  const fixturesDir = path.resolve(__dirname, '../../__fixtures__', provider)

  /** Load a previously recorded fixture from disk.
   *  Throws a helpful error with recording instructions if the fixture is missing. */
  async function loadFixture(name) {
    const filePath = path.join(fixturesDir, `${name}.json`)
    try {
      const raw = await fs.readFile(filePath, 'utf8')
      return JSON.parse(raw)
    } catch (err) {
      if (err.code === 'ENOENT') {
        throw new Error(
          `Fixture "${name}" not found at ${filePath}\n\n` +
            `To record it, run:\n` +
             `  RECORD_FIXTURES=1 npx vitest run ${testFile}`
        )
      }
      throw err
    }
  }

  /** Persist a captured HTTP response to disk as a JSON fixture.
   *  `captured` must be an object with { status, ok, body }. */
  async function saveRecordedFixture(name, captured) {
    if (!captured) {
      throw new Error(
        `No response captured for fixture "${name}". Did fetch run?`
      )
    }

    await ensureDir(fixturesDir)

    const fixture = {
      _meta: {
        recordedAt: new Date().toISOString(),
        scenario: name,
        provider,
      },
      response: captured,
    }

    const filePath = path.join(fixturesDir, `${name}.json`)
    await fs.writeFile(
      filePath,
      JSON.stringify(fixture, null, 2) + '\n',
      'utf8'
    )
  }

  /** Wire a Vitest fetch spy to replay a saved fixture instead of making real network calls. */
  async function setupFixture(name, fetchSpy) {
    const fixture = await loadFixture(name)

    fetchSpy.mockImplementation(async () => ({
      ok: fixture.response.ok,
      status: fixture.response.status,
      json: async () => fixture.response.body,
    }))
  }

  return { loadFixture, saveRecordedFixture, setupFixture }
}

/** Run a recorded-replay test, optionally recording the real response when
 *  RECORD_FIXTURES=1 is set. Shared by all provider clients.
 *
 *  - `provider`: fixture subdirectory name (e.g. 'anthropic', 'ollama').
 *  - `fixtureName`: scenario filename without extension.
 *  - `buildClient({ apiKey })`: factory that returns the LLM client under test.
 *  - `prompt` / `maxToken`: forwarded to `client.sendPrompt`.
 *  - `apiKeyEnvVar`: if set, the env var name to source the API key from
 *    (only required in record mode). Omit for providers that don't need auth.
 *  - `mockFetch`: caller-provided `() => fetchSpy` helper so the recorder
 *    module stays decoupled from the test file's Vitest setup. */
export async function runRecordingScenario({
  provider,
  fixtureName,
  buildClient,
  prompt,
  maxToken,
  apiKeyEnvVar,
  mockFetch,
}) {
  if (RECORD_MODE()) {
    let apiKey
    if (apiKeyEnvVar) {
      apiKey = process.env[apiKeyEnvVar]
      if (!apiKey) {
        throw new Error(
          `${apiKeyEnvVar} is required when RECORD_FIXTURES=1`
        )
      }
    }

    const realFetch = globalThis.fetch.bind(globalThis)
    let captured

    globalThis.fetch = async (...args) => {
      const response = await realFetch(...args)
      const body = await response.clone().json()
      captured = { status: response.status, ok: response.ok, body }
      return response
    }

    const client = buildClient({ apiKey })

    let result
    try {
      result = await client.sendPrompt(prompt, maxToken)
    } finally {
      globalThis.fetch = realFetch
    }

    if (!captured) {
      throw new Error('No response captured. Did the API call complete?')
    }

    const recorder = createFixtureRecorder(provider)
    await recorder.saveRecordedFixture(fixtureName, captured)

    return result
  }

  const recorder = createFixtureRecorder(provider)
  const fetchSpy = mockFetch()
  await recorder.setupFixture(fixtureName, fetchSpy)

  const replayArgs = {}
  if (apiKeyEnvVar && process.env[apiKeyEnvVar]) {
    replayArgs.apiKey = process.env[apiKeyEnvVar]
  }
  const client = buildClient(replayArgs)

  const result = await client.sendPrompt(prompt, maxToken)

  fetchSpy.mockRestore()
  return result
}
