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
  motion: {
    durations: Record<string, string>
    easings: Record<string, string>
  }
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
  | 'solidjs-component'
  | 'qwik-component'

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

export interface LineHeightAudit {
  found: string[]
  suggestedScale: Record<string, string | number>
  unitlessMix: boolean
}

export interface MotionDurationSample {
  value: string
  normalizedMs: number
  usageCount: number
  contexts: string[]
}

export interface MotionEasingSample {
  value: string
  normalizedKeyword: string | null
  usageCount: number
  contexts: string[]
}

export interface MotionAudit {
  durations: {
    found: MotionDurationSample[]
    suggestedScale: Record<string, string>
  }
  easings: {
    found: MotionEasingSample[]
    suggestedScale: Record<string, string>
  }
  duplicateDeclarations: number
}

export interface LayoutA11yIssue {
  selector: string
  property: string // 'order' or 'tabindex'
  value: string
  reason: string
  severity: 'warning' // always warning for a11y impact
}

export interface ModernPracticeIssue {
  selector: string
  rule: string // 'grid-when-flexbox-wrap-would-work' | 'legacy-centering' | 'flex-min-width-zero-hack' | 'fragile-nested-selectors'
  severity: 'suggestion'
  reason: string
}

export interface AdoptionSuggestion {
  selector: string
  rule: string // 'use-css-layers' | 'use-container-queries'
  severity: 'info'
  reason: string
}

export interface OverflowSafetyIssue {
  selector: string
  rule: string // 'flex-wrap-missing' | 'missing-overflow-wrap'
  severity: 'warning' | 'suggestion'
  reason: string
}

export interface AuditReport {
  brand: string
  chaosScore: number
  summary: string
  colorClusters: ColorCluster[]
  fonts: FontEntry[]
  spacing: SpacingAudit
  lineHeights: LineHeightAudit
  motion?: MotionAudit
  layoutA11yIssues?: LayoutA11yIssue[]
  modernPracticeIssues?: ModernPracticeIssue[]
  adoptionSuggestions?: AdoptionSuggestion[]
  overflowSafetyIssues?: OverflowSafetyIssue[]
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
  lineHeights: Record<string, string | number>
  motion: {
    durations: Record<string, string>
    easings: Record<string, string>
  }
}

// ─── LLM provider configuration ───────────────────────────────────────────────

export interface ProviderDefaults {
  url: string
  model: string
  maxTokens: { audit: number; parse: number; export: number }
}

export interface AnthropicConfig extends ProviderDefaults {
  name: 'anthropic'
  apiKey?: string
  version: string
}

export interface OllamaConfig extends ProviderDefaults {
  name: 'ollama'
  apiKey?: string
}

export type LlmConfig = AnthropicConfig | OllamaConfig
export type LlmProviderName = LlmConfig['name']

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
  {
    target: 'solidjs-component',
    label: 'SolidJS',
    filename: 'components',
    ext: 'tsx',
    category: 'Components',
    description: 'Fine-grained reactive components with createSignal',
  },
  {
    target: 'qwik-component',
    label: 'Qwik',
    filename: 'components',
    ext: 'tsx',
    category: 'Components',
    description: 'Resumable component$ with typed props and Slot',
  },
]
