'use client'

import { useState } from 'react'
import { Github, FileText, Download, Loader2 } from 'lucide-react'

interface AssessmentResult {
  readinessScore: number
  categories: {
    documentation: number
    instructionClarity: number
    workflowAutomation: number
    riskCompliance: number
    integrationStructure: number
    fileSizeOptimization: number
  }
  findings: string[]
  recommendations: string[]
  detailedAnalysis?: {
    instructionClarity: {
      stepByStepQuality: number
      commandClarity: number
      environmentSetup: number
      errorHandling: number
      dependencySpecification: number
      overallScore: number
    }
    workflowAutomation: {
      ciCdQuality: number
      testAutomation: number
      buildScripts: number
      deploymentAutomation: number
      monitoringLogging: number
      overallScore: number
    }
    contextEfficiency: {
      instructionFileOptimization: number
      codeDocumentation: number
      apiDocumentation: number
      contextWindowUsage: number
      overallScore: number
    }
    riskCompliance: {
      securityPractices: number
      errorHandling: number
      inputValidation: number
      dependencySecurity: number
      licenseCompliance: number
      overallScore: number
    }
  }
  confidence?: {
    overall: number
    instructionClarity: number
    workflowAutomation: number
    contextEfficiency: number
    riskCompliance: number
  }
  staticAnalysis: {
    hasReadme: boolean
    hasContributing: boolean
    hasAgents: boolean
    hasLicense: boolean
    hasWorkflows: boolean
    hasTests: boolean
    languages: string[]
    errorHandling: boolean
    fileCount: number
    linesOfCode: number
    fileSizeAnalysis?: {
      totalFiles: number
      filesBySize: {
        under1MB: number
        under2MB: number
        under10MB: number
        under50MB: number
        over50MB: number
      }
      largeFiles: Array<{
        path: string
        size: number
        sizeFormatted: string
        type: string
        agentImpact: {
          cursor: string
          githubCopilot: string
          claudeWeb: string
          claudeApi: string
        }
        recommendation: string
      }>
      criticalFiles: Array<{
        path: string
        size: number
        sizeFormatted: string
        type: string
        isOptimal: boolean
        agentImpact: {
          cursor: string
          githubCopilot: string
          claudeWeb: string
        }
        recommendation: string
      }>
      contextConsumption: {
        instructionFiles: {
          agentsMd: { size: number; lines: number; estimatedTokens: number } | null
          readme: { size: number; lines: number; estimatedTokens: number } | null
          contributing: { size: number; lines: number; estimatedTokens: number } | null
        }
        totalContextFiles: number
        averageContextFileSize: number
        contextEfficiency: string
        recommendations: string[]
      }
      agentCompatibility: {
        cursor: number
        githubCopilot: number
        claudeWeb: number
        claudeApi: number
        overall: number
      }
      recommendations: string[]
    }
  }
}

