import { NextRequest, NextResponse } from 'next/server'
import type { UserDecisions } from '@/lib/types'
import { buildResolvePrompt } from '@/lib/prompts.mjs'
import { getCssAuditor } from '@/lib/css-auditor.mjs'

export async function POST(req: NextRequest) {
  const { css, decisions }: { css: string; decisions: UserDecisions } =
    await req.json()

  if (!css || !decisions) {
    return NextResponse.json(
      { error: 'CSS and decisions required' },
      { status: 400 }
    )
  }

  try {
    const auditor = getCssAuditor()
    const parseResult = await auditor.parse(buildResolvePrompt(css, decisions))
    return NextResponse.json({ parseResult })
  } catch (err) {
    const errorMsg = 'Error parsing result'
    console.error(errorMsg, err)
    return NextResponse.json({ error: errorMsg }, { status: 500 })
  }
}
