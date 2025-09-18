import jsPDF from 'jspdf'

export async function generatePDFReport(assessmentResult: any, repoUrl?: string): Promise<Buffer> {
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

  // Repository Information
  if (repoUrl) {
    doc.setFontSize(12)
    doc.setFont('helvetica', 'normal')
    doc.text(`Repository: ${repoUrl}`, pageWidth / 2, yPosition, { align: 'center' })
    yPosition += 15
  }

  // Repository Statistics
  const staticAnalysis = assessmentResult.staticAnalysis || {}
  const fileSizeAnalysis = staticAnalysis.fileSizeAnalysis || {}
  
  if (staticAnalysis.fileCount || fileSizeAnalysis.totalFiles) {
    checkNewPage(40)
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('Repository Statistics', 20, yPosition)
    yPosition += 15

    doc.setFontSize(11)
    doc.setFont('helvetica', 'normal')
    
    // Basic stats
    const totalFiles = fileSizeAnalysis.totalFiles || staticAnalysis.fileCount || 0
    doc.text(`Total Files: ${totalFiles}`, 20, yPosition)
    yPosition += 12

    if (staticAnalysis.languages && staticAnalysis.languages.length > 0) {
      doc.text(`Primary Languages: ${staticAnalysis.languages.slice(0, 3).join(', ')}`, 20, yPosition)
      yPosition += 12
    }

    // File size distribution
    if (fileSizeAnalysis.filesBySize) {
      const fs = fileSizeAnalysis.filesBySize
      doc.text(`File Size Distribution:`, 20, yPosition)
      yPosition += 8
      doc.text(`  • Under 100KB: ${fs.under100KB} files`, 30, yPosition)
      yPosition += 8
      doc.text(`  • 100KB-500KB: ${fs.under500KB - fs.under100KB} files`, 30, yPosition)
      yPosition += 8
      doc.text(`  • 500KB-1MB: ${fs.under1MB - fs.under500KB} files`, 30, yPosition)
      yPosition += 8
      doc.text(`  • 1MB-5MB: ${fs.under5MB - fs.under1MB} files`, 30, yPosition)
      yPosition += 8
      doc.text(`  • Over 5MB: ${fs.over5MB} files`, 30, yPosition)
      yPosition += 15
    }

    // Lines of code estimation
    if (fileSizeAnalysis.contextConsumption) {
      const totalLines = (fileSizeAnalysis.contextConsumption.instructionFiles.agentsMd?.lines || 0) +
                        (fileSizeAnalysis.contextConsumption.instructionFiles.readme?.lines || 0) +
                        (fileSizeAnalysis.contextConsumption.instructionFiles.contributing?.lines || 0)
      
      if (totalLines > 0) {
        doc.text(`Documentation Lines: ${totalLines}`, 20, yPosition)
        yPosition += 12
      }
    }
  }

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
    integrationStructure: 'Integration & Structure',
    fileSizeOptimization: 'File Size & Context Optimization'
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

  // File Size & AI Agent Compatibility Analysis
  if (fileSizeAnalysis.agentCompatibility || fileSizeAnalysis.largeFiles || fileSizeAnalysis.criticalFiles) {
    checkNewPage(50)
    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.text('File Size & AI Agent Compatibility', 20, yPosition)
    yPosition += 15

    // Agent Compatibility Scores
    if (fileSizeAnalysis.agentCompatibility) {
      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      doc.text('Agent Compatibility Scores:', 20, yPosition)
      yPosition += 10

      doc.setFontSize(11)
      doc.setFont('helvetica', 'normal')
      const agents = fileSizeAnalysis.agentCompatibility
      doc.text(`Cursor: ${agents.cursor}%`, 30, yPosition)
      yPosition += 8
      doc.text(`GitHub Copilot: ${agents.githubCopilot}%`, 30, yPosition)
      yPosition += 8
      doc.text(`Claude Web: ${agents.claudeWeb}%`, 30, yPosition)
      yPosition += 8
      doc.text(`Claude API: ${agents.claudeApi}%`, 30, yPosition)
      yPosition += 15
    }

    // Large Files Analysis
    if (fileSizeAnalysis.largeFiles && fileSizeAnalysis.largeFiles.length > 0) {
      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      doc.text(`Large Files (>2MB): ${fileSizeAnalysis.largeFiles.length} files`, 20, yPosition)
      yPosition += 10

      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      fileSizeAnalysis.largeFiles.slice(0, 5).forEach((file: any) => {
        checkNewPage(15)
        doc.text(`• ${file.path}: ${file.sizeFormatted} (${file.type})`, 30, yPosition)
        yPosition += 8
        doc.text(`  Impact: Cursor ${file.agentImpact.cursor}, GitHub Copilot ${file.agentImpact.githubCopilot}`, 35, yPosition)
        yPosition += 8
      })
      
      if (fileSizeAnalysis.largeFiles.length > 5) {
        doc.text(`... and ${fileSizeAnalysis.largeFiles.length - 5} more files`, 30, yPosition)
        yPosition += 8
      }
      yPosition += 10
    }

    // Critical Files Analysis
    if (fileSizeAnalysis.criticalFiles && fileSizeAnalysis.criticalFiles.length > 0) {
      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      doc.text('Critical Files Analysis:', 20, yPosition)
      yPosition += 10

      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      fileSizeAnalysis.criticalFiles.forEach((file: any) => {
        checkNewPage(12)
        const status = file.isOptimal ? 'Optimal' : 'Suboptimal'
        doc.text(`• ${file.path}: ${file.sizeFormatted} (${file.type}) - ${status}`, 30, yPosition)
        yPosition += 8
      })
      yPosition += 10
    }

    // Context Consumption Analysis
    if (fileSizeAnalysis.contextConsumption) {
      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      doc.text('Context Consumption Analysis:', 20, yPosition)
      yPosition += 10

      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      const context = fileSizeAnalysis.contextConsumption
      doc.text(`Total Context Files: ${context.totalContextFiles}`, 30, yPosition)
      yPosition += 8
      doc.text(`Average File Size: ${Math.round(context.averageContextFileSize / 1024)}KB`, 30, yPosition)
      yPosition += 8
      doc.text(`Context Efficiency: ${context.contextEfficiency}`, 30, yPosition)
      yPosition += 8

      // Instruction files details
      if (context.instructionFiles.agentsMd) {
        const agents = context.instructionFiles.agentsMd
        doc.text(`AGENTS.md: ${Math.round(agents.size / 1024)}KB, ${agents.lines} lines`, 30, yPosition)
        yPosition += 8
      }
      if (context.instructionFiles.readme) {
        const readme = context.instructionFiles.readme
        doc.text(`README: ${Math.round(readme.size / 1024)}KB, ${readme.lines} lines`, 30, yPosition)
        yPosition += 8
      }
      yPosition += 10
    }
  }

  // Detailed Analysis
  if (assessmentResult.detailedAnalysis) {
    checkNewPage(50)
    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.text('Detailed Analysis', 20, yPosition)
    yPosition += 20

    const detailed = assessmentResult.detailedAnalysis

    // Instruction Clarity
    if (detailed.instructionClarity) {
      checkNewPage(40)
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.text('Instruction Clarity Breakdown', 20, yPosition)
      yPosition += 15

      doc.setFontSize(11)
      doc.setFont('helvetica', 'normal')
      yPosition = addText(`Step-by-Step Quality: ${detailed.instructionClarity.stepByStepQuality}/20`, 20, yPosition, pageWidth - 40, 11)
      yPosition = addText(`Command Clarity: ${detailed.instructionClarity.commandClarity}/20`, 20, yPosition, pageWidth - 40, 11)
      yPosition = addText(`Environment Setup: ${detailed.instructionClarity.environmentSetup}/20`, 20, yPosition, pageWidth - 40, 11)
      yPosition = addText(`Error Handling: ${detailed.instructionClarity.errorHandling}/20`, 20, yPosition, pageWidth - 40, 11)
      yPosition = addText(`Dependency Specification: ${detailed.instructionClarity.dependencySpecification}/20`, 20, yPosition, pageWidth - 40, 11)
      yPosition = addText(`Overall Score: ${detailed.instructionClarity.overallScore}/20`, 20, yPosition, pageWidth - 40, 11)
      yPosition += 10
    }

    // Workflow Automation
    if (detailed.workflowAutomation) {
      checkNewPage(40)
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.text('Workflow Automation Breakdown', 20, yPosition)
      yPosition += 15

      doc.setFontSize(11)
      doc.setFont('helvetica', 'normal')
      yPosition = addText(`CI/CD Quality: ${detailed.workflowAutomation.ciCdQuality}/20`, 20, yPosition, pageWidth - 40, 11)
      yPosition = addText(`Test Automation: ${detailed.workflowAutomation.testAutomation}/20`, 20, yPosition, pageWidth - 40, 11)
      yPosition = addText(`Build Scripts: ${detailed.workflowAutomation.buildScripts}/20`, 20, yPosition, pageWidth - 40, 11)
      yPosition = addText(`Deployment Automation: ${detailed.workflowAutomation.deploymentAutomation}/20`, 20, yPosition, pageWidth - 40, 11)
      yPosition = addText(`Monitoring & Logging: ${detailed.workflowAutomation.monitoringLogging}/20`, 20, yPosition, pageWidth - 40, 11)
      yPosition = addText(`Overall Score: ${detailed.workflowAutomation.overallScore}/20`, 20, yPosition, pageWidth - 40, 11)
      yPosition += 10
    }

    // Context Efficiency
    if (detailed.contextEfficiency) {
      checkNewPage(40)
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.text('Context Efficiency Breakdown', 20, yPosition)
      yPosition += 15

      doc.setFontSize(11)
      doc.setFont('helvetica', 'normal')
      yPosition = addText(`Instruction File Optimization: ${detailed.contextEfficiency.instructionFileOptimization}/20`, 20, yPosition, pageWidth - 40, 11)
      yPosition = addText(`Code Documentation: ${detailed.contextEfficiency.codeDocumentation}/20`, 20, yPosition, pageWidth - 40, 11)
      yPosition = addText(`API Documentation: ${detailed.contextEfficiency.apiDocumentation}/20`, 20, yPosition, pageWidth - 40, 11)
      yPosition = addText(`Context Window Usage: ${detailed.contextEfficiency.contextWindowUsage}/20`, 20, yPosition, pageWidth - 40, 11)
      yPosition = addText(`Overall Score: ${detailed.contextEfficiency.overallScore}/20`, 20, yPosition, pageWidth - 40, 11)
      yPosition += 10
    }

    // Risk & Compliance
    if (detailed.riskCompliance) {
      checkNewPage(40)
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.text('Risk & Compliance Breakdown', 20, yPosition)
      yPosition += 15

      doc.setFontSize(11)
      doc.setFont('helvetica', 'normal')
      yPosition = addText(`Security Practices: ${detailed.riskCompliance.securityPractices}/20`, 20, yPosition, pageWidth - 40, 11)
      yPosition = addText(`Error Handling: ${detailed.riskCompliance.errorHandling}/20`, 20, yPosition, pageWidth - 40, 11)
      yPosition = addText(`Input Validation: ${detailed.riskCompliance.inputValidation}/20`, 20, yPosition, pageWidth - 40, 11)
      yPosition = addText(`Dependency Security: ${detailed.riskCompliance.dependencySecurity}/20`, 20, yPosition, pageWidth - 40, 11)
      yPosition = addText(`License Compliance: ${detailed.riskCompliance.licenseCompliance}/20`, 20, yPosition, pageWidth - 40, 11)
      yPosition = addText(`Overall Score: ${detailed.riskCompliance.overallScore}/20`, 20, yPosition, pageWidth - 40, 11)
      yPosition += 10
    }
  }

  // Confidence Scores
  if (assessmentResult.confidence) {
    checkNewPage(30)
    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.text('Assessment Confidence', 20, yPosition)
    yPosition += 15

    doc.setFontSize(11)
    doc.setFont('helvetica', 'normal')
    yPosition = addText(`Overall Confidence: ${assessmentResult.confidence.overall}%`, 20, yPosition, pageWidth - 40, 11)
    yPosition = addText(`Instruction Clarity: ${assessmentResult.confidence.instructionClarity}%`, 20, yPosition, pageWidth - 40, 11)
    yPosition = addText(`Workflow Automation: ${assessmentResult.confidence.workflowAutomation}%`, 20, yPosition, pageWidth - 40, 11)
    yPosition = addText(`Context Efficiency: ${assessmentResult.confidence.contextEfficiency}%`, 20, yPosition, pageWidth - 40, 11)
    yPosition = addText(`Risk & Compliance: ${assessmentResult.confidence.riskCompliance}%`, 20, yPosition, pageWidth - 40, 11)
    yPosition += 10
  }

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