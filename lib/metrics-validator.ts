/**
 * Metrics Validator
 * 
 * Validates consistency between static checks and AI analytics.
 * Ensures metrics alignment and provides recommendations for improvement.
 */

import { UnifiedMetricsConfig, UnifiedMetric } from './unified-metrics-engine';

export interface MetricsValidatorConfig extends UnifiedMetricsConfig {
  maxVariance: number;
  minConfidence: number;
  criticalVariance: number;
  lowConfidenceThreshold: number;
}

export interface ValidationResult {
  isValid: boolean;
  passed: boolean; // Alias for isValid for backward compatibility
  overallScore: number;
  issues: ValidationIssue[];
  recommendations: string[];
  alignmentScore: number; // 0-100, how well aligned the metrics are
}

export interface ValidationIssue {
  type: 'variance' | 'confidence' | 'missing_data' | 'inconsistency';
  category: string;
  metric: string; // Alias for category for backward compatibility
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  staticValue?: number;
  aiValue?: number;
  expectedValue?: number;
  variance?: number;
}

export interface MetricsAlignmentReport {
  overallAlignment: number;
  categoryAlignments: { [category: string]: number };
  criticalIssues: ValidationIssue[];
  improvementSuggestions: string[];
  confidenceLevel: 'low' | 'medium' | 'high';
}

export class MetricsValidator {
  private config: MetricsValidatorConfig;

  constructor(config: Partial<MetricsValidatorConfig> = {}) {
    this.config = { ...DEFAULT_VALIDATOR_CONFIG, ...config };
  }

  /**
   * Validate a single metric
   */
  validateMetric(
    metricName: string,
    staticValue: number,
    aiValue: number,
    aiConfidence: number
  ): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const variance = Math.abs(staticValue - aiValue);
    
    // Check variance
    if (variance >= this.config.maxScoreVariance) {
      issues.push({
        type: 'variance',
        category: metricName,
        metric: metricName,
        severity: variance >= 20 ? 'critical' : variance >= 15 ? 'high' : 'medium',
        message: `High variance between static (${staticValue}) and AI (${aiValue}) scores`,
        staticValue,
        aiValue,
        variance
      });
    }
    
    // Check confidence
    if (aiConfidence < this.config.minConfidenceThreshold) {
      issues.push({
        type: 'confidence',
        category: metricName,
        metric: metricName,
        severity: aiConfidence < 30 ? 'high' : 'medium',
        message: `Low AI confidence (${aiConfidence}%) for ${metricName}`,
        aiValue,
        expectedValue: this.config.minConfidenceThreshold
      });
    }
    
