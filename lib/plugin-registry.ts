/**
 * Plugin Registry for AI Agent Readiness Assessment Tool
 * 
 * This module provides a centralized registry for managing analyzers and AI assessors
 * as plugins, enabling a flexible and extensible architecture.
 */

import { AnalysisType, AssessmentInput, AnalysisResult, AIAssessment, AIAssessor } from './unified-types'

/**
 * Plugin interface for analyzers
 */
export interface AnalyzerPlugin {
  readonly type: AnalysisType
  readonly name: string
  readonly version: string
  readonly description: string
  
  /**
   * Analyze the input and return structured results
   */
  analyze(input: AssessmentInput): Promise<AnalysisResult>
  
  /**
   * Validate the analysis result
   */
  validate(result: AnalysisResult): ValidationResult
  
  /**
   * Check if this analyzer can handle the given input
   */
  canHandle(input: AssessmentInput): boolean
}

/**
 * Plugin interface for AI assessors
 */
export interface AIAssessorPlugin {
  readonly type: AnalysisType
  readonly name: string
  readonly version: string
  readonly description: string
  
  /**
   * Perform AI assessment on the analysis result
   */
  assess(analysis: AnalysisResult): Promise<AIAssessment>
  
  /**
   * Generate insights from the AI assessment
   */
  generateInsights(assessment: AIAssessment): Insights
  
  /**
   * Check if this assessor can handle the given analysis
   */
  canHandle(analysis: AnalysisResult): boolean
}

/**
 * Validation result for analyzer output
 */
export interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
  score: number // 0-100 confidence in validation
}

/**
 * Insights generated from AI assessment
 */
export interface Insights {
  keyFindings: string[]
  recommendations: string[]
  confidence: number
  riskLevel: 'low' | 'medium' | 'high'
}

/**
 * Plugin metadata
 */
export interface PluginMetadata {
  name: string
  version: string
  description: string
  author?: string
  dependencies?: string[]
  config?: Record<string, any>
}

/**
 * Plugin registry configuration
 */
export interface PluginRegistryConfig {
  enableCaching: boolean
  cacheTimeout: number
  maxRetries: number
  retryDelay: number
  enableLogging: boolean
}

/**
 * Central plugin registry for managing analyzers and AI assessors
 */
export class PluginRegistry {
  private analyzers = new Map<string, AnalyzerPlugin>()
  private aiAssessors = new Map<string, AIAssessorPlugin>()
  private config: PluginRegistryConfig
  private cache = new Map<string, { result: any; timestamp: number }>()

  constructor(config: Partial<PluginRegistryConfig> = {}) {
    this.config = {
      enableCaching: true,
      cacheTimeout: 300000, // 5 minutes
      maxRetries: 3,
      retryDelay: 1000,
      enableLogging: true,
      ...config
    }
  }

  /**
   * Register an analyzer plugin
   */
  registerAnalyzer(plugin: AnalyzerPlugin): void {
    const key = `${plugin.type}:${plugin.name}`
    
    if (this.analyzers.has(key)) {
      throw new Error(`Analyzer ${key} is already registered`)
    }

    this.analyzers.set(key, plugin)
    
    if (this.config.enableLogging) {
      console.log(`📦 Registered analyzer: ${key} v${plugin.version}`)
    }
  }

  /**
   * Register an AI assessor plugin
   */
  registerAIAssessor(plugin: AIAssessorPlugin): void {
    const key = `${plugin.type}:${plugin.name}`
    
    if (this.aiAssessors.has(key)) {
      throw new Error(`AI Assessor ${key} is already registered`)
    }

    this.aiAssessors.set(key, plugin)
    
    if (this.config.enableLogging) {
      console.log(`🤖 Registered AI assessor: ${key} v${plugin.version}`)
    }
  }

  /**
   * Get analyzer for specific type
   */
  getAnalyzer(type: AnalysisType, name?: string): AnalyzerPlugin | null {
    if (name) {
      const key = `${type}:${name}`
      return this.analyzers.get(key) || null
    }

    // Return first analyzer of the type
    for (const [key, analyzer] of this.analyzers) {
      if (analyzer.type === type) {
        return analyzer
      }
    }

    return null
  }

  /**
   * Get AI assessor for specific type
   */
  getAIAssessor(type: AnalysisType, name?: string): AIAssessorPlugin | null {
    if (name) {
      const key = `${type}:${name}`
      return this.aiAssessors.get(key) || null
    }

    // Return first assessor of the type
    for (const [key, assessor] of this.aiAssessors) {
      if (assessor.type === type) {
        return assessor
      }
    }

    return null
  }

  /**
   * Get all analyzers of a specific type
   */
  getAnalyzers(type: AnalysisType): AnalyzerPlugin[] {
    return Array.from(this.analyzers.values()).filter(analyzer => analyzer.type === type)
  }

  /**
   * Get all AI assessors of a specific type
   */
  getAIAssessors(type: AnalysisType): AIAssessorPlugin[] {
    return Array.from(this.aiAssessors.values()).filter(assessor => assessor.type === type)
  }

