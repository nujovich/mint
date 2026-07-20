/**
 * DESIGN.md generator — deterministic converter from mint-ds.tokens.json
 * to a human-readable Markdown design-system summary.
 *
 * Consumed as context for AI-assisted design workflows (e.g. Claude Design).
 * No LLM, no I/O. Same input → byte-identical output.
 *
 * Mirrors the deterministic approach of lib/dtcg-exporter.mjs.
 */

function isNonEmptyObject(v) {
  return (
    v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length > 0
  )
}

/** Render a flat map as a `Token | Value` Markdown table. */
function kvTable(map) {
  const lines = ['| Token | Value |', '|---|---|']
  for (const [k, v] of Object.entries(map)) {
    lines.push(`| ${k} | ${v} |`)
  }
  return lines.join('\n')
}

export function convertTokensToDesignMd(tokens) {
  const t = tokens && typeof tokens === 'object' ? tokens : {}
  const out = []

  // Title — brand from the resolved tokens; the schema allows an empty string.
  const brand =
    typeof t.brand === 'string' && t.brand.trim() !== '' ? t.brand.trim() : null
  out.push(`# ${brand ? brand + ' ' : ''}Design System`)

  // Colors — one subsection per color, Step | Value over the scale.
  if (Array.isArray(t.colors) && t.colors.length > 0) {
    const blocks = []
    for (const c of t.colors) {
      if (!c || typeof c !== 'object' || !isNonEmptyObject(c.scale)) continue
      const block = [`### ${c.name}`, '', '| Step | Value |', '|---|---|']
      for (const [step, hex] of Object.entries(c.scale)) {
        block.push(`| ${step} | ${hex} |`)
      }
      if (typeof c.description === 'string' && c.description.trim() !== '') {
        block.push('', `_${c.description.trim()}_`)
      }
      blocks.push(block.join('\n'))
    }
    if (blocks.length > 0) out.push('## Colors', blocks.join('\n\n'))
  }

  // Typography — one Token | Value table per present sub-map.
  const typo = isNonEmptyObject(t.typography) ? t.typography : {}
  const typoSections = []
  if (isNonEmptyObject(typo.fontFamilies))
    typoSections.push(`### Font families\n\n${kvTable(typo.fontFamilies)}`)
  if (isNonEmptyObject(typo.fontSizes))
    typoSections.push(`### Font sizes\n\n${kvTable(typo.fontSizes)}`)
  if (isNonEmptyObject(typo.fontWeights))
    typoSections.push(`### Font weights\n\n${kvTable(typo.fontWeights)}`)
  if (isNonEmptyObject(typo.lineHeights))
    typoSections.push(`### Line heights\n\n${kvTable(typo.lineHeights)}`)
  if (typoSections.length > 0)
    out.push('## Typography', typoSections.join('\n\n'))

  // Motion — sourced from typography.motion, rendered as its own section.
  const motion = isNonEmptyObject(typo.motion) ? typo.motion : {}
  const motionSections = []
  if (isNonEmptyObject(motion.durations))
    motionSections.push(`### Durations\n\n${kvTable(motion.durations)}`)
  if (isNonEmptyObject(motion.easings))
    motionSections.push(`### Easings\n\n${kvTable(motion.easings)}`)
  if (motionSections.length > 0)
    out.push('## Motion', motionSections.join('\n\n'))

  // Flat scales.
  if (isNonEmptyObject(t.spacing)) out.push('## Spacing', kvTable(t.spacing))
  if (isNonEmptyObject(t.borderRadius))
    out.push('## Border radius', kvTable(t.borderRadius))
  if (isNonEmptyObject(t.shadows)) out.push('## Shadows', kvTable(t.shadows))

  return out.join('\n\n')
}
