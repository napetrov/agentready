import { NextRequest, NextResponse } from 'next/server'
import { generatePDFReport } from '../../../lib/report-generator'

export async function POST(request: NextRequest) {
  try {
    const { result, repoUrl } = await request.json()

    if (!result) {
      return NextResponse.json(
        { error: 'Assessment result is required' },
        { status: 400 }
      )
    }

    const pdfBuffer = await generatePDFReport(result, repoUrl)

    return new NextResponse(pdfBuffer as any, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="ai-readiness-assessment.pdf"',
      },
    })
  } catch (error) {
    console.error('Report generation error:', error)
    return NextResponse.json(
      { error: 'Failed to generate report' },
      { status: 500 }
    )
  }
}