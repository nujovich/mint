/**
 * DTCG v1 Validator — validates tokens.json against W3C Design Tokens Community Group Format Module v1.
 * Spec: https://www.designtokens.org/TR/2025.10/format/
 */

// DTCG token types (from spec)
export const DTCG_TYPES = [
  'color',
  'dimension',
  'fontFamily',
  'fontWeight',
  'duration',
  'cubicBezier',
  'number',
  'border',
  'shadow',
  'gradient',
  'transition',
  'fontFamilies',
  'fontSizes',
  'fontWeights',
  'lineHeights',
  'spacing',
  'borderRadius',
  'opacity',
  'zIndex',
  'typography',
  'asset',
]

// Reserved property prefixes
const RESERVED_PROPS = [
  '$value',
  '$type',
  '$description',
  '$deprecated',
  '$extensions',
  '$root',
  '$extends',
]

// Reserved token name rules
const TOKEN_NAME_FORBIDDEN = ['{', '}', '.']

/**
 * Validation result types
 */
export const Severity = {
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info',
}

export class ValidationIssue {
  constructor(path, message, severity = Severity.ERROR, code = null) {
    this.path = path
    this.message = message
    this.severity = severity
    this.code = code
  }

  toString() {
    const prefix =
      this.severity === Severity.ERROR
        ? '✗'
        : this.severity === Severity.WARNING
          ? '⚠'
          : 'ℹ'
    const codeStr = this.code ? ` [${this.code}]` : ''
    return `${prefix} ${this.path}: ${this.message}${codeStr}`
  }
}

export class ValidationResult {
  constructor() {
    this.issues = []
  }

  addError(path, message, code = null) {
    this.issues.push(new ValidationIssue(path, message, Severity.ERROR, code))
  }

  addWarning(path, message, code = null) {
    this.issues.push(new ValidationIssue(path, message, Severity.WARNING, code))
  }

  addInfo(path, message, code = null) {
    this.issues.push(new ValidationIssue(path, message, Severity.INFO, code))
  }

  get errors() {
    return this.issues.filter((i) => i.severity === Severity.ERROR)
  }

  get warnings() {
    return this.issues.filter((i) => i.severity === Severity.WARNING)
  }

  get infos() {
    return this.issues.filter((i) => i.severity === Severity.INFO)
  }

  get hasErrors() {
    return this.errors.length > 0
  }

  get hasWarnings() {
    return this.warnings.length > 0
  }

  get exitCode() {
    if (this.hasErrors) return 2
    if (this.hasWarnings) return 1
    return 0
  }

  toJSON() {
    return {
      valid: !this.hasErrors,
      errors: this.errors.map((i) => ({
        path: i.path,
        message: i.message,
        code: i.code,
      })),
      warnings: this.warnings.map((i) => ({
        path: i.path,
        message: i.message,
        code: i.code,
      })),
      infos: this.infos.map((i) => ({
        path: i.path,
        message: i.message,
        code: i.code,
      })),
    }
  }

  print(includeWarnings = true, includeInfos = false) {
    const lines = []
    for (const issue of this.issues) {
      if (
        issue.severity === Severity.ERROR ||
        (includeWarnings && issue.severity === Severity.WARNING) ||
        (includeInfos && issue.severity === Severity.INFO)
      ) {
        lines.push(issue.toString())
      }
    }
    if (lines.length === 0) {
      lines.push('✓ Valid DTCG v1 tokens file')
    }
    return lines.join('\n')
  }
}

/**
 * Check if a token name is valid per DTCG spec
 */
function isValidTokenName(name, path) {
  const issues = []
  if (name.startsWith('$')) {
    issues.push(
      new ValidationIssue(
        path,
        `Token name must not start with '$'`,
        Severity.ERROR,
        'INVALID_TOKEN_NAME'
      )
    )
  }
  for (const forbidden of TOKEN_NAME_FORBIDDEN) {
    if (name.includes(forbidden)) {
      issues.push(
        new ValidationIssue(
          path,
          `Token name must not contain '${forbidden}'`,
          Severity.ERROR,
          'INVALID_TOKEN_NAME'
        )
      )
      break
    }
  }
  return issues
}

/**
 * Check if a value is a DTCG reference (curly brace syntax)
 */
function isReference(value) {
  return typeof value === 'string' && /^\{.+\}$/.test(value)
}

/**
 * Validate a token value against its declared type
 */
