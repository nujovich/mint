import { NextRequest, NextResponse } from 'next/server'
import { buildAuditPrompt, callAnthropic, stripFences } from '@/lib/prompts.mjs'

export async function POST(req: NextRequest) {
  const { css } = await req.json()

  if (!css || typeof css !== 'string') {
    return NextResponse.json({ error: 'CSS required' }, { status: 400 })
  }

  try {
    const text = await callAnthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      prompt: buildAuditPrompt(css),
      maxTokens: 3000,
    })
    const audit = JSON.parse(stripFences(text))
    return NextResponse.json({ audit })
  } catch (err) {
    console.error('Audit error:', err)
    return NextResponse.json({ error: 'Error auditing CSS' }, { status: 500 })
  }
}
