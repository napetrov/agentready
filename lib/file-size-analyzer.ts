/**
 * File Size and Context Consumption Analyzer
 * 
 * Analyzes repository files for AI agent compatibility based on file size limits
 * and context consumption patterns across different AI coding agents.
 */

export interface FileSizeLimits {
  cursor: number; // 2 MB
  githubCopilot: number; // 1 MB
  microsoftCopilot: number; // 1 MB
  claudeWeb: number; // 30 MB
  claudeApi: number; // 500 MB
  chatgpt: number; // 512 MB
  perplexityRegular: number; // 40 MB
  perplexityEnterprise: number; // 50 MB
}

export interface FileSizeAnalysis {
  totalFiles: number;
  filesBySize: {
    under1MB: number;
    under2MB: number;
    under10MB: number;
    under50MB: number;
    over50MB: number;
  };
  largeFiles: LargeFileInfo[];
  criticalFiles: CriticalFileInfo[];
  contextConsumption: ContextConsumptionInfo;
  agentCompatibility: AgentCompatibilityScore;
  recommendations: string[];
}

export interface LargeFileInfo {
  path: string;
  size: number;
  sizeFormatted: string;
  type: 'binary' | 'text' | 'code' | 'documentation' | 'data';
  agentImpact: {
    cursor: 'blocked' | 'limited' | 'supported';
    githubCopilot: 'blocked' | 'limited' | 'supported';
    claudeWeb: 'blocked' | 'limited' | 'supported';
    claudeApi: 'blocked' | 'limited' | 'supported';
  };
  recommendation: string;
}

export interface CriticalFileInfo {
  path: string;
  size: number;
  sizeFormatted: string;
  type: 'readme' | 'agents' | 'contributing' | 'license' | 'main_source';
  isOptimal: boolean;
  agentImpact: {
    cursor: 'optimal' | 'acceptable' | 'problematic';
    githubCopilot: 'optimal' | 'acceptable' | 'problematic';
    claudeWeb: 'optimal' | 'acceptable' | 'problematic';
  };
  recommendation: string;
}

export interface ContextConsumptionInfo {
  instructionFiles: {
    agentsMd: { size: number; lines: number; estimatedTokens: number } | null;
    readme: { size: number; lines: number; estimatedTokens: number } | null;
    contributing: { size: number; lines: number; estimatedTokens: number } | null;
  };
  totalContextFiles: number;
  averageContextFileSize: number;
  contextEfficiency: 'excellent' | 'good' | 'moderate' | 'poor';
  recommendations: string[];
}

export interface AgentCompatibilityScore {
  cursor: number; // 0-100
  githubCopilot: number; // 0-100
  claudeWeb: number; // 0-100
  claudeApi: number; // 0-100
  overall: number; // 0-100
}

// AI Agent file size limits in bytes
export const AGENT_LIMITS: FileSizeLimits = {
  cursor: 2 * 1024 * 1024, // 2 MB
  githubCopilot: 1 * 1024 * 1024, // 1 MB
  microsoftCopilot: 1 * 1024 * 1024, // 1 MB
  claudeWeb: 30 * 1024 * 1024, // 30 MB
  claudeApi: 500 * 1024 * 1024, // 500 MB
  chatgpt: 512 * 1024 * 1024, // 512 MB
  perplexityRegular: 40 * 1024 * 1024, // 40 MB
  perplexityEnterprise: 50 * 1024 * 1024, // 50 MB
};

// Optimal sizes for critical files
export const OPTIMAL_SIZES = {
  agentsMd: 200 * 1024, // 200 KB
  readme: 500 * 1024, // 500 KB
  contributing: 300 * 1024, // 300 KB
  license: 50 * 1024, // 50 KB
  mainSource: 1000 * 1024, // 1 MB
};

