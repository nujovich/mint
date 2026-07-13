/**
 * Token Diff — compare two mint-ds tokens.json files and classify what changed.
 *
 * Categories of change:
 *   - added         a token present in the new file but not the old one
 *   - removed       a token present in the old file but not the new one
 *   - renamed       same value under a different name (heuristic)
 *   - value-changed same name, different value
 *   - scale-changed a color scale whose stops differ (added/removed/changed)
 *
 * Breaking changes (removed, value-changed, scale-changed) drive a non-zero
 * exit code so CI can gate on them. Additions and renames preserve existing
 * values and are non-breaking.
 */

export const ChangeType = {
  ADDED: 'added',
  REMOVED: 'removed',
  RENAMED: 'renamed',
  VALUE_CHANGED: 'value-changed',
  SCALE_CHANGED: 'scale-changed',
}

const BREAKING_TYPES = new Set([
  ChangeType.REMOVED,
  ChangeType.VALUE_CHANGED,
  ChangeType.SCALE_CHANGED,
])

// Display order + labels. Typography sub-records surface under their leaf name.
const CATEGORY_ORDER = [
  'brand',
  'colors',
  'fontFamilies',
  'fontSizes',
  'fontWeights',
  'lineHeights',
  'spacing',
  'borderRadius',
  'shadows',
]

const TYPE_PRIORITY = {
  [ChangeType.ADDED]: 0,
  [ChangeType.VALUE_CHANGED]: 1,
  [ChangeType.SCALE_CHANGED]: 2,
  [ChangeType.RENAMED]: 3,
  [ChangeType.REMOVED]: 4,
}

export class TokenDiff {
  constructor() {
    this.changes = []
  }

  add(change) {
    this.changes.push(change)
  }

  get added() {
    return this.changes.filter((c) => c.type === ChangeType.ADDED)
  }

  get removed() {
    return this.changes.filter((c) => c.type === ChangeType.REMOVED)
  }

  get renamed() {
    return this.changes.filter((c) => c.type === ChangeType.RENAMED)
  }

  get valueChanged() {
    return this.changes.filter((c) => c.type === ChangeType.VALUE_CHANGED)
  }

  get scaleChanged() {
    return this.changes.filter((c) => c.type === ChangeType.SCALE_CHANGED)
  }

  get breaking() {
    return this.changes.filter((c) => BREAKING_TYPES.has(c.type))
  }

  get hasChanges() {
    return this.changes.length > 0
  }

  get hasBreakingChanges() {
    return this.breaking.length > 0
  }

  // 0 = no breaking changes, 1 = breaking changes present.
  get exitCode() {
    return this.hasBreakingChanges ? 1 : 0
  }

  toJSON() {
    return {
      changed: this.hasChanges,
      breaking: this.hasBreakingChanges,
      summary: {
        added: this.added.length,
        removed: this.removed.length,
        renamed: this.renamed.length,
        valueChanged: this.valueChanged.length,
        scaleChanged: this.scaleChanged.length,
      },
      changes: this.changes,
    }
  }

  print() {
    if (!this.hasChanges) return '✓ No changes between token files'

    const byCategory = new Map()
    for (const change of this.changes) {
      if (!byCategory.has(change.category)) byCategory.set(change.category, [])
      byCategory.get(change.category).push(change)
    }

    const seen = new Set()
    const orderedCategories = [
      ...CATEGORY_ORDER.filter((c) => byCategory.has(c)),
      ...[...byCategory.keys()].filter((c) => !CATEGORY_ORDER.includes(c)),
    ]

    const lines = []
    for (const category of orderedCategories) {
      if (seen.has(category)) continue
      seen.add(category)
      const changes = byCategory.get(category)
      lines.push(category)
      const sorted = [...changes].sort((a, b) => {
        const pa = TYPE_PRIORITY[a.type] ?? 9
        const pb = TYPE_PRIORITY[b.type] ?? 9
        if (pa !== pb) return pa - pb
        return keyOf(a).localeCompare(keyOf(b))
      })
      for (const change of sorted) {
        for (const line of renderChange(change)) lines.push(line)
      }
    }

    lines.push('')
    lines.push(this.summaryLine())
    return lines.join('\n')
  }

  summaryLine() {
    const counts = [
      ['added', this.added.length],
      ['removed', this.removed.length],
      ['renamed', this.renamed.length],
      ['value-changed', this.valueChanged.length],
      ['scale-changed', this.scaleChanged.length],
    ]
      .filter(([, n]) => n > 0)
      .map(([label, n]) => `${n} ${label}`)
    const breaking = this.hasBreakingChanges ? ' — breaking' : ''
    return `Summary: ${this.changes.length} change(s) — ${counts.join(', ')}${breaking}`
  }
}

