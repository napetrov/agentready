import React from 'react'
import { AdminReportData, Finding, categorizeFindingsBySeverity } from '@/lib/types'

interface AdminReportViewProps {
  data: AdminReportData
}

export function AdminReportView({ data }: AdminReportViewProps) {
  const categorizedFindings = categorizeFindingsBySeverity(data.findings)

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <h1 className="text-3xl font-bold mb-2">Admin Scan Report</h1>
        <p className="text-gray-600 mb-4">{data.websiteUrl}</p>
        <p className="text-sm text-gray-500">
          Generated: {new Date(data.generatedAt).toLocaleString()}
        </p>
      </div>

      {/* Score Overview */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <ScoreCard
          title="Overall"
          score={data.scores.overall}
          color={getScoreColor(data.scores.overall)}
        />
        <ScoreCard
          title="AI Visibility"
          score={data.scores.aiVisibility}
          color={getScoreColor(data.scores.aiVisibility)}
        />
        <ScoreCard
          title="Online Presence"
          score={data.scores.onlinePresence}
          color={getScoreColor(data.scores.onlinePresence)}
        />
        <ScoreCard
          title="Review Reputation"
          score={data.scores.reviewReputation}
          color={getScoreColor(data.scores.reviewReputation)}
        />
        <ScoreCard
          title="SEO Performance"
          score={data.scores.seoPerformance}
          color={getScoreColor(data.scores.seoPerformance)}
        />
      </div>

      {/* Priority Recommendations */}
      {data.recommendations.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-2xl font-bold mb-4">Priority Recommendations</h2>
          <div className="space-y-2">
            {data.recommendations.map((rec, idx) => (
              <div key={idx} className="text-gray-700">
                {rec}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Critical Findings */}
      {categorizedFindings.critical.length > 0 && (
        <FindingsSection
          title="🚨 Critical Issues"
          findings={categorizedFindings.critical}
          bgColor="bg-red-50"
          borderColor="border-red-200"
        />
      )}

      {/* High Priority Findings */}
      {categorizedFindings.high.length > 0 && (
        <FindingsSection
          title="⚠️ High Priority"
          findings={categorizedFindings.high}
          bgColor="bg-orange-50"
          borderColor="border-orange-200"
        />
      )}

      {/* Medium Priority Findings */}
      {categorizedFindings.medium.length > 0 && (
        <FindingsSection
          title="📋 Medium Priority"
          findings={categorizedFindings.medium}
          bgColor="bg-yellow-50"
          borderColor="border-yellow-200"
        />
      )}

      {/* Data Sources */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Semrush Data */}
        {data.semrush && (
          <DataSourceCard title="Semrush Data">
            <div className="space-y-2">
              <DataRow label="Domain Authority" value={data.semrush.domainAuthority} />
              <DataRow label="AI Visibility Score" value={data.semrush.aiVisibilityScore} />
              <DataRow label="Organic Traffic" value={data.semrush.organicTraffic.toLocaleString()} />
              <DataRow label="Backlinks" value={data.semrush.backlinks.toLocaleString()} />
              <DataRow label="Tracked Keywords" value={data.semrush.keywords.length} />
            </div>
          </DataSourceCard>
        )}

        {/* Google Business Profile */}
        {data.googleBusiness && (
          <DataSourceCard title="Google Business Profile">
            <div className="space-y-2">
              <DataRow label="Name" value={data.googleBusiness.name} />
              <DataRow
                label="Rating"
                value={`${data.googleBusiness.rating.toFixed(1)} ⭐ (${data.googleBusiness.reviewCount} reviews)`}
              />
              <DataRow
                label="Verified"
                value={data.googleBusiness.verified ? '✅ Yes' : '❌ No'}
              />
              <DataRow label="Phone" value={data.googleBusiness.phone} />
              <DataRow label="Address" value={data.googleBusiness.address} />
            </div>
          </DataSourceCard>
        )}

        {/* Yelp Data */}
        {data.yelp && (
          <DataSourceCard title="Yelp">
            <div className="space-y-2">
              <DataRow label="Name" value={data.yelp.name} />
              <DataRow
                label="Rating"
                value={`${data.yelp.rating.toFixed(1)} ⭐ (${data.yelp.reviewCount} reviews)`}
              />
              <DataRow
                label="Claimed"
                value={data.yelp.claimed ? '✅ Yes' : '❌ No'}
              />
              <DataRow label="Price Level" value={data.yelp.priceLevel} />
              <DataRow label="Phone" value={data.yelp.phone} />
            </div>
          </DataSourceCard>
        )}

        {/* SERP Data */}
        {data.serp && (
          <DataSourceCard title="SERP Visibility">
            <div className="space-y-2">
              <DataRow label="Search Query" value={data.serp.query} />
              <DataRow label="Total Results" value={data.serp.totalResults.toLocaleString()} />
              <div className="mt-4">
                <h4 className="font-semibold mb-2">Platform Presence:</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {Object.entries(data.serp.visibility).map(([platform, visible]) => (
                    <div key={platform} className="flex items-center">
                      <span className={visible ? 'text-green-600' : 'text-gray-400'}>
                        {visible ? '✅' : '❌'}
                      </span>
                      <span className="ml-2 capitalize">{platform}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </DataSourceCard>
        )}
      </div>

      {/* Top Semrush Keywords */}
      {data.semrush && data.semrush.keywords.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-2xl font-bold mb-4">Top Keywords</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-4">Keyword</th>
                  <th className="text-left py-2 px-4">Position</th>
                  <th className="text-left py-2 px-4">Volume</th>
                  <th className="text-left py-2 px-4">Difficulty</th>
                </tr>
              </thead>
              <tbody>
                {data.semrush.keywords.slice(0, 10).map((kw, idx) => (
                  <tr key={idx} className="border-b hover:bg-gray-50">
                    <td className="py-2 px-4">{kw.keyword}</td>
                    <td className="py-2 px-4">#{kw.position}</td>
                    <td className="py-2 px-4">{kw.volume.toLocaleString()}</td>
                    <td className="py-2 px-4">{kw.difficulty}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function ScoreCard({ title, score, color }: { title: string; score: number; color: string }) {
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h3 className="text-sm font-medium text-gray-600 mb-2">{title}</h3>
      <div className={`text-4xl font-bold ${color}`}>{score}</div>
      <div className="text-xs text-gray-500 mt-1">/ 100</div>
    </div>
  )
}

function FindingsSection({
  title,
  findings,
  bgColor,
  borderColor
}: {
  title: string
  findings: Finding[]
  bgColor: string
  borderColor: string
}) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-2xl font-bold mb-4">{title}</h2>
      <div className="space-y-4">
        {findings.map((finding, idx) => (
          <div
            key={idx}
            className={`${bgColor} border ${borderColor} rounded-lg p-4`}
          >
            <div className="flex items-start justify-between mb-2">
              <h3 className="font-bold text-lg">{finding.title}</h3>
              {finding.effort && (
                <span className="text-xs bg-gray-200 px-2 py-1 rounded">
                  {finding.effort} effort
                </span>
              )}
            </div>
            <p className="text-gray-700 mb-2">{finding.description}</p>
            {finding.url && (
              <p className="text-sm text-blue-600 mb-2">
                🔗 <a href={finding.url} target="_blank" rel="noopener noreferrer" className="underline">
                  {finding.url}
                </a>
              </p>
            )}
            {finding.evidence && (
              <div className="bg-gray-100 p-2 rounded text-sm mb-2">
                <strong>Evidence:</strong> {finding.evidence}
              </div>
            )}
            {finding.impact && (
              <p className="text-sm text-gray-600 mb-2">
                <strong>Impact:</strong> {finding.impact}
              </p>
            )}
            <div className="mt-3 pt-3 border-t border-gray-300">
              <p className="text-sm">
                <strong>Recommendation:</strong> {finding.recommendation}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function DataSourceCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-xl font-bold mb-4">{title}</h3>
      {children}
    </div>
  )
}

function DataRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between py-1">
      <span className="font-medium text-gray-600">{label}:</span>
      <span className="text-gray-900">{value}</span>
    </div>
  )
}

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-green-600'
  if (score >= 60) return 'text-yellow-600'
  if (score >= 40) return 'text-orange-600'
  return 'text-red-600'
}