export class FileSizeAnalyzer {
  /**
   * Analyze file sizes and context consumption for AI agent compatibility
   */
  static async analyzeFileSizes(files: Array<{ path: string; content: string; size: number }>): Promise<FileSizeAnalysis> {
    const totalFiles = files.length;
    const filesBySize = this.categorizeFilesBySize(files);
    const largeFiles = this.identifyLargeFiles(files);
    const criticalFiles = this.analyzeCriticalFiles(files);
    const contextConsumption = this.analyzeContextConsumption(files);
    const agentCompatibility = this.calculateAgentCompatibility(files, largeFiles, criticalFiles);
    const recommendations = this.generateRecommendations(files, largeFiles, criticalFiles, contextConsumption);

    return {
      totalFiles,
      filesBySize,
      largeFiles,
      criticalFiles,
      contextConsumption,
      agentCompatibility,
      recommendations
    };
  }

  /**
   * Categorize files by size ranges
   */
  private static categorizeFilesBySize(files: Array<{ size: number }>) {
    return files.reduce((acc, file) => {
      if (file.size < 1024 * 1024) acc.under1MB++;
      else if (file.size < 2 * 1024 * 1024) acc.under2MB++;
      else if (file.size < 10 * 1024 * 1024) acc.under10MB++;
      else if (file.size < 50 * 1024 * 1024) acc.under50MB++;
      else acc.over50MB++;
      return acc;
    }, {
      under1MB: 0,
      under2MB: 0,
      under10MB: 0,
      under50MB: 0,
      over50MB: 0
    });
  }

  /**
   * Identify files that exceed AI agent limits
   */
  private static identifyLargeFiles(files: Array<{ path: string; content: string; size: number }>): LargeFileInfo[] {
    return files
      .filter(file => file.size > 2 * 1024 * 1024) // > 2 MB
      .map(file => {
        const type = this.detectFileType(file.path, file.content);
        const agentImpact = this.calculateAgentImpact(file.size);
        const recommendation = this.generateFileRecommendation(file, type, agentImpact);

        return {
          path: file.path,
          size: file.size,
          sizeFormatted: this.formatFileSize(file.size),
          type,
          agentImpact,
          recommendation
        };
      });
  }

  /**
   * Analyze critical files for optimal sizing
   */
  private static analyzeCriticalFiles(files: Array<{ path: string; content: string; size: number }>): CriticalFileInfo[] {
    const criticalFiles: CriticalFileInfo[] = [];

    // Check for README files
    const readmeFiles = files.filter(f => 
      f.path.toLowerCase().includes('readme') && 
      (f.path.endsWith('.md') || f.path.endsWith('.txt'))
    );
    readmeFiles.forEach(file => {
      const type = 'readme' as const;
      const isOptimal = file.size <= OPTIMAL_SIZES.readme;
      const agentImpact = this.calculateCriticalFileImpact(file.size, type);
      const recommendation = this.generateCriticalFileRecommendation(file, type, isOptimal);

      criticalFiles.push({
        path: file.path,
        size: file.size,
        sizeFormatted: this.formatFileSize(file.size),
        type,
        isOptimal,
        agentImpact,
        recommendation
      });
    });

    // Check for AGENTS.md
    const agentsFiles = files.filter(f => 
      f.path.toLowerCase().includes('agents') && f.path.endsWith('.md')
    );
    agentsFiles.forEach(file => {
      const type = 'agents' as const;
      const isOptimal = file.size <= OPTIMAL_SIZES.agentsMd;
      const agentImpact = this.calculateCriticalFileImpact(file.size, type);
      const recommendation = this.generateCriticalFileRecommendation(file, type, isOptimal);

      criticalFiles.push({
        path: file.path,
        size: file.size,
        sizeFormatted: this.formatFileSize(file.size),
        type,
        isOptimal,
        agentImpact,
        recommendation
      });
    });

    // Check for CONTRIBUTING files
    const contributingFiles = files.filter(f => 
      f.path.toLowerCase().includes('contributing') && 
      (f.path.endsWith('.md') || f.path.endsWith('.txt'))
    );
    contributingFiles.forEach(file => {
      const type = 'contributing' as const;
      const isOptimal = file.size <= OPTIMAL_SIZES.contributing;
      const agentImpact = this.calculateCriticalFileImpact(file.size, type);
      const recommendation = this.generateCriticalFileRecommendation(file, type, isOptimal);

      criticalFiles.push({
        path: file.path,
        size: file.size,
        sizeFormatted: this.formatFileSize(file.size),
        type,
        isOptimal,
        agentImpact,
        recommendation
      });
    });

    // Check for LICENSE files
    const licenseFiles = files.filter(f => 
      f.path.toLowerCase().includes('license') && 
      (f.path.endsWith('.md') || f.path.endsWith('.txt'))
    );
    licenseFiles.forEach(file => {
      const type = 'license' as const;
      const isOptimal = file.size <= OPTIMAL_SIZES.license;
      const agentImpact = this.calculateCriticalFileImpact(file.size, type);
      const recommendation = this.generateCriticalFileRecommendation(file, type, isOptimal);

      criticalFiles.push({
        path: file.path,
        size: file.size,
        sizeFormatted: this.formatFileSize(file.size),
        type,
        isOptimal,
        agentImpact,
        recommendation
      });
    });

    return criticalFiles;
  }

