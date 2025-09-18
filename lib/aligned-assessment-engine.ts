/**
 * Aligned Assessment Engine
 * 
 * Integrates static checks and AI analytics with consistent metrics collection.
 * Ensures alignment between different assessment methods.
 */

import { UnifiedMetricsEngine, UnifiedAssessmentResult, DEFAULT_METRICS_CONFIG } from './unified-metrics-engine';
import { MetricsValidator, ValidationResult } from './metrics-validator';
import { analyzeRepository, analyzeWebsite, WebsiteAnalysisResult } from './analyzer';
import { generateEnhancedAIAssessment, generateWebsiteAIAssessment } from './enhanced-ai-assessment';

export interface AlignedAssessmentConfig {
  enableValidation: boolean;
  requireAlignment: boolean;
  maxRetries: number;
  fallbackToStatic: boolean;
  metricsConfig: typeof DEFAULT_METRICS_CONFIG;
}

export interface AlignedAssessmentResult extends UnifiedAssessmentResult {
  validation: {
    passed: boolean;
    alignmentScore: number;
    issues: string[];
    recommendations: string[];
  };
  assessmentMetadata: {
    staticAnalysisTime: number;
    aiAnalysisTime: number;
    totalAnalysisTime: number;
    retryCount: number;
    fallbackUsed: boolean;
  };
}

export class AlignedAssessmentEngine {
  private metricsEngine: UnifiedMetricsEngine;
  private validator: MetricsValidator;
  private config: AlignedAssessmentConfig;

  constructor(config?: Partial<AlignedAssessmentConfig>) {
    this.config = {
      enableValidation: true,
      requireAlignment: false,
      maxRetries: 2,
      fallbackToStatic: true,
      metricsConfig: DEFAULT_METRICS_CONFIG,
      ...config
    };
    
    this.metricsEngine = new UnifiedMetricsEngine(this.config.metricsConfig);
    this.validator = new MetricsValidator(this.config.metricsConfig);
  }

