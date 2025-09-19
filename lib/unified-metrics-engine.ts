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
  // Direct access properties for convenience
  staticValue?: number;
  aiValue?: number;
  variance?: number;
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
  validation: {
    isValid: boolean;
    variances: { [key: string]: number };
    recommendations: string[];
  };
  insights: {
    findings: string[];
    recommendations: string[];
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
    aiValue: number | undefined,
    staticConfidence: number = 80,
    aiConfidence: number = 70
  ): UnifiedMetric {
    const variance = aiValue !== undefined ? Math.abs(staticValue - aiValue) : 0;
    const isValidated = variance <= this.config.maxScoreVariance;
    
    // Calculate weighted average
    let weightedValue: number;
    let weightedConfidence: number;
    let source: 'static' | 'ai' | 'hybrid';
    
    if (aiValue !== undefined && aiValue !== null && !Number.isNaN(aiValue)) {
      // Both static and AI values available
      weightedValue = (staticValue * this.config.staticWeight) + (aiValue * this.config.aiWeight);
      weightedConfidence = (staticConfidence * this.config.staticWeight) + (aiConfidence * this.config.aiWeight);
      source = 'hybrid';
    } else {
      // Only static value available
      weightedValue = staticValue;
      weightedConfidence = staticConfidence;
      source = 'static';
    }
    
    return {
      value: Math.round(weightedValue),
      confidence: Math.round(weightedConfidence),
      source,
      lastUpdated: new Date(),
      metadata: {
        staticValue,
        aiValue,
        variance,
        isValidated
      },
      staticValue,
      aiValue,
      variance
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
  calculateOverallScore(categoryScores: { [key: string]: UnifiedCategoryScore }): UnifiedMetric {
    const weightedSum = Object.entries(this.config.categoryWeights).reduce((sum, [category, weight]) => {
      const categoryScore = categoryScores[category];
      return sum + (categoryScore.score.value * weight);
    }, 0);

    const averageConfidence = Object.values(categoryScores).reduce((sum, categoryScore) => 
      sum + categoryScore.score.confidence, 0) / Object.keys(categoryScores).length;

    const value100 = Math.round(this.normalizeToOverallScale(weightedSum, this.config.categoryScale));

    return {
      value: value100,
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
      
      if (variance >= this.config.maxScoreVariance) {
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
    Object.entries(categoryScores).forEach(([category, categoryScore]) => {
      if (categoryScore.score.value < 10) {
        findings.push(`${category} score is low (${categoryScore.score.value}/20) - needs improvement`);
        recommendations.push(`Focus on improving ${category} through targeted enhancements`);
      } else if (categoryScore.score.value >= 16) {
        findings.push(`${category} score is excellent (${categoryScore.score.value}/20) - well optimized`);
      }
    });

    // Add specific findings based on static analysis
    if (staticAnalysis) {
      const isWebsite = staticAnalysis.websiteUrl || staticAnalysis.pageTitle;
      
      if (isWebsite) {
        // Website-specific findings
        if (!staticAnalysis.hasStructuredData) {
          findings.push('Missing structured data markup');
          recommendations.push('Add JSON-LD structured data for better AI understanding');
        }
        if (!staticAnalysis.hasOpenGraph) {
          findings.push('No Open Graph meta tags found');
          recommendations.push('Implement Open Graph meta tags for social sharing');
        }
        if (!staticAnalysis.hasTwitterCards) {
          findings.push('No Twitter Cards meta tags');
          recommendations.push('Add Twitter Cards meta tags for better social media integration');
        }
        if (!staticAnalysis.contactInfo || staticAnalysis.contactInfo.length === 0) {
          findings.push('No contact information found');
          recommendations.push('Add clear contact information (phone, email, address)');
        }
        if (!staticAnalysis.mobileFriendly) {
          findings.push('Website not mobile-friendly');
          recommendations.push('Optimize website for mobile devices');
        }
        if ((staticAnalysis.accessibilityScore || 0) < 60) {
          findings.push('Accessibility issues detected');
          recommendations.push('Improve website accessibility for better usability');
        }
        if (!staticAnalysis.hasSitemap) {
          findings.push('No XML sitemap available');
          recommendations.push('Create and submit an XML sitemap for better indexing');
        }
        if (!staticAnalysis.hasRobotsTxt) {
          findings.push('No robots.txt file found');
          recommendations.push('Add robots.txt file for search engine directives');
        }
      } else {
        // Repository-specific findings
        if (!staticAnalysis.hasReadme) {
          findings.push('Missing README.md file');
          recommendations.push('Create comprehensive README.md with setup instructions');
        }
        if (!staticAnalysis.hasAgents) {
          findings.push('Missing AGENTS.md file');
          recommendations.push('Add AGENTS.md with AI agent specific instructions');
        }
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
        findings: this.generateCategoryFindings(category, unifiedScore, staticAnalysis, aiAnalysis),
        recommendations: this.generateCategoryRecommendations(category, unifiedScore, staticAnalysis, aiAnalysis)
      };
    });

    // Calculate overall score
    const overallScore = this.calculateOverallScore(categoryScores);
    
    // Generate insights
    const insights = this.generateStandardizedInsights(categoryScores, staticAnalysis, aiAnalysis);

    return {
      overallScore,
      categories: categoryScores as any,
      validation: {
        isValid: validation.isValid,
        variances: validation.variances,
        recommendations: validation.recommendations
      },
      insights: {
        findings: insights.findings,
        recommendations: insights.recommendations
      },
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
  convertStaticAnalysisToScores(staticAnalysis: any): { [key: string]: number } {
    // Check if this is a website analysis
    const isWebsite = staticAnalysis.websiteUrl || staticAnalysis.pageTitle;
    
    if (isWebsite) {
      // Website-specific scoring
      return {
        documentation: this.normalizeToCategoryScale(
          (staticAnalysis.hasStructuredData ? 8 : 0) +
          (staticAnalysis.hasOpenGraph ? 4 : 0) +
          (staticAnalysis.hasTwitterCards ? 3 : 0) +
          (staticAnalysis.hasSitemap ? 3 : 0) +
          (staticAnalysis.hasRobotsTxt ? 2 : 0)
        ),
        instructionClarity: this.normalizeToCategoryScale(
          (staticAnalysis.technologies?.length > 0 ? 8 : 0) +
          (staticAnalysis.contactInfo?.length > 0 ? 6 : 0) +
          (staticAnalysis.socialMediaLinks?.length > 0 ? 3 : 0) +
          (staticAnalysis.navigationStructure?.length > 0 ? 3 : 0)
        ),
        workflowAutomation: this.normalizeToCategoryScale(
          (staticAnalysis.mobileFriendly ? 8 : 0) +
          (staticAnalysis.pageLoadSpeed && staticAnalysis.pageLoadSpeed < 3000 ? 6 : 0) +
          (staticAnalysis.navigationStructure?.length > 0 ? 4 : 0) +
          (staticAnalysis.hasServiceWorker ? 2 : 0)
        ),
        riskCompliance: this.normalizeToCategoryScale(
          (staticAnalysis.securityHeaders?.length > 0 ? 8 : 0) +
          (staticAnalysis.contactInfo?.length > 0 ? 6 : 0) +
          ((staticAnalysis.accessibilityScore || 0) > 60 ? 4 : 0) +
          (staticAnalysis.hasManifest ? 2 : 0)
        ),
        integrationStructure: this.normalizeToCategoryScale(
          (staticAnalysis.technologies?.length > 0 ? 8 : 0) +
          (staticAnalysis.socialMediaLinks?.length > 0 ? 6 : 0) +
          (staticAnalysis.contactInfo?.length > 0 ? 4 : 0) +
          (staticAnalysis.hasServiceWorker ? 2 : 0)
        ),
        fileSizeOptimization: this.normalizeToCategoryScale(
          ((staticAnalysis.contentLength || 0) > 1000 ? 6 : 0) +
          ((staticAnalysis.imageCount || 0) > 0 ? 4 : 0) +
          ((staticAnalysis.linkCount || 0) > 5 ? 4 : 0) +
          (staticAnalysis.headingStructure?.h1 > 0 ? 3 : 0) +
          (staticAnalysis.headingStructure?.h2 > 0 ? 3 : 0)
        )
      };
    } else {
      // Repository-specific scoring (existing logic)
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
  }

  /**
   * Convert AI analysis to normalized scores
   */
  convertAIAnalysisToScores(aiAnalysis: any): { [key: string]: number } {
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

  /**
   * Generate category-specific findings
   */
  private generateCategoryFindings(category: string, score: UnifiedMetric, staticAnalysis: any, aiAnalysis: any): string[] {
    const findings: string[] = [];
    
    if (score.value < 5) {
      findings.push(`${category} score is very low (${score.value}/20) - critical improvement needed`);
    } else if (score.value < 10) {
      findings.push(`${category} score is low (${score.value}/20) - needs improvement`);
    } else if (score.value >= 16) {
      findings.push(`${category} score is excellent (${score.value}/20) - well optimized`);
    }

    // Check if this is a website analysis
    const isWebsite = staticAnalysis.websiteUrl || staticAnalysis.pageTitle;

    // Add category-specific findings based on analysis type
    switch (category) {
      case 'documentation':
        if (isWebsite) {
          if (!staticAnalysis.hasStructuredData) findings.push('Missing structured data markup');
          if (!staticAnalysis.hasOpenGraph) findings.push('No Open Graph meta tags found');
          if (!staticAnalysis.hasTwitterCards) findings.push('No Twitter Cards meta tags');
          if (!staticAnalysis.hasSitemap) findings.push('No XML sitemap available');
          if (!staticAnalysis.hasRobotsTxt) findings.push('No robots.txt file found');
          if (!staticAnalysis.hasFavicon) findings.push('No favicon detected');
        } else {
          if (!staticAnalysis.hasReadme) findings.push('Missing README.md file');
          if (!staticAnalysis.hasAgents) findings.push('Missing AGENTS.md file');
          if (!staticAnalysis.hasContributing) findings.push('Missing CONTRIBUTING.md file');
          if (!staticAnalysis.hasLicense) findings.push('Missing LICENSE file');
        }
        break;
      case 'instructionClarity':
        if (isWebsite) {
          if (!staticAnalysis.technologies || staticAnalysis.technologies.length === 0) findings.push('No technology stack detected');
          if (!staticAnalysis.contactInfo || staticAnalysis.contactInfo.length === 0) findings.push('No contact information found');
          if (!staticAnalysis.socialMediaLinks || staticAnalysis.socialMediaLinks.length === 0) findings.push('No social media links detected');
        } else {
          if (!staticAnalysis.hasReadme) findings.push('No setup instructions available');
          if (!staticAnalysis.hasAgents) findings.push('No AI agent specific instructions');
        }
        break;
      case 'workflowAutomation':
        if (isWebsite) {
          if (!staticAnalysis.mobileFriendly) findings.push('Website not mobile-friendly');
          if (staticAnalysis.pageLoadSpeed && staticAnalysis.pageLoadSpeed > 3000) findings.push('Slow page load speed detected');
          if (!staticAnalysis.navigationStructure || staticAnalysis.navigationStructure.length === 0) findings.push('No clear navigation structure');
        } else {
          if (!staticAnalysis.hasWorkflows) findings.push('No CI/CD workflows detected');
          if (!staticAnalysis.hasTests) findings.push('No automated tests found');
        }
        break;
      case 'riskCompliance':
        if (isWebsite) {
          if (!staticAnalysis.securityHeaders || staticAnalysis.securityHeaders.length === 0) findings.push('No security headers detected');
          if (!staticAnalysis.contactInfo || staticAnalysis.contactInfo.length === 0) findings.push('No contact information available');
          if (staticAnalysis.accessibilityScore && staticAnalysis.accessibilityScore < 60) findings.push('Accessibility issues detected');
        } else {
          if (!staticAnalysis.hasLicense) findings.push('No license information available');
          if (!staticAnalysis.errorHandling) findings.push('Limited error handling detected');
        }
        break;
      case 'integrationStructure':
        if (isWebsite) {
          if (!staticAnalysis.technologies || staticAnalysis.technologies.length === 0) findings.push('No technology stack detected');
          if (!staticAnalysis.socialMediaLinks || staticAnalysis.socialMediaLinks.length === 0) findings.push('No social media integration found');
          if (!staticAnalysis.contactInfo || staticAnalysis.contactInfo.length === 0) findings.push('No contact information for integration');
        } else {
          if (!staticAnalysis.hasWorkflows) findings.push('No automation infrastructure');
          if (!staticAnalysis.hasTests) findings.push('No testing infrastructure');
        }
        break;
      case 'fileSizeOptimization':
        if (isWebsite) {
          if (staticAnalysis.contentLength && staticAnalysis.contentLength < 500) findings.push('Very limited content available');
          if (staticAnalysis.imageCount && staticAnalysis.imageCount === 0) findings.push('No images found for visual context');
          if (staticAnalysis.linkCount && staticAnalysis.linkCount < 5) findings.push('Limited internal linking structure');
        } else {
          if (staticAnalysis.fileSizeAnalysis?.largeFiles?.length > 0) {
            findings.push(`${staticAnalysis.fileSizeAnalysis.largeFiles.length} files exceed 2MB limit`);
          }
        }
        break;
    }

    return findings;
  }

  /**
   * Generate category-specific recommendations
   */
  private generateCategoryRecommendations(category: string, score: UnifiedMetric, staticAnalysis: any, aiAnalysis: any): string[] {
    const recommendations: string[] = [];
    
    if (score.value < 10) {
      recommendations.push(`Focus on improving ${category} through targeted enhancements`);
    }

    // Check if this is a website analysis
    const isWebsite = staticAnalysis.websiteUrl || staticAnalysis.pageTitle;

    // Add category-specific recommendations based on analysis type
    switch (category) {
      case 'documentation':
        if (isWebsite) {
          if (!staticAnalysis.hasStructuredData) recommendations.push('Add structured data markup for better AI understanding');
          if (!staticAnalysis.hasOpenGraph) recommendations.push('Implement Open Graph meta tags for social sharing');
          if (!staticAnalysis.hasTwitterCards) recommendations.push('Add Twitter Cards meta tags for better social media integration');
          if (!staticAnalysis.hasSitemap) recommendations.push('Create XML sitemap for better search engine indexing');
          if (!staticAnalysis.hasRobotsTxt) recommendations.push('Add robots.txt file for search engine directives');
          if (!staticAnalysis.hasFavicon) recommendations.push('Add favicon for better brand recognition');
        } else {
          if (!staticAnalysis.hasReadme) recommendations.push('Create comprehensive README.md with setup instructions');
          if (!staticAnalysis.hasAgents) recommendations.push('Add AGENTS.md with AI agent specific instructions');
          if (!staticAnalysis.hasContributing) recommendations.push('Add CONTRIBUTING.md for contributor guidance');
          if (!staticAnalysis.hasLicense) recommendations.push('Add LICENSE file to clarify usage rights');
        }
        break;
      case 'instructionClarity':
        if (isWebsite) {
          if (!staticAnalysis.technologies || staticAnalysis.technologies.length === 0) recommendations.push('Add technology stack information for better integration');
          if (!staticAnalysis.contactInfo || staticAnalysis.contactInfo.length === 0) recommendations.push('Add comprehensive contact information');
          if (!staticAnalysis.socialMediaLinks || staticAnalysis.socialMediaLinks.length === 0) recommendations.push('Add social media links for better connectivity');
        } else {
          if (!staticAnalysis.hasReadme) recommendations.push('Create detailed setup and usage instructions');
          if (!staticAnalysis.hasAgents) recommendations.push('Add specific instructions for AI agents');
        }
        break;
      case 'workflowAutomation':
        if (isWebsite) {
          if (!staticAnalysis.mobileFriendly) recommendations.push('Optimize website for mobile devices');
          if (staticAnalysis.pageLoadSpeed && staticAnalysis.pageLoadSpeed > 3000) recommendations.push('Improve page load speed for better user experience');
          if (!staticAnalysis.navigationStructure || staticAnalysis.navigationStructure.length === 0) recommendations.push('Implement clear navigation structure');
        } else {
          if (!staticAnalysis.hasWorkflows) recommendations.push('Implement CI/CD workflows for automated processes');
          if (!staticAnalysis.hasTests) recommendations.push('Add automated test suite');
        }
        break;
      case 'riskCompliance':
        if (isWebsite) {
          if (!staticAnalysis.securityHeaders || staticAnalysis.securityHeaders.length === 0) recommendations.push('Implement security headers for better protection');
          if (!staticAnalysis.contactInfo || staticAnalysis.contactInfo.length === 0) recommendations.push('Add contact information for compliance');
          if (staticAnalysis.accessibilityScore && staticAnalysis.accessibilityScore < 60) recommendations.push('Improve website accessibility for better usability');
        } else {
          if (!staticAnalysis.hasLicense) recommendations.push('Add appropriate license file');
          if (!staticAnalysis.errorHandling) recommendations.push('Implement comprehensive error handling');
        }
        break;
      case 'integrationStructure':
        if (isWebsite) {
          if (!staticAnalysis.technologies || staticAnalysis.technologies.length === 0) recommendations.push('Document technology stack for better integration');
          if (!staticAnalysis.socialMediaLinks || staticAnalysis.socialMediaLinks.length === 0) recommendations.push('Add social media integration for better connectivity');
          if (!staticAnalysis.contactInfo || staticAnalysis.contactInfo.length === 0) recommendations.push('Add contact information for integration support');
        } else {
          if (!staticAnalysis.hasWorkflows) recommendations.push('Set up automation infrastructure');
          if (!staticAnalysis.hasTests) recommendations.push('Implement testing infrastructure');
        }
        break;
      case 'fileSizeOptimization':
        if (isWebsite) {
          if (staticAnalysis.contentLength && staticAnalysis.contentLength < 500) recommendations.push('Add more comprehensive content for better context');
          if (staticAnalysis.imageCount && staticAnalysis.imageCount === 0) recommendations.push('Add relevant images for better visual context');
          if (staticAnalysis.linkCount && staticAnalysis.linkCount < 5) recommendations.push('Improve internal linking structure for better navigation');
        } else {
          if (staticAnalysis.fileSizeAnalysis?.largeFiles?.length > 0) {
            recommendations.push('Optimize large files for better AI agent compatibility');
          }
        }
        break;
    }

    return recommendations;
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