function keyOf(change) {
  return String(change.name ?? change.from ?? '')
}

function fmt(value) {
  if (value === null || value === undefined) return String(value)
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function renderChange(change) {
  switch (change.type) {
    case ChangeType.ADDED:
      return [`  + ${change.name} (${fmt(change.value)})`]
    case ChangeType.REMOVED:
      return [`  – ${change.name} (was ${fmt(change.value)})`]
    case ChangeType.RENAMED:
      return [
        `  ↻ renamed "${change.from}" → "${change.to}" (value ${fmt(change.value)})`,
      ]
    case ChangeType.VALUE_CHANGED:
      return [
        `  ~ ${change.name}: ${fmt(change.oldValue)} → ${fmt(change.newValue)}`,
      ]
    case ChangeType.SCALE_CHANGED:
      return change.stops.map((stop) => renderStop(change.name, stop))
    default:
      return []
  }
}

function renderStop(name, stop) {
  if (stop.type === ChangeType.ADDED) {
    return `  + ${name}.${stop.stop} (${fmt(stop.newValue)})`
  }
  if (stop.type === ChangeType.REMOVED) {
    return `  – ${name}.${stop.stop} (was ${fmt(stop.oldValue)})`
  }
  return `  ~ ${name}.${stop.stop}: ${fmt(stop.oldValue)} → ${fmt(stop.newValue)}`
}

// ─── Comparison helpers ─────────────────────────────────────────────────────

function valuesEqual(a, b) {
  if (a === b) return true
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    return JSON.stringify(a) === JSON.stringify(b)
  }
  return false
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : {}
}

function colorMap(colors) {
  const map = new Map()
  if (Array.isArray(colors)) {
    for (const c of colors) {
      if (c && typeof c.name === 'string') map.set(c.name, c)
    }
  }
  return map
}

function sortStops(keys) {
  return [...keys].sort((a, b) => {
    const na = Number(a)
    const nb = Number(b)
    if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb
    return String(a).localeCompare(String(b))
  })
}

/**
 * Greedy 1:1 rename pairing: an old name and a new name that share the same
 * value are treated as a rename. Returns the pairing plus the leftovers.
 */
function pairRenames(onlyOld, onlyNew, oldValueOf, newValueOf) {
  const renames = []
  const usedNew = new Set()
  const removed = []
  for (const oldName of onlyOld) {
    const oldValue = oldValueOf(oldName)
    let match = null
    for (const newName of onlyNew) {
      if (usedNew.has(newName)) continue
      if (valuesEqual(oldValue, newValueOf(newName))) {
        match = newName
        break
      }
    }
    if (match !== null) {
      renames.push({ from: oldName, to: match, value: oldValue })
      usedNew.add(match)
    } else {
      removed.push(oldName)
    }
  }
  const added = onlyNew.filter((n) => !usedNew.has(n))
  return { renames, removed, added }
}

// ─── Category diffs ─────────────────────────────────────────────────────────

function diffBrand(oldTokens, newTokens, diff) {
  const oldBrand = oldTokens.brand
  const newBrand = newTokens.brand
  if (oldBrand === newBrand) return
  if (oldBrand == null && newBrand != null) {
    diff.add({
      category: 'brand',
      type: ChangeType.ADDED,
      name: 'brand',
      value: newBrand,
    })
  } else if (oldBrand != null && newBrand == null) {
    diff.add({
      category: 'brand',
      type: ChangeType.REMOVED,
      name: 'brand',
      value: oldBrand,
    })
  } else {
    diff.add({
      category: 'brand',
      type: ChangeType.VALUE_CHANGED,
      name: 'brand',
      oldValue: oldBrand,
      newValue: newBrand,
    })
  }
}

function diffScale(oldScaleRaw, newScaleRaw) {
  const oldScale = asObject(oldScaleRaw)
  const newScale = asObject(newScaleRaw)
  const stops = []
  const keys = new Set([...Object.keys(oldScale), ...Object.keys(newScale)])
  for (const stop of sortStops(keys)) {
    const inOld = stop in oldScale
    const inNew = stop in newScale
    if (inOld && inNew) {
      if (!valuesEqual(oldScale[stop], newScale[stop])) {
        stops.push({
          stop,
          type: ChangeType.VALUE_CHANGED,
          oldValue: oldScale[stop],
          newValue: newScale[stop],
        })
      }
    } else if (inNew) {
      stops.push({ stop, type: ChangeType.ADDED, newValue: newScale[stop] })
    } else {
      stops.push({ stop, type: ChangeType.REMOVED, oldValue: oldScale[stop] })
    }
  }
  return stops
}