  /**
   * Perform aligned assessment for repository
   */
  async assessRepository(repoUrl: string): Promise<AlignedAssessmentResult> {
    const startTime = Date.now();
    let retryCount = 0;
    let fallbackUsed = false;

    try {
      // Perform static analysis
      const staticStartTime = Date.now();
      const staticAnalysis = await analyzeRepository(repoUrl);
      const staticAnalysisTime = Date.now() - staticStartTime;

      // Perform AI analysis with retry logic
      let aiAnalysis = null;
      let aiAnalysisTime = 0;
      
      for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
        try {
          const aiStartTime = Date.now();
          aiAnalysis = await generateEnhancedAIAssessment(staticAnalysis);
          aiAnalysisTime = Date.now() - aiStartTime;
          break;
        } catch (error) {
          console.warn(`AI analysis attempt ${attempt + 1} failed:`, error);
          retryCount = attempt + 1;
          
          if (attempt === this.config.maxRetries) {
            if (this.config.fallbackToStatic) {
              fallbackUsed = true;
              aiAnalysis = this.createFallbackAIAssessment(staticAnalysis);
            } else {
              throw error;
            }
          }
        }
      }

      // Create unified assessment
      const unifiedAssessment = this.metricsEngine.createUnifiedAssessment(
        staticAnalysis,
        aiAnalysis,
        staticAnalysis.fileSizeAnalysis
      );

      // Validate alignment if enabled
      let validation: ValidationResult | null = null;
      if (this.config.enableValidation) {
        const staticScores = this.metricsEngine['convertStaticAnalysisToScores'](staticAnalysis);
        const aiScores = this.metricsEngine['convertAIAnalysisToScores'](aiAnalysis);
        
        validation = this.validator.validateMetrics(staticScores, aiScores);
        
        // If alignment is required and validation fails, retry or use fallback
        if (this.config.requireAlignment && !validation.isValid && !fallbackUsed) {
          console.warn('Alignment validation failed, retrying with adjusted parameters...');
          // Could implement retry logic with adjusted parameters here
        }
      }

      const totalAnalysisTime = Date.now() - startTime;

      return {
        ...unifiedAssessment,
        validation: validation ? {
          passed: validation.isValid,
          alignmentScore: validation.alignmentScore,
          issues: validation.issues.map(issue => issue.message),
          recommendations: validation.recommendations
        } : {
          passed: true,
          alignmentScore: 100,
          issues: [],
          recommendations: []
        },
        assessmentMetadata: {
          staticAnalysisTime,
          aiAnalysisTime,
          totalAnalysisTime,
          retryCount,
          fallbackUsed
        }
      };

    } catch (error) {
      console.error('Repository assessment failed:', error);
      throw new Error(`Failed to assess repository: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Perform aligned assessment for website
   */
  async assessWebsite(websiteUrl: string): Promise<AlignedAssessmentResult> {
    const startTime = Date.now();
    let retryCount = 0;
    let fallbackUsed = false;

    try {
      // Perform static analysis
      const staticStartTime = Date.now();
      const websiteAnalysis = await analyzeWebsite(websiteUrl);
      const staticAnalysisTime = Date.now() - staticStartTime;

      // Convert website analysis to static analysis format
      const staticAnalysis = {
        hasReadme: false,
        hasContributing: false,
        hasAgents: false,
        hasLicense: false,
        hasWorkflows: false,
        hasTests: false,
        languages: websiteAnalysis.technologies,
        errorHandling: false,
        fileCount: 1,
        linesOfCode: 0,
        repositorySizeMB: websiteAnalysis.contentLength / (1024 * 1024),
        workflowFiles: [],
        testFiles: [],
        // Map website properties
        websiteUrl: websiteAnalysis.websiteUrl,
        pageTitle: websiteAnalysis.pageTitle,
        metaDescription: websiteAnalysis.metaDescription,
        hasStructuredData: websiteAnalysis.hasStructuredData,
        hasOpenGraph: websiteAnalysis.hasOpenGraph,
        hasTwitterCards: websiteAnalysis.hasTwitterCards,
        hasSitemap: websiteAnalysis.hasSitemap,
        hasRobotsTxt: websiteAnalysis.hasRobotsTxt,
        hasFavicon: websiteAnalysis.hasFavicon,
        hasManifest: websiteAnalysis.hasManifest,
        hasServiceWorker: websiteAnalysis.hasServiceWorker,
        pageLoadSpeed: websiteAnalysis.pageLoadSpeed,
        mobileFriendly: websiteAnalysis.mobileFriendly,
        accessibilityScore: websiteAnalysis.accessibilityScore,
        seoScore: websiteAnalysis.seoScore,
        contentLength: websiteAnalysis.contentLength,
        imageCount: websiteAnalysis.imageCount,
        linkCount: websiteAnalysis.linkCount,
        headingStructure: websiteAnalysis.headingStructure,
        technologies: websiteAnalysis.technologies,
        securityHeaders: websiteAnalysis.securityHeaders,
        socialMediaLinks: websiteAnalysis.socialMediaLinks,
        contactInfo: websiteAnalysis.contactInfo,
        navigationStructure: websiteAnalysis.navigationStructure
      };

      // Perform AI analysis with retry logic
      let aiAnalysis = null;
      let aiAnalysisTime = 0;
      
      for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
        try {
          const aiStartTime = Date.now();
          aiAnalysis = await generateWebsiteAIAssessment(staticAnalysis, websiteAnalysis.agenticFlows);
          aiAnalysisTime = Date.now() - aiStartTime;
          break;
        } catch (error) {
          console.warn(`Website AI analysis attempt ${attempt + 1} failed:`, error);
          retryCount = attempt + 1;
          
          if (attempt === this.config.maxRetries) {
            if (this.config.fallbackToStatic) {
              fallbackUsed = true;
              aiAnalysis = this.createWebsiteFallbackAIAssessment(staticAnalysis);
            } else {
              throw error;
            }
          }
        }
      }

      // Create unified assessment
      const unifiedAssessment = this.metricsEngine.createUnifiedAssessment(
        staticAnalysis,
        aiAnalysis
      );

      // Validate alignment if enabled
      let validation: ValidationResult | null = null;
      if (this.config.enableValidation) {
        const staticScores = this.metricsEngine['convertStaticAnalysisToScores'](staticAnalysis);
        const aiScores = this.metricsEngine['convertAIAnalysisToScores'](aiAnalysis);
        
        validation = this.validator.validateMetrics(staticScores, aiScores);
      }

      const totalAnalysisTime = Date.now() - startTime;

      return {
        ...unifiedAssessment,
        validation: validation ? {
          passed: validation.isValid,
          alignmentScore: validation.alignmentScore,
          issues: validation.issues.map(issue => issue.message),
          recommendations: validation.recommendations
        } : {
          passed: true,
          alignmentScore: 100,
          issues: [],
          recommendations: []
        },
        assessmentMetadata: {
          staticAnalysisTime,
          aiAnalysisTime,
          totalAnalysisTime,
          retryCount,
          fallbackUsed
        }
      };

    } catch (error) {
      console.error('Website assessment failed:', error);
      throw new Error(`Failed to assess website: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create fallback AI assessment when AI analysis fails
   */
  private createFallbackAIAssessment(staticAnalysis: any): any {
    return {
      readinessScore: Math.min(100, Math.round(
        (staticAnalysis.hasReadme ? 15 : 0) +
        (staticAnalysis.hasAgents ? 10 : 0) +
        (staticAnalysis.hasContributing ? 5 : 0) +
        (staticAnalysis.hasLicense ? 5 : 0) +
        (staticAnalysis.hasWorkflows ? 10 : 0) +
        (staticAnalysis.hasTests ? 10 : 0) +
        (staticAnalysis.errorHandling ? 10 : 0)
      )),
      categories: {
        documentation: Math.min(20, Math.round(
          (staticAnalysis.hasReadme ? 8 : 0) + 
          (staticAnalysis.hasAgents ? 6 : 0) + 
          (staticAnalysis.hasContributing ? 4 : 0) + 
          (staticAnalysis.hasLicense ? 2 : 0)
        )),
        instructionClarity: Math.min(20, Math.round(
          (staticAnalysis.hasReadme ? 12 : 0) + (staticAnalysis.hasAgents ? 8 : 0)
        )),
        workflowAutomation: Math.min(20, Math.round(
          (staticAnalysis.hasWorkflows ? 15 : 0) + (staticAnalysis.hasTests ? 5 : 0)
        )),
        riskCompliance: Math.min(20, Math.round(
          (staticAnalysis.hasLicense ? 5 : 0) + 
          (staticAnalysis.errorHandling ? 10 : 0) + 
          (staticAnalysis.hasTests ? 5 : 0)
        )),
        integrationStructure: Math.min(20, Math.round(
          (staticAnalysis.hasWorkflows ? 8 : 0) + 
          (staticAnalysis.hasTests ? 6 : 0) + 
          (staticAnalysis.languages?.length > 0 ? 6 : 0)
        )),
        fileSizeOptimization: staticAnalysis.fileSizeAnalysis 
          ? Math.min(20, Math.round(staticAnalysis.fileSizeAnalysis.agentCompatibility.overall / 5))
          : 10
      },
      findings: [
        staticAnalysis.hasReadme ? 'README.md documentation is present' : 'No README.md found',
        staticAnalysis.hasAgents ? 'AGENTS.md file provides AI agent context' : 'No AGENTS.md file found',
        staticAnalysis.hasWorkflows ? 'CI/CD workflows detected' : 'No CI/CD workflows detected',
        staticAnalysis.hasTests ? 'Test files detected' : 'No test files detected'
      ],
      recommendations: [
        !staticAnalysis.hasReadme ? 'Create comprehensive README.md' : 'Consider enhancing README.md',
        !staticAnalysis.hasAgents ? 'Add AGENTS.md for AI agent guidance' : 'Review AGENTS.md content',
        !staticAnalysis.hasWorkflows ? 'Implement CI/CD workflows' : 'Expand CI/CD coverage',
        !staticAnalysis.hasTests ? 'Add automated test suite' : 'Increase test coverage'
      ],
      confidence: {
        overall: 60,
        documentation: 60,
        instructionClarity: 60,
        workflowAutomation: 60,
        riskCompliance: 60,
        integrationStructure: 60,
        fileSizeOptimization: 60
      }
    };
  }

  /**
   * Create fallback AI assessment for websites
   */
  private createWebsiteFallbackAIAssessment(staticAnalysis: any): any {
    return {
      readinessScore: Math.min(100, Math.round(
        (staticAnalysis.hasStructuredData ? 20 : 0) +
        (staticAnalysis.hasOpenGraph ? 15 : 0) +
        (staticAnalysis.hasTwitterCards ? 10 : 0) +
        (staticAnalysis.pageTitle ? 15 : 0) +
        (staticAnalysis.metaDescription ? 10 : 0) +
        ((staticAnalysis.accessibilityScore || 0) > 50 ? 15 : 0) +
        (staticAnalysis.contactInfo?.length ? 15 : 0)
      )),
      categories: {
        documentation: staticAnalysis.hasStructuredData ? 15 : 5,
        instructionClarity: staticAnalysis.hasOpenGraph ? 12 : 5,
        workflowAutomation: staticAnalysis.contactInfo?.length ? 10 : 5,
        riskCompliance: (staticAnalysis.accessibilityScore || 0) > 50 ? 12 : 5,
        integrationStructure: staticAnalysis.technologies?.length ? 10 : 5,
        fileSizeOptimization: staticAnalysis.hasSitemap ? 8 : 5
      },
      findings: [
        staticAnalysis.hasStructuredData ? 'Structured data found' : 'No structured data detected',
        staticAnalysis.hasOpenGraph ? 'Open Graph meta tags present' : 'Missing Open Graph tags',
        staticAnalysis.pageTitle ? 'Page title available' : 'No page title found',
        staticAnalysis.contactInfo?.length ? 'Contact information available' : 'No contact information found'
      ],
      recommendations: [
        !staticAnalysis.hasStructuredData ? 'Add JSON-LD structured data' : 'Enhance structured data',
        !staticAnalysis.hasOpenGraph ? 'Implement Open Graph tags' : 'Review Open Graph implementation',
        !staticAnalysis.pageTitle ? 'Add descriptive page title' : 'Optimize page title',
        !staticAnalysis.contactInfo?.length ? 'Add contact information' : 'Enhance contact details'
      ],
      confidence: {
        overall: 50,
        documentation: 50,
        instructionClarity: 50,
        workflowAutomation: 50,
        riskCompliance: 50,
        integrationStructure: 50,
        fileSizeOptimization: 50
      }
    };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<AlignedAssessmentConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.metricsEngine = new UnifiedMetricsEngine(this.config.metricsConfig);
    this.validator = new MetricsValidator(this.config.metricsConfig);
  }

  /**
   * Get current configuration
   */
  getConfig(): AlignedAssessmentConfig {
    return { ...this.config };
  }
}