  /**
   * Analyze context consumption patterns
   */
  private static analyzeContextConsumption(files: Array<{ path: string; content: string; size: number }>): ContextConsumptionInfo {
    const instructionFiles = {
      agentsMd: this.findInstructionFile(files, 'agents'),
      readme: this.findInstructionFile(files, 'readme'),
      contributing: this.findInstructionFile(files, 'contributing')
    };

    const contextFiles = files.filter(f => 
      f.path.toLowerCase().includes('readme') ||
      f.path.toLowerCase().includes('agents') ||
      f.path.toLowerCase().includes('contributing') ||
      f.path.toLowerCase().includes('license') ||
      f.path.endsWith('.md')
    );

    const totalContextFiles = contextFiles.length;
    const averageContextFileSize = totalContextFiles > 0 
      ? contextFiles.reduce((sum, f) => sum + f.size, 0) / totalContextFiles 
      : 0;

    const contextEfficiency = this.calculateContextEfficiency(averageContextFileSize);
    const recommendations = this.generateContextRecommendations(instructionFiles, averageContextFileSize);

    return {
      instructionFiles,
      totalContextFiles,
      averageContextFileSize,
      contextEfficiency,
      recommendations
    };
  }

  /**
   * Calculate agent compatibility scores
   */
  private static calculateAgentCompatibility(
    files: Array<{ size: number }>,
    largeFiles: LargeFileInfo[],
    criticalFiles: CriticalFileInfo[]
  ): AgentCompatibilityScore {
    const totalFiles = files.length;
    const problematicFiles = largeFiles.length + criticalFiles.filter(f => !f.isOptimal).length;
    
    // Base score from file size compliance
    const baseScore = Math.max(0, 100 - (problematicFiles / totalFiles) * 100);
    
    // Calculate agent-specific scores
    const cursor = this.calculateAgentScore(baseScore, largeFiles, criticalFiles, 'cursor');
    const githubCopilot = this.calculateAgentScore(baseScore, largeFiles, criticalFiles, 'githubCopilot');
    const claudeWeb = this.calculateAgentScore(baseScore, largeFiles, criticalFiles, 'claudeWeb');
    const claudeApi = this.calculateAgentScore(baseScore, largeFiles, criticalFiles, 'claudeApi');
    
    const overall = Math.round((cursor + githubCopilot + claudeWeb + claudeApi) / 4);

    return {
      cursor: Math.round(cursor),
      githubCopilot: Math.round(githubCopilot),
      claudeWeb: Math.round(claudeWeb),
      claudeApi: Math.round(claudeApi),
      overall
    };
  }

