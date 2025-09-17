import jsPDF from 'jspdf'

export async function generatePDFReport(assessmentResult: any): Promise<Buffer> {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  let yPosition = 20

  // Helper function to add text with word wrapping
  const addText = (text: string, x: number, y: number, maxWidth: number, fontSize: number = 12) => {
    const lines = doc.splitTextToSize(text, maxWidth)
    doc.setFontSize(fontSize)
    doc.text(lines, x, y)
    return y + (lines.length * fontSize * 0.4) + 5
  }

  // Helper function to add a new page if needed
  const checkNewPage = (requiredSpace: number) => {
    if (yPosition + requiredSpace > pageHeight - 20) {
      doc.addPage()
      yPosition = 20
    }
  }

  // Title
  doc.setFontSize(24)
  doc.setFont('helvetica', 'bold')
  doc.text('AI Agent Readiness Assessment', pageWidth / 2, yPosition, { align: 'center' })
  yPosition += 20

  // Overall Score
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text(`Overall Readiness Score: ${assessmentResult.readinessScore}/100`, pageWidth / 2, yPosition, { align: 'center' })
  yPosition += 15

  // Score interpretation
  let scoreInterpretation = ''
  if (assessmentResult.readinessScore >= 80) {
    scoreInterpretation = 'Excellent - Ready for AI agents'
  } else if (assessmentResult.readinessScore >= 60) {
    scoreInterpretation = 'Good - Minor improvements needed'
  } else {
    scoreInterpretation = 'Needs improvement - Significant work required'
  }
  
  doc.setFontSize(12)
  doc.setFont('helvetica', 'normal')
  doc.text(scoreInterpretation, pageWidth / 2, yPosition, { align: 'center' })
  yPosition += 30

  // Category Breakdown
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text('Category Breakdown', 20, yPosition)
  yPosition += 15

  const categories = assessmentResult.categories
  const categoryNames = {
    documentation: 'Documentation Completeness',
    instructionClarity: 'Instruction Clarity',
    workflowAutomation: 'Workflow Automation',
    riskCompliance: 'Risk & Compliance',
    integrationStructure: 'Integration & Structure'
  }

  Object.entries(categories || {}).forEach(([key, score]) => {
    checkNewPage(20)
    
    const scoreValue = score as number
    doc.setFontSize(12)
    doc.setFont('helvetica', 'normal')
    const categoryName = categoryNames[key as keyof typeof categoryNames]
    doc.text(`${categoryName}: ${scoreValue}/20`, 20, yPosition)
    
    // Add progress bar
    const barWidth = 100
    const barHeight = 8
    const fillWidth = (scoreValue / 20) * barWidth
    
    doc.setDrawColor(200, 200, 200)
    doc.rect(20, yPosition + 5, barWidth, barHeight)
    
    if (scoreValue >= 16) {
      doc.setFillColor(34, 197, 94) // Green
    } else if (scoreValue >= 12) {
      doc.setFillColor(245, 158, 11) // Yellow
    } else {
      doc.setFillColor(239, 68, 68) // Red
    }
    
    doc.rect(20, yPosition + 5, fillWidth, barHeight, 'F')
    
    yPosition += 20
  })

  yPosition += 10

  // Static Analysis Results
  checkNewPage(30)
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text('Static Analysis Results', 20, yPosition)
  yPosition += 15

  const staticAnalysis = assessmentResult.staticAnalysis || {}
  const staticItems = [
    { name: 'README.md', value: staticAnalysis.hasReadme || false },
    { name: 'CONTRIBUTING.md', value: staticAnalysis.hasContributing || false },
    { name: 'AGENTS.md', value: staticAnalysis.hasAgents || false },
    { name: 'LICENSE', value: staticAnalysis.hasLicense || false },
    { name: 'CI/CD Workflows', value: staticAnalysis.hasWorkflows || false },
    { name: 'Test Files', value: staticAnalysis.hasTests || false },
    { name: 'Error Handling', value: staticAnalysis.errorHandling || false }
  ]

  staticItems.forEach(item => {
    checkNewPage(15)
    doc.setFontSize(11)
    doc.setFont('helvetica', 'normal')
    const status = item.value ? '✓' : '✗'
    doc.text(`${status} ${item.name}`, 20, yPosition)
    yPosition += 12
  })

  yPosition += 10

  // Key Findings
  if (assessmentResult.findings && assessmentResult.findings.length > 0) {
    checkNewPage(30)
    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.text('Key Findings', 20, yPosition)
    yPosition += 15

    assessmentResult.findings.forEach((finding: string) => {
      checkNewPage(20)
      yPosition = addText(`• ${finding}`, 20, yPosition, pageWidth - 40, 11)
    })

    yPosition += 10
  }

  // Recommendations
  if (assessmentResult.recommendations && assessmentResult.recommendations.length > 0) {
    checkNewPage(30)
    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.text('Recommendations', 20, yPosition)
    yPosition += 15

    assessmentResult.recommendations.forEach((recommendation: string) => {
      checkNewPage(20)
      yPosition = addText(`• ${recommendation}`, 20, yPosition, pageWidth - 40, 11)
    })
  }

  // Footer
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(`Generated on ${new Date().toLocaleDateString()}`, pageWidth / 2, pageHeight - 10, { align: 'center' })

  return Buffer.from(doc.output('arraybuffer'))
}