  /**
   * Execute analysis using the appropriate analyzer
   */
  async executeAnalysis(input: AssessmentInput): Promise<AnalysisResult> {
    const analyzer = this.getAnalyzer(input.type)
    
    if (!analyzer) {
      throw new Error(`No analyzer found for type: ${input.type}`)
    }

    if (!analyzer.canHandle(input)) {
      throw new Error(`Analyzer ${analyzer.name} cannot handle input: ${JSON.stringify(input)}`)
    }

    // Check cache first
    if (this.config.enableCaching) {
      const cacheKey = this.generateCacheKey('analysis', input)
      const cached = this.cache.get(cacheKey)
      
      if (cached && Date.now() - cached.timestamp < this.config.cacheTimeout) {
        if (this.config.enableLogging) {
          console.log(`📋 Using cached analysis result for ${input.type}`)
        }
        return cached.result
      }
    }

    // Execute analysis with retry logic
    let lastError: Error | null = null
    
    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      try {
        const result = await analyzer.analyze(input)
        
        // Validate result
        const validation = analyzer.validate(result)
        if (!validation.isValid) {
          throw new Error(`Analysis validation failed: ${validation.errors.join(', ')}`)
        }

        // Cache result
        if (this.config.enableCaching) {
          const cacheKey = this.generateCacheKey('analysis', input)
          this.cache.set(cacheKey, { result, timestamp: Date.now() })
        }

        return result
      } catch (error) {
        lastError = error as Error
        
        if (this.config.enableLogging) {
          console.warn(`⚠️ Analysis attempt ${attempt + 1} failed:`, error)
        }
        
        if (attempt < this.config.maxRetries - 1) {
          await this.delay(this.config.retryDelay * (attempt + 1))
        }
      }
    }

    throw new Error(`Analysis failed after ${this.config.maxRetries} attempts: ${lastError?.message}`)
  }

  /**
   * Execute AI assessment using the appropriate assessor
   */
  async executeAIAssessment(analysis: AnalysisResult): Promise<AIAssessment> {
    const assessor = this.getAIAssessor(analysis.type)
    
    if (!assessor) {
      throw new Error(`No AI assessor found for type: ${analysis.type}`)
    }

    if (!assessor.canHandle(analysis)) {
      throw new Error(`AI Assessor ${assessor.name} cannot handle analysis: ${JSON.stringify(analysis)}`)
    }

    // Check cache first
    if (this.config.enableCaching) {
      const cacheKey = this.generateCacheKey('ai-assessment', analysis)
      const cached = this.cache.get(cacheKey)
      
      if (cached && Date.now() - cached.timestamp < this.config.cacheTimeout) {
        if (this.config.enableLogging) {
          console.log(`🤖 Using cached AI assessment result for ${analysis.type}`)
        }
        return cached.result
      }
    }

    // Execute AI assessment with retry logic
    let lastError: Error | null = null
    
    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      try {
        const assessment = await assessor.assess(analysis)
        
        // Cache result
        if (this.config.enableCaching) {
          const cacheKey = this.generateCacheKey('ai-assessment', analysis)
          this.cache.set(cacheKey, { result: assessment, timestamp: Date.now() })
        }

        return assessment
      } catch (error) {
        lastError = error as Error
        
        if (this.config.enableLogging) {
          console.warn(`⚠️ AI assessment attempt ${attempt + 1} failed:`, error)
        }
        
        if (attempt < this.config.maxRetries - 1) {
          await this.delay(this.config.retryDelay * (attempt + 1))
        }
      }
    }

    throw new Error(`AI assessment failed after ${this.config.maxRetries} attempts: ${lastError?.message}`)
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear()
    
    if (this.config.enableLogging) {
      console.log('🗑️ Plugin registry cache cleared')
    }
  }

  /**
   * Get registry statistics
   */
  getStats(): {
    analyzers: number
    aiAssessors: number
    cacheSize: number
    config: PluginRegistryConfig
  } {
    return {
      analyzers: this.analyzers.size,
      aiAssessors: this.aiAssessors.size,
      cacheSize: this.cache.size,
      config: this.config
    }
  }

  /**
   * Generate cache key for input
   */
  private generateCacheKey(prefix: string, input: any): string {
    return `${prefix}:${JSON.stringify(input)}`
  }

  /**
   * Delay utility for retry logic
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

/**
 * Global plugin registry instance
 */
export const pluginRegistry = new PluginRegistry()

/**
 * Helper function to register all default plugins
 */
export function registerDefaultPlugins(): void {
  console.log('🔌 Registering default plugins...')
  
  try {
    // Register analyzer plugins
    const { RepositoryAnalyzerPlugin } = require('./plugins/repository-analyzer')
    const { WebsiteAnalyzerPlugin } = require('./plugins/website-analyzer')
    const { BusinessTypeAnalyzerPlugin } = require('./plugins/business-type-analyzer')
    
    // Register AI assessor plugins
    const { UnifiedAIAssessorPlugin } = require('./plugins/unified-ai-assessor')
    
    // Create plugin instances
    const repositoryAnalyzer = new RepositoryAnalyzerPlugin()
    const websiteAnalyzer = new WebsiteAnalyzerPlugin()
    const businessTypeAnalyzer = new BusinessTypeAnalyzerPlugin()
    const unifiedAIAssessor = new UnifiedAIAssessorPlugin()
    
    // Register analyzers
    pluginRegistry.registerAnalyzer(repositoryAnalyzer)
    pluginRegistry.registerAnalyzer(websiteAnalyzer)
    pluginRegistry.registerAnalyzer(businessTypeAnalyzer)
    
    // Register AI assessors for both repository and website types
    // Create separate instances for each type since the registry uses type as part of the key
    const repositoryAIAssessor = new UnifiedAIAssessorPlugin('repository')
    const websiteAIAssessor = new UnifiedAIAssessorPlugin('website')
    
    pluginRegistry.registerAIAssessor(repositoryAIAssessor)
    pluginRegistry.registerAIAssessor(websiteAIAssessor)
    
    console.log('✅ Default plugins registered successfully')
  } catch (error) {
    console.error('❌ Failed to register default plugins:', error)
    throw error
  }
}