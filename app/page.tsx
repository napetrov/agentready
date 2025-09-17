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
  }
  findings: string[]
  recommendations: string[]
  staticAnalysis: {
    hasReadme: boolean
    hasContributing: boolean
    hasAgents: boolean
    hasLicense: boolean
    hasWorkflows: boolean
    hasTests: boolean
    languages: string[]
    errorHandling: boolean
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
        body: JSON.stringify({ result }),
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
              {Object.entries(result.staticAnalysis).map(([key, value]) => (
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
          </div>

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