  /**
   * Detect file type based on path and content
   */
  private static detectFileType(path: string, content: string): LargeFileInfo['type'] {
    const extension = path.split('.').pop()?.toLowerCase();
    
    // Binary file detection
    if (['exe', 'dll', 'so', 'dylib', 'bin', 'img', 'iso', 'zip', 'tar', 'gz', 'rar', '7z'].includes(extension || '')) {
      return 'binary';
    }
    
    // Data file detection
    if (['csv', 'json', 'xml', 'yaml', 'yml', 'sql', 'db', 'sqlite'].includes(extension || '')) {
      return 'data';
    }
    
    // Documentation detection
    if (['md', 'txt', 'rst', 'adoc', 'tex'].includes(extension || '')) {
      return 'documentation';
    }
    
    // Code file detection
    if (['js', 'ts', 'py', 'java', 'cpp', 'c', 'cs', 'php', 'rb', 'go', 'rs', 'swift', 'kt'].includes(extension || '')) {
      return 'code';
    }
    
    // Check for binary content
    const binaryThreshold = 0.3;
    const binaryChars = content.split('').filter(char => char.charCodeAt(0) < 32 && char !== '\n' && char !== '\r' && char !== '\t').length;
    if (binaryChars / content.length > binaryThreshold) {
      return 'binary';
    }
    
    return 'text';
  }

  /**
   * Calculate agent impact for large files
   */
  private static calculateAgentImpact(size: number): LargeFileInfo['agentImpact'] {
    return {
      cursor: size > AGENT_LIMITS.cursor ? 'blocked' : size > AGENT_LIMITS.cursor * 0.5 ? 'limited' : 'supported',
      githubCopilot: size > AGENT_LIMITS.githubCopilot ? 'blocked' : 'supported',
      claudeWeb: size > AGENT_LIMITS.claudeWeb ? 'blocked' : size > AGENT_LIMITS.claudeWeb * 0.5 ? 'limited' : 'supported',
      claudeApi: size > AGENT_LIMITS.claudeApi ? 'blocked' : size > AGENT_LIMITS.claudeApi * 0.5 ? 'limited' : 'supported'
    };
  }

  /**
   * Calculate critical file impact
   */
  private static calculateCriticalFileImpact(size: number, type: CriticalFileInfo['type']): CriticalFileInfo['agentImpact'] {
    const optimalSize = OPTIMAL_SIZES[type === 'readme' ? 'readme' : type === 'agents' ? 'agentsMd' : type === 'contributing' ? 'contributing' : 'license'];
    const isOptimal = size <= optimalSize;
    const isAcceptable = size <= optimalSize * 2;
    
    const status = isOptimal ? 'optimal' : isAcceptable ? 'acceptable' : 'problematic';
    
    return {
      cursor: status,
      githubCopilot: status,
      claudeWeb: status
    };
  }

  /**
   * Format file size for display
   */
  private static formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Find instruction file by type
   */
  private static findInstructionFile(files: Array<{ path: string; content: string; size: number }>, type: string) {
    const file = files.find(f => 
      f.path.toLowerCase().includes(type) && 
      (f.path.endsWith('.md') || f.path.endsWith('.txt'))
    );
    
    if (!file) return null;
    
    const lines = file.content.split('\n').length;
    const estimatedTokens = Math.ceil(file.content.length / 4); // Rough token estimation
    
    return {
      size: file.size,
      lines,
      estimatedTokens
    };
  }

  /**
   * Calculate context efficiency rating
   */
  private static calculateContextEfficiency(averageSize: number): ContextConsumptionInfo['contextEfficiency'] {
    if (averageSize <= 50 * 1024) return 'excellent'; // < 50 KB
    if (averageSize <= 200 * 1024) return 'good'; // < 200 KB
    if (averageSize <= 500 * 1024) return 'moderate'; // < 500 KB
    return 'poor'; // > 500 KB
  }

