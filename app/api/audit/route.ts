import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { css } = await req.json()

  if (!css || typeof css !== 'string') {
    return NextResponse.json({ error: 'CSS required' }, { status: 400 })
  }

  const prompt = `You are a design-system auditor. Analyze the CSS/SCSS/HTML below and return a JSON AuditReport.

CSS SOURCE:
${css.slice(0, 60000)}

Instructions:
1. COLORS — Find every hex, rgb(), rgba(), hsl() value. Group near-duplicates (within ~15% on H, S, or L) into clusters. Per cluster:
   - "representative": most-used or most-saturated value
   - "samples": each distinct value with usageCount (how many times that exact value appears) and up to 3 contexts (CSS selectors or property names)
   - "suggestedName": semantic role — choose from: primary, secondary, accent, background, surface, text, muted, border, error, success, warning, info
   - "id": "cluster-N" (sequential integer, starting at 0)
   Keep clusters to a maximum of 14.

2. FONTS — List every font-family value. Mark isSystemFont: true for: Arial, Helvetica, Georgia, Times, Courier, Verdana, Tahoma, Trebuchet, system-ui, -apple-system, BlinkMacSystemFont, sans-serif, serif, monospace, cursive, fantasy. Provide up to 5 usage contexts per font.

3. SPACING — Collect every distinct numeric spacing value (px only) from margin, padding, gap, top, right, bottom, left properties. Exclude: 0, values with %, auto, vh, vw, em, rem. Suggest a clean 4px-based scale using these steps: 1→4px, 2→8px, 3→12px, 4→16px, 5→20px, 6→24px, 8→32px, 10→40px, 12→48px, 16→64px, 20→80px, 24→96px. List nonScaleValues: found values NOT divisible by 4.

4. chaosScore: integer 1-10. 1-3 = clean, 4-6 = moderate debt, 7-10 = real chaos. Base on: colorClusters.length > 8 adds points, nonScaleValues.length > 5 adds points, fonts.filter(f=>!f.isSystemFont).length > 3 adds points.

5. summary: 1-2 sentences describing the main CSS quality issues found.

Return ONLY a valid JSON object. No markdown fences, no backticks, no explanation outside the JSON.

{
  "brand": "project name from comments/title/class names, or empty string",
  "chaosScore": 7,
  "summary": "The codebase has 6 near-duplicate blue shades and 23 off-scale spacing values.",
  "colorClusters": [
    {
      "id": "cluster-0",
      "suggestedName": "primary",
      "representative": "#1a73e8",
      "samples": [
        { "hex": "#1a73e8", "usageCount": 12, "contexts": [".btn-primary", "--color-brand", "a:hover"] },
        { "hex": "#1b74e9", "usageCount": 3, "contexts": [".header-logo"] }
      ]
    }
  ],
  "fonts": [
    { "family": "Inter", "usages": ["body", "h1", ".card"], "isSystemFont": false },
    { "family": "sans-serif", "usages": ["*"], "isSystemFont": true }
  ],
  "spacing": {
    "found": ["4px", "7px", "8px", "13px", "16px", "24px"],
    "suggestedScale": { "1": "4px", "2": "8px", "4": "16px", "6": "24px" },
    "nonScaleValues": ["7px", "13px"]
  }
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
        max_tokens: 3000,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    const data = await res.json()
    const raw: string = data.content?.find((b: { type: string }) => b.type === 'text')?.text ?? ''
    const clean = raw.replace(/^```json\n?/m, '').replace(/\n?```$/m, '').trim()
    const audit = JSON.parse(clean)

    return NextResponse.json({ audit })
  } catch (err) {
    console.error('Audit error:', err)
    return NextResponse.json({ error: 'Error auditing CSS' }, { status: 500 })
  }
}
