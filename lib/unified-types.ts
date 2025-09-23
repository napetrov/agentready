/**
 * Unified Types for AI Agent Readiness Assessment Tool
 * 
 * This file contains all the unified interfaces and types used across
 * the assessment system, replacing the fragmented interfaces from
 * multiple files.
 */

// ============================================================================
// Core Assessment Types
// ============================================================================

export type AnalysisType = 'repository' | 'website'

export interface AssessmentInput {
  url: string
  type: AnalysisType
  options?: AssessmentOptions
}

export interface AssessmentOptions {
  enableAIAssessment?: boolean
  enableValidation?: boolean
  maxRetries?: number
  timeout?: number
  includeDetailedAnalysis?: boolean
}

// ============================================================================
// Unified Assessment Result
// ============================================================================

export interface AssessmentResult {
  // Core identification
  id: string
  type: AnalysisType
  url: string
  timestamp: Date
  
  // Unified scoring (0-100 scale)
  scores: {
    overall: Score
    categories: CategoryScores
    confidence: ConfidenceScores
  }
  
  // Analysis data
  analysis: AnalysisData
  aiAssessment?: AIAssessment
  
  // Insights
  findings: Finding[]
  recommendations: Recommendation[]
  
  // Metadata
  metadata: AssessmentMetadata
}

export interface Score {
  value: number
  maxValue: number
  percentage: number
  confidence: number
}

export interface CategoryScores {
  documentation: Score
  instructionClarity: Score
  workflowAutomation: Score
  riskCompliance: Score
  integrationStructure: Score
  fileSizeOptimization: Score
  // Website-specific categories
  informationArchitecture?: Score
  machineReadableContent?: Score
  conversationalQueryReadiness?: Score
  actionOrientedFunctionality?: Score
  personalizationContextAwareness?: Score
}

export interface ConfidenceScores {
  overall: number
  staticAnalysis: number
  aiAssessment: number
  businessTypeAnalysis?: number
}

// ============================================================================
// Analysis Data
// ============================================================================

export interface AnalysisData {
  // Repository-specific data
  repository?: RepositoryAnalysisData
  // Website-specific data
  website?: WebsiteAnalysisData
  // Business type analysis
  businessType?: BusinessTypeAnalysisData
}

export interface RepositoryAnalysisData {
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
  repositorySizeMB: number
  readmeContent?: string
  contributingContent?: string
  agentsContent?: string
  workflowFiles: string[]
  testFiles: string[]
  // File size analysis
  fileSizeAnalysis?: FileSizeAnalysisData
}

export interface WebsiteAnalysisData {
  url: string
  pageTitle?: string
  metaDescription?: string
  hasStructuredData: boolean
  hasOpenGraph: boolean
  hasTwitterCards: boolean
  hasSitemap: boolean
  hasRobotsTxt: boolean
  hasFavicon: boolean
  hasManifest: boolean
  hasServiceWorker: boolean
  contentLength: number
  technologies: string[]
  contactInfo: string[]
  socialMediaLinks: SocialMediaLink[]
  locations: string[]
  // Agent readiness specific
  agentReadinessFeatures: AgentReadinessFeatures
}

export interface BusinessTypeAnalysisData {
  businessType: string
  businessTypeConfidence: number
  overallScore: number
  industrySpecificInsights: string[]
  recommendations: string[]
}

export interface FileSizeAnalysisData {
  totalSizeMB: number
  largeFiles: LargeFile[]
  criticalFiles: CriticalFile[]
  agentCompatibility: AgentCompatibility
  recommendations: string[]
}

export interface LargeFile {
  path: string
  sizeMB: number
  type: 'binary' | 'text' | 'image' | 'video' | 'other'
  agentImpact: 'blocking' | 'warning' | 'info'
}

export interface CriticalFile {
  path: string
  sizeMB: number
  agentLimit: number
  status: 'compliant' | 'warning' | 'exceeded'
}

export interface AgentCompatibility {
  cursor: CompatibilityStatus
  githubCopilot: CompatibilityStatus
  claudeWeb: CompatibilityStatus
  claudeAPI: CompatibilityStatus
  chatgpt: CompatibilityStatus
  overall: CompatibilityStatus
}

export interface CompatibilityStatus {
  status: 'compliant' | 'warning' | 'blocked'
  score: number
  issues: string[]
}

export interface SocialMediaLink {
  platform: string
  url: string
}

export interface AgentReadinessFeatures {
  informationGathering: FeatureScore
  directBooking: FeatureScore
  faqSupport: FeatureScore
  taskManagement: FeatureScore
  personalization: FeatureScore
}

export interface FeatureScore {
  score: number
  maxScore: number
  details: string[]
  missing: string[]
}

// ============================================================================
// AI Assessment
// ============================================================================

export interface AIAssessment {
  enabled: boolean
  instructionClarity: boolean
  workflowAutomation: boolean
  contextEfficiency: boolean
  riskCompliance: boolean
  overallSuccess: boolean
  reason?: string
  detailedAnalysis?: DetailedAIAnalysis
}

