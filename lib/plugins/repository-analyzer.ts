/**
 * Repository Analyzer Plugin
 * 
 * This plugin handles static analysis of GitHub repositories,
 * including documentation, code structure, and file analysis.
 */

import { AnalysisType, AnalysisInput, AnalysisResult, RepositoryAnalysisData } from '../unified-types'
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
  async analyze(input: AnalysisInput): Promise<AnalysisResult> {
    if (input.type !== 'repository') {
      throw new Error('Repository analyzer can only handle repository inputs')
    }

    if (!this.isValidGitHubUrl(input.url)) {
      throw new Error('Invalid GitHub repository URL')
    }

    try {
      // Use the existing analyzer function
      const staticAnalysis = await analyzeRepository(input.url)
      
      // Convert to unified format
      const analysisData: RepositoryAnalysisData = {
        type: 'repository',
        url: input.url,
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
        fileSizeAnalysis: staticAnalysis.fileSizeAnalysis
      }

      return {
        type: 'repository',
        data: analysisData,
        timestamp: new Date(),
        metadata: {
          analyzer: this.name,
          version: this.version,
          duration: 0 // Will be set by the registry
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
      const repoData = result.data as RepositoryAnalysisData
      
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
  canHandle(input: AnalysisInput): boolean {
    return input.type === 'repository' && this.isValidGitHubUrl(input.url)
  }

  /**
   * Validate GitHub URL format
   */
  private isValidGitHubUrl(url: string): boolean {
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