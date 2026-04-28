import { NextRequest, NextResponse } from 'next/server'
import type { DSTokens, ExportTarget } from '@/lib/types'
import { buildExportPrompt, callAnthropic, stripFences } from '@/lib/prompts.mjs'

export async function POST(req: NextRequest) {
  const { tokens, target }: { tokens: DSTokens; target: ExportTarget } = await req.json()

  const prompt = buildExportPrompt(tokens, target)
  if (!prompt) {
    return NextResponse.json({ error: 'Unknown target' }, { status: 400 })
  }

  try {
    const text = await callAnthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      prompt,
      maxTokens: 6000,
    })
    return NextResponse.json({ code: stripFences(text) })
  } catch (err) {
    console.error('Export error:', err)
    return NextResponse.json({ error: 'Error generating export' }, { status: 500 })
  }
}
