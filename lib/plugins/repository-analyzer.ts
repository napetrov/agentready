/**
 * Repository Analyzer Plugin
 * 
 * This plugin handles static analysis of GitHub repositories,
 * including documentation, code structure, and file analysis.
 */

import { AnalysisType, AssessmentInput, AnalysisResult, RepositoryAnalysisData } from '../unified-types'
import { AnalyzerPlugin, ValidationResult } from '../plugin-registry'
import { analyzeRepository } from '../analyzer'

export class RepositoryAnalyzerPlugin implements AnalyzerPlugin {
  readonly type: AnalysisType = 'repository'
  readonly name = 'repository-analyzer'
  readonly version = '1.0.0'
  readonly description = 'Static analysis of GitHub repositories for AI agent readiness'

  /**
   * Analyze a GitHub repository
   */
  async analyze(input: AssessmentInput): Promise<AnalysisResult> {
    if (input.type !== 'repository') {
      throw new Error('Repository analyzer can only handle repository inputs')
    }

    if (!this.isValidGitHubUrl(input.url)) {
      throw new Error('Invalid GitHub repository URL')
    }

    const startTime = Date.now()
    console.log(`🔍 Starting repository analysis for: ${input.url}`)

    try {
      // Use the existing analyzer function
      const staticAnalysis = await analyzeRepository(input.url)
      
      // Convert to unified format
      const analysisData: RepositoryAnalysisData = {
        hasReadme: staticAnalysis.hasReadme,
        hasContributing: staticAnalysis.hasContributing,
        hasAgents: staticAnalysis.hasAgents,
        hasLicense: staticAnalysis.hasLicense,
        hasWorkflows: staticAnalysis.hasWorkflows,
        hasTests: staticAnalysis.hasTests,
        languages: staticAnalysis.languages,
        errorHandling: staticAnalysis.errorHandling,
        fileCount: staticAnalysis.fileCount,
        linesOfCode: staticAnalysis.linesOfCode,
        repositorySizeMB: staticAnalysis.repositorySizeMB,
        readmeContent: staticAnalysis.readmeContent,
        contributingContent: staticAnalysis.contributingContent,
        agentsContent: staticAnalysis.agentsContent,
        workflowFiles: staticAnalysis.workflowFiles,
        testFiles: staticAnalysis.testFiles,
        fileSizeAnalysis: staticAnalysis.fileSizeAnalysis ? {
          totalSizeMB: (staticAnalysis.fileSizeAnalysis.filesBySize.under100KB * 0.1 + 
                       staticAnalysis.fileSizeAnalysis.filesBySize.under500KB * 0.3 + 
                       staticAnalysis.fileSizeAnalysis.filesBySize.under1MB * 0.75 + 
                       staticAnalysis.fileSizeAnalysis.filesBySize.under5MB * 3 + 
                       staticAnalysis.fileSizeAnalysis.filesBySize.over5MB * 10) || 0,
          largeFiles: staticAnalysis.fileSizeAnalysis.largeFiles.map(file => ({
            path: file.path,
            sizeMB: (file.size || 0) / (1024 * 1024), // Convert bytes to MB
            type: 'other' as const,
            agentImpact: 'info' as const
          })),
          criticalFiles: staticAnalysis.fileSizeAnalysis.criticalFiles.map(file => ({
            path: file.path,
            sizeMB: (file.size || 0) / (1024 * 1024), // Convert bytes to MB
            agentLimit: 100, // Placeholder
            status: 'warning' as const
          })),
          agentCompatibility: {
            cursor: {
              score: staticAnalysis.fileSizeAnalysis.agentCompatibility.cursor,
              status: staticAnalysis.fileSizeAnalysis.agentCompatibility.cursor >= 80 ? 'compliant' : 
                     staticAnalysis.fileSizeAnalysis.agentCompatibility.cursor >= 60 ? 'warning' : 'blocked',
              issues: staticAnalysis.fileSizeAnalysis.agentCompatibility.cursor < 80 ? 
                     [`Cursor compatibility: ${staticAnalysis.fileSizeAnalysis.agentCompatibility.cursor}%`] : []
            },
            githubCopilot: {
              score: staticAnalysis.fileSizeAnalysis.agentCompatibility.githubCopilot,
              status: staticAnalysis.fileSizeAnalysis.agentCompatibility.githubCopilot >= 80 ? 'compliant' : 
                     staticAnalysis.fileSizeAnalysis.agentCompatibility.githubCopilot >= 60 ? 'warning' : 'blocked',
              issues: staticAnalysis.fileSizeAnalysis.agentCompatibility.githubCopilot < 80 ? 
                     [`GitHub Copilot compatibility: ${staticAnalysis.fileSizeAnalysis.agentCompatibility.githubCopilot}%`] : []
            },
            claudeWeb: {
              score: staticAnalysis.fileSizeAnalysis.agentCompatibility.claudeWeb,
              status: staticAnalysis.fileSizeAnalysis.agentCompatibility.claudeWeb >= 80 ? 'compliant' : 
                     staticAnalysis.fileSizeAnalysis.agentCompatibility.claudeWeb >= 60 ? 'warning' : 'blocked',
              issues: staticAnalysis.fileSizeAnalysis.agentCompatibility.claudeWeb < 80 ? 
                     [`Claude Web compatibility: ${staticAnalysis.fileSizeAnalysis.agentCompatibility.claudeWeb}%`] : []
            },
            claudeAPI: {
              score: staticAnalysis.fileSizeAnalysis.agentCompatibility.claudeApi,
              status: staticAnalysis.fileSizeAnalysis.agentCompatibility.claudeApi >= 80 ? 'compliant' : 
                     staticAnalysis.fileSizeAnalysis.agentCompatibility.claudeApi >= 60 ? 'warning' : 'blocked',
              issues: staticAnalysis.fileSizeAnalysis.agentCompatibility.claudeApi < 80 ? 
                     [`Claude API compatibility: ${staticAnalysis.fileSizeAnalysis.agentCompatibility.claudeApi}%`] : []
            },
            chatgpt: {
              score: 75, // Placeholder since not available in AgentCompatibilityScore
              status: 'warning' as const,
              issues: ['ChatGPT compatibility: 75% (placeholder)']
            },
            overall: {
              score: staticAnalysis.fileSizeAnalysis.agentCompatibility.overall,
              status: staticAnalysis.fileSizeAnalysis.agentCompatibility.overall >= 80 ? 'compliant' : 
                     staticAnalysis.fileSizeAnalysis.agentCompatibility.overall >= 60 ? 'warning' : 'blocked',
              issues: staticAnalysis.fileSizeAnalysis.agentCompatibility.overall < 80 ? 
                     [`Overall compatibility: ${staticAnalysis.fileSizeAnalysis.agentCompatibility.overall}%`] : []
            }
          },
          recommendations: staticAnalysis.fileSizeAnalysis.recommendations
        } : undefined
      }

      return {
        type: 'repository',
        data: {
          repository: analysisData
        },
        metadata: {
          analyzer: this.name,
          version: this.version,
          timestamp: new Date(),
          duration: Date.now() - startTime
        }
      }
    } catch (error) {
      throw new Error(`Repository analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Validate the analysis result
   */
  validate(result: AnalysisResult): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    if (result.type !== 'repository') {
      errors.push('Result type must be repository')
    }

    if (!result.data) {
      errors.push('Analysis data is required')
    }

    if (result.data && 'type' in result.data && result.data.type !== 'repository') {
      errors.push('Analysis data type must be repository')
    }

    // Validate repository-specific fields
    if (result.data && 'type' in result.data && result.data.type === 'repository') {
      const repoData = result.data.repository as RepositoryAnalysisData
      
      if (typeof repoData.hasReadme !== 'boolean') {
        errors.push('hasReadme must be a boolean')
      }
      
      if (typeof repoData.fileCount !== 'number' || repoData.fileCount < 0) {
        errors.push('fileCount must be a non-negative number')
      }
      
      if (typeof repoData.linesOfCode !== 'number' || repoData.linesOfCode < 0) {
        errors.push('linesOfCode must be a non-negative number')
      }
      
      if (typeof repoData.repositorySizeMB !== 'number' || repoData.repositorySizeMB < 0) {
        errors.push('repositorySizeMB must be a non-negative number')
      }

      if (!Array.isArray(repoData.languages)) {
        errors.push('languages must be an array')
      }

      if (!repoData.fileSizeAnalysis) {
        warnings.push('fileSizeAnalysis is missing')
      }
    }

    const isValid = errors.length === 0
    const score = isValid ? (warnings.length === 0 ? 100 : 80) : 0

    return {
      isValid,
      errors,
      warnings,
      score
    }
  }

  /**
   * Check if this analyzer can handle the given input
   */
  canHandle(input: AssessmentInput): boolean {
    return input.type === 'repository' && this.isValidGitHubUrl(input.url)
  }

  /**
   * Validate GitHub URL format
   */
  isValidGitHubUrl(url: string): boolean {
    try {
      const urlObj = new URL(url)
      return urlObj.hostname === 'github.com' && 
             urlObj.pathname.split('/').length >= 3 &&
             urlObj.pathname.split('/')[1] !== '' &&
             urlObj.pathname.split('/')[2] !== ''
    } catch {
      return false
    }
  }
}