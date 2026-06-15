export function preprocessCss(raw) {
  return String(raw)
    .replace(/\/\*[\s\S]*?\*\//g, ' ') // block comments
    .replace(/\/\/[^\n]*/g, ' ') // line comments (SCSS/LESS)
    .replace(/\s+/g, ' ')
    .trim()
}