export interface DetailedAIAnalysis {
  instructionClarity: InstructionClarityAnalysis
  workflowAutomation: WorkflowAutomationAnalysis
  contextEfficiency: ContextEfficiencyAnalysis
  riskCompliance: RiskComplianceAnalysis
  integrationStructure: IntegrationStructureAnalysis
  fileSizeOptimization: FileSizeOptimizationAnalysis
}

export interface InstructionClarityAnalysis {
  stepByStepQuality: number
  commandClarity: number
  environmentSetup: number
  errorHandling: number
  dependencySpecification: number
  findings: string[]
  recommendations: string[]
  confidence: number
}

export interface WorkflowAutomationAnalysis {
  ciCdQuality: number
  testAutomation: number
  buildScripts: number
  deploymentAutomation: number
  monitoringLogging: number
  findings: string[]
  recommendations: string[]
  confidence: number
}

export interface ContextEfficiencyAnalysis {
  informationCohesion: number
  terminologyConsistency: number
  crossReferenceQuality: number
  chunkingOptimization: number
  findings: string[]
  recommendations: string[]
  confidence: number
}

export interface RiskComplianceAnalysis {
  securityPractices: number
  complianceAlignment: number
  safetyGuidelines: number
  governanceDocumentation: number
  findings: string[]
  recommendations: string[]
  confidence: number
}

export interface IntegrationStructureAnalysis {
  codeOrganization: number
  modularity: number
  apiDesign: number
  dependencies: number
  findings: string[]
  recommendations: string[]
  confidence: number
}

export interface FileSizeOptimizationAnalysis {
  criticalFileCompliance: number
  largeFileManagement: number
  contextWindowOptimization: number
  agentCompatibility: number
  findings: string[]
  recommendations: string[]
  confidence: number
}

// ============================================================================
// Insights and Recommendations
// ============================================================================

export interface Finding {
  id: string
  category: string
  severity: 'high' | 'medium' | 'low'
  title: string
  description: string
  evidence: string[]
  impact: string
  confidence: number
}

export interface Recommendation {
  id: string
  category: string
  priority: 'high' | 'medium' | 'low'
  title: string
  description: string
  implementation: string[]
  impact: string
  effort: 'low' | 'medium' | 'high'
  timeline: string
}

// ============================================================================
// Metadata
// ============================================================================

export interface AssessmentMetadata {
  version: string
  analysisTime: number
  staticAnalysisTime: number
  aiAnalysisTime?: number
  totalAnalysisTime: number
  retryCount: number
  fallbackUsed: boolean
  errors: AssessmentError[]
  warnings: AssessmentWarning[]
  duration?: number
}

export interface AssessmentError {
  code: string
  message: string
  category: string
  timestamp: Date
  recoverable: boolean
}

export interface AssessmentWarning {
  code: string
  message: string
  category: string
  timestamp: Date
  impact: 'low' | 'medium' | 'high'
}

// ============================================================================
// Plugin Architecture Types
// ============================================================================

export interface Analyzer {
  type: AnalysisType
  name: string
  version: string
  analyze(input: AssessmentInput): Promise<AnalysisResult>
  validate(result: AnalysisResult): ValidationResult
}

export interface AIAssessor {
  type: AnalysisType
  name: string
  version: string
  assess(analysis: AnalysisResult): Promise<AIAssessment>
  generateInsights(assessment: AIAssessment): Insights
}

export interface AnalysisResult {
  type: AnalysisType
  data: AnalysisData
  metadata: {
    analyzer: string
    version: string
    timestamp: Date
    duration: number
  }
}

export interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
  score: number
}

export interface Insights {
  findings: Finding[]
  recommendations: Recommendation[]
  summary: string
  confidence: number
}

// ============================================================================
// Configuration Types
// ============================================================================

export interface UnifiedAssessmentConfig {
  enableAIAssessment: boolean
  enableValidation: boolean
  requireAlignment: boolean
  maxRetries: number
  fallbackToStatic: boolean
  timeout: number
  includeDetailedAnalysis: boolean
  metricsConfig: MetricsConfig
}

export interface MetricsConfig {
  scoringScale: number
  categoryWeights: Record<string, number>
  confidenceThresholds: {
    high: number
    medium: number
    low: number
  }
  validationRules: ValidationRule[]
}

export interface ValidationRule {
  name: string
  condition: (data: any) => boolean
  message: string
  severity: 'error' | 'warning'
}

// ============================================================================
// Legacy Compatibility Types
// ============================================================================

export interface LegacyAssessmentResult {
  readinessScore: number
  aiAnalysisStatus?: {
    enabled: boolean
    instructionClarity: boolean
    workflowAutomation: boolean
    contextEfficiency: boolean
    riskCompliance: boolean
    overallSuccess: boolean
    reason?: string
  }
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
  detailedAnalysis?: any
  confidence?: any
  staticAnalysis: any
  websiteAnalysis?: any
  businessTypeAnalysis?: any
}