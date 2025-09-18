/**
 * GitHub API Client for Repository Analysis
 * 
 * Provides methods to fetch repository data relevant for AI agent readiness assessment
 */

export interface GitHubRepositoryMetadata {
  // Basic repository information
  name: string;
  fullName: string;
  description: string;
  homepage: string;
  private: boolean;
  fork: boolean;
  archived: boolean;
  disabled: boolean;
  
  // Activity metrics
  stargazersCount: number;
  watchersCount: number;
  forksCount: number;
  openIssuesCount: number;
  
  // Technical details
  language: string;
  languages: Record<string, number>;
  size: number;
  defaultBranch: string;
  topics: string[];
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
  pushedAt: string;
  
  // License
  license: {
    key: string;
    name: string;
    spdxId: string;
  } | null;
  
  // Configuration
  hasIssues: boolean;
  hasProjects: boolean;
  hasWiki: boolean;
  hasDiscussions: boolean;
  hasPages: boolean;
  hasDownloads: boolean;
}

export interface GitHubActivityMetrics {
  commitActivity: {
    weekly: Array<[number, number, number]>; // [timestamp, additions, deletions]
    contributors: Array<{
      author: { login: string; id: number };
      total: number;
      weeks: Array<{
        w: number;
        a: number;
        d: number;
        c: number;
      }>;
    }>;
    participation: {
      all: number[];
      owner: number[];
    };
  };
  lastYearCommits: number;
  activeContributors: number;
  recentActivity: boolean;
}

export interface GitHubIssueManagement {
  issues: {
    total: number;
    open: number;
    closed: number;
    averageResolutionTime: number;
    hasLabels: boolean;
    hasAssignees: boolean;
    recentActivity: boolean;
  };
  issueLabels: string[];
  issueTemplates: boolean;
  issueResponseTime: number;
}

export interface GitHubPullRequestQuality {
  pullRequests: {
    total: number;
    open: number;
    merged: number;
    averageReviewTime: number;
    hasReviews: boolean;
    mergeable: boolean;
    recentActivity: boolean;
  };
  prTemplates: boolean;
  reviewRequirements: boolean;
  mergePatterns: {
    squashMerge: boolean;
    mergeCommit: boolean;
    rebaseMerge: boolean;
  };
}

export interface GitHubCommunityHealth {
  communityProfile: {
    healthPercentage: number;
    hasCodeOfConduct: boolean;
    hasContributing: boolean;
    hasIssueTemplate: boolean;
    hasPRTemplate: boolean;
    hasReadme: boolean;
    hasLicense: boolean;
  };
  features: {
    hasIssues: boolean;
    hasProjects: boolean;
    hasWiki: boolean;
    hasDiscussions: boolean;
  };
}

export interface GitHubRepositoryData {
  metadata: GitHubRepositoryMetadata;
  activityMetrics: GitHubActivityMetrics;
  issueManagement: GitHubIssueManagement;
  prQuality: GitHubPullRequestQuality;
  communityHealth: GitHubCommunityHealth;
}

export class GitHubAPIClient {
  private baseURL = 'https://api.github.com';
  private token: string;
  private rateLimitRemaining: number = 5000;
  private rateLimitReset: number = 0;

  constructor(token: string) {
    this.token = token;
  }

  /**
   * Extract owner and repo from GitHub URL
   */
  private extractOwnerRepo(repoUrl: string): { owner: string; repo: string } {
    const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (!match) {
      throw new Error('Invalid GitHub repository URL');
    }
    return { owner: match[1], repo: match[2] };
  }