  /**
   * Calculate agent-specific score
   */
  private static calculateAgentScore(
    baseScore: number,
    largeFiles: LargeFileInfo[],
    criticalFiles: CriticalFileInfo[],
    agent: 'cursor' | 'githubCopilot' | 'claudeWeb' | 'claudeApi'
  ): number {
    let score = baseScore;
    
    // Penalize for files that exceed agent limits
    const blockedFiles = largeFiles.filter(f => f.agentImpact[agent] === 'blocked').length;
    const limitedFiles = largeFiles.filter(f => f.agentImpact[agent] === 'limited').length;
    
    score -= blockedFiles * 20; // -20 points per blocked file
    score -= limitedFiles * 10; // -10 points per limited file
    
    // Penalize for suboptimal critical files (only for agents that exist in critical files)
    if (agent !== 'claudeApi') {
      const problematicCriticalFiles = criticalFiles.filter(f => f.agentImpact[agent as keyof CriticalFileInfo['agentImpact']] === 'problematic').length;
      score -= problematicCriticalFiles * 15; // -15 points per problematic critical file
    }
    
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Generate file-specific recommendations
   */
  private static generateFileRecommendation(file: { path: string; size: number }, type: LargeFileInfo['type'], agentImpact: LargeFileInfo['agentImpact']): string {
    const blockedAgents = Object.entries(agentImpact)
      .filter(([_, status]) => status === 'blocked')
      .map(([agent, _]) => agent);
    
    if (blockedAgents.length > 0) {
      return `File exceeds limits for ${blockedAgents.join(', ')}. Consider splitting or using repository-level processing tools.`;
    }
    
    if (type === 'binary') {
      return 'Binary file detected. Consider using .gitignore or LFS for large binary files.';
    }
    
    if (type === 'data' && file.size > 10 * 1024 * 1024) {
      return 'Large data file detected. Consider using data processing pipelines or external storage.';
    }
    
    return 'File size is acceptable for most AI agents.';
  }

  /**
   * Generate critical file recommendations
   */
  private static generateCriticalFileRecommendation(file: { path: string; size: number }, type: CriticalFileInfo['type'], isOptimal: boolean): string {
    if (isOptimal) {
      return `File size is optimal for AI agent processing.`;
    }
    
    const optimalSize = OPTIMAL_SIZES[type === 'readme' ? 'readme' : type === 'agents' ? 'agentsMd' : type === 'contributing' ? 'contributing' : 'license'];
    const currentSize = this.formatFileSize(file.size);
    const targetSize = this.formatFileSize(optimalSize);
    
    return `File size (${currentSize}) exceeds optimal size (${targetSize}). Consider splitting content or moving detailed information to separate files.`;
  }

  /**
   * Generate context consumption recommendations
   */
  private static generateContextRecommendations(instructionFiles: any, averageSize: number): string[] {
    const recommendations: string[] = [];
    
    if (instructionFiles.agentsMd && instructionFiles.agentsMd.size > OPTIMAL_SIZES.agentsMd) {
      recommendations.push('AGENTS.md file is too large. Consider splitting into multiple focused instruction files.');
    }
    
    if (instructionFiles.readme && instructionFiles.readme.size > OPTIMAL_SIZES.readme) {
      recommendations.push('README file is too large. Consider creating a concise overview with links to detailed documentation.');
    }
    
    if (averageSize > 200 * 1024) {
      recommendations.push('Average context file size is large. Consider breaking down documentation into smaller, focused files.');
    }
    
    if (!instructionFiles.agentsMd) {
      recommendations.push('Consider adding an AGENTS.md file with specific instructions for AI agents.');
    }
    
    return recommendations;
  }

  /**
   * Generate overall recommendations
   */
  private static generateRecommendations(
    files: Array<{ path: string; size: number }>,
    largeFiles: LargeFileInfo[],
    criticalFiles: CriticalFileInfo[],
    contextConsumption: ContextConsumptionInfo
  ): string[] {
    const recommendations: string[] = [];
    
    // File size recommendations
    if (largeFiles.length > 0) {
      recommendations.push(`Found ${largeFiles.length} files exceeding 2MB. Consider using repository-level processing tools or splitting large files.`);
    }
    
    // Critical file recommendations
    const suboptimalCriticalFiles = criticalFiles.filter(f => !f.isOptimal);
    if (suboptimalCriticalFiles.length > 0) {
      recommendations.push(`${suboptimalCriticalFiles.length} critical files exceed optimal sizes. Optimize for better AI agent compatibility.`);
    }
    
    // Context consumption recommendations
    if (contextConsumption.contextEfficiency === 'poor') {
      recommendations.push('Context consumption efficiency is poor. Consider restructuring documentation for better AI agent processing.');
    }
    
    // Add specific recommendations from context analysis
    recommendations.push(...contextConsumption.recommendations);
    
    return recommendations;
  }
}