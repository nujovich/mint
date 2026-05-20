export interface ColorToken {
  name: string
  value: string
  scale?: Record<string, string>
  description?: string
}

export interface TypographyTokens {
  fontFamilies: Record<string, string>
  fontSizes: Record<string, string>
  fontWeights: Record<string, string | number>
  lineHeights: Record<string, string | number>
}

export interface DSTokens {
  brand: string
  colors: ColorToken[]
  typography: TypographyTokens
  spacing: Record<string, string>
  borderRadius: Record<string, string>
  shadows: Record<string, string>
}

export type ExportTarget =
  | 'css-variables'
  | 'scss-variables'
  | 'js-tokens'
  | 'tailwind-config'
  | 'styled-components'
  | 'emotion'
  | 'css-modules'
  | 'react-component'
  | 'vue-component'
  | 'svelte-component'
  | 'astro-component'
  | 'angular-component'
  | 'angular-legacy-component'

export interface ExportConfig {
  target: ExportTarget
  label: string
  filename: string
  ext: string
  category: 'Tokens' | 'Frameworks CSS' | 'Components'
  description: string
}

// ─── CSS Audit Wizard ─────────────────────────────────────────────────────────

export interface ColorSample {
  hex: string
  usageCount: number
  contexts: string[]
}

export interface ColorCluster {
  id: string
  suggestedName: string
  representative: string
  samples: ColorSample[]
}

export interface FontEntry {
  family: string
  usages: string[]
  isSystemFont: boolean
}

export interface SpacingAudit {
  found: string[]
  suggestedScale: Record<string, string>
  nonScaleValues: string[]
}

export interface AuditReport {
  brand: string
  chaosScore: number
  summary: string
  colorClusters: ColorCluster[]
  fonts: FontEntry[]
  spacing: SpacingAudit
}

export interface ColorDecision {
  clusterId: string
  name: string
  value: string
  include: boolean
}

export interface UserDecisions {
  colors: ColorDecision[]
  fonts: string[]
  spacingScale: Record<string, string>
}

// ──────────────────────────────────────────────────────────────────────────────

export const EXPORT_TARGETS: ExportConfig[] = [
  {
    target: 'css-variables',
    label: 'CSS Custom Properties',
    filename: 'variables',
    ext: 'css',
    category: 'Tokens',
    description: ':root with all variables + dark mode',
  },
  {
    target: 'scss-variables',
    label: 'SCSS Variables',
    filename: '_tokens',
    ext: 'scss',
    category: 'Tokens',
    description: '$variables + useful @mixins',
  },
  {
    target: 'js-tokens',
    label: 'JS / TS Object',
    filename: 'tokens',
    ext: 'ts',
    category: 'Tokens',
    description: 'Typed object with all tokens',
  },
  {
    target: 'tailwind-config',
    label: 'Tailwind Config',
    filename: 'tailwind.config',
    ext: 'js',
    category: 'Frameworks CSS',
    description: 'theme.extend with colors, fonts, and more',
  },
  {
    target: 'styled-components',
    label: 'Styled Components',
    filename: 'theme',
    ext: 'ts',
    category: 'Frameworks CSS',
    description: 'DefaultTheme with light/dark theme objects',
  },
  {
    target: 'emotion',
    label: 'Emotion Theme',
    filename: 'theme',
    ext: 'ts',
    category: 'Frameworks CSS',
    description: 'Theme interface + ThemeProvider setup',
  },
  {
    target: 'css-modules',
    label: 'CSS Modules',
    filename: 'tokens',
    ext: 'module.css',
    category: 'Frameworks CSS',
    description: '@value declarations + utility classes',
  },
  {
    target: 'react-component',
    label: 'React + TypeScript',
    filename: 'components',
    ext: 'tsx',
    category: 'Components',
    description: 'Button, Card, Badge, Input with variants',
  },
  {
    target: 'vue-component',
    label: 'Vue 3 SFC',
    filename: 'components',
    ext: 'vue',
    category: 'Components',
    description: 'script setup + typed defineProps',
  },
  {
    target: 'svelte-component',
    label: 'Svelte',
    filename: 'components',
    ext: 'svelte',
    category: 'Components',
    description: 'Typed props + scoped styles',
  },
  {
    target: 'astro-component',
    label: 'Astro',
    filename: 'components',
    ext: 'astro',
    category: 'Components',
    description: '.astro components with typed props and scoped CSS',
  },
  {
    target: 'angular-component',
    label: 'Angular',
    filename: 'components',
    ext: 'ts',
    category: 'Components',
    description: 'Standalone components + signal inputs',
  },
  {
    target: 'angular-legacy-component',
    label: 'Angular (Legacy)',
    filename: 'components.module',
    ext: 'ts',
    category: 'Components',
    description: 'Classic @NgModule with @Input/@Output decorators',
  },
]