function validateTokenValue(type, value, path, result) {
  if (!type) return // Type validation happens elsewhere

  // Skip value validation for references - they're validated in semantic phase (Milestone 2)
  if (isReference(value)) {
    return
  }

  switch (type) {
    case 'color': {
      // Color value can be string (hex, rgb, etc.) or object with colorSpace/components
      if (typeof value === 'string') {
        // Basic hex/rgb check
        if (
          !/^#([0-9a-fA-F]{3,8}|[0-9a-fA-F]{6})$/.test(value) &&
          !/^rgb\(/.test(value) &&
          !/^hsl\(/.test(value) &&
          !/^(transparent|currentColor|inherit|initial|unset)$/i.test(value)
        ) {
          result.addWarning(
            path,
            `Color value '${value}' may not be a valid CSS color`,
            'COLOR_FORMAT'
          )
        }
      } else if (typeof value === 'object' && value !== null) {
        // Object format: { colorSpace, components, hex?, alpha? }
        if (!value.colorSpace || !Array.isArray(value.components)) {
          result.addError(
            path,
            `Color object must have 'colorSpace' and 'components' array`,
            'INVALID_COLOR_OBJECT'
          )
        }
      } else {
        result.addError(
          path,
          `Color token $value must be a string or object`,
          'INVALID_COLOR_VALUE'
        )
      }
      break
    }
    case 'dimension': {
      // Dimension: { value: number, unit: string }
      if (
        typeof value !== 'object' ||
        value === null ||
        typeof value.value !== 'number' ||
        typeof value.unit !== 'string'
      ) {
        result.addError(
          path,
          `Dimension token $value must be an object with 'value' (number) and 'unit' (string)`,
          'INVALID_DIMENSION'
        )
      }
      break
    }
    case 'fontFamily':
    case 'fontFamilies': {
      // String or array of strings
      if (typeof value !== 'string' && !Array.isArray(value)) {
        result.addError(
          path,
          `Font family token $value must be a string or array of strings`,
          'INVALID_FONT_FAMILY'
        )
      }
      break
    }
    case 'fontWeight':
    case 'fontWeights': {
      // Number or string (e.g., 'bold', 'normal', 400, 700)
      if (typeof value !== 'number' && typeof value !== 'string') {
        result.addError(
          path,
          `Font weight token $value must be a number or string`,
          'INVALID_FONT_WEIGHT'
        )
      }
      break
    }
    case 'duration': {
      // String with time unit (e.g., '200ms', '1s')
      if (typeof value !== 'string' || !/^\d+(\.\d+)?(ms|s)$/.test(value)) {
        result.addError(
          path,
          `Duration token $value must be a string like '200ms' or '1s'`,
          'INVALID_DURATION'
        )
      }
      break
    }
    case 'cubicBezier': {
      // Array of 4 numbers
      if (
        !Array.isArray(value) ||
        value.length !== 4 ||
        !value.every((v) => typeof v === 'number')
      ) {
        result.addError(
          path,
          `Cubic bezier token $value must be an array of 4 numbers`,
          'INVALID_CUBIC_BEZIER'
        )
      }
      break
    }
    case 'number': {
      if (typeof value !== 'number') {
        result.addError(
          path,
          `Number token $value must be a number`,
          'INVALID_NUMBER'
        )
      }
      break
    }
    case 'border': {
      // Object with width, style, color
      if (typeof value !== 'object' || value === null) {
        result.addError(
          path,
          `Border token $value must be an object`,
          'INVALID_BORDER'
        )
      }
      break
    }
    case 'shadow': {
      // Array of shadow objects
      if (!Array.isArray(value)) {
        result.addError(
          path,
          `Shadow token $value must be an array`,
          'INVALID_SHADOW'
        )
      }
      break
    }
    case 'gradient': {
      // Gradient object
      if (typeof value !== 'object' || value === null) {
        result.addError(
          path,
          `Gradient token $value must be an object`,
          'INVALID_GRADIENT'
        )
      }
      break
    }
    case 'transition': {
      // Transition object
      if (typeof value !== 'object' || value === null) {
        result.addError(
          path,
          `Transition token $value must be an object`,
          'INVALID_TRANSITION'
        )
      }
      break
    }
    case 'fontSizes':
    case 'lineHeights':
    case 'spacing':
    case 'borderRadius':
    case 'opacity':
    case 'zIndex':
    case 'typography':
    case 'asset': {
      // These are composite types or generic - basic object check
      if (typeof value !== 'object' || value === null) {
        result.addWarning(
          path,
          `Token of type '${type}' should have an object value`,
          'INVALID_COMPOSITE_VALUE'
        )
      }
      break
    }
    default: {
      // Unknown type - warn but don't error
      result.addWarning(
        path,
        `Unknown token type '${type}' - skipping value validation`,
        'UNKNOWN_TYPE'
      )
      break
    }
  }
}

/**
 * Determine if an object is a group (no $value) or a token (has $value)
 * A token MUST have $value. If it has $type but no $value AND has no children, it's an invalid token.
 * But groups CAN have $type for inheritance.
 */
function isToken(obj) {
  return obj && typeof obj === 'object' && '$value' in obj
}

function isGroup(obj) {
  return obj && typeof obj === 'object' && !('$value' in obj)
}

function isInvalidToken(obj) {
  // An object with $type but no $value and no children (only reserved props) is an invalid token
  // We check this at call sites by looking at whether it has non-reserved children
  return false // We handle this inline now
}

/**
 * Validate a single token
 */
function validateToken(token, name, path, inheritedType, result) {
  // Check token name
  for (const issue of isValidTokenName(name, path)) {
    result.issues.push(issue)
  }

  // $value is REQUIRED
  if (!('$value' in token)) {
    result.addError(
      path,
      `Token missing required '$value' property`,
      'MISSING_VALUE'
    )
    return
  }

  // Resolve type: explicit $type > inherited group $type > error
  const explicitType = token.$type
  const resolvedType = explicitType || inheritedType

  if (!resolvedType) {
    result.addError(
      path,
      `Token has no '$type' and no inherited type from parent groups`,
      'MISSING_TYPE'
    )
    return
  }

  // Validate $type is known (warn if unknown)
  if (!DTCG_TYPES.includes(resolvedType)) {
    result.addWarning(
      path,
      `Token type '${resolvedType}' is not a standard DTCG type`,
      'NON_STANDARD_TYPE'
    )
  }

  // Validate $value against type
  validateTokenValue(resolvedType, token.$value, path, result)

  // $description - optional string
  if (
    token.$description !== undefined &&
    typeof token.$description !== 'string'
  ) {
    result.addError(
      path,
      `'$description' must be a string`,
      'INVALID_DESCRIPTION'
    )
  }

  // $deprecated - optional: true | string | false
  if (token.$deprecated !== undefined) {
    if (
      token.$deprecated !== true &&
      token.$deprecated !== false &&
      typeof token.$deprecated !== 'string'
    ) {
      result.addError(
        path,
        `'$deprecated' must be true, false, or a string reason`,
        'INVALID_DEPRECATED'
      )
    }
  }

  // $extensions - optional object
  if (token.$extensions !== undefined) {
    if (
      typeof token.$extensions !== 'object' ||
      token.$extensions === null ||
      Array.isArray(token.$extensions)
    ) {
      result.addError(
        path,
        `'$extensions' must be an object`,
        'INVALID_EXTENSIONS'
      )
    }
  }

  // Check for unknown properties (not reserved)
  for (const key of Object.keys(token)) {
    if (!RESERVED_PROPS.includes(key)) {
      result.addWarning(
        path,
        `Unknown token property '${key}' (not a reserved DTCG property)`,
        'UNKNOWN_PROPERTY'
      )
    }
  }
}

/**
 * Validate a group recursively
 */
function validateGroup(
  group,
  name,
  path,
  parentType,
  result,
  visitedGroups = new Set()
) {
  // Check group name
  for (const issue of isValidTokenName(name, path)) {
    result.issues.push(issue)
  }

  // Track visited groups for circular $extends detection
  const groupId = path
  if (visitedGroups.has(groupId)) {
    result.addError(path, `Circular group reference detected`, 'CIRCULAR_GROUP')
    return
  }
  visitedGroups.add(groupId)

  // Resolve this group's type for inheritance
  let groupType = parentType
  if (group.$type !== undefined) {
    if (typeof group.$type !== 'string') {
      result.addError(path, `'$type' must be a string`, 'INVALID_GROUP_TYPE')
    } else {
      groupType = group.$type
      if (!DTCG_TYPES.includes(groupType)) {
        result.addWarning(
          path,
          `Group type '${groupType}' is not a standard DTCG type`,
          'NON_STANDARD_GROUP_TYPE'
        )
      }
    }
  }

  // $extends - check for circular references (basic check)
  if (group.$extends !== undefined) {
    if (typeof group.$extends !== 'string') {
      result.addError(
        path,
        `'$extends' must be a string reference`,
        'INVALID_EXTENDS'
      )
    } else if (group.$extends.includes(path)) {
      result.addError(
        path,
        `'$extends' creates a circular reference`,
        'CIRCULAR_EXTENDS'
      )
    }
  }

  // $description
  if (
    group.$description !== undefined &&
    typeof group.$description !== 'string'
  ) {
    result.addError(
      path,
      `'$description' must be a string`,
      'INVALID_DESCRIPTION'
    )
  }

  // $deprecated
  if (group.$deprecated !== undefined) {
    if (
      group.$deprecated !== true &&
      group.$deprecated !== false &&
      typeof group.$deprecated !== 'string'
    ) {
      result.addError(
        path,
        `'$deprecated' must be true, false, or a string reason`,
        'INVALID_DEPRECATED'
      )
    }
  }

  // $extensions
  if (group.$extensions !== undefined) {
    if (
      typeof group.$extensions !== 'object' ||
      group.$extensions === null ||
      Array.isArray(group.$extensions)
    ) {
      result.addError(
        path,
        `'$extensions' must be an object`,
        'INVALID_EXTENSIONS'
      )
    }
  }

  // Recurse into children
  for (const [key, value] of Object.entries(group)) {
    if (RESERVED_PROPS.includes(key)) continue

    const childPath = path ? `${path}.${key}` : key

    if (isToken(value)) {
      validateToken(value, key, childPath, groupType, result)
    } else if (isGroup(value)) {
      // Check if this "group" has any non-reserved children
      const hasChildren = Object.keys(value).some(
        (k) => !RESERVED_PROPS.includes(k)
      )
      if (!hasChildren && value.$type !== undefined) {
        // No children but has $type - invalid token (missing $value)
        result.addError(
          childPath,
          `Token missing required '$value' property`,
          'MISSING_VALUE'
        )
      } else {
        validateGroup(
          value,
          key,
          childPath,
          groupType,
          result,
          new Set(visitedGroups)
        )
      }
    } else {
      result.addError(
        childPath,
        `Child is neither a token (has $value) nor a group (object without $value)`,
        'INVALID_CHILD'
      )
    }
  }

  visitedGroups.delete(groupId)
}

/**
 * Walk the token tree and collect every token's resolved type, raw value, and
 * the list of references it points to. Used by semantic checks (Milestone 2).
 */
function collectTokens(tokens) {
  const map = new Map()
  const walk = (node, path, inheritedType) => {
    if (!node || typeof node !== 'object' || Array.isArray(node)) return
    const groupType =
      typeof node.$type === 'string' ? node.$type : inheritedType
    if ('$value' in node) {
      const type = typeof node.$type === 'string' ? node.$type : inheritedType
      map.set(path, {
        path,
        type: type || null,
        value: node.$value,
        refs: extractRefs(node.$value),
      })
      return
    }
    for (const [key, child] of Object.entries(node)) {
      if (RESERVED_PROPS.includes(key)) continue
      const childPath = path ? `${path}.${key}` : key
      walk(child, childPath, groupType)
    }
  }
  walk(tokens, '', null)
  return map
}

/**
 * Pull `{some.token.path}` references out of any value (string / object / array).
 */
function extractRefs(value) {
  const refs = []
  const visit = (v) => {
    if (typeof v === 'string') {
      const matches = v.match(/\{[^{}]+\}/g)
      if (matches) {
        for (const m of matches) refs.push(m.slice(1, -1))
      }
    } else if (Array.isArray(v)) {
      v.forEach(visit)
    } else if (v && typeof v === 'object') {
      Object.values(v).forEach(visit)
    }
  }
  visit(value)
  return refs
}

/**
 * Classify a name as kebab-case, camelCase, snake_case, PascalCase, or 'mixed/other'.
 */
function classifyName(name) {
  if (/^[a-z][a-z0-9]*(-[a-z0-9]+)+$/.test(name)) return 'kebab-case'
  if (/^[a-z][a-z0-9]*(_[a-z0-9]+)+$/.test(name)) return 'snake_case'
  if (/^[a-z][a-z0-9]*([A-Z][a-z0-9]*)+$/.test(name)) return 'camelCase'
  if (/^[A-Z][a-z0-9]*([A-Z][a-z0-9]*)*$/.test(name)) return 'PascalCase'
  return null // single-word or non-classifiable - excluded from convention check
}

function collectNames(tokens) {
  const names = []
  const walk = (node, path) => {
    if (!node || typeof node !== 'object' || Array.isArray(node)) return
    for (const [key, child] of Object.entries(node)) {
      if (RESERVED_PROPS.includes(key)) continue
      const childPath = path ? `${path}.${key}` : key
      names.push({ name: key, path: childPath })
      if (child && typeof child === 'object' && !('$value' in child)) {
        walk(child, childPath)
      }
    }
  }
  walk(tokens, '')
  return names
}

/**
 * Semantic checks (Milestone 2):
 *  - broken references
 *  - circular dependencies
 *  - type mismatch on referenced tokens
 *  - naming convention consistency
 */
function validateSemantic(tokens, result) {
  const map = collectTokens(tokens)

  // 1. Broken references + type mismatch
  for (const token of map.values()) {
    for (const ref of token.refs) {
      const target = map.get(ref)
      if (!target) {
        result.addError(
          token.path,
          `Reference '{${ref}}' points to a token that does not exist`,
          'BROKEN_REFERENCE'
        )
        continue
      }
      if (token.type && target.type && token.type !== target.type) {
        result.addWarning(
          token.path,
          `References '{${ref}}' of type '${target.type}', but this token is type '${token.type}'`,
          'TYPE_MISMATCH'
        )
      }
    }
  }

  // 2. Circular dependency detection (DFS)
  const visited = new Set()
  const onStack = new Set()
  const detect = (path, trail) => {
    if (onStack.has(path)) {
      const cycleStart = trail.indexOf(path)
      const cycle = trail.slice(cycleStart).concat(path).join(' → ')
      result.addError(
        path,
        `Circular reference: ${cycle}`,
        'CIRCULAR_REFERENCE'
      )
      return
    }
    if (visited.has(path)) return
    const node = map.get(path)
    if (!node) return
    onStack.add(path)
    trail.push(path)
    for (const ref of node.refs) {
      if (map.has(ref)) detect(ref, trail)
    }
    trail.pop()
    onStack.delete(path)
    visited.add(path)
  }
  for (const path of map.keys()) detect(path, [])

  // 3. Naming convention consistency
  const names = collectNames(tokens)
  const buckets = new Map()
  for (const { name, path } of names) {
    const style = classifyName(name)
    if (!style) continue
    if (!buckets.has(style)) buckets.set(style, [])
    buckets.get(style).push({ name, path })
  }
  if (buckets.size > 1) {
    let dominant = null
    let max = 0
    for (const [style, items] of buckets) {
      if (items.length > max) {
        max = items.length
        dominant = style
      }
    }
    for (const [style, items] of buckets) {
      if (style === dominant) continue
      for (const { name, path } of items) {
        result.addWarning(
          path,
          `Name '${name}' is ${style}, but dominant convention is ${dominant}`,
          'NAMING_CONVENTION'
        )
      }
    }
  }
}

/**
 * Main validation entry point
 * @param {object} tokens - Parsed tokens.json object
 * @param {object} options - Validation options
 * @returns {ValidationResult}
 */
export function validateDTCG(tokens, options = {}) {
  const result = new ValidationResult()
  const { semantic = true } = options

  if (!tokens || typeof tokens !== 'object' || Array.isArray(tokens)) {
    result.addError('root', 'Root must be an object', 'INVALID_ROOT')
    return result
  }

  // Validate top-level children
  for (const [key, value] of Object.entries(tokens)) {
    const path = key
    if (isToken(value)) {
      validateToken(value, key, path, null, result)
    } else if (isGroup(value)) {
      // Check if this "group" has any non-reserved children
      const hasChildren = Object.keys(value).some(
        (k) => !RESERVED_PROPS.includes(k)
      )
      if (!hasChildren && value.$type !== undefined) {
        // No children but has $type - invalid token (missing $value)
        result.addError(
          path,
          `Token missing required '$value' property`,
          'MISSING_VALUE'
        )
      } else {
        validateGroup(value, key, path, null, result)
      }
    } else {
      result.addError(
        path,
        `Top-level child is neither a token nor a group`,
        'INVALID_TOP_LEVEL'
      )
    }
  }

  // Skip semantic checks if structural validation hit fatal root errors.
  if (semantic && !result.issues.some((i) => i.code === 'INVALID_ROOT')) {
    validateSemantic(tokens, result)
  }

  return result
}

/**
 * Load and validate a tokens.json file
 */
export async function validateFile(filePath, options = {}) {
  const { promises: fs } = await import('node:fs')
  const content = await fs.readFile(filePath, 'utf8')
  let tokens
  try {
    tokens = JSON.parse(content)
  } catch (err) {
    const result = new ValidationResult()
    result.addError(filePath, `Invalid JSON: ${err.message}`, 'INVALID_JSON')
    return result
  }
  return validateDTCG(tokens, options)
}

const DTCGValidator = {
  validateDTCG,
  validateFile,
  ValidationResult,
  ValidationIssue,
  Severity,
}
export default DTCGValidator
