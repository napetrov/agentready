/**
 * Unified Metrics Engine
 * 
 * Provides consistent metrics collection and scoring across static checks and AI analytics.
 * Ensures alignment between different assessment methods and maintains scoring consistency.
 */

export interface UnifiedMetricsConfig {
  // Scoring scales
  categoryScale: number; // 0-20 for categories
  overallScale: number;  // 0-100 for overall score
  confidenceScale: number; // 0-100 for confidence
  
  // Weights for different assessment types
  staticWeight: number;    // Weight for static analysis (0-1)
  aiWeight: number;        // Weight for AI analysis (0-1)
  
  // Category weights (must sum to 1.0)
  categoryWeights: {
    documentation: number;
    instructionClarity: number;
    workflowAutomation: number;
    riskCompliance: number;
    integrationStructure: number;
    fileSizeOptimization: number;
  };
  
  // Validation thresholds
  minConfidenceThreshold: number;
  maxScoreVariance: number; // Maximum allowed variance between static and AI scores
}

export interface UnifiedMetric {
  value: number;
  confidence: number;
  source: 'static' | 'ai' | 'hybrid';
  lastUpdated: Date;
  metadata: {
    staticValue?: number;
    aiValue?: number;
    variance?: number;
    isValidated: boolean;
  };
}

export interface UnifiedCategoryScore {
  score: UnifiedMetric;
  subMetrics: {
    [key: string]: UnifiedMetric;
  };
  findings: string[];
  recommendations: string[];
}

export interface UnifiedAssessmentResult {
  overallScore: UnifiedMetric;
  categories: {
    documentation: UnifiedCategoryScore;
    instructionClarity: UnifiedCategoryScore;
    workflowAutomation: UnifiedCategoryScore;
    riskCompliance: UnifiedCategoryScore;
    integrationStructure: UnifiedCategoryScore;
    fileSizeOptimization: UnifiedCategoryScore;
  };
  assessmentStatus: {
    staticAnalysisEnabled: boolean;
    aiAnalysisEnabled: boolean;
    hybridMode: boolean;
    validationPassed: boolean;
    lastValidation: Date;
  };
  metadata: {
    totalFiles: number;
    analysisDuration: number;
    version: string;
  };
}

export class UnifiedMetricsEngine {
  private config: UnifiedMetricsConfig;
  
  constructor(config?: Partial<UnifiedMetricsConfig>) {
    this.config = {
      categoryScale: 20,
      overallScale: 100,
      confidenceScale: 100,
      staticWeight: 0.3,
      aiWeight: 0.7,
      categoryWeights: {
        documentation: 0.20,
        instructionClarity: 0.20,
        workflowAutomation: 0.20,
        riskCompliance: 0.20,
        integrationStructure: 0.10,
        fileSizeOptimization: 0.10,
      },
      minConfidenceThreshold: 60,
      maxScoreVariance: 15,
      ...config
    };
  }

  /**
   * Create a unified metric from static and AI values
   */
  createUnifiedMetric(
    staticValue: number,
    aiValue: number,
    staticConfidence: number = 80,
    aiConfidence: number = 70
  ): UnifiedMetric {
    const variance = Math.abs(staticValue - aiValue);
    const isValidated = variance <= this.config.maxScoreVariance;
    
    // Calculate weighted average
    const weightedValue = (staticValue * this.config.staticWeight) + (aiValue * this.config.aiWeight);
    const weightedConfidence = (staticConfidence * this.config.staticWeight) + (aiConfidence * this.config.aiWeight);
    
    return {
      value: Math.round(weightedValue),
      confidence: Math.round(weightedConfidence),
      source: 'hybrid',
      lastUpdated: new Date(),
      metadata: {
        staticValue,
        aiValue,
        variance,
        isValidated
      }
    };
  }

  /**
   * Normalize score to category scale (0-20)
   */
  normalizeToCategoryScale(value: number, maxValue: number = 100): number {
    return Math.min(this.config.categoryScale, Math.max(0, (value / maxValue) * this.config.categoryScale));
  }

  /**
   * Normalize score to overall scale (0-100)
   */
  normalizeToOverallScale(value: number, maxValue: number = 20): number {
    return Math.min(this.config.overallScale, Math.max(0, (value / maxValue) * this.config.overallScale));
  }

