import { NextRequest, NextResponse } from 'next/server'
import type { UserDecisions } from '@/lib/types'
import { buildResolvePrompt, callAnthropic, stripFences } from '@/lib/prompts.mjs'

export async function POST(req: NextRequest) {
  const { css, decisions }: { css: string; decisions: UserDecisions } = await req.json()

  if (!css || !decisions) {
    return NextResponse.json({ error: 'CSS and decisions required' }, { status: 400 })
  }

  try {
    const text = await callAnthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      prompt: buildResolvePrompt(css, decisions),
      maxTokens: 4000,
    })
    const tokens = JSON.parse(stripFences(text))
    return NextResponse.json({ tokens })
  } catch (err) {
    console.error('Resolve error:', err)
    return NextResponse.json({ error: 'Error generating tokens' }, { status: 500 })
  }
}
