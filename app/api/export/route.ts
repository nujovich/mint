import { NextRequest, NextResponse } from 'next/server'
import type { DSTokens, ExportTarget } from '@/lib/types'
import { buildExportPrompt } from '@/lib/prompts.mjs'
import { getCssAuditor } from '@/lib/css-auditor.mjs'


export async function POST(req: NextRequest) {
  const { tokens, target }: { tokens: DSTokens; target: ExportTarget } = await req.json()

  const prompt = buildExportPrompt(tokens, target)
  if (!prompt) {
    return NextResponse.json({ error: 'Unknown target' }, { status: 400 })
  }

  try {
    const cssAuditor = getCssAuditor()
    const exportResult = await cssAuditor.export(prompt)
    return NextResponse.json({ exportResult })
  } catch (err) {
    const errorMsg = 'Error exporting result'
    console.error(errorMsg, err)
    return NextResponse.json({ error: errorMsg }, { status: 500 })
  }
}