  /**
   * Make authenticated request to GitHub API
   */
  private async makeRequest(endpoint: string): Promise<any> {
    const url = `${this.baseURL}${endpoint}`;
    
    try {
      const response = await fetch(url, {
        headers: {
          'Authorization': `token ${this.token}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'AI-Agent-Readiness-Assessment'
        }
      });

      // Update rate limit info
      this.rateLimitRemaining = parseInt(response.headers.get('X-RateLimit-Remaining') || '0');
      this.rateLimitReset = parseInt(response.headers.get('X-RateLimit-Reset') || '0');

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Repository not found');
        }
        if (response.status === 403) {
          throw new Error('Rate limit exceeded or repository access denied');
        }
        throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('GitHub API request failed:', error);
      throw error;
    }
  }

  /**
   * Check if we have sufficient rate limit
   */
  private checkRateLimit(requiredRequests: number = 1): boolean {
    return this.rateLimitRemaining >= requiredRequests;
  }

  /**
   * Get repository metadata
   */
  async getRepositoryMetadata(repoUrl: string): Promise<GitHubRepositoryMetadata> {
    const { owner, repo } = this.extractOwnerRepo(repoUrl);
    
    if (!this.checkRateLimit(1)) {
      throw new Error('Rate limit exceeded. Please try again later.');
    }

    const data = await this.makeRequest(`/repos/${owner}/${repo}`);
    
    return {
      name: data.name,
      fullName: data.full_name,
      description: data.description || '',
      homepage: data.homepage || '',
      private: data.private,
      fork: data.fork,
      archived: data.archived,
      disabled: data.disabled,
      stargazersCount: data.stargazers_count,
      watchersCount: data.watchers_count,
      forksCount: data.forks_count,
      openIssuesCount: data.open_issues_count,
      language: data.language || '',
      languages: {}, // Will be populated separately
      size: data.size,
      defaultBranch: data.default_branch,
      topics: data.topics || [],
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      pushedAt: data.pushed_at,
      license: data.license ? {
        key: data.license.key,
        name: data.license.name,
        spdxId: data.license.spdx_id
      } : null,
      hasIssues: data.has_issues,
      hasProjects: data.has_projects,
      hasWiki: data.has_wiki,
      hasDiscussions: data.has_discussions,
      hasPages: data.has_pages,
      hasDownloads: data.has_downloads
    };
  }

  /**
   * Get repository languages
   */
  async getRepositoryLanguages(repoUrl: string): Promise<Record<string, number>> {
    const { owner, repo } = this.extractOwnerRepo(repoUrl);
    
    if (!this.checkRateLimit(1)) {
      throw new Error('Rate limit exceeded. Please try again later.');
    }

    const data = await this.makeRequest(`/repos/${owner}/${repo}/languages`);
    return data;
  }

  /**
   * Get commit activity metrics
   */
  async getCommitActivity(repoUrl: string): Promise<GitHubActivityMetrics> {
    const { owner, repo } = this.extractOwnerRepo(repoUrl);
    
    if (!this.checkRateLimit(3)) {
      throw new Error('Rate limit exceeded. Please try again later.');
    }

    try {
      // Get weekly commit activity
      const weeklyData = await this.makeRequest(`/repos/${owner}/${repo}/stats/commit_activity`);
      
      // Get contributors
      const contributorsData = await this.makeRequest(`/repos/${owner}/${repo}/stats/contributors`);
      
      // Get participation data
      const participationData = await this.makeRequest(`/repos/${owner}/${repo}/stats/participation`);

      // Calculate metrics
      const lastYearCommits = weeklyData.reduce((sum: number, week: any) => sum + week.total, 0);
      const activeContributors = contributorsData.length;
      const recentActivity = weeklyData.length > 0 && weeklyData[weeklyData.length - 1].total > 0;

      return {
        commitActivity: {
          weekly: weeklyData.map((week: any) => [week.week, week.additions, week.deletions]),
          contributors: contributorsData.map((contributor: any) => ({
            author: {
              login: contributor.author.login,
              id: contributor.author.id
            },
            total: contributor.total,
            weeks: contributor.weeks
          })),
          participation: {
            all: participationData.all || [],
            owner: participationData.owner || []
          }
        },
        lastYearCommits,
        activeContributors,
        recentActivity
      };
    } catch (error) {
      console.warn('Failed to fetch commit activity, using fallback data:', error);
      return {
        commitActivity: {
          weekly: [],
          contributors: [],
          participation: { all: [], owner: [] }
        },
        lastYearCommits: 0,
        activeContributors: 0,
        recentActivity: false
      };
    }
  }

  /**
   * Get issue management data
   */
  async getIssueManagement(repoUrl: string): Promise<GitHubIssueManagement> {
    const { owner, repo } = this.extractOwnerRepo(repoUrl);
    
    if (!this.checkRateLimit(2)) {
      throw new Error('Rate limit exceeded. Please try again later.');
    }

    try {
      // Get recent issues
      const issuesData = await this.makeRequest(`/repos/${owner}/${repo}/issues?state=all&per_page=100&sort=updated`);
      
      // Get issue labels
      const labelsData = await this.makeRequest(`/repos/${owner}/${repo}/labels?per_page=100`);

      // Calculate metrics
      const totalIssues = issuesData.length;
      const openIssues = issuesData.filter((issue: any) => issue.state === 'open').length;
      const closedIssues = totalIssues - openIssues;
      
      // Calculate average resolution time (simplified)
      const closedIssuesWithDates = issuesData.filter((issue: any) => 
        issue.state === 'closed' && issue.closed_at
      );
      const averageResolutionTime = closedIssuesWithDates.length > 0 
        ? closedIssuesWithDates.reduce((sum: number, issue: any) => {
            const created = new Date(issue.created_at).getTime();
            const closed = new Date(issue.closed_at).getTime();
            return sum + (closed - created);
          }, 0) / closedIssuesWithDates.length / (1000 * 60 * 60 * 24) // Convert to days
        : 0;

      const hasLabels = issuesData.some((issue: any) => issue.labels && issue.labels.length > 0);
      const hasAssignees = issuesData.some((issue: any) => issue.assignees && issue.assignees.length > 0);
      const recentActivity = issuesData.length > 0 && 
        new Date(issuesData[0].updated_at).getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000; // Last 7 days

      return {
        issues: {
          total: totalIssues,
          open: openIssues,
          closed: closedIssues,
          averageResolutionTime,
          hasLabels,
          hasAssignees,
          recentActivity
        },
        issueLabels: labelsData.map((label: any) => label.name),
        issueTemplates: false, // Would need to check .github/ISSUE_TEMPLATE directory
        issueResponseTime: averageResolutionTime
      };
    } catch (error) {
      console.warn('Failed to fetch issue management data, using fallback:', error);
      return {
        issues: {
          total: 0,
          open: 0,
          closed: 0,
          averageResolutionTime: 0,
          hasLabels: false,
          hasAssignees: false,
          recentActivity: false
        },
        issueLabels: [],
        issueTemplates: false,
        issueResponseTime: 0
      };
    }
  }

  /**
   * Get pull request quality data
   */
  async getPullRequestQuality(repoUrl: string): Promise<GitHubPullRequestQuality> {
    const { owner, repo } = this.extractOwnerRepo(repoUrl);
    
    if (!this.checkRateLimit(2)) {
      throw new Error('Rate limit exceeded. Please try again later.');
    }

    try {
      // Get recent pull requests
      const prsData = await this.makeRequest(`/repos/${owner}/${repo}/pulls?state=all&per_page=100&sort=updated`);
      
      // Get repository settings for merge patterns
      const repoData = await this.makeRequest(`/repos/${owner}/${repo}`);

      // Calculate metrics
      const totalPRs = prsData.length;
      const openPRs = prsData.filter((pr: any) => pr.state === 'open').length;
      const mergedPRs = prsData.filter((pr: any) => pr.state === 'closed' && pr.merged_at).length;
      
      // Calculate average review time (simplified)
      const mergedPRsWithDates = prsData.filter((pr: any) => 
        pr.state === 'closed' && pr.merged_at
      );
      const averageReviewTime = mergedPRsWithDates.length > 0 
        ? mergedPRsWithDates.reduce((sum: number, pr: any) => {
            const created = new Date(pr.created_at).getTime();
            const merged = new Date(pr.merged_at).getTime();
            return sum + (merged - created);
          }, 0) / mergedPRsWithDates.length / (1000 * 60 * 60 * 24) // Convert to days
        : 0;

      const hasReviews = prsData.some((pr: any) => pr.review_comments > 0);
      const mergeable = prsData.some((pr: any) => pr.mergeable === true);
      const recentActivity = prsData.length > 0 && 
        new Date(prsData[0].updated_at).getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000; // Last 7 days

      return {
        pullRequests: {
          total: totalPRs,
          open: openPRs,
          merged: mergedPRs,
          averageReviewTime,
          hasReviews,
          mergeable,
          recentActivity
        },
        prTemplates: false, // Would need to check .github/PULL_REQUEST_TEMPLATE directory
        reviewRequirements: false, // Would need to check branch protection rules
        mergePatterns: {
          squashMerge: repoData.allow_squash_merge,
          mergeCommit: repoData.allow_merge_commit,
          rebaseMerge: repoData.allow_rebase_merge
        }
      };
    } catch (error) {
      console.warn('Failed to fetch pull request data, using fallback:', error);
      return {
        pullRequests: {
          total: 0,
          open: 0,
          merged: 0,
          averageReviewTime: 0,
          hasReviews: false,
          mergeable: false,
          recentActivity: false
        },
        prTemplates: false,
        reviewRequirements: false,
        mergePatterns: {
          squashMerge: false,
          mergeCommit: false,
          rebaseMerge: false
        }
      };
    }
  }

  /**
   * Get community health data
   */
  async getCommunityHealth(repoUrl: string): Promise<GitHubCommunityHealth> {
    const { owner, repo } = this.extractOwnerRepo(repoUrl);
    
    if (!this.checkRateLimit(2)) {
      throw new Error('Rate limit exceeded. Please try again later.');
    }

    try {
      // Get community profile
      const communityData = await this.makeRequest(`/repos/${owner}/${repo}/community/profile`);
      
      // Get repository features
      const repoData = await this.makeRequest(`/repos/${owner}/${repo}`);

      return {
        communityProfile: {
          healthPercentage: communityData.health_percentage || 0,
          hasCodeOfConduct: communityData.files?.code_of_conduct?.name ? true : false,
          hasContributing: communityData.files?.contributing?.name ? true : false,
          hasIssueTemplate: communityData.files?.issue_template ? true : false,
          hasPRTemplate: communityData.files?.pull_request_template ? true : false,
          hasReadme: communityData.files?.readme?.name ? true : false,
          hasLicense: communityData.files?.license?.name ? true : false
        },
        features: {
          hasIssues: repoData.has_issues,
          hasProjects: repoData.has_projects,
          hasWiki: repoData.has_wiki,
          hasDiscussions: repoData.has_discussions
        }
      };
    } catch (error) {
      console.warn('Failed to fetch community health data, using fallback:', error);
      return {
        communityProfile: {
          healthPercentage: 0,
          hasCodeOfConduct: false,
          hasContributing: false,
          hasIssueTemplate: false,
          hasPRTemplate: false,
          hasReadme: false,
          hasLicense: false
        },
        features: {
          hasIssues: false,
          hasProjects: false,
          hasWiki: false,
          hasDiscussions: false
        }
      };
    }
  }

  /**
   * Get comprehensive repository data
   */
  async getRepositoryData(repoUrl: string): Promise<GitHubRepositoryData> {
    console.log('🔍 Fetching GitHub repository data...');
    
    try {
      // Fetch all data in parallel for efficiency
      const [metadata, languages, activityMetrics, issueManagement, prQuality, communityHealth] = await Promise.all([
        this.getRepositoryMetadata(repoUrl),
        this.getRepositoryLanguages(repoUrl),
        this.getCommitActivity(repoUrl),
        this.getIssueManagement(repoUrl),
        this.getPullRequestQuality(repoUrl),
        this.getCommunityHealth(repoUrl)
      ]);

      // Add languages to metadata
      metadata.languages = languages;

      console.log('✅ GitHub repository data fetched successfully');
      console.log('📊 Rate limit remaining:', this.rateLimitRemaining);

      return {
        metadata,
        activityMetrics,
        issueManagement,
        prQuality,
        communityHealth
      };
    } catch (error) {
      console.error('❌ Failed to fetch GitHub repository data:', error);
      throw error;
    }
  }

  /**
   * Get rate limit status
   */
  getRateLimitStatus(): { remaining: number; reset: number } {
    return {
      remaining: this.rateLimitRemaining,
      reset: this.rateLimitReset
    };
  }
}