  /**
   * Calculate overall score from category scores
   */
  calculateOverallScore(categoryScores: { [key: string]: UnifiedMetric }): UnifiedMetric {
    const weightedSum = Object.entries(this.config.categoryWeights).reduce((sum, [category, weight]) => {
      const categoryScore = categoryScores[category];
      return sum + (categoryScore.value * weight);
    }, 0);

    const averageConfidence = Object.values(categoryScores).reduce((sum, metric) => 
      sum + metric.confidence, 0) / Object.keys(categoryScores).length;

    return {
      value: Math.round(weightedSum),
      confidence: Math.round(averageConfidence),
      source: 'hybrid',
      lastUpdated: new Date(),
      metadata: {
        isValidated: true
      }
    };
  }

  /**
   * Validate consistency between static and AI metrics
   */
  validateMetricsConsistency(staticScores: { [key: string]: number }, aiScores: { [key: string]: number }): {
    isValid: boolean;
    variances: { [key: string]: number };
    recommendations: string[];
  } {
    const variances: { [key: string]: number } = {};
    const recommendations: string[] = [];
    let isValid = true;

    for (const category of Object.keys(this.config.categoryWeights)) {
      const staticScore = staticScores[category] || 0;
      const aiScore = aiScores[category] || 0;
      const variance = Math.abs(staticScore - aiScore);
      
      variances[category] = variance;
      
      if (variance > this.config.maxScoreVariance) {
        isValid = false;
        recommendations.push(
          `High variance detected in ${category}: static=${staticScore}, ai=${aiScore}, variance=${variance}`
        );
      }
    }

    if (!isValid) {
      recommendations.push('Consider reviewing scoring algorithms for better alignment');
      recommendations.push('Increase confidence thresholds or adjust weighting factors');
    }

    return { isValid, variances, recommendations };
  }

  /**
   * Generate standardized findings and recommendations
   */
  generateStandardizedInsights(
    categoryScores: { [key: string]: UnifiedCategoryScore },
    staticAnalysis: any,
    aiAnalysis: any
  ): { findings: string[]; recommendations: string[] } {
    const findings: string[] = [];
    const recommendations: string[] = [];

    // Generate findings based on scores
    Object.entries(categoryScores).forEach(([category, score]) => {
      if (score.score.value < 10) {
        findings.push(`${category} score is low (${score.score.value}/20) - needs improvement`);
        recommendations.push(`Focus on improving ${category} through targeted enhancements`);
      } else if (score.score.value >= 16) {
        findings.push(`${category} score is excellent (${score.score.value}/20) - well optimized`);
      }
    });

    // Add specific findings based on static analysis
    if (staticAnalysis) {
      if (!staticAnalysis.hasReadme) {
        findings.push('Missing README.md file');
        recommendations.push('Create comprehensive README.md with setup instructions');
      }
      if (!staticAnalysis.hasAgents) {
        findings.push('Missing AGENTS.md file');
        recommendations.push('Add AGENTS.md with AI agent specific instructions');
      }
    }

    // Add AI-specific insights
    if (aiAnalysis && aiAnalysis.confidence) {
      const lowConfidenceCategories = Object.entries(aiAnalysis.confidence)
        .filter(([_, confidence]) => (confidence as number) < this.config.minConfidenceThreshold)
        .map(([category, _]) => category);
      
      if (lowConfidenceCategories.length > 0) {
        findings.push(`Low AI confidence in: ${lowConfidenceCategories.join(', ')}`);
        recommendations.push('Consider providing more context or improving documentation for better AI analysis');
      }
    }

    return { findings, recommendations };
  }

  /**
   * Create unified assessment result
   */
  createUnifiedAssessment(
    staticAnalysis: any,
    aiAnalysis: any,
    fileSizeAnalysis?: any
  ): UnifiedAssessmentResult {
    // Convert static analysis to normalized scores
    const staticScores = this.convertStaticAnalysisToScores(staticAnalysis);
    
    // Convert AI analysis to normalized scores
    const aiScores = this.convertAIAnalysisToScores(aiAnalysis);
    
    // Validate consistency
    const validation = this.validateMetricsConsistency(staticScores, aiScores);
    
    // Create unified category scores
    const categoryScores: { [key: string]: UnifiedCategoryScore } = {};
    
    Object.keys(this.config.categoryWeights).forEach(category => {
      const staticScore = staticScores[category] || 0;
      const aiScore = aiScores[category] || 0;
      const staticConfidence = 80; // Static analysis confidence
      const aiConfidence = aiAnalysis?.confidence?.[category] || 70;
      
      const unifiedScore = this.createUnifiedMetric(staticScore, aiScore, staticConfidence, aiConfidence);
      
      categoryScores[category] = {
        score: unifiedScore,
        subMetrics: this.createSubMetrics(category, staticAnalysis, aiAnalysis),
        findings: [],
        recommendations: []
      };
    });

    // Calculate overall score
    const overallScore = this.calculateOverallScore(categoryScores);
    
    // Generate insights
    const insights = this.generateStandardizedInsights(categoryScores, staticAnalysis, aiAnalysis);

    return {
      overallScore,
      categories: categoryScores as any,
      assessmentStatus: {
        staticAnalysisEnabled: true,
        aiAnalysisEnabled: !!aiAnalysis,
        hybridMode: true,
        validationPassed: validation.isValid,
        lastValidation: new Date()
      },
      metadata: {
        totalFiles: staticAnalysis?.fileCount || 0,
        analysisDuration: 0, // Will be set by caller
        version: '1.0.0'
      }
    };
  }

