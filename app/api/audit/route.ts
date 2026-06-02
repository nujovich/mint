import { NextRequest, NextResponse } from 'next/server'
import { buildAuditPrompt } from '@/lib/prompts.mjs'
import { getCssAuditor } from '@/lib/css-auditor.mjs'


export async function POST(req: NextRequest) {
  const { css } = await req.json()

  if (!css || typeof css !== 'string') {
    return NextResponse.json({ error: 'CSS required' }, { status: 400 })
  }

  try {
    const cssAuditor = getCssAuditor()
    const auditResult = await cssAuditor.audit(buildAuditPrompt(css))
    return NextResponse.json({ auditResult })
  } catch (err) {
    const errorMsg = 'Error auditing CSS'
    console.error(errorMsg, err)
    return NextResponse.json({ error: errorMsg }, { status: 500 })
  }
}