    return issues;
  }

  /**
   * Validate overall assessment
   */
  validateOverallAssessment(
    overallScore: UnifiedMetric,
    categories: { [key: string]: any }
  ): ValidationResult {
    const issues: ValidationIssue[] = [];
    
    // Check overall confidence
    if (overallScore.confidence < this.config.minConfidenceThreshold) {
      issues.push({
        type: 'confidence',
        category: 'overall',
        metric: 'overall',
        severity: 'high',
        message: `Low overall confidence (${overallScore.confidence}%)`,
        expectedValue: this.config.minConfidenceThreshold
      });
    }
    
    // Validate category scores
    const categoryIssues = this.validateCategoryScores(categories);
    issues.push(...categoryIssues);
    
    const alignmentScore = this.calculateAlignmentScore(issues);
    
    return {
      isValid: issues.length === 0,
      passed: issues.length === 0,
      overallScore: overallScore.value,
      issues,
      recommendations: this.generateRecommendations(issues),
      alignmentScore
    };
  }

  /**
   * Validate category scores
   */
  validateCategoryScores(categories: { [key: string]: any }): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    
    Object.entries(categories).forEach(([categoryName, category]) => {
      if (category.score) {
        const score = category.score;
        
        // Check confidence
        if (score.confidence < this.config.minConfidenceThreshold) {
          issues.push({
            type: 'confidence',
            category: categoryName,
            metric: categoryName,
            severity: score.confidence < 40 ? 'high' : 'medium',
            message: `Low confidence (${score.confidence}%) for ${categoryName}`,
            expectedValue: this.config.minConfidenceThreshold
          });
        }
        
        // Check variance if available
        if (score.variance && score.variance > this.config.maxScoreVariance) {
          issues.push({
            type: 'variance',
            category: categoryName,
            metric: categoryName,
            severity: score.variance > 20 ? 'critical' : 'high',
            message: `High variance (${score.variance}) for ${categoryName}`,
            variance: score.variance
          });
        }
      }
    });
    
    return issues;
  }

  /**
   * Validate sub-metrics
   */
  validateSubMetrics(
    categoryName: string,
    subMetrics: { [key: string]: UnifiedMetric }
  ): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    
    Object.entries(subMetrics).forEach(([metricName, metric]) => {
      if (metric.confidence < this.config.minConfidenceThreshold) {
        issues.push({
          type: 'confidence',
          category: `${categoryName}.${metricName}`,
          metric: `${categoryName}.${metricName}`,
          severity: metric.confidence < 40 ? 'high' : 'medium',
          message: `Low confidence (${metric.confidence}%) for ${metricName}`,
          expectedValue: this.config.minConfidenceThreshold
        });
      }
    });
    
    return issues;
  }

  /**
   * Calculate alignment score
   */
  private calculateAlignmentScore(issues: ValidationIssue[]): number {
    if (issues.length === 0) return 100;
    
    const criticalIssues = issues.filter(i => i.severity === 'critical').length;
    const highIssues = issues.filter(i => i.severity === 'high').length;
    const mediumIssues = issues.filter(i => i.severity === 'medium').length;
    const lowIssues = issues.filter(i => i.severity === 'low').length;
    
    const penalty = (criticalIssues * 25) + (highIssues * 15) + (mediumIssues * 8) + (lowIssues * 3);
    return Math.max(0, 100 - penalty);
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(issues: ValidationIssue[]): string[] {
    const recommendations: string[] = [];
    
    if (issues.some(i => i.type === 'variance')) {
      recommendations.push('Review and align static and AI analysis methods');
    }
    
    if (issues.some(i => i.type === 'confidence')) {
      recommendations.push('Improve data quality and analysis methods for better confidence');
    }
    
    return recommendations;
  }

  /**
   * Validate metrics consistency between static and AI analysis
   */
  validateMetrics(
    staticScores: { [key: string]: number },
    aiScores: { [key: string]: number },
    staticConfidence: { [key: string]: number } = {},
    aiConfidence: { [key: string]: number } = {}
  ): ValidationResult {
    const issues: ValidationIssue[] = [];
    const recommendations: string[] = [];
    let totalVariance = 0;
    let validCategories = 0;

    // Check each category for consistency
    Object.keys(this.config.categoryWeights).forEach(category => {
      const staticScore = staticScores[category] || 0;
      const aiScore = aiScores[category] || 0;
      const variance = Math.abs(staticScore - aiScore);
      
      totalVariance += variance;
      validCategories++;

      // Check for high variance
      if (variance > this.config.maxScoreVariance) {
        const severity = this.determineSeverity(variance, this.config.maxScoreVariance);
        issues.push({
          type: 'variance',
          category,
          metric: category,
          severity,
          message: `High variance detected: static=${staticScore}, ai=${aiScore}, variance=${variance}`,
          staticValue: staticScore,
          aiValue: aiScore,
          variance
        });

        recommendations.push(this.generateVarianceRecommendation(category, staticScore, aiScore, variance));
      }

      // Check for missing data
      if (staticScore === 0 && aiScore === 0) {
        issues.push({
          type: 'missing_data',
          category,
          metric: category,
          severity: 'medium',
          message: `No data available for ${category} in both static and AI analysis`
        });
        recommendations.push(`Investigate why ${category} has no measurable data`);
      }

      // Check confidence levels
      const staticConf = staticConfidence[category] || 80;
      const aiConf = aiConfidence[category] || 70;
      
      if (staticConf < this.config.minConfidenceThreshold) {
        issues.push({
          type: 'confidence',
          category,
          metric: category,
          severity: 'medium',
          message: `Low static analysis confidence: ${staticConf}%`
        });
      }

      if (aiConf < this.config.minConfidenceThreshold) {
        issues.push({
          type: 'confidence',
          category,
          metric: category,
          severity: 'medium',
          message: `Low AI analysis confidence: ${aiConf}%`
        });
        recommendations.push(`Improve AI analysis quality for ${category} by providing more context`);
      }
    });

    // Calculate alignment score
    const averageVariance = validCategories > 0 ? totalVariance / validCategories : 0;
    const alignmentScore = Math.max(0, 100 - (averageVariance * 2)); // Scale variance to 0-100

    // Determine overall validity
    const criticalIssues = issues.filter(issue => issue.severity === 'critical');
    const highIssues = issues.filter(issue => issue.severity === 'high');
    const isValid = criticalIssues.length === 0 && highIssues.length <= 2;

    // Generate general recommendations
    if (alignmentScore < 70) {
      recommendations.push('Consider reviewing scoring algorithms for better alignment');
      recommendations.push('Increase data quality or adjust weighting factors');
    }

    if (issues.length > 5) {
      recommendations.push('High number of validation issues detected - consider system-wide review');
    }

    return {
      isValid,
      passed: isValid,
      overallScore: alignmentScore,
      issues,
      recommendations,
      alignmentScore
    };
  }

  /**
   * Generate alignment report
   */
  generateAlignmentReport(
    staticScores: { [key: string]: number },
    aiScores: { [key: string]: number },
    staticConfidence: { [key: string]: number } = {},
    aiConfidence: { [key: string]: number } = {}
  ): MetricsAlignmentReport {
    const categoryAlignments: { [category: string]: number } = {};
    const criticalIssues: ValidationIssue[] = [];
    const improvementSuggestions: string[] = [];

    // Calculate per-category alignment
    Object.keys(this.config.categoryWeights).forEach(category => {
      const staticScore = staticScores[category] || 0;
      const aiScore = aiScores[category] || 0;
      const variance = Math.abs(staticScore - aiScore);
      
      // Calculate alignment score for this category (0-100)
      const categoryAlignment = Math.max(0, 100 - (variance * 5)); // Scale variance to 0-100
      categoryAlignments[category] = categoryAlignment;

      // Identify critical issues
      if (variance > this.config.maxScoreVariance * 2) {
        criticalIssues.push({
          type: 'variance',
          category,
          metric: category,
          severity: 'critical',
          message: `Critical variance in ${category}: ${variance} points difference`,
          staticValue: staticScore,
          aiValue: aiScore,
          variance
        });
      }

      // Generate improvement suggestions
      if (categoryAlignment < 60) {
        improvementSuggestions.push(`Focus on aligning ${category} scoring between static and AI analysis`);
      }
    });

    // Calculate overall alignment
    const overallAlignment = Object.values(categoryAlignments).reduce((sum, score) => sum + score, 0) / Object.keys(categoryAlignments).length;

    // Determine confidence level
    const avgConfidence = [
      ...Object.values(staticConfidence),
      ...Object.values(aiConfidence)
    ].reduce((sum, conf) => sum + conf, 0) / (Object.keys(staticConfidence).length + Object.keys(aiConfidence).length);

    let confidenceLevel: 'low' | 'medium' | 'high' = 'low';
    if (avgConfidence >= 80) confidenceLevel = 'high';
    else if (avgConfidence >= 60) confidenceLevel = 'medium';

    return {
      overallAlignment: Math.round(overallAlignment),
      categoryAlignments,
      criticalIssues,
      improvementSuggestions,
      confidenceLevel
    };
  }

  /**
   * Validate specific metric consistency
   */
  validateMetricConsistency(
    staticValue: number,
    aiValue: number,
    category: string,
    expectedRange?: { min: number; max: number }
  ): {
    isConsistent: boolean;
    variance: number;
    severity: 'low' | 'medium' | 'high' | 'critical';
    recommendation: string;
  } {
    const variance = Math.abs(staticValue - aiValue);
    const severity = this.determineSeverity(variance, this.config.maxScoreVariance);
    
    let isConsistent = variance <= this.config.maxScoreVariance;
    
    // Check against expected range if provided
    if (expectedRange) {
      const staticInRange = staticValue >= expectedRange.min && staticValue <= expectedRange.max;
      const aiInRange = aiValue >= expectedRange.min && aiValue <= expectedRange.max;
      
      if (!staticInRange || !aiInRange) {
        isConsistent = false;
      }
    }

    const recommendation = this.generateVarianceRecommendation(category, staticValue, aiValue, variance);

    return {
      isConsistent,
      variance,
      severity,
      recommendation
    };
  }

  /**
   * Determine severity based on variance
   */
  private determineSeverity(variance: number, threshold: number): 'low' | 'medium' | 'high' | 'critical' {
    if (variance <= threshold * 0.5) return 'low';
    if (variance <= threshold) return 'medium';
    if (variance <= threshold * 1.5) return 'high';
    return 'critical';
  }

  /**
   * Generate recommendation for variance issues
   */
  private generateVarianceRecommendation(
    category: string,
    staticValue: number,
    aiValue: number,
    variance: number
  ): string {
    if (variance <= this.config.maxScoreVariance) {
      return `${category} metrics are well aligned`;
    }

    const higherValue = staticValue > aiValue ? 'static' : 'AI';
    const lowerValue = staticValue > aiValue ? 'AI' : 'static';
    
    if (variance > this.config.maxScoreVariance * 2) {
      return `Critical variance in ${category}: ${higherValue} analysis (${Math.max(staticValue, aiValue)}) significantly higher than ${lowerValue} (${Math.min(staticValue, aiValue)}). Review scoring algorithms.`;
    }

    return `Moderate variance in ${category}: ${higherValue} analysis shows higher score. Consider adjusting weighting or improving data quality.`;
  }

  /**
   * Validate file size analysis consistency
   */
  validateFileSizeConsistency(
    staticFileAnalysis: any,
    aiFileAnalysis: any
  ): ValidationResult {
    const issues: ValidationIssue[] = [];
    const recommendations: string[] = [];

    if (!staticFileAnalysis || !aiFileAnalysis) {
      issues.push({
        type: 'missing_data',
        category: 'fileSizeOptimization',
        metric: 'fileSizeOptimization',
        severity: 'high',
        message: 'File size analysis data missing from static or AI analysis'
      });
      return {
        isValid: false,
        passed: false,
        overallScore: 0,
        issues,
        recommendations: ['Ensure file size analysis is performed in both static and AI analysis'],
        alignmentScore: 0
      };
    }

    // Compare agent compatibility scores
    const staticCompatibility = staticFileAnalysis.agentCompatibility?.overall || 0;
    const aiCompatibility = aiFileAnalysis.agentCompatibility?.overall || 0;
    const variance = Math.abs(staticCompatibility - aiCompatibility);

    if (variance > 20) { // 20% variance threshold for compatibility scores
      issues.push({
        type: 'variance',
        category: 'fileSizeOptimization',
        metric: 'fileSizeOptimization',
        severity: 'high',
        message: `High variance in agent compatibility: static=${staticCompatibility}%, ai=${aiCompatibility}%`,
        staticValue: staticCompatibility,
        aiValue: aiCompatibility,
        variance
      });
      recommendations.push('Review file size analysis algorithms for consistency');
    }

    // Compare large file counts
    const staticLargeFiles = staticFileAnalysis.largeFiles?.length || 0;
    const aiLargeFiles = aiFileAnalysis.largeFiles?.length || 0;
    
    if (Math.abs(staticLargeFiles - aiLargeFiles) > 2) {
      issues.push({
        type: 'inconsistency',
        category: 'fileSizeOptimization',
        metric: 'fileSizeOptimization',
        severity: 'medium',
        message: `Inconsistent large file detection: static=${staticLargeFiles}, ai=${aiLargeFiles}`
      });
      recommendations.push('Ensure consistent file size thresholds across analysis methods');
    }

    const alignmentScore = variance <= 20 ? 100 - variance : Math.max(0, 100 - (variance * 2));

    return {
      isValid: issues.length === 0,
      passed: issues.length === 0,
      overallScore: alignmentScore,
      issues,
      recommendations,
      alignmentScore
    };
  }

  /**
   * Generate comprehensive validation report
   */
  generateValidationReport(
    staticAnalysis: any,
    aiAnalysis: any,
    fileSizeAnalysis?: any
  ): {
    overall: ValidationResult;
    fileSize: ValidationResult;
    alignment: MetricsAlignmentReport;
    summary: {
      totalIssues: number;
      criticalIssues: number;
      recommendations: string[];
      overallHealth: 'excellent' | 'good' | 'fair' | 'poor';
    };
  } {
    // Convert to score format
    const staticScores = this.convertToScores(staticAnalysis);
    const aiScores = this.convertToScores(aiAnalysis);

    // Validate overall metrics
    const overallValidation = this.validateMetrics(staticScores, aiScores);
    
    // Validate file size analysis
    const fileSizeValidation = fileSizeAnalysis
      ? this.validateFileSizeConsistency(fileSizeAnalysis, fileSizeAnalysis) // Assuming same data for now
      : { isValid: true, passed: true, overallScore: 100, issues: [], recommendations: [], alignmentScore: 100 };

    // Generate alignment report
    const alignmentReport = this.generateAlignmentReport(staticScores, aiScores);

    // Calculate overall health
    const totalIssues = overallValidation.issues.length + fileSizeValidation.issues.length;
    const criticalIssues = overallValidation.issues.filter(i => i.severity === 'critical').length + 
                          fileSizeValidation.issues.filter(i => i.severity === 'critical').length;
    
    let overallHealth: 'excellent' | 'good' | 'fair' | 'poor' = 'excellent';
    if (criticalIssues > 0 || totalIssues > 10) overallHealth = 'poor';
    else if (totalIssues > 5) overallHealth = 'fair';
    else if (totalIssues > 2) overallHealth = 'good';

    const allRecommendations = [
      ...overallValidation.recommendations,
      ...fileSizeValidation.recommendations,
      ...alignmentReport.improvementSuggestions
    ];

    return {
      overall: overallValidation,
      fileSize: fileSizeValidation,
      alignment: alignmentReport,
      summary: {
        totalIssues,
        criticalIssues,
        recommendations: allRecommendations,
        overallHealth
      }
    };
  }

  /**
   * Convert analysis data to score format
   */
  private convertToScores(analysis: any): { [key: string]: number } {
    if (!analysis) return {};

    if (analysis.categories) {
      // AI analysis format
      return {
        documentation: analysis.categories.documentation || 0,
        instructionClarity: analysis.categories.instructionClarity || 0,
        workflowAutomation: analysis.categories.workflowAutomation || 0,
        riskCompliance: analysis.categories.riskCompliance || 0,
        integrationStructure: analysis.categories.integrationStructure || 0,
        fileSizeOptimization: analysis.categories.fileSizeOptimization || 0
      };
    }

    // Static analysis format - convert to scores
    return {
      documentation: (analysis.hasReadme ? 8 : 0) + (analysis.hasAgents ? 6 : 0) + (analysis.hasContributing ? 4 : 0) + (analysis.hasLicense ? 2 : 0),
      instructionClarity: (analysis.hasReadme ? 12 : 0) + (analysis.hasAgents ? 8 : 0),
      workflowAutomation: (analysis.hasWorkflows ? 15 : 0) + (analysis.hasTests ? 5 : 0),
      riskCompliance: (analysis.hasLicense ? 5 : 0) + (analysis.errorHandling ? 10 : 0) + (analysis.hasTests ? 5 : 0),
      integrationStructure: (analysis.hasWorkflows ? 8 : 0) + (analysis.hasTests ? 6 : 0) + (analysis.languages?.length > 0 ? 6 : 0),
      fileSizeOptimization: analysis.fileSizeAnalysis ? analysis.fileSizeAnalysis.agentCompatibility.overall / 5 : 10
    };
  }
}

// Default configuration
export const DEFAULT_VALIDATOR_CONFIG: MetricsValidatorConfig = {
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
  // Additional properties for validator
  maxVariance: 15,
  minConfidence: 60,
  criticalVariance: 20,
  lowConfidenceThreshold: 40,
};