  /**
   * Convert static analysis to normalized scores
   */
  private convertStaticAnalysisToScores(staticAnalysis: any): { [key: string]: number } {
    return {
      documentation: this.normalizeToCategoryScale(
        (staticAnalysis.hasReadme ? 8 : 0) +
        (staticAnalysis.hasAgents ? 6 : 0) +
        (staticAnalysis.hasContributing ? 4 : 0) +
        (staticAnalysis.hasLicense ? 2 : 0)
      ),
      instructionClarity: this.normalizeToCategoryScale(
        (staticAnalysis.hasReadme ? 12 : 0) +
        (staticAnalysis.hasAgents ? 8 : 0)
      ),
      workflowAutomation: this.normalizeToCategoryScale(
        (staticAnalysis.hasWorkflows ? 15 : 0) +
        (staticAnalysis.hasTests ? 5 : 0)
      ),
      riskCompliance: this.normalizeToCategoryScale(
        (staticAnalysis.hasLicense ? 5 : 0) +
        (staticAnalysis.errorHandling ? 10 : 0) +
        (staticAnalysis.hasTests ? 5 : 0)
      ),
      integrationStructure: this.normalizeToCategoryScale(
        (staticAnalysis.hasWorkflows ? 8 : 0) +
        (staticAnalysis.hasTests ? 6 : 0) +
        (staticAnalysis.languages?.length > 0 ? 6 : 0)
      ),
      fileSizeOptimization: staticAnalysis.fileSizeAnalysis 
        ? this.normalizeToCategoryScale(staticAnalysis.fileSizeAnalysis.agentCompatibility.overall / 5)
        : 10
    };
  }

  /**
   * Convert AI analysis to normalized scores
   */
  private convertAIAnalysisToScores(aiAnalysis: any): { [key: string]: number } {
    if (!aiAnalysis || !aiAnalysis.categories) {
      return Object.keys(this.config.categoryWeights).reduce((acc, key) => {
        acc[key] = 0;
        return acc;
      }, {} as { [key: string]: number });
    }

    return {
      documentation: this.normalizeToCategoryScale(aiAnalysis.categories.documentation || 0),
      instructionClarity: this.normalizeToCategoryScale(aiAnalysis.categories.instructionClarity || 0),
      workflowAutomation: this.normalizeToCategoryScale(aiAnalysis.categories.workflowAutomation || 0),
      riskCompliance: this.normalizeToCategoryScale(aiAnalysis.categories.riskCompliance || 0),
      integrationStructure: this.normalizeToCategoryScale(aiAnalysis.categories.integrationStructure || 0),
      fileSizeOptimization: this.normalizeToCategoryScale(aiAnalysis.categories.fileSizeOptimization || 0)
    };
  }

  /**
   * Create sub-metrics for detailed analysis
   */
  private createSubMetrics(category: string, staticAnalysis: any, aiAnalysis: any): { [key: string]: UnifiedMetric } {
    // This would be implemented based on specific sub-metrics for each category
    // For now, return empty object
    return {};
  }
}

// Default configuration
export const DEFAULT_METRICS_CONFIG: UnifiedMetricsConfig = {
  categoryScale: 20,
  overallScale: 100,
  confidenceScale: 100,
  staticWeight: 0.3,
  aiWeight: 0.7,
  categoryWeights: {
    documentation: 0.20,
    instructionClarity: 0.20,
    workflowAutomation: 0.20,
    riskCompliance: 0.20,
    integrationStructure: 0.10,
    fileSizeOptimization: 0.10,
  },
  minConfidenceThreshold: 60,
  maxScoreVariance: 15,
};