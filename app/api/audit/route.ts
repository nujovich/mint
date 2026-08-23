import { NextRequest, NextResponse } from 'next/server'
import { buildAuditPrompt } from '@/lib/prompts.mjs'
import { getCssAuditor } from '@/lib/css-auditor.mjs'
import {
  annotateColorClusters,
  buildContrastPairs,
} from '@/lib/css-contrast.mjs'

export async function POST(req: NextRequest) {
  const { css } = await req.json()

  if (!css || typeof css !== 'string') {
    return NextResponse.json({ error: 'CSS required' }, { status: 400 })
  }

  try {
    const cssAuditor = getCssAuditor()
    const auditResult = await cssAuditor.audit(buildAuditPrompt(css))
    auditResult.colorClusters = annotateColorClusters(auditResult.colorClusters)
    auditResult.contrastPairs = buildContrastPairs(auditResult.colorClusters)
    return NextResponse.json({ auditResult })
  } catch (err) {
    const errorMsg = 'Error auditing CSS'
    console.error(errorMsg, err)
    return NextResponse.json({ error: errorMsg }, { status: 500 })
  }
}
