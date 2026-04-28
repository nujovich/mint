import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { html } = await req.json()

  if (!html || typeof html !== 'string') {
    return NextResponse.json({ error: 'HTML requerido' }, { status: 400 })
  }

  const prompt = `Analyze this design system HTML and extract all design tokens into a structured JSON object.

The HTML may use CSS custom properties, hardcoded hex/rgb/hsl values, inline styles, class names, or any combination. Extract everything you can find.

HTML:
${html.slice(0, 60000)}

Return ONLY a valid JSON object with no markdown fences, no backticks, no explanation. Use this exact structure:

{
  "brand": "name found in title/h1/logo, or empty string",
  "colors": [
    {
      "name": "descriptive name (e.g. primary, accent, neutral, background)",
      "value": "#hex or rgb() — the main/500 value",
      "scale": { "50": "#...", "100": "#...", "200": "#...", "300": "#...", "400": "#...", "500": "#...", "600": "#...", "700": "#...", "800": "#...", "900": "#..." },
      "description": "optional note about usage"
    }
  ],
  "typography": {
    "fontFamilies": {
      "display": "Font Name",
      "body": "Font Name",
      "mono": "Font Name"
    },
    "fontSizes": {
      "xs": "0.75rem", "sm": "0.875rem", "base": "1rem",
      "lg": "1.125rem", "xl": "1.25rem", "2xl": "1.5rem",
      "3xl": "1.875rem", "4xl": "2.25rem", "5xl": "3rem"
    },
    "fontWeights": { "normal": 400, "medium": 500, "semibold": 600, "bold": 700 },
    "lineHeights": { "tight": 1.25, "snug": 1.375, "normal": 1.5, "relaxed": 1.625 }
  },
  "spacing": { "1": "4px", "2": "8px", "3": "12px", "4": "16px", "5": "20px", "6": "24px", "8": "32px", "10": "40px", "12": "48px", "16": "64px", "20": "80px", "24": "96px" },
  "borderRadius": { "none": "0", "sm": "...", "md": "...", "lg": "...", "xl": "...", "2xl": "...", "full": "9999px" },
  "shadows": { "sm": "...", "md": "...", "lg": "...", "xl": "..." }
}

Rules:
- If a color has no scale in the HTML, derive a realistic 50-900 scale from the main value
- If typography values are missing, use sensible defaults based on what you do find
- Include ALL colors found, even if only used once
- Never return null values — always provide a fallback
- Keep color names semantic (primary, secondary, accent, background, surface, text, muted, etc.)`

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
    const clean = raw.replace(/^```json\n?/m, '').replace(/\n?```$/m, '').trim()
    const tokens = JSON.parse(clean)

    return NextResponse.json({ tokens })
  } catch (err) {
    console.error('Parse error:', err)
    return NextResponse.json({ error: 'Error al parsear el HTML' }, { status: 500 })
  }
}