function diffColors(oldColors, newColors, diff) {
  const oldMap = colorMap(oldColors)
  const newMap = colorMap(newColors)
  const oldNames = [...oldMap.keys()]
  const onlyOld = oldNames.filter((n) => !newMap.has(n))
  const onlyNew = [...newMap.keys()].filter((n) => !oldMap.has(n))
  const common = oldNames.filter((n) => newMap.has(n))

  const { renames, removed, added } = pairRenames(
    onlyOld,
    onlyNew,
    (n) => oldMap.get(n).value,
    (n) => newMap.get(n).value
  )

  for (const name of added) {
    diff.add({
      category: 'colors',
      type: ChangeType.ADDED,
      name,
      value: newMap.get(name).value,
    })
  }
  for (const r of renames) {
    diff.add({
      category: 'colors',
      type: ChangeType.RENAMED,
      from: r.from,
      to: r.to,
      value: r.value,
    })
  }
  for (const name of removed) {
    diff.add({
      category: 'colors',
      type: ChangeType.REMOVED,
      name,
      value: oldMap.get(name).value,
    })
  }
  for (const name of common) {
    const oldColor = oldMap.get(name)
    const newColor = newMap.get(name)
    if (!valuesEqual(oldColor.value, newColor.value)) {
      diff.add({
        category: 'colors',
        type: ChangeType.VALUE_CHANGED,
        name,
        oldValue: oldColor.value,
        newValue: newColor.value,
      })
    }
    const stops = diffScale(oldColor.scale, newColor.scale)
    if (stops.length > 0) {
      diff.add({
        category: 'colors',
        type: ChangeType.SCALE_CHANGED,
        name,
        stops,
      })
    }
  }
}

function diffRecord(category, oldRaw, newRaw, diff) {
  const oldObj = asObject(oldRaw)
  const newObj = asObject(newRaw)
  const oldKeys = Object.keys(oldObj)
  const onlyOld = oldKeys.filter((k) => !(k in newObj))
  const onlyNew = Object.keys(newObj).filter((k) => !(k in oldObj))
  const common = oldKeys.filter((k) => k in newObj)

  const { renames, removed, added } = pairRenames(
    onlyOld,
    onlyNew,
    (k) => oldObj[k],
    (k) => newObj[k]
  )

  for (const name of added) {
    diff.add({ category, type: ChangeType.ADDED, name, value: newObj[name] })
  }
  for (const r of renames) {
    diff.add({
      category,
      type: ChangeType.RENAMED,
      from: r.from,
      to: r.to,
      value: r.value,
    })
  }
  for (const name of removed) {
    diff.add({ category, type: ChangeType.REMOVED, name, value: oldObj[name] })
  }
  for (const name of common) {
    if (!valuesEqual(oldObj[name], newObj[name])) {
      diff.add({
        category,
        type: ChangeType.VALUE_CHANGED,
        name,
        oldValue: oldObj[name],
        newValue: newObj[name],
      })
    }
  }
}

/**
 * Compare two parsed mint-ds tokens objects.
 * @param {object} oldTokens
 * @param {object} newTokens
 * @returns {TokenDiff}
 */
export function diffTokens(oldTokens, newTokens) {
  const diff = new TokenDiff()
  const oldT = oldTokens && typeof oldTokens === 'object' ? oldTokens : {}
  const newT = newTokens && typeof newTokens === 'object' ? newTokens : {}

  diffBrand(oldT, newT, diff)
  diffColors(oldT.colors, newT.colors, diff)

  const oldTypo = asObject(oldT.typography)
  const newTypo = asObject(newT.typography)
  for (const sub of [
    'fontFamilies',
    'fontSizes',
    'fontWeights',
    'lineHeights',
  ]) {
    diffRecord(sub, oldTypo[sub], newTypo[sub], diff)
  }

  diffRecord('spacing', oldT.spacing, newT.spacing, diff)
  diffRecord('borderRadius', oldT.borderRadius, newT.borderRadius, diff)
  diffRecord('shadows', oldT.shadows, newT.shadows, diff)

  return diff
}

async function loadTokens(filePath) {
  const { promises: fs } = await import('node:fs')
  let content
  try {
    content = await fs.readFile(filePath, 'utf8')
  } catch {
    throw new Error(`Tokens file not found: ${filePath}`)
  }
  try {
    return JSON.parse(content)
  } catch (err) {
    throw new Error(
      `Tokens file is not valid JSON: ${filePath} (${err.message})`
    )
  }
}

/**
 * Load two tokens.json files from disk and diff them.
 * @param {string} oldPath
 * @param {string} newPath
 * @returns {Promise<TokenDiff>}
 */
export async function diffFiles(oldPath, newPath) {
  const oldTokens = await loadTokens(oldPath)
  const newTokens = await loadTokens(newPath)
  return diffTokens(oldTokens, newTokens)
}

const TokenDiffer = { diffTokens, diffFiles, TokenDiff, ChangeType }
export default TokenDiffer
