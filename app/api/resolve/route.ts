import { NextRequest, NextResponse } from 'next/server'
import type { UserDecisions } from '@/lib/types'

export async function POST(req: NextRequest) {
  const { css, decisions }: { css: string; decisions: UserDecisions } = await req.json()

  if (!css || !decisions) {
    return NextResponse.json({ error: 'CSS and decisions required' }, { status: 400 })
  }

  const prompt = `You are a design system token generator. Given the original CSS and user curation decisions, produce a clean DSTokens JSON.

ORIGINAL CSS:
${css.slice(0, 50000)}

USER DECISIONS:
${JSON.stringify(decisions, null, 2)}

Rules:
- decisions.colors: only include entries where include === true. Use the provided "name" as the token name and "value" as the hex color.
- decisions.fonts: first font = "body", second = "display" (if present). If any font name contains "mono", "code", or "courier", use it as "mono".
- decisions.spacingScale: use directly as the spacing token map (e.g. { "1": "4px", "2": "8px", ... }).
- Extract border-radius values from the CSS. Normalize to these named keys: sm (2-4px), md (6-8px), lg (10-14px), xl (16-20px), 2xl (24px+), full (9999px or 50%). Include only the keys you find evidence for.
- Extract box-shadow values from the CSS. Normalize to: sm, md, lg, xl. Include only found values.
- Extract font-size values from the CSS. Normalize to semantic keys: xs, sm, base, lg, xl, 2xl, 3xl, 4xl, 5xl. Base ≈ 16px. Include only found values.
- Extract font-weight values from the CSS. Normalize to: thin (100), light (300), normal (400), medium (500), semibold (600), bold (700), extrabold (800). Include only found values.
- Extract line-height values from the CSS. Normalize to: tight (1–1.2), snug (1.3–1.4), normal (1.5), relaxed (1.6–1.7), loose (2+). Include only found values.
- Generate a 50–900 scale (50, 100, 200, 300, 400, 500, 600, 700, 800, 900) for each included color. The "value" from decisions is the 500. Derive lighter shades by mixing with white and darker shades by mixing with black (adjust luminance accordingly).
- brand: extract from CSS comments, class name prefixes, or CSS variable prefixes. Empty string if not found.

Return ONLY valid JSON matching this exact DSTokens structure. No markdown fences, no explanation.

{
  "brand": "string",
  "colors": [
    {
      "name": "primary",
      "value": "#6366f1",
      "scale": { "50": "#eef2ff", "100": "#e0e7ff", "200": "#c7d2fe", "300": "#a5b4fc", "400": "#818cf8", "500": "#6366f1", "600": "#4f46e5", "700": "#4338ca", "800": "#3730a3", "900": "#312e81" },
      "description": ""
    }
  ],
  "typography": {
    "fontFamilies": { "body": "Inter", "display": "Cal Sans", "mono": "Fira Code" },
    "fontSizes": { "xs": "12px", "sm": "14px", "base": "16px", "lg": "18px", "xl": "20px", "2xl": "24px", "3xl": "30px", "4xl": "36px" },
    "fontWeights": { "normal": 400, "medium": 500, "semibold": 600, "bold": 700 },
    "lineHeights": { "tight": 1.2, "normal": 1.5, "relaxed": 1.7 }
  },
  "spacing": { "1": "4px", "2": "8px", "3": "12px", "4": "16px", "6": "24px", "8": "32px" },
  "borderRadius": { "sm": "4px", "md": "8px", "lg": "12px", "xl": "16px", "full": "9999px" },
  "shadows": { "sm": "0 1px 2px rgba(0,0,0,0.05)", "md": "0 4px 6px rgba(0,0,0,0.1)", "lg": "0 10px 15px rgba(0,0,0,0.1)" }
}`

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    const data = await res.json()
    const raw: string = data.content?.find((b: { type: string }) => b.type === 'text')?.text ?? ''
    const clean = raw.replace(/^```json\n?/m, '').replace(/^```\n?/m, '').replace(/\n?```$/m, '').trim()
    const tokens = JSON.parse(clean)

    return NextResponse.json({ tokens })
  } catch (err) {
    console.error('Resolve error:', err)
    return NextResponse.json({ error: 'Error generating tokens' }, { status: 500 })
  }
}