export default function Home() {
  const [repoUrl, setRepoUrl] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [result, setResult] = useState<AssessmentResult | null>(null)
  const [error, setError] = useState('')

  const handleAnalyze = async () => {
    if (!repoUrl.trim()) {
      setError('Please enter a GitHub repository URL')
      return
    }

    setIsAnalyzing(true)
    setError('')
    setResult(null)

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ repoUrl: repoUrl.trim() }),
      })

      if (!response.ok) {
        throw new Error('Failed to analyze repository')
      }

      const data = await response.json()
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsAnalyzing(false)
    }
  }

  const downloadReport = async () => {
    if (!result) return

    try {
      const response = await fetch('/api/report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ result, repoUrl }),
      })

      if (!response.ok) {
        throw new Error('Failed to generate report')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `ai-readiness-assessment-${Date.now()}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err) {
      console.error('Failed to download report:', err)
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-success-600 bg-success-50'
    if (score >= 60) return 'text-warning-600 bg-warning-50'
    return 'text-danger-600 bg-danger-50'
  }

  return (
    <div className="space-y-8">
      {/* Input Section */}
      <div className="card">
        <h2 className="text-xl font-semibold mb-4 flex items-center">
          <Github className="w-5 h-5 mr-2" />
          Repository Analysis
        </h2>
        <div className="space-y-4">
          <div>
            <label htmlFor="repoUrl" className="block text-sm font-medium text-gray-700 mb-2">
              GitHub Repository URL
            </label>
            <input
              type="url"
              id="repoUrl"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="https://github.com/username/repository"
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
              disabled={isAnalyzing}
            />
          </div>
          <button
            onClick={handleAnalyze}
            disabled={isAnalyzing || !repoUrl.trim()}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Analyzing...
              </>
            ) : (
              'Analyze Repository'
            )}
          </button>
          {error && (
            <div className="text-danger-600 text-sm bg-danger-50 p-3 rounded-md">
              {error}
            </div>
          )}
        </div>
      </div>

      {/* Results Section */}
      {result && (
        <div className="space-y-6">
          {/* Repository Information */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Repository Information</h3>
              <a
                href={repoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center text-blue-600 hover:text-blue-800 transition-colors"
              >
                <Github className="w-4 h-4 mr-2" />
                View Repository
              </a>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-3 border rounded-lg">
                <div className="text-sm font-medium text-gray-600 mb-1">Total Files</div>
                <div className="text-lg font-bold text-blue-600">
                  {result.staticAnalysis.fileSizeAnalysis?.totalFiles || result.staticAnalysis.fileCount || 0}
                </div>
              </div>
              <div className="p-3 border rounded-lg">
                <div className="text-sm font-medium text-gray-600 mb-1">Lines of Code</div>
                <div className="text-lg font-bold text-green-600">
                  {result.staticAnalysis.linesOfCode?.toLocaleString() || '0'}
                </div>
              </div>
              <div className="p-3 border rounded-lg">
                <div className="text-sm font-medium text-gray-600 mb-1">Primary Languages</div>
                <div className="text-sm font-medium">
                  {result.staticAnalysis.languages?.slice(0, 2).join(', ') || 'Unknown'}
                </div>
              </div>
              <div className="p-3 border rounded-lg">
                <div className="text-sm font-medium text-gray-600 mb-1">Documentation Files</div>
                <div className="text-sm font-medium">
                  {[
                    result.staticAnalysis.hasReadme && 'README',
                    result.staticAnalysis.hasAgents && 'AGENTS',
                    result.staticAnalysis.hasContributing && 'CONTRIBUTING',
                    result.staticAnalysis.hasLicense && 'LICENSE'
                  ].filter(Boolean).join(', ') || 'None'}
                </div>
              </div>
            </div>
          </div>

          {/* Overall Score */}
          <div className="card">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold">Assessment Results</h2>
              <button
                onClick={downloadReport}
                className="btn-secondary flex items-center"
              >
                <Download className="w-4 h-4 mr-2" />
                Download Report
              </button>
            </div>
            
            <div className="flex items-center space-x-8">
              <div className={`score-circle ${getScoreColor(result.readinessScore)}`}>
                {result.readinessScore}
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2">Overall Readiness Score</h3>
                <p className="text-gray-600">
                  {result.readinessScore >= 80 && 'Excellent - Ready for AI agents'}
                  {result.readinessScore >= 60 && result.readinessScore < 80 && 'Good - Minor improvements needed'}
                  {result.readinessScore < 60 && 'Needs improvement - Significant work required'}
                </p>
              </div>
            </div>
          </div>

          {/* Category Breakdown */}
          <div className="card">
            <h3 className="text-lg font-semibold mb-4">Category Breakdown</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(result.categories).map(([category, score]) => (
                <div key={category} className="p-4 border rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium capitalize">
                      {category.replace(/([A-Z])/g, ' $1').trim()}
                    </span>
                    <span className={`text-sm font-bold ${getScoreColor(score).split(' ')[0]}`}>
                      {score}/20
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${
                        score >= 16 ? 'bg-success-500' : score >= 12 ? 'bg-warning-500' : 'bg-danger-500'
                      }`}
                      style={{ width: `${(score / 20) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Static Analysis */}
          <div className="card">
            <h3 className="text-lg font-semibold mb-4">Static Analysis Results</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(result.staticAnalysis)
                .filter(([_, value]) => typeof value === 'boolean')
                .map(([key, value]) => (
                  <div key={key} className="text-center p-3 border rounded-lg">
                    <div className={`w-8 h-8 mx-auto mb-2 rounded-full flex items-center justify-center ${
                      value ? 'bg-success-100 text-success-600' : 'bg-gray-100 text-gray-400'
                    }`}>
                      {value ? '✓' : '✗'}
                    </div>
                    <div className="text-sm font-medium capitalize">
                      {key.replace(/([A-Z])/g, ' $1').trim()}
                    </div>
                  </div>
                ))}
            </div>
            
            {/* Languages */}
            {result.staticAnalysis.languages && result.staticAnalysis.languages.length > 0 && (
              <div className="mt-4 p-3 border rounded-lg">
                <div className="text-sm font-medium mb-2">Programming Languages</div>
                <div className="flex flex-wrap gap-2">
                  {result.staticAnalysis.languages.map((lang: string, index: number) => (
                    <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                      {lang}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* File Size Analysis */}
          {result.staticAnalysis.fileSizeAnalysis && (
            <div className="card">
              <h3 className="text-lg font-semibold mb-4">File Size & AI Agent Compatibility</h3>
              
              {/* Agent Compatibility Scores */}
              <div className="mb-6">
                <h4 className="text-md font-medium mb-3">Agent Compatibility Scores</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {Object.entries(result.staticAnalysis.fileSizeAnalysis.agentCompatibility)
                    .filter(([key]) => key !== 'overall')
                    .map(([agent, score]) => (
                    <div key={agent} className="p-3 border rounded-lg text-center">
                      <div className="text-sm font-medium capitalize mb-1">
                        {agent === 'githubCopilot' ? 'GitHub Copilot' : 
                         agent === 'claudeWeb' ? 'Claude Web' :
                         agent === 'claudeApi' ? 'Claude API' : agent}
                      </div>
                      <div className={`text-lg font-bold ${
                        score >= 80 ? 'text-green-600' : score >= 60 ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        {score}%
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* File Size Distribution */}
              <div className="mb-6">
                <h4 className="text-md font-medium mb-3">File Size Distribution</h4>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  {Object.entries(result.staticAnalysis.fileSizeAnalysis.filesBySize).map(([range, count]) => (
                    <div key={range} className="p-3 border rounded-lg text-center">
                      <div className="text-sm font-medium capitalize mb-1">
                        {range.replace(/([A-Z])/g, ' $1').trim()}
                      </div>
                      <div className="text-lg font-bold text-blue-600">{count}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Large Files */}
              {result.staticAnalysis.fileSizeAnalysis.largeFiles.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-md font-medium mb-3">Large Files (&gt;2MB)</h4>
                  <div className="space-y-2">
                    {result.staticAnalysis.fileSizeAnalysis.largeFiles.slice(0, 5).map((file, index) => (
                      <div key={index} className="p-3 border rounded-lg">
                        <div className="flex justify-between items-start mb-2">
                          <div className="font-medium text-sm truncate flex-1 mr-2">{file.path}</div>
                          <div className="text-sm font-bold text-red-600">{file.sizeFormatted}</div>
                        </div>
                        <div className="text-xs text-gray-600 mb-1">
                          Type: {file.type} | 
                          Cursor: {file.agentImpact.cursor} | 
                          GitHub Copilot: {file.agentImpact.githubCopilot}
                        </div>
                        <div className="text-xs text-gray-700">{file.recommendation}</div>
                      </div>
                    ))}
                    {result.staticAnalysis.fileSizeAnalysis.largeFiles.length > 5 && (
                      <div className="text-sm text-gray-500 text-center">
                        ... and {result.staticAnalysis.fileSizeAnalysis.largeFiles.length - 5} more files
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Critical Files */}
              {result.staticAnalysis.fileSizeAnalysis.criticalFiles.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-md font-medium mb-3">Critical Files Analysis</h4>
                  <div className="space-y-2">
                    {result.staticAnalysis.fileSizeAnalysis.criticalFiles.map((file, index) => (
                      <div key={index} className="p-3 border rounded-lg">
                        <div className="flex justify-between items-start mb-2">
                          <div className="font-medium text-sm truncate flex-1 mr-2">{file.path}</div>
                          <div className="text-sm font-bold">{file.sizeFormatted}</div>
                        </div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-2 py-1 text-xs rounded ${
                            file.isOptimal ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {file.isOptimal ? 'Optimal' : 'Suboptimal'}
                          </span>
                          <span className="text-xs text-gray-600">
                            {file.type} | Cursor: {file.agentImpact.cursor}
                          </span>
                        </div>
                        <div className="text-xs text-gray-700">{file.recommendation}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Context Consumption */}
              <div className="mb-6">
                <h4 className="text-md font-medium mb-3">Context Consumption Analysis</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-3 border rounded-lg">
                    <div className="text-sm font-medium mb-2">Instruction Files</div>
                    <div className="space-y-1 text-xs">
                      {result.staticAnalysis.fileSizeAnalysis.contextConsumption.instructionFiles.agentsMd && (
                        <div>AGENTS.md: {Math.round(result.staticAnalysis.fileSizeAnalysis.contextConsumption.instructionFiles.agentsMd.size / 1024)}KB ({result.staticAnalysis.fileSizeAnalysis.contextConsumption.instructionFiles.agentsMd.lines} lines)</div>
                      )}
                      {result.staticAnalysis.fileSizeAnalysis.contextConsumption.instructionFiles.readme && (
                        <div>README: {Math.round(result.staticAnalysis.fileSizeAnalysis.contextConsumption.instructionFiles.readme.size / 1024)}KB ({result.staticAnalysis.fileSizeAnalysis.contextConsumption.instructionFiles.readme.lines} lines)</div>
                      )}
                      {result.staticAnalysis.fileSizeAnalysis.contextConsumption.instructionFiles.contributing && (
                        <div>CONTRIBUTING: {Math.round(result.staticAnalysis.fileSizeAnalysis.contextConsumption.instructionFiles.contributing.size / 1024)}KB ({result.staticAnalysis.fileSizeAnalysis.contextConsumption.instructionFiles.contributing.lines} lines)</div>
                      )}
                    </div>
                  </div>
                  <div className="p-3 border rounded-lg">
                    <div className="text-sm font-medium mb-2">Efficiency Metrics</div>
                    <div className="space-y-1 text-xs">
                      <div>Total Context Files: {result.staticAnalysis.fileSizeAnalysis.contextConsumption.totalContextFiles}</div>
                      <div>Average File Size: {Math.round(result.staticAnalysis.fileSizeAnalysis.contextConsumption.averageContextFileSize / 1024)}KB</div>
                      <div>Context Efficiency: <span className={`font-medium ${
                        result.staticAnalysis.fileSizeAnalysis.contextConsumption.contextEfficiency === 'excellent' ? 'text-green-600' :
                        result.staticAnalysis.fileSizeAnalysis.contextConsumption.contextEfficiency === 'good' ? 'text-blue-600' :
                        result.staticAnalysis.fileSizeAnalysis.contextConsumption.contextEfficiency === 'moderate' ? 'text-yellow-600' : 'text-red-600'
                      }`}>{result.staticAnalysis.fileSizeAnalysis.contextConsumption.contextEfficiency}</span></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* File Size Recommendations */}
              {result.staticAnalysis.fileSizeAnalysis.recommendations.length > 0 && (
                <div>
                  <h4 className="text-md font-medium mb-3">File Size Recommendations</h4>
                  <ul className="space-y-1">
                    {result.staticAnalysis.fileSizeAnalysis.recommendations.map((rec, index) => (
                      <li key={index} className="flex items-start text-sm">
                        <span className="w-2 h-2 bg-blue-500 rounded-full mt-2 mr-3 flex-shrink-0" />
                        <span className="text-gray-700">{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Detailed Analysis */}
          {result.detailedAnalysis && (
            <div className="card">
              <h3 className="text-lg font-semibold mb-4">Detailed Analysis</h3>
              
              {/* Instruction Clarity */}
              <div className="mb-6">
                <h4 className="text-md font-medium mb-3">Instruction Clarity Breakdown</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="p-3 border rounded-lg">
                    <div className="text-sm font-medium text-gray-600 mb-1">Step-by-Step Quality</div>
                    <div className="text-lg font-bold text-blue-600">{result.detailedAnalysis.instructionClarity.stepByStepQuality}/20</div>
                  </div>
                  <div className="p-3 border rounded-lg">
                    <div className="text-sm font-medium text-gray-600 mb-1">Command Clarity</div>
                    <div className="text-lg font-bold text-blue-600">{result.detailedAnalysis.instructionClarity.commandClarity}/20</div>
                  </div>
                  <div className="p-3 border rounded-lg">
                    <div className="text-sm font-medium text-gray-600 mb-1">Environment Setup</div>
                    <div className="text-lg font-bold text-blue-600">{result.detailedAnalysis.instructionClarity.environmentSetup}/20</div>
                  </div>
                  <div className="p-3 border rounded-lg">
                    <div className="text-sm font-medium text-gray-600 mb-1">Error Handling</div>
                    <div className="text-lg font-bold text-blue-600">{result.detailedAnalysis.instructionClarity.errorHandling}/20</div>
                  </div>
                  <div className="p-3 border rounded-lg">
                    <div className="text-sm font-medium text-gray-600 mb-1">Dependency Specification</div>
                    <div className="text-lg font-bold text-blue-600">{result.detailedAnalysis.instructionClarity.dependencySpecification}/20</div>
                  </div>
                  <div className="p-3 border rounded-lg bg-blue-50">
                    <div className="text-sm font-medium text-gray-600 mb-1">Overall Score</div>
                    <div className="text-lg font-bold text-blue-700">{result.detailedAnalysis.instructionClarity.overallScore}/20</div>
                  </div>
                </div>
              </div>

              {/* Workflow Automation */}
              <div className="mb-6">
                <h4 className="text-md font-medium mb-3">Workflow Automation Breakdown</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="p-3 border rounded-lg">
                    <div className="text-sm font-medium text-gray-600 mb-1">CI/CD Quality</div>
                    <div className="text-lg font-bold text-green-600">{result.detailedAnalysis.workflowAutomation.ciCdQuality}/20</div>
                  </div>
                  <div className="p-3 border rounded-lg">
                    <div className="text-sm font-medium text-gray-600 mb-1">Test Automation</div>
                    <div className="text-lg font-bold text-green-600">{result.detailedAnalysis.workflowAutomation.testAutomation}/20</div>
                  </div>
                  <div className="p-3 border rounded-lg">
                    <div className="text-sm font-medium text-gray-600 mb-1">Build Scripts</div>
                    <div className="text-lg font-bold text-green-600">{result.detailedAnalysis.workflowAutomation.buildScripts}/20</div>
                  </div>
                  <div className="p-3 border rounded-lg">
                    <div className="text-sm font-medium text-gray-600 mb-1">Deployment Automation</div>
                    <div className="text-lg font-bold text-green-600">{result.detailedAnalysis.workflowAutomation.deploymentAutomation}/20</div>
                  </div>
                  <div className="p-3 border rounded-lg">
                    <div className="text-sm font-medium text-gray-600 mb-1">Monitoring & Logging</div>
                    <div className="text-lg font-bold text-green-600">{result.detailedAnalysis.workflowAutomation.monitoringLogging}/20</div>
                  </div>
                  <div className="p-3 border rounded-lg bg-green-50">
                    <div className="text-sm font-medium text-gray-600 mb-1">Overall Score</div>
                    <div className="text-lg font-bold text-green-700">{result.detailedAnalysis.workflowAutomation.overallScore}/20</div>
                  </div>
                </div>
              </div>

              {/* Context Efficiency */}
              <div className="mb-6">
                <h4 className="text-md font-medium mb-3">Context Efficiency Breakdown</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="p-3 border rounded-lg">
                    <div className="text-sm font-medium text-gray-600 mb-1">Instruction File Optimization</div>
                    <div className="text-lg font-bold text-purple-600">{result.detailedAnalysis.contextEfficiency.instructionFileOptimization}/20</div>
                  </div>
                  <div className="p-3 border rounded-lg">
                    <div className="text-sm font-medium text-gray-600 mb-1">Code Documentation</div>
                    <div className="text-lg font-bold text-purple-600">{result.detailedAnalysis.contextEfficiency.codeDocumentation}/20</div>
                  </div>
                  <div className="p-3 border rounded-lg">
                    <div className="text-sm font-medium text-gray-600 mb-1">API Documentation</div>
                    <div className="text-lg font-bold text-purple-600">{result.detailedAnalysis.contextEfficiency.apiDocumentation}/20</div>
                  </div>
                  <div className="p-3 border rounded-lg">
                    <div className="text-sm font-medium text-gray-600 mb-1">Context Window Usage</div>
                    <div className="text-lg font-bold text-purple-600">{result.detailedAnalysis.contextEfficiency.contextWindowUsage}/20</div>
                  </div>
                  <div className="p-3 border rounded-lg bg-purple-50">
                    <div className="text-sm font-medium text-gray-600 mb-1">Overall Score</div>
                    <div className="text-lg font-bold text-purple-700">{result.detailedAnalysis.contextEfficiency.overallScore}/20</div>
                  </div>
                </div>
              </div>

              {/* Risk & Compliance */}
              <div className="mb-6">
                <h4 className="text-md font-medium mb-3">Risk & Compliance Breakdown</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="p-3 border rounded-lg">
                    <div className="text-sm font-medium text-gray-600 mb-1">Security Practices</div>
                    <div className="text-lg font-bold text-red-600">{result.detailedAnalysis.riskCompliance.securityPractices}/20</div>
                  </div>
                  <div className="p-3 border rounded-lg">
                    <div className="text-sm font-medium text-gray-600 mb-1">Error Handling</div>
                    <div className="text-lg font-bold text-red-600">{result.detailedAnalysis.riskCompliance.errorHandling}/20</div>
                  </div>
                  <div className="p-3 border rounded-lg">
                    <div className="text-sm font-medium text-gray-600 mb-1">Input Validation</div>
                    <div className="text-lg font-bold text-red-600">{result.detailedAnalysis.riskCompliance.inputValidation}/20</div>
                  </div>
                  <div className="p-3 border rounded-lg">
                    <div className="text-sm font-medium text-gray-600 mb-1">Dependency Security</div>
                    <div className="text-lg font-bold text-red-600">{result.detailedAnalysis.riskCompliance.dependencySecurity}/20</div>
                  </div>
                  <div className="p-3 border rounded-lg">
                    <div className="text-sm font-medium text-gray-600 mb-1">License Compliance</div>
                    <div className="text-lg font-bold text-red-600">{result.detailedAnalysis.riskCompliance.licenseCompliance}/20</div>
                  </div>
                  <div className="p-3 border rounded-lg bg-red-50">
                    <div className="text-sm font-medium text-gray-600 mb-1">Overall Score</div>
                    <div className="text-lg font-bold text-red-700">{result.detailedAnalysis.riskCompliance.overallScore}/20</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Confidence Scores */}
          {result.confidence && (
            <div className="card">
              <h3 className="text-lg font-semibold mb-4">Assessment Confidence</h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="p-3 border rounded-lg text-center">
                  <div className="text-sm font-medium text-gray-600 mb-1">Overall</div>
                  <div className={`text-lg font-bold ${
                    result.confidence.overall >= 80 ? 'text-green-600' : 
                    result.confidence.overall >= 60 ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    {result.confidence.overall}%
                  </div>
                </div>
                <div className="p-3 border rounded-lg text-center">
                  <div className="text-sm font-medium text-gray-600 mb-1">Instruction Clarity</div>
                  <div className={`text-lg font-bold ${
                    result.confidence.instructionClarity >= 80 ? 'text-green-600' : 
                    result.confidence.instructionClarity >= 60 ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    {result.confidence.instructionClarity}%
                  </div>
                </div>
                <div className="p-3 border rounded-lg text-center">
                  <div className="text-sm font-medium text-gray-600 mb-1">Workflow Automation</div>
                  <div className={`text-lg font-bold ${
                    result.confidence.workflowAutomation >= 80 ? 'text-green-600' : 
                    result.confidence.workflowAutomation >= 60 ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    {result.confidence.workflowAutomation}%
                  </div>
                </div>
                <div className="p-3 border rounded-lg text-center">
                  <div className="text-sm font-medium text-gray-600 mb-1">Context Efficiency</div>
                  <div className={`text-lg font-bold ${
                    result.confidence.contextEfficiency >= 80 ? 'text-green-600' : 
                    result.confidence.contextEfficiency >= 60 ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    {result.confidence.contextEfficiency}%
                  </div>
                </div>
                <div className="p-3 border rounded-lg text-center">
                  <div className="text-sm font-medium text-gray-600 mb-1">Risk & Compliance</div>
                  <div className={`text-lg font-bold ${
                    result.confidence.riskCompliance >= 80 ? 'text-green-600' : 
                    result.confidence.riskCompliance >= 60 ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    {result.confidence.riskCompliance}%
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Key Findings */}
          <div className="card">
            <h3 className="text-lg font-semibold mb-4">Key Findings</h3>
            <ul className="space-y-2">
              {result.findings.map((finding, index) => (
                <li key={index} className="flex items-start">
                  <span className="w-2 h-2 bg-primary-500 rounded-full mt-2 mr-3 flex-shrink-0" />
                  <span className="text-gray-700">{finding}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Recommendations */}
          <div className="card">
            <h3 className="text-lg font-semibold mb-4">Recommendations</h3>
            <ul className="space-y-2">
              {result.recommendations.map((recommendation, index) => (
                <li key={index} className="flex items-start">
                  <span className="w-2 h-2 bg-warning-500 rounded-full mt-2 mr-3 flex-shrink-0" />
                  <span className="text-gray-700">{recommendation}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}