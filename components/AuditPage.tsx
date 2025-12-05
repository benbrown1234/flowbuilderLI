import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../services/linkedinApi';
import { 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle,
  Loader2,
  RefreshCw,
  CheckCircle2,
  XCircle,
  BarChart3,
  ExternalLink,
  Play,
  Database,
  Clock,
  DollarSign,
  Users,
  Zap,
  Target,
  Info,
  Calendar,
  ChevronDown,
  X,
  MousePointer,
  Eye,
  Percent,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';

type ComparisonMode = 'rolling28' | 'fullMonth';

interface AuditPageProps {
  accountId: string;
  accountName: string;
  isLiveData: boolean;
}

interface AuditAccountStatus {
  optedIn: boolean;
  accountId?: string;
  accountName?: string;
  optedInAt?: string;
  lastSyncAt?: string;
  syncStatus?: 'pending' | 'syncing' | 'completed' | 'error';
  syncError?: string;
  autoSyncEnabled?: boolean;
}

type ScoringStatus = 'needs_attention' | 'mild_issues' | 'performing_well' | 'paused' | 'low_volume' | 'new_campaign';

interface MetricContribution {
  metric: string;
  value: number | string | null;
  contribution: number;
  threshold: string;
  applied: boolean;
}

interface CampaignItem {
  id: string;
  name: string;
  ctr: number;
  ctrChange: number;
  cpc?: number;
  cpcChange?: number;
  cpm?: number;
  cpmChange?: number;
  conversions?: number;
  conversionsChange?: number;
  cpa?: number;
  cpaChange?: number;
  impressions: number;
  clicks: number;
  spend: number;
  prevImpressions?: number;
  prevClicks?: number;
  prevSpend?: number;
  impressionsChange?: number;
  clicksChange?: number;
  dailyBudget?: number;
  avgDailySpend?: number;
  budgetUtilization?: number;
  prevBudgetUtilization?: number;
  budgetUtilizationChange?: number;
  currentWeekSpend?: number;
  previousWeekSpend?: number;
  currentWeekDays?: number;
  previousWeekDays?: number;
  expectedDays?: number;
  daysSinceChange?: number;
  spendChange?: number;
  hasLan?: boolean;
  hasExpansion?: boolean;
  hasMaximizeDelivery?: boolean;
  hasUnderspending?: boolean;
  underspendingReason?: string;
  // New metrics with MoM/WoW comparisons
  frequency?: number | null;
  frequencyChange?: number | null;
  audiencePenetration?: number | null;
  audiencePenetrationChange?: number | null;
  averageDwellTime?: number | null;
  dwellTimeChange?: number | null;
  dwellTimeChangeWoW?: number | null;
  cpcVsAccount?: number | null;
  cpaVsAccount?: number | null;
  // Scoring breakdown with actual applied contributions
  score?: number;
  negativeScore?: number;
  positiveScore?: number;
  rawPositiveScore?: number;
  hasHardFailure?: boolean;
  scoringBreakdown?: MetricContribution[];
  scoringStatus?: ScoringStatus;
  isPerformingWell: boolean;
  issues: string[];
  positiveSignals?: string[];
  flags?: string[];
  // New 100-point scoring system
  totalScore?: number;
  engagementScore?: number;
  engagementMax?: number;
  costScore?: number;
  costMax?: number;
  audienceScore?: number;
  audienceMax?: number;
  scoreBreakdown?: Array<{
    category: string;
    metric: string;
    maxPoints: number;
    earnedPoints: number;
    value: string;
    threshold?: string;
    trend?: string;
    wowValue?: string;
  }>;
  causationInsights?: Array<{
    layer: string;
    type: string;
    severity: string;
    message: string;
    recommendation?: string;
  }>;
  narrative?: string;
}

type AdScoringStatus = 'needs_attention' | 'mild_issues' | 'performing_well' | 'insufficient_data';

interface AdBreakdownItem {
  metric: string;
  value: string;
  threshold: string;
  contribution: number;
  applied: boolean;
}

interface AdItem {
  id: string;
  name: string;
  campaignId: string;
  campaignName: string;
  ctr: number;
  ctrChange: number | null;
  prevCtr?: number | null;
  conversions?: number;
  prevConversions?: number;
  cvr?: number;
  cvrChange?: number | null;
  prevCvr?: number | null;
  impressions: number;
  prevImpressions?: number;
  clicks: number;
  prevClicks?: number;
  spend?: number;
  prevSpend?: number;
  cpc?: number;
  cpm?: number;
  averageDwellTime?: number | null;
  dwellTimeChange?: number | null;
  scoringStatus?: AdScoringStatus;
  isPerformingWell: boolean;
  issues: string[];
  positiveSignals?: string[];
  scoringBreakdown?: AdBreakdownItem[];
  scoringMetadata?: {
    score?: number;
    negativeScore?: number;
    positiveScore?: number;
    rawPositiveScore?: number;
    peerCount?: number;
  };
  campaignIssues?: string[];
  campaignScoringStatus?: string;
  hasCampaignIssues?: boolean;
}

interface AuditData {
  campaigns: CampaignItem[];
  ads: AdItem[];
  alerts: {
    type: 'budget' | 'penetration' | 'lan_expansion';
    message: string;
    campaignId?: string;
    campaignName?: string;
  }[];
  lastSyncAt?: string;
  syncFrequency: 'daily' | 'weekly';
}

type AgeState = 'learning' | 'stable' | 'fatigue_risk';
type PerformanceStatus = 'strong' | 'weak' | 'neutral';
type CpcStatus = 'efficient' | 'inefficient' | 'neutral';
type DistributionFlag = 'over_served' | 'under_served' | 'normal';
type FatigueFlag = 'fatigued' | 'ageing_but_ok' | 'not_fatigued';
type Contribution = 'high_contributor' | 'neutral_contributor' | 'weak_contributor' | 'learning' | 'not_evaluable';

interface ScoredAd {
  adId: string;
  adName: string;
  adStatus: string;
  ageState: AgeState | null;
  impressionShare: number;
  ctrDelta: number | null;
  dwellDelta: number | null;
  cpcDelta: number | null;
  ctrStatus: PerformanceStatus | null;
  dwellStatus: PerformanceStatus | null;
  cpcStatus: CpcStatus | null;
  contribution: Contribution;
  fatigueFlag: FatigueFlag;
  distributionFlag: DistributionFlag;
  conflictReason: string | null;
  recommendation: string;
  lowVolume: boolean;
  adCtr: number;
  adDwell: number | null;
  adCpc: number | null;
  adCpm: number | null;
  adImpressions: number;
  adClicks: number;
  adAgeDays: number;
  adSpend: number;
}

interface CampaignAverages {
  campaignCtr: number;
  campaignDwell: number | null;
  campaignCpc: number | null;
  campaignCpm: number | null;
  campaignImpressionsTotal: number;
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toLocaleString();
}

function formatCtr(ctr: number): string {
  return `${ctr.toFixed(2)}%`;
}

function formatChange(change: number): string {
  const sign = change > 0 ? '+' : '';
  return `${sign}${change.toFixed(1)}%`;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-GB', { 
    day: 'numeric', 
    month: 'short', 
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function getLinkedInCampaignUrl(accountId: string, campaignId: string): string {
  return `https://www.linkedin.com/campaignmanager/accounts/${accountId}/campaigns/${campaignId}`;
}

function getLinkedInAdUrl(accountId: string, campaignId: string, adId: string): string {
  return `https://www.linkedin.com/campaignmanager/accounts/${accountId}/campaigns/${campaignId}/creatives/${adId}`;
}

function PerformanceIndicator({ change, isPositive }: { change: number | null; isPositive: boolean }) {
  if (change === null) {
    return <span className="text-gray-400 text-sm">No prior data</span>;
  }
  
  if (Math.abs(change) < 0.5) {
    return <span className="text-gray-500 text-sm">No change</span>;
  }
  
  return (
    <span className={`flex items-center gap-1 ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
      {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
      <span className="text-sm font-medium">{formatChange(change)}</span>
    </span>
  );
}

function ScoreBadge({ score, status }: { score?: number; status?: ScoringStatus }) {
  if (score === undefined) return null;
  
  const getScoreColor = () => {
    // Thresholds: 0-49 = Needs Attention (red), 50-69 = Monitor Closely (amber), 70-100 = Strong Performance (green)
    if (status === 'needs_attention' || score < 50) return 'bg-red-100 text-red-700 border-red-200';
    if (status === 'mild_issues' || score < 70) return 'bg-amber-100 text-amber-700 border-amber-200';
    return 'bg-green-100 text-green-700 border-green-200';
  };
  
  return (
    <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border text-sm font-semibold ${getScoreColor()}`}>
      <span>{score}</span>
      <span className="text-xs opacity-70">/100</span>
    </div>
  );
}

function ScoreBreakdownBars({ 
  engagementScore, engagementMax,
  costScore, costMax,
  audienceScore, audienceMax
}: { 
  engagementScore?: number; engagementMax?: number;
  costScore?: number; costMax?: number;
  audienceScore?: number; audienceMax?: number;
}) {
  if (engagementScore === undefined && costScore === undefined && audienceScore === undefined) {
    return null;
  }
  
  const bars = [
    { label: 'Engagement', score: engagementScore || 0, max: engagementMax || 45, color: 'bg-blue-500' },
    { label: 'Cost', score: costScore || 0, max: costMax || 35, color: 'bg-green-500' },
    { label: 'Audience', score: audienceScore || 0, max: audienceMax || 20, color: 'bg-purple-500' },
  ];
  
  return (
    <div className="space-y-1.5 mt-3">
      {bars.map(bar => {
        const percentage = bar.max > 0 ? (bar.score / bar.max) * 100 : 0;
        const getBarBgColor = () => {
          if (percentage >= 70) return bar.color;
          if (percentage >= 40) return bar.color.replace('500', '400');
          return 'bg-gray-300';
        };
        
        return (
          <div key={bar.label} className="flex items-center gap-2">
            <span className="text-xs text-gray-500 w-20">{bar.label}</span>
            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all ${getBarBgColor()}`}
                style={{ width: `${Math.min(percentage, 100)}%` }}
              />
            </div>
            <span className="text-xs font-medium text-gray-600 w-12 text-right">{bar.score}/{bar.max}</span>
          </div>
        );
      })}
    </div>
  );
}

function CausationPanel({ insights }: { insights?: CampaignItem['causationInsights'] }) {
  if (!insights || insights.length === 0) return null;
  
  const primaryCause = insights.find(i => i.severity === 'primary');
  const secondaryCauses = insights.filter(i => i.severity === 'secondary').slice(0, 2);
  
  const getSeverityIcon = (severity: string) => {
    if (severity === 'primary') return <AlertTriangle className="w-4 h-4 text-red-500" />;
    if (severity === 'secondary') return <Info className="w-4 h-4 text-amber-500" />;
    return <Info className="w-4 h-4 text-blue-500" />;
  };
  
  const getLayerBadge = (layer: string) => {
    const colors: Record<string, string> = {
      creative: 'bg-purple-100 text-purple-700',
      bidding: 'bg-blue-100 text-blue-700',
      targeting: 'bg-green-100 text-green-700',
    };
    return colors[layer] || 'bg-gray-100 text-gray-700';
  };
  
  return (
    <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
      {primaryCause && (
        <div className="flex items-start gap-2">
          {getSeverityIcon('primary')}
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className={`text-xs px-1.5 py-0.5 rounded ${getLayerBadge(primaryCause.layer)}`}>
                {primaryCause.layer}
              </span>
              <span className="text-xs font-medium text-red-700">Primary Cause</span>
            </div>
            <p className="text-xs text-gray-700 mt-0.5">{primaryCause.message}</p>
            {primaryCause.recommendation && (
              <p className="text-xs text-gray-500 mt-0.5 italic">{primaryCause.recommendation}</p>
            )}
          </div>
        </div>
      )}
      {secondaryCauses.map((cause, idx) => (
        <div key={idx} className="flex items-start gap-2">
          {getSeverityIcon('secondary')}
          <div className="flex-1">
            <span className={`text-xs px-1.5 py-0.5 rounded ${getLayerBadge(cause.layer)}`}>
              {cause.layer}
            </span>
            <p className="text-xs text-gray-600 mt-0.5">{cause.message}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function CampaignCard({ campaign, accountId, showIssues, onClick, onSeeAds, isAdsSelected }: { campaign: CampaignItem; accountId: string; showIssues: boolean; onClick?: () => void; onSeeAds?: () => void; isAdsSelected?: boolean }) {
  const linkedInUrl = getLinkedInCampaignUrl(accountId, campaign.id);
  
  const getBorderColor = () => {
    if (campaign.scoringStatus === 'needs_attention') return 'border-red-200';
    if (campaign.scoringStatus === 'mild_issues') return 'border-amber-200';
    return 'border-green-200';
  };
  
  const getIssueBorderColor = () => {
    if (campaign.scoringStatus === 'needs_attention') return 'border-red-100';
    if (campaign.scoringStatus === 'mild_issues') return 'border-amber-100';
    return 'border-green-100';
  };
  
  const getIssueTextColor = () => {
    if (campaign.scoringStatus === 'needs_attention') return 'text-red-600';
    if (campaign.scoringStatus === 'mild_issues') return 'text-amber-600';
    return 'text-green-600';
  };
  
  return (
    <div 
      className={`bg-white rounded-lg border ${getBorderColor()} p-4 ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <a 
            href={linkedInUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-gray-900 hover:text-blue-600 flex items-center gap-1 group"
          >
            <span className="truncate">{campaign.name}</span>
            <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 flex-shrink-0" />
          </a>
        </div>
        <div className="flex items-center gap-2">
          <ScoreBadge score={campaign.totalScore} status={campaign.scoringStatus} />
          <PerformanceIndicator change={campaign.ctrChange} isPositive={campaign.ctrChange > 0} />
        </div>
      </div>
      
      <div className="grid grid-cols-3 gap-4 text-center mb-3">
        <div>
          <div className="flex items-center justify-center gap-1">
            <p className="text-lg font-semibold text-gray-900">{formatCtr(campaign.ctr)}</p>
            {campaign.ctrChange !== null && campaign.ctrChange !== undefined && Math.abs(campaign.ctrChange) >= 0.5 && (
              <span className={`text-xs font-medium ${campaign.ctrChange > 0 ? 'text-green-600' : 'text-red-600'}`}>
                {campaign.ctrChange > 0 ? '+' : ''}{campaign.ctrChange.toFixed(1)}%
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500">CTR</p>
        </div>
        <div>
          <div className="flex items-center justify-center gap-1">
            <p className="text-lg font-semibold text-gray-900">{campaign.cpc ? `$${campaign.cpc.toFixed(2)}` : '-'}</p>
            {campaign.cpcChange !== null && campaign.cpcChange !== undefined && Math.abs(campaign.cpcChange) >= 0.5 && (
              <span className={`text-xs font-medium ${campaign.cpcChange < 0 ? 'text-green-600' : 'text-red-600'}`}>
                {campaign.cpcChange > 0 ? '+' : ''}{campaign.cpcChange.toFixed(1)}%
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500">CPC</p>
        </div>
        <div>
          <div className="flex items-center justify-center gap-1">
            <p className="text-lg font-semibold text-gray-900">{campaign.cpm ? `$${campaign.cpm.toFixed(2)}` : '-'}</p>
            {campaign.cpmChange !== null && campaign.cpmChange !== undefined && Math.abs(campaign.cpmChange) >= 0.5 && (
              <span className={`text-xs font-medium ${campaign.cpmChange < 0 ? 'text-green-600' : 'text-red-600'}`}>
                {campaign.cpmChange > 0 ? '+' : ''}{campaign.cpmChange.toFixed(1)}%
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500">CPM</p>
        </div>
      </div>
      
      {/* Score Breakdown Bars */}
      <ScoreBreakdownBars 
        engagementScore={campaign.engagementScore}
        engagementMax={campaign.engagementMax}
        costScore={campaign.costScore}
        costMax={campaign.costMax}
        audienceScore={campaign.audienceScore}
        audienceMax={campaign.audienceMax}
      />
      
      {(campaign.hasLan || campaign.hasExpansion || campaign.hasMaximizeDelivery || campaign.hasUnderspending) && (
        <div className="flex items-center gap-2 flex-wrap mb-2 mt-3">
          {campaign.hasLan && (
            <span className="inline-flex items-center gap-1 text-blue-600 text-xs bg-blue-50 rounded px-2 py-1">
              <Zap className="w-3 h-3" />
              LAN
            </span>
          )}
          {campaign.hasExpansion && (
            <span className="inline-flex items-center gap-1 text-purple-600 text-xs bg-purple-50 rounded px-2 py-1">
              <Users className="w-3 h-3" />
              Expansion
            </span>
          )}
          {campaign.hasMaximizeDelivery && (
            <span className="inline-flex items-center gap-1 text-orange-600 text-xs bg-orange-50 rounded px-2 py-1">
              <Zap className="w-3 h-3" />
              Max Delivery
            </span>
          )}
          {campaign.hasUnderspending && (
            <span className="inline-flex items-center gap-1 text-red-600 text-xs bg-red-50 rounded px-2 py-1">
              <DollarSign className="w-3 h-3" />
              Underspending
            </span>
          )}
        </div>
      )}
      
      {/* Causation Insights */}
      {showIssues && <CausationPanel insights={campaign.causationInsights} />}
      
      {/* See Ads Button */}
      {onSeeAds && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onSeeAds();
          }}
          className={`mt-3 w-full py-2 px-3 text-sm font-medium rounded-lg border transition-all flex items-center justify-center gap-2 ${
            isAdsSelected 
              ? 'bg-blue-600 text-white border-blue-600' 
              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
          }`}
        >
          <MousePointer className="w-4 h-4" />
          {isAdsSelected ? 'Viewing Ads' : 'See Ads'}
        </button>
      )}
    </div>
  );
}

function AdCard({ ad, accountId, showIssues, onClick }: { ad: AdItem; accountId: string; showIssues: boolean; onClick?: () => void }) {
  const linkedInUrl = getLinkedInAdUrl(accountId, ad.campaignId, ad.id);
  
  const getBorderColor = () => {
    if (ad.scoringStatus === 'needs_attention') return 'border-red-200';
    if (ad.scoringStatus === 'insufficient_data') return 'border-gray-200';
    return 'border-green-200';
  };
  
  return (
    <div 
      className={`bg-white rounded-lg border ${getBorderColor()} p-4 ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <a 
            href={linkedInUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-gray-900 hover:text-blue-600 flex items-center gap-1 group"
          >
            <span className="truncate">{ad.name}</span>
            <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 flex-shrink-0" />
          </a>
          <p className="text-xs text-gray-500 truncate">{ad.campaignName}</p>
        </div>
        <PerformanceIndicator change={ad.ctrChange} isPositive={ad.ctrChange > 0} />
      </div>
      
      <div className="grid grid-cols-3 gap-4 text-center mb-3">
        <div>
          <p className="text-lg font-semibold text-gray-900">{formatCtr(ad.ctr)}</p>
          <p className="text-xs text-gray-500">CTR</p>
        </div>
        <div>
          <p className="text-lg font-semibold text-gray-900">{ad.conversions || 0}</p>
          <p className="text-xs text-gray-500">Conversions</p>
        </div>
        <div>
          <p className="text-lg font-semibold text-gray-900">{formatNumber(ad.clicks)}</p>
          <p className="text-xs text-gray-500">Clicks</p>
        </div>
      </div>
      
      {showIssues && ad.issues.length > 0 && (
        <div className="mt-2 pt-2 border-t border-red-100">
          {ad.issues.map((issue, idx) => (
            <div key={idx} className="flex items-center gap-2 text-red-600 text-xs">
              <AlertTriangle className="w-3 h-3 flex-shrink-0" />
              <span>{issue}</span>
            </div>
          ))}
        </div>
      )}
      
      {/* Show inherited campaign issues (even for performing well ads) */}
      {ad.hasCampaignIssues && ad.campaignIssues && ad.campaignIssues.length > 0 && (
        <div className={`mt-2 pt-2 border-t ${ad.campaignScoringStatus === 'needs_attention' ? 'border-red-100' : 'border-amber-100'}`}>
          <p className="text-xs text-gray-500 mb-1 font-medium">Campaign issues:</p>
          {ad.campaignIssues.map((issue, idx) => (
            <div key={idx} className={`flex items-center gap-2 text-xs ${ad.campaignScoringStatus === 'needs_attention' ? 'text-red-500' : 'text-amber-600'}`}>
              <AlertTriangle className="w-3 h-3 flex-shrink-0" />
              <span>{issue}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ScoredAdCard({ ad, accountId, campaignId, onClick, onPreview }: { ad: ScoredAd; accountId: string; campaignId: string; onClick?: () => void; onPreview?: () => void }) {
  const linkedInUrl = getLinkedInAdUrl(accountId, campaignId, ad.adId);
  
  const getContributionBadge = () => {
    switch (ad.contribution) {
      case 'high_contributor':
        return <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium"><CheckCircle2 className="w-3 h-3" /> High Contributor</span>;
      case 'neutral_contributor':
        return <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">Neutral</span>;
      case 'weak_contributor':
        return <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium"><XCircle className="w-3 h-3" /> Weak Contributor</span>;
      case 'learning':
        return <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium"><Clock className="w-3 h-3" /> Learning</span>;
      default:
        return <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-500 rounded-full text-xs font-medium"><Info className="w-3 h-3" /> Low Volume</span>;
    }
  };
  
  const getStatusPill = (status: PerformanceStatus | CpcStatus | null, type: 'ctr' | 'dwell' | 'cpc') => {
    if (status === null) return <span className="text-xs text-gray-400">-</span>;
    
    const isGood = status === 'strong' || status === 'efficient';
    const isBad = status === 'weak' || status === 'inefficient';
    
    if (isGood) return <span className="text-xs font-medium text-green-600">{status}</span>;
    if (isBad) return <span className="text-xs font-medium text-red-600">{status}</span>;
    return <span className="text-xs text-gray-500">{status}</span>;
  };
  
  const formatDelta = (delta: number | null) => {
    if (delta === null) return '-';
    const pct = (delta * 100).toFixed(0);
    return delta >= 0 ? `+${pct}%` : `${pct}%`;
  };
  
  const getRecommendationText = (rec: string) => {
    const map: Record<string, string> = {
      'scale_or_duplicate': 'Scale or duplicate this ad - it\'s a top performer',
      'keep_running': 'Keep running - performance is on track',
      'pause_or_optimize': 'Consider pausing or optimizing creative',
      'refresh_or_replace_creative': 'Refresh or replace creative - showing fatigue',
      'reduce_impression_share_or_pause': 'Reduce impression share or pause',
      'allow_more_time': 'Allow more time to gather data',
      'insufficient_data': 'Insufficient data to evaluate',
      'no_action_ad_paused': 'Ad is paused - no action needed',
      'strong_message_but_cta_weak': 'Strong message but weak CTA - improve call-to-action',
      'improve_post_click_experience': 'Improve landing page experience',
      'pause_or_replace': 'Pause or replace - underperforming',
      'create_variants': 'Create variants to spread impression load',
    };
    return map[rec] || rec.replace(/_/g, ' ');
  };
  
  const getConflictReasonText = (reason: string) => {
    const map: Record<string, string> = {
      'senior_audience_or_message_depth': 'Low CTR but high dwell - audience reads carefully before acting',
      'curiosity_clicks': 'High CTR but low dwell - clicks aren\'t converting to engagement',
      'algorithm_over_serving_weak_ad': 'LinkedIn is over-serving a weak ad - manual intervention needed',
      'top_ad_over_served': 'Top ad is monopolizing impressions - diversify to reduce risk',
    };
    return map[reason] || reason.replace(/_/g, ' ');
  };
  
  const getAgeStateBadge = () => {
    if (!ad.ageState) return null;
    
    switch (ad.ageState) {
      case 'learning':
        return <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded">Learning ({ad.adAgeDays}d)</span>;
      case 'stable':
        return <span className="text-xs px-2 py-0.5 bg-green-50 text-green-600 rounded">Stable ({ad.adAgeDays}d)</span>;
      case 'fatigue_risk':
        return <span className="text-xs px-2 py-0.5 bg-amber-50 text-amber-600 rounded">Fatigue Risk ({ad.adAgeDays}d)</span>;
    }
  };
  
  const getBorderColor = () => {
    if (ad.contribution === 'high_contributor') return 'border-green-200';
    if (ad.contribution === 'weak_contributor') return 'border-red-200';
    if (ad.contribution === 'learning') return 'border-blue-200';
    return 'border-gray-200';
  };
  
  return (
    <div 
      className={`bg-white rounded-lg border ${getBorderColor()} p-4 cursor-pointer hover:shadow-md transition-shadow`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-900 truncate">{ad.adName}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onPreview?.();
              }}
              className="p-1 hover:bg-purple-100 rounded text-purple-600 opacity-60 hover:opacity-100 transition-opacity"
              title="View Ad Preview"
            >
              <Eye className="w-3.5 h-3.5" />
            </button>
            <a 
              href={linkedInUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-blue-600 transition-colors"
              title="View in LinkedIn"
            >
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          <div className="flex items-center gap-2 mt-1">
            {getAgeStateBadge()}
            {ad.adStatus === 'PAUSED' && (
              <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded">Paused</span>
            )}
          </div>
        </div>
        {getContributionBadge()}
      </div>
      
      <div className="grid grid-cols-4 gap-2 text-center mb-3">
        <div>
          <p className="text-sm font-semibold text-gray-900">{formatCtr(ad.adCtr)}</p>
          <p className="text-xs text-gray-500">CTR</p>
          {getStatusPill(ad.ctrStatus, 'ctr')}
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-900">{ad.adDwell ? `${ad.adDwell.toFixed(1)}s` : '-'}</p>
          <p className="text-xs text-gray-500">Dwell</p>
          {getStatusPill(ad.dwellStatus, 'dwell')}
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-900">{ad.adCpc ? `$${ad.adCpc.toFixed(2)}` : '-'}</p>
          <p className="text-xs text-gray-500">CPC</p>
          {getStatusPill(ad.cpcStatus, 'cpc')}
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-900">{(ad.impressionShare * 100).toFixed(0)}%</p>
          <p className="text-xs text-gray-500">Share</p>
          {ad.distributionFlag !== 'normal' && (
            <span className={`text-xs font-medium ${ad.distributionFlag === 'over_served' ? 'text-amber-600' : 'text-gray-500'}`}>
              {ad.distributionFlag === 'over_served' ? 'Over-served' : 'Under-served'}
            </span>
          )}
        </div>
      </div>
      
      <div className="text-xs text-gray-500 mb-2">
        {formatNumber(ad.adImpressions)} impressions · {formatNumber(ad.adClicks)} clicks · ${ad.adSpend.toFixed(2)} spend
      </div>
      
      {ad.fatigueFlag === 'fatigued' && (
        <div className="mb-2 px-2 py-1 bg-amber-50 border border-amber-100 rounded text-xs text-amber-700 flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" /> Creative fatigue detected
        </div>
      )}
      
      {ad.conflictReason && (
        <div className="mb-2 px-2 py-1 bg-purple-50 border border-purple-100 rounded text-xs text-purple-700">
          <span className="font-medium">Insight:</span> {getConflictReasonText(ad.conflictReason)}
        </div>
      )}
      
      <div className="pt-2 border-t border-gray-100">
        <div className="flex items-center gap-2">
          <Zap className="w-3 h-3 text-blue-500" />
          <span className="text-xs text-gray-700">{getRecommendationText(ad.recommendation)}</span>
        </div>
      </div>
    </div>
  );
}

function AlertCard({ alert, accountId }: { alert: AuditData['alerts'][0]; accountId: string }) {
  const Icon = alert.type === 'budget' ? DollarSign : 
               alert.type === 'penetration' ? Users : Zap;
  
  const bgColor = alert.type === 'budget' ? 'bg-amber-50 border-amber-200' :
                  alert.type === 'penetration' ? 'bg-purple-50 border-purple-200' : 
                  'bg-blue-50 border-blue-200';
  
  const iconColor = alert.type === 'budget' ? 'text-amber-600' :
                    alert.type === 'penetration' ? 'text-purple-600' : 
                    'text-blue-600';
  
  return (
    <div className={`rounded-lg border p-3 ${bgColor}`}>
      <div className="flex items-start gap-3">
        <Icon className={`w-5 h-5 ${iconColor} flex-shrink-0 mt-0.5`} />
        <div className="flex-1">
          <p className="text-sm text-gray-900">{alert.message}</p>
          {alert.campaignId && alert.campaignName && (
            <a 
              href={getLinkedInCampaignUrl(accountId, alert.campaignId)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-1"
            >
              View {alert.campaignName}
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function MetricRow({ label, current, previous, change, isPositive, format = 'number' }: { 
  label: string; 
  current: number | undefined; 
  previous: number | undefined | null; 
  change: number | undefined | null;
  isPositive: boolean;
  format?: 'number' | 'percent' | 'currency';
}) {
  const formatValue = (val: number | undefined | null) => {
    if (val === undefined || val === null) return '-';
    if (format === 'percent') return `${val.toFixed(2)}%`;
    if (format === 'currency') return `$${val.toFixed(2)}`;
    return formatNumber(val);
  };
  
  const getChangeColor = () => {
    if (change === undefined || change === null || Math.abs(change) < 0.5) return 'text-gray-500';
    return isPositive ? 'text-green-600' : 'text-red-600';
  };
  
  const ChangeIcon = change !== undefined && change !== null && change > 0 ? ArrowUpRight : ArrowDownRight;
  
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-600">{label}</span>
      <div className="text-right">
        <span className="text-sm font-medium text-gray-900">{formatValue(current)}</span>
        {previous !== undefined && previous !== null && (
          <span className="text-xs text-gray-500 ml-2">vs {formatValue(previous)}</span>
        )}
        {change !== undefined && change !== null && Math.abs(change) >= 0.5 && (
          <span className={`inline-flex items-center ml-2 text-xs ${getChangeColor()}`}>
            <ChangeIcon className="w-3 h-3" />
            {change > 0 ? '+' : ''}{change.toFixed(1)}%
          </span>
        )}
      </div>
    </div>
  );
}

function CampaignDetailSidebar({ campaign, accountId, onClose }: { 
  campaign: CampaignItem; 
  accountId: string;
  onClose: () => void;
}) {
  const linkedInUrl = getLinkedInCampaignUrl(accountId, campaign.id);
  
  const getStatusBadge = () => {
    if (campaign.scoringStatus === 'needs_attention') {
      return <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-medium"><XCircle className="w-3 h-3" /> Needs Attention</span>;
    }
    if (campaign.scoringStatus === 'mild_issues') {
      return <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 rounded text-xs font-medium"><AlertTriangle className="w-3 h-3" /> Monitor Closely</span>;
    }
    return <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium"><CheckCircle2 className="w-3 h-3" /> Strong Performance</span>;
  };
  
  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-white shadow-xl z-50 overflow-y-auto">
      <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">Campaign Details</h3>
        <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
          <X className="w-5 h-5 text-gray-500" />
        </button>
      </div>
      
      <div className="p-4 space-y-6">
        <div>
          <h4 className="text-lg font-medium text-gray-900 mb-2">{campaign.name}</h4>
          <div className="flex items-center gap-2 flex-wrap">
            {getStatusBadge()}
            {campaign.totalScore !== undefined && (
              <ScoreBadge score={campaign.totalScore} status={campaign.scoringStatus} />
            )}
          </div>
          <a 
            href={linkedInUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline mt-2"
          >
            View in LinkedIn <ExternalLink className="w-3 h-3" />
          </a>
        </div>
        
        {/* 100-Point Score Breakdown */}
        {(campaign.engagementScore !== undefined || campaign.costScore !== undefined || campaign.audienceScore !== undefined) && (
          <div className="bg-gray-100 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="font-medium text-gray-700">Score Breakdown</span>
              <span className="text-lg font-bold text-gray-900">{campaign.totalScore || 0}/100</span>
            </div>
            <ScoreBreakdownBars 
              engagementScore={campaign.engagementScore}
              engagementMax={45}
              costScore={campaign.costScore}
              costMax={35}
              audienceScore={campaign.audienceScore}
              audienceMax={20}
            />
          </div>
        )}
        
        {/* Causation Insights - Why Performance Changed */}
        {campaign.causationInsights && campaign.causationInsights.length > 0 && (
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
            <h5 className="font-medium text-blue-800 mb-2 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" /> Causation Analysis
            </h5>
            <ul className="space-y-2">
              {campaign.causationInsights.map((insight: any, idx: number) => (
                <li key={idx} className="text-sm">
                  <div className="flex items-start gap-2">
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                      insight.layer === 'creative' ? 'bg-purple-100 text-purple-700' :
                      insight.layer === 'bidding' ? 'bg-orange-100 text-orange-700' :
                      'bg-cyan-100 text-cyan-700'
                    }`}>
                      {insight.layer === 'creative' ? 'Creative' :
                       insight.layer === 'bidding' ? 'Bidding' : 'Targeting'}
                    </span>
                    <div className="flex-1">
                      <span className="text-blue-700">{insight.message}</span>
                      {insight.recommendation && (
                        <p className="text-blue-600 text-xs mt-1 italic">{insight.recommendation}</p>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
        
        {/* 100-Point Scoring Breakdown by Category */}
        {campaign.scoreBreakdown && campaign.scoreBreakdown.length > 0 && (
          <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
            <h5 className="font-medium text-slate-800 mb-3 flex items-center gap-2">
              <BarChart3 className="w-4 h-4" /> Score Breakdown Details
            </h5>
            
            {/* Engagement Quality */}
            {campaign.scoreBreakdown.filter(b => b.category === 'engagement').length > 0 && (
              <div className="mb-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-blue-700">Engagement Quality</span>
                  <span className="text-xs text-blue-600">{campaign.engagementScore || 0}/{campaign.engagementMax || 45}</span>
                </div>
                <div className="space-y-1">
                  {campaign.scoreBreakdown.filter(b => b.category === 'engagement').map((item, idx) => (
                    <div key={idx} className="py-0.5">
                      <div className="flex justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className={item.earnedPoints > 0 ? 'text-slate-700' : 'text-slate-400'}>{item.metric}</span>
                          <span className="text-slate-400">{item.value}</span>
                        </div>
                        <span className={item.earnedPoints > 0 ? 'text-blue-600 font-medium' : 'text-slate-400'}>
                          {item.earnedPoints}/{item.maxPoints}
                        </span>
                      </div>
                      {item.wowValue && (
                        <div className="text-[10px] text-slate-400 ml-0 mt-0.5">{item.wowValue}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Cost Efficiency */}
            {campaign.scoreBreakdown.filter(b => b.category === 'cost').length > 0 && (
              <div className="mb-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-green-700">Cost Efficiency</span>
                  <span className="text-xs text-green-600">{campaign.costScore || 0}/{campaign.costMax || 35}</span>
                </div>
                <div className="space-y-1">
                  {campaign.scoreBreakdown.filter(b => b.category === 'cost').map((item, idx) => (
                    <div key={idx} className="py-0.5">
                      <div className="flex justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className={item.earnedPoints > 0 ? 'text-slate-700' : 'text-slate-400'}>{item.metric}</span>
                          <span className="text-slate-400">{item.value}</span>
                        </div>
                        <span className={item.earnedPoints > 0 ? 'text-green-600 font-medium' : 'text-slate-400'}>
                          {item.earnedPoints}/{item.maxPoints}
                        </span>
                      </div>
                      {item.wowValue && (
                        <div className="text-[10px] text-slate-400 ml-0 mt-0.5">{item.wowValue}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Audience Quality */}
            {campaign.scoreBreakdown.filter(b => b.category === 'audience').length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-purple-700">Audience Quality</span>
                  <span className="text-xs text-purple-600">{campaign.audienceScore || 0}/{campaign.audienceMax || 20}</span>
                </div>
                <div className="space-y-1">
                  {campaign.scoreBreakdown.filter(b => b.category === 'audience').map((item, idx) => (
                    <div key={idx} className="py-0.5">
                      <div className="flex justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className={item.earnedPoints > 0 ? 'text-slate-700' : 'text-slate-400'}>{item.metric}</span>
                          <span className="text-slate-400">{item.value}</span>
                        </div>
                        <span className={item.earnedPoints > 0 ? 'text-purple-600 font-medium' : 'text-slate-400'}>
                          {item.earnedPoints}/{item.maxPoints}
                        </span>
                      </div>
                      {item.wowValue && (
                        <div className="text-[10px] text-slate-400 ml-0 mt-0.5">{item.wowValue}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        
        {(campaign.hasLan || campaign.hasExpansion || campaign.hasMaximizeDelivery || campaign.hasUnderspending) && (
          <div className="flex gap-2 flex-wrap">
            {campaign.hasLan && (
              <span className="inline-flex items-center gap-1 text-blue-600 text-xs bg-blue-50 rounded px-2 py-1">
                <Zap className="w-3 h-3" /> LinkedIn Audience Network
              </span>
            )}
            {campaign.hasExpansion && (
              <span className="inline-flex items-center gap-1 text-purple-600 text-xs bg-purple-50 rounded px-2 py-1">
                <Users className="w-3 h-3" /> Audience Expansion
              </span>
            )}
            {campaign.hasMaximizeDelivery && (
              <span className="inline-flex items-center gap-1 text-orange-600 text-xs bg-orange-50 rounded px-2 py-1">
                <Zap className="w-3 h-3" /> Maximize Delivery
              </span>
            )}
            {campaign.hasUnderspending && (
              <span className="inline-flex items-center gap-1 text-red-600 text-xs bg-red-50 rounded px-2 py-1">
                <DollarSign className="w-3 h-3" /> Underspending - Check Bidding
              </span>
            )}
          </div>
        )}
        
        <div>
          <h5 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
            <BarChart3 className="w-4 h-4" /> Performance Metrics
          </h5>
          <div className="bg-gray-50 rounded-lg p-3">
            <MetricRow 
              label="CTR" 
              current={campaign.ctr} 
              previous={undefined}
              change={campaign.ctrChange} 
              isPositive={campaign.ctrChange > 0}
              format="percent"
            />
            <MetricRow 
              label="CPC" 
              current={campaign.cpc} 
              previous={undefined}
              change={campaign.cpcChange} 
              isPositive={(campaign.cpcChange || 0) < 0}
              format="currency"
            />
            <MetricRow 
              label="CPM" 
              current={campaign.cpm} 
              previous={undefined}
              change={campaign.cpmChange} 
              isPositive={(campaign.cpmChange || 0) < 0}
              format="currency"
            />
            <MetricRow 
              label="Conversions" 
              current={campaign.conversions} 
              previous={undefined}
              change={campaign.conversionsChange} 
              isPositive={(campaign.conversionsChange || 0) > 0}
            />
            <MetricRow 
              label="CPA" 
              current={campaign.cpa} 
              previous={undefined}
              change={campaign.cpaChange} 
              isPositive={(campaign.cpaChange || 0) < 0}
              format="currency"
            />
          </div>
        </div>
        
        <div>
          <h5 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
            <Eye className="w-4 h-4" /> Volume Metrics (28-day)
          </h5>
          <div className="bg-gray-50 rounded-lg p-3 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Impressions</span>
              <div className="text-right">
                <span className="font-medium text-gray-900">{formatNumber(campaign.impressions)}</span>
                {campaign.impressionsChange !== null && campaign.impressionsChange !== undefined && (
                  <span className={`ml-2 text-xs ${campaign.impressionsChange > 0 ? 'text-green-600' : 'text-amber-600'}`}>
                    {campaign.impressionsChange > 0 ? '+' : ''}{campaign.impressionsChange.toFixed(0)}% MoM
                  </span>
                )}
              </div>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Clicks</span>
              <div className="text-right">
                <span className="font-medium text-gray-900">{formatNumber(campaign.clicks)}</span>
                {campaign.clicksChange !== null && campaign.clicksChange !== undefined && (
                  <span className={`ml-2 text-xs ${campaign.clicksChange > 0 ? 'text-green-600' : 'text-amber-600'}`}>
                    {campaign.clicksChange > 0 ? '+' : ''}{campaign.clicksChange.toFixed(0)}% MoM
                  </span>
                )}
              </div>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Spend</span>
              <div className="text-right">
                <span className="font-medium text-gray-900">${formatNumber(campaign.spend)}</span>
                {campaign.spendChange !== null && campaign.spendChange !== undefined && (
                  <span className={`ml-2 text-xs ${campaign.spendChange > 0 ? 'text-green-600' : 'text-amber-600'}`}>
                    {campaign.spendChange > 0 ? '+' : ''}{campaign.spendChange.toFixed(0)}% MoM
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
        
        {campaign.dailyBudget && campaign.dailyBudget > 0 && (
          <div>
            <h5 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
              <DollarSign className="w-4 h-4" /> Budget Metrics
            </h5>
            <div className="bg-gray-50 rounded-lg p-3 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Daily Budget</span>
                <span className="font-medium text-gray-900">${campaign.dailyBudget.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Avg Daily Spend</span>
                <span className="font-medium text-gray-900">${campaign.avgDailySpend?.toFixed(2) || '-'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Utilization</span>
                <div className="text-right">
                  <span className={`font-medium ${
                    (campaign.budgetUtilization || 0) < 50 ? 'text-red-600' :
                    (campaign.budgetUtilization || 0) < 80 ? 'text-amber-600' : 'text-green-600'
                  }`}>
                    {campaign.budgetUtilization?.toFixed(0) || '-'}%
                  </span>
                  {campaign.budgetUtilizationChange !== null && campaign.budgetUtilizationChange !== undefined && (
                    <span className={`ml-2 text-xs ${campaign.budgetUtilizationChange > 0 ? 'text-green-600' : 'text-amber-600'}`}>
                      {campaign.budgetUtilizationChange > 0 ? '+' : ''}{campaign.budgetUtilizationChange.toFixed(0)}% WoW
                    </span>
                  )}
                </div>
              </div>
              {campaign.hasUnderspending && campaign.underspendingReason && (
                <div className="mt-2 p-2 bg-red-50 rounded border border-red-100">
                  <div className="flex items-center gap-2 text-red-600 text-xs">
                    <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                    <span>{campaign.underspendingReason}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Advanced Metrics */}
        {(campaign.frequency !== null || campaign.audiencePenetration !== null || campaign.averageDwellTime !== null || campaign.cpcVsAccount !== null) && (
          <div>
            <h5 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
              <Target className="w-4 h-4" /> Advanced Metrics (28-day)
            </h5>
            <div className="bg-gray-50 rounded-lg p-3 space-y-2">
              {campaign.frequency !== null && campaign.frequency !== undefined && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Frequency</span>
                  <div className="text-right">
                    <span className={`font-medium ${
                      campaign.frequency > 6 ? 'text-red-600' :
                      campaign.frequency > 4 ? 'text-amber-600' :
                      campaign.frequency >= 1.5 && campaign.frequency <= 3 ? 'text-green-600' : 'text-gray-900'
                    }`}>
                      {campaign.frequency.toFixed(1)}x
                    </span>
                    {campaign.frequencyChange !== null && campaign.frequencyChange !== undefined && (
                      <span className={`ml-2 text-xs ${campaign.frequencyChange > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                        {campaign.frequencyChange > 0 ? '+' : ''}{campaign.frequencyChange.toFixed(0)}% MoM
                      </span>
                    )}
                  </div>
                </div>
              )}
              {campaign.audiencePenetration !== null && campaign.audiencePenetration !== undefined && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Audience Penetration</span>
                  <div className="text-right">
                    <span className={`font-medium ${
                      campaign.audiencePenetration < 10 ? 'text-red-600' :
                      campaign.audiencePenetration < 20 ? 'text-amber-600' :
                      campaign.audiencePenetration > 60 ? 'text-green-600' : 'text-gray-900'
                    }`}>
                      {campaign.audiencePenetration.toFixed(1)}%
                    </span>
                    {campaign.audiencePenetrationChange !== null && campaign.audiencePenetrationChange !== undefined && (
                      <span className={`ml-2 text-xs ${campaign.audiencePenetrationChange > 0 ? 'text-green-600' : 'text-amber-600'}`}>
                        {campaign.audiencePenetrationChange > 0 ? '+' : ''}{campaign.audiencePenetrationChange.toFixed(0)}% MoM
                      </span>
                    )}
                  </div>
                </div>
              )}
              {campaign.averageDwellTime !== null && campaign.averageDwellTime !== undefined && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Avg Dwell Time</span>
                  <div className="text-right">
                    <span className={`font-medium ${
                      campaign.averageDwellTime < 1.5 ? 'text-red-600' :
                      campaign.averageDwellTime >= 4 ? 'text-green-600' : 'text-gray-900'
                    }`}>
                      {campaign.averageDwellTime.toFixed(1)}s
                    </span>
                    {campaign.dwellTimeChange !== null && campaign.dwellTimeChange !== undefined && (
                      <span className={`ml-2 text-xs ${campaign.dwellTimeChange > 0 ? 'text-green-600' : 'text-amber-600'}`}>
                        {campaign.dwellTimeChange > 0 ? '+' : ''}{campaign.dwellTimeChange.toFixed(0)}% MoM
                      </span>
                    )}
                    {campaign.dwellTimeChangeWoW !== null && campaign.dwellTimeChangeWoW !== undefined && (
                      <span className={`ml-1 text-xs ${campaign.dwellTimeChangeWoW > 0 ? 'text-green-600' : 'text-amber-600'}`}>
                        ({campaign.dwellTimeChangeWoW > 0 ? '+' : ''}{campaign.dwellTimeChangeWoW.toFixed(0)}% WoW)
                      </span>
                    )}
                  </div>
                </div>
              )}
              {campaign.cpcVsAccount !== null && campaign.cpcVsAccount !== undefined && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">CPC vs Account Avg</span>
                  <span className={`font-medium ${
                    campaign.cpcVsAccount > 30 ? 'text-red-600' :
                    campaign.cpcVsAccount > 15 ? 'text-amber-600' :
                    campaign.cpcVsAccount <= -10 ? 'text-green-600' : 'text-gray-900'
                  }`}>
                    {campaign.cpcVsAccount > 0 ? '+' : ''}{campaign.cpcVsAccount.toFixed(0)}%
                  </span>
                </div>
              )}
              {campaign.cpaVsAccount !== null && campaign.cpaVsAccount !== undefined && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">CPA vs Account Avg</span>
                  <span className={`font-medium ${
                    campaign.cpaVsAccount > 25 ? 'text-red-600' :
                    campaign.cpaVsAccount <= -15 ? 'text-green-600' : 'text-gray-900'
                  }`}>
                    {campaign.cpaVsAccount > 0 ? '+' : ''}{campaign.cpaVsAccount.toFixed(0)}%
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
        
        {campaign.budgetUtilization !== undefined && (
          <div>
            <h5 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
              <DollarSign className="w-4 h-4" /> Budget
            </h5>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-600">Daily Budget</span>
                <span className="font-medium">${campaign.dailyBudget?.toFixed(2) || '-'}</span>
              </div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-600">Avg Daily Spend</span>
                <span className="font-medium">${campaign.avgDailySpend?.toFixed(2) || '-'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Utilization</span>
                <span className={`font-medium ${
                  campaign.budgetUtilization < 50 ? 'text-red-600' :
                  campaign.budgetUtilization < 80 ? 'text-amber-600' : 'text-green-600'
                }`}>
                  {campaign.budgetUtilization.toFixed(0)}%
                </span>
              </div>
            </div>
          </div>
        )}
        
      </div>
    </div>
  );
}

function AdDetailSidebar({ ad, accountId, onClose }: { 
  ad: AdItem; 
  accountId: string;
  onClose: () => void;
}) {
  const linkedInUrl = getLinkedInAdUrl(accountId, ad.campaignId, ad.id);
  
  const getStatusBadge = () => {
    if (ad.scoringStatus === 'needs_attention') {
      return <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-medium"><XCircle className="w-3 h-3" /> Needs Attention</span>;
    }
    if (ad.scoringStatus === 'mild_issues') {
      return <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 rounded text-xs font-medium"><AlertTriangle className="w-3 h-3" /> Monitor Closely</span>;
    }
    if (ad.scoringStatus === 'insufficient_data') {
      return <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-medium"><Info className="w-3 h-3" /> Insufficient Data</span>;
    }
    return <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium"><CheckCircle2 className="w-3 h-3" /> Strong Performance</span>;
  };
  
  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-white shadow-xl z-50 overflow-y-auto">
      <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">Ad Details</h3>
        <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
          <X className="w-5 h-5 text-gray-500" />
        </button>
      </div>
      
      <div className="p-4 space-y-6">
        <div>
          <h4 className="text-lg font-medium text-gray-900 mb-1">{ad.name}</h4>
          <p className="text-sm text-gray-500 mb-2">{ad.campaignName}</p>
          <div className="flex items-center gap-2 flex-wrap">
            {getStatusBadge()}
          </div>
          <a 
            href={linkedInUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline mt-2"
          >
            View in LinkedIn <ExternalLink className="w-3 h-3" />
          </a>
        </div>
        
        {ad.positiveSignals && ad.positiveSignals.length > 0 && (
          <div className="bg-green-50 rounded-lg p-4 border border-green-100">
            <h5 className="font-medium text-green-800 mb-2 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> Positive Signals
            </h5>
            <ul className="space-y-1">
              {ad.positiveSignals.map((signal, idx) => (
                <li key={idx} className="text-sm text-green-700 flex items-start gap-2">
                  <span className="text-green-400 mt-1">•</span> {signal}
                </li>
              ))}
            </ul>
          </div>
        )}
        
        {ad.issues.length > 0 && (
          <div className="bg-red-50 rounded-lg p-4 border border-red-100">
            <h5 className="font-medium text-red-800 mb-2 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> Issues Detected
            </h5>
            <ul className="space-y-1">
              {ad.issues.map((issue, idx) => (
                <li key={idx} className="text-sm text-red-700 flex items-start gap-2">
                  <span className="text-red-400 mt-1">•</span> {issue}
                </li>
              ))}
            </ul>
          </div>
        )}
        
        {ad.scoringStatus === 'insufficient_data' && (
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <h5 className="font-medium text-gray-700 mb-2 flex items-center gap-2">
              <Info className="w-4 h-4" /> Why Insufficient Data?
            </h5>
            <p className="text-sm text-gray-600">
              {(ad.impressions < 500 || ad.clicks < 10) 
                ? `This ad has low volume (${ad.impressions} impressions, ${ad.clicks} clicks). We need at least 500 impressions and 10 clicks to reliably score performance.`
                : `No previous period data available for comparison. We need data from both the current and previous 4-week periods to calculate trends.`
              }
            </p>
          </div>
        )}
        
        <div>
          <h5 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
            <BarChart3 className="w-4 h-4" /> Current Period (4 weeks)
          </h5>
          <div className="bg-gray-50 rounded-lg p-3">
            <MetricRow 
              label="CTR" 
              current={ad.ctr} 
              previous={ad.prevCtr}
              change={ad.ctrChange} 
              isPositive={(ad.ctrChange || 0) > 0}
              format="percent"
            />
            {ad.cpc !== undefined && ad.cpc > 0 && (
              <MetricRow 
                label="CPC" 
                current={ad.cpc} 
                previous={undefined}
                change={undefined} 
                isPositive={true}
                format="currency"
              />
            )}
            {ad.cpm !== undefined && ad.cpm > 0 && (
              <MetricRow 
                label="CPM" 
                current={ad.cpm} 
                previous={undefined}
                change={undefined} 
                isPositive={true}
                format="currency"
              />
            )}
            <MetricRow 
              label="Impressions" 
              current={ad.impressions} 
              previous={ad.prevImpressions}
              change={undefined} 
              isPositive={true}
            />
            <MetricRow 
              label="Clicks" 
              current={ad.clicks} 
              previous={ad.prevClicks}
              change={undefined} 
              isPositive={true}
            />
            <MetricRow 
              label="Conversions" 
              current={ad.conversions} 
              previous={ad.prevConversions}
              change={undefined} 
              isPositive={true}
            />
            {ad.cvr !== undefined && (
              <MetricRow 
                label="Conversion Rate" 
                current={ad.cvr} 
                previous={ad.prevCvr}
                change={ad.cvrChange} 
                isPositive={(ad.cvrChange || 0) > 0}
                format="percent"
              />
            )}
            {ad.averageDwellTime !== null && ad.averageDwellTime !== undefined && (
              <div className="flex justify-between py-1.5 border-t border-gray-200 mt-2 pt-2">
                <span className="text-sm text-gray-600">Avg Dwell Time</span>
                <div className="text-right">
                  <span className={`text-sm font-medium ${
                    ad.averageDwellTime < 1.5 ? 'text-red-600' :
                    ad.averageDwellTime >= 4 ? 'text-green-600' : 'text-gray-900'
                  }`}>
                    {ad.averageDwellTime.toFixed(1)}s
                  </span>
                  {ad.dwellTimeChange !== null && ad.dwellTimeChange !== undefined && (
                    <span className={`ml-2 text-xs ${ad.dwellTimeChange > 0 ? 'text-green-600' : 'text-amber-600'}`}>
                      {ad.dwellTimeChange > 0 ? '+' : ''}{ad.dwellTimeChange.toFixed(0)}% MoM
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ScoredAdDetailSidebar({ ad, campaignAverages, accountId, campaignId, onClose, onPreview }: { 
  ad: ScoredAd; 
  campaignAverages: CampaignAverages | null;
  accountId: string;
  campaignId: string;
  onClose: () => void;
  onPreview: () => void;
}) {
  const linkedInUrl = getLinkedInAdUrl(accountId, campaignId, ad.adId);
  
  const getContributionBadge = () => {
    switch (ad.contribution) {
      case 'high_contributor':
        return <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium"><CheckCircle2 className="w-3 h-3" /> High Contributor</span>;
      case 'neutral_contributor':
        return <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-medium">Neutral</span>;
      case 'weak_contributor':
        return <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-medium"><XCircle className="w-3 h-3" /> Weak Contributor</span>;
      case 'learning':
        return <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium"><Clock className="w-3 h-3" /> Learning</span>;
      default:
        return <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-500 rounded text-xs font-medium"><Info className="w-3 h-3" /> Low Volume</span>;
    }
  };

  const getAgeStateBadge = () => {
    if (!ad.ageState) return null;
    switch (ad.ageState) {
      case 'learning':
        return <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded">Learning ({ad.adAgeDays}d)</span>;
      case 'stable':
        return <span className="text-xs px-2 py-0.5 bg-green-50 text-green-600 rounded">Stable ({ad.adAgeDays}d)</span>;
      case 'fatigue_risk':
        return <span className="text-xs px-2 py-0.5 bg-amber-50 text-amber-600 rounded">Fatigue Risk ({ad.adAgeDays}d)</span>;
    }
  };

  const formatDelta = (delta: number | null) => {
    if (delta === null) return '-';
    const pct = (delta * 100).toFixed(0);
    return delta >= 0 ? `+${pct}%` : `${pct}%`;
  };

  const getStatusColor = (status: string | null, type: 'performance' | 'cpc') => {
    if (!status) return 'text-gray-500';
    if (type === 'performance') {
      if (status === 'strong') return 'text-green-600';
      if (status === 'weak') return 'text-red-600';
    } else {
      if (status === 'efficient') return 'text-green-600';
      if (status === 'inefficient') return 'text-red-600';
    }
    return 'text-gray-600';
  };

  const getRecommendationText = (rec: string) => {
    const map: Record<string, string> = {
      'scale_or_duplicate': 'Scale or duplicate this ad - it\'s a top performer',
      'keep_running': 'Keep running - performance is on track',
      'pause_or_optimize': 'Consider pausing or optimizing creative',
      'refresh_or_replace_creative': 'Refresh or replace creative - showing fatigue',
      'reduce_impression_share_or_pause': 'Reduce impression share or pause',
      'allow_more_time': 'Allow more time to gather data',
      'insufficient_data': 'Insufficient data to evaluate',
      'no_action_ad_paused': 'Ad is paused - no action needed',
      'strong_message_but_cta_weak': 'Strong message but weak CTA - improve call-to-action',
      'improve_post_click_experience': 'Improve landing page experience',
      'pause_or_replace': 'Pause or replace - underperforming',
      'create_variants': 'Create variants to spread impression load',
    };
    return map[rec] || rec.replace(/_/g, ' ');
  };

  const getConflictReasonText = (reason: string) => {
    const map: Record<string, string> = {
      'senior_audience_or_message_depth': 'Low CTR but high dwell - audience reads carefully before acting',
      'curiosity_clicks': 'High CTR but low dwell - clicks aren\'t converting to engagement',
      'algorithm_over_serving_weak_ad': 'LinkedIn is over-serving a weak ad - manual intervention needed',
      'top_ad_over_served': 'Top ad is monopolizing impressions - diversify to reduce risk',
    };
    return map[reason] || reason.replace(/_/g, ' ');
  };

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-white shadow-xl z-50 overflow-y-auto">
      <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">Ad Scoring Details</h3>
        <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
          <X className="w-5 h-5 text-gray-500" />
        </button>
      </div>
      
      <div className="p-4 space-y-6">
        <div>
          <h4 className="text-lg font-medium text-gray-900 mb-1">{ad.adName}</h4>
          <div className="flex items-center gap-2 flex-wrap mt-2">
            {getContributionBadge()}
            {getAgeStateBadge()}
            {ad.adStatus === 'PAUSED' && (
              <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded">Paused</span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-3">
            <a 
              href={linkedInUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
            >
              View in LinkedIn <ExternalLink className="w-3 h-3" />
            </a>
            <button
              onClick={onPreview}
              className="inline-flex items-center gap-1 text-sm text-purple-600 hover:underline"
            >
              <Eye className="w-3 h-3" /> View Preview
            </button>
          </div>
        </div>

        <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
          <h5 className="font-medium text-blue-800 mb-2 flex items-center gap-2">
            <Zap className="w-4 h-4" /> Recommendation
          </h5>
          <p className="text-sm text-blue-700">{getRecommendationText(ad.recommendation)}</p>
        </div>

        {ad.conflictReason && (
          <div className="bg-purple-50 rounded-lg p-4 border border-purple-100">
            <h5 className="font-medium text-purple-800 mb-2 flex items-center gap-2">
              <Info className="w-4 h-4" /> Pattern Detected
            </h5>
            <p className="text-sm text-purple-700">{getConflictReasonText(ad.conflictReason)}</p>
          </div>
        )}

        {ad.fatigueFlag === 'fatigued' && (
          <div className="bg-amber-50 rounded-lg p-4 border border-amber-100">
            <h5 className="font-medium text-amber-800 mb-2 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> Creative Fatigue
            </h5>
            <p className="text-sm text-amber-700">This ad is showing signs of fatigue. Consider refreshing the creative or pausing to prevent wasted spend.</p>
          </div>
        )}
        
        <div>
          <h5 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
            <BarChart3 className="w-4 h-4" /> Performance vs Campaign Average
          </h5>
          <div className="bg-gray-50 rounded-lg p-3 space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-gray-200">
              <span className="text-sm text-gray-600">CTR</span>
              <div className="text-right">
                <span className="text-sm font-medium text-gray-900">{formatCtr(ad.adCtr)}</span>
                {campaignAverages && (
                  <span className="text-xs text-gray-500 ml-2">vs {formatCtr(campaignAverages.campaignCtr)}</span>
                )}
                <span className={`ml-2 text-xs font-medium ${getStatusColor(ad.ctrStatus, 'performance')}`}>
                  {formatDelta(ad.ctrDelta)} ({ad.ctrStatus || '-'})
                </span>
              </div>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-200">
              <span className="text-sm text-gray-600">Dwell Time</span>
              <div className="text-right">
                <span className="text-sm font-medium text-gray-900">{ad.adDwell ? `${ad.adDwell.toFixed(1)}s` : '-'}</span>
                {campaignAverages?.campaignDwell && (
                  <span className="text-xs text-gray-500 ml-2">vs {campaignAverages.campaignDwell.toFixed(1)}s</span>
                )}
                <span className={`ml-2 text-xs font-medium ${getStatusColor(ad.dwellStatus, 'performance')}`}>
                  {formatDelta(ad.dwellDelta)} ({ad.dwellStatus || '-'})
                </span>
              </div>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-sm text-gray-600">CPC</span>
              <div className="text-right">
                <span className="text-sm font-medium text-gray-900">{ad.adCpc ? `$${ad.adCpc.toFixed(2)}` : '-'}</span>
                {campaignAverages?.campaignCpc && (
                  <span className="text-xs text-gray-500 ml-2">vs ${campaignAverages.campaignCpc.toFixed(2)}</span>
                )}
                <span className={`ml-2 text-xs font-medium ${getStatusColor(ad.cpcStatus, 'cpc')}`}>
                  {formatDelta(ad.cpcDelta)} ({ad.cpcStatus || '-'})
                </span>
              </div>
            </div>
          </div>
        </div>

        <div>
          <h5 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
            <Percent className="w-4 h-4" /> Impression Distribution
          </h5>
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-gray-600">Share of Campaign</span>
              <span className={`text-sm font-medium ${
                ad.distributionFlag === 'over_served' ? 'text-amber-600' :
                ad.distributionFlag === 'under_served' ? 'text-gray-500' : 'text-gray-900'
              }`}>
                {(ad.impressionShare * 100).toFixed(0)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className={`h-2 rounded-full ${
                  ad.distributionFlag === 'over_served' ? 'bg-amber-500' :
                  ad.distributionFlag === 'under_served' ? 'bg-gray-400' : 'bg-blue-500'
                }`}
                style={{ width: `${Math.min(ad.impressionShare * 100, 100)}%` }}
              />
            </div>
            {ad.distributionFlag !== 'normal' && (
              <p className={`text-xs mt-2 ${ad.distributionFlag === 'over_served' ? 'text-amber-600' : 'text-gray-500'}`}>
                {ad.distributionFlag === 'over_served' 
                  ? 'This ad is receiving ≥70% of impressions. Consider creating variants to spread risk.'
                  : 'This ad is receiving <10% of impressions. LinkedIn may be deprioritizing it.'}
              </p>
            )}
          </div>
        </div>

        <div>
          <h5 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
            <Eye className="w-4 h-4" /> Volume Metrics
          </h5>
          <div className="bg-gray-50 rounded-lg p-3 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Impressions</span>
              <span className="font-medium text-gray-900">{formatNumber(ad.adImpressions)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Clicks</span>
              <span className="font-medium text-gray-900">{formatNumber(ad.adClicks)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Spend</span>
              <span className="font-medium text-gray-900">${ad.adSpend.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Age</span>
              <span className="font-medium text-gray-900">{ad.adAgeDays} days</span>
            </div>
          </div>
        </div>

        <div>
          <h5 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
            <Target className="w-4 h-4" /> Scoring Thresholds Applied
          </h5>
          <div className="bg-gray-50 rounded-lg p-3 space-y-2 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-white p-2 rounded border border-gray-200">
                <p className="text-gray-500 mb-1">Volume Required</p>
                <p className="font-medium">≥1,000 impressions</p>
                <p className={ad.lowVolume ? 'text-red-500' : 'text-green-500'}>
                  {ad.lowVolume ? 'Not met' : 'Met'}
                </p>
              </div>
              <div className="bg-white p-2 rounded border border-gray-200">
                <p className="text-gray-500 mb-1">Age Classification</p>
                <p className="font-medium">
                  {ad.adAgeDays <= 13 ? '≤13d = Learning' : ad.adAgeDays <= 59 ? '14-59d = Stable' : '≥60d = Fatigue Risk'}
                </p>
              </div>
              <div className="bg-white p-2 rounded border border-gray-200">
                <p className="text-gray-500 mb-1">CTR Thresholds</p>
                <p className="font-medium">Strong ≥+10% / Weak ≤-15%</p>
              </div>
              <div className="bg-white p-2 rounded border border-gray-200">
                <p className="text-gray-500 mb-1">Dwell Thresholds</p>
                <p className="font-medium">Strong ≥+10% / Weak ≤-10%</p>
              </div>
              <div className="bg-white p-2 rounded border border-gray-200">
                <p className="text-gray-500 mb-1">CPC Thresholds</p>
                <p className="font-medium">Efficient ≥+10% / Inefficient ≤-15%</p>
              </div>
              <div className="bg-white p-2 rounded border border-gray-200">
                <p className="text-gray-500 mb-1">Distribution</p>
                <p className="font-medium">Over ≥70% / Under &lt;10%</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AdPreviewModal({ previewHtml, loading, onClose }: {
  previewHtml: string | null;
  loading: boolean;
  onClose: () => void;
}) {
  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 z-[100] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-auto relative"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between z-10">
          <h3 className="font-semibold text-gray-900">Ad Preview</h3>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 rounded-full text-gray-500 hover:text-gray-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-3" />
              <p className="text-sm text-gray-500">Loading preview...</p>
            </div>
          ) : previewHtml ? (
            <div 
              className="w-full"
              dangerouslySetInnerHTML={{ __html: previewHtml }} 
            />
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <Eye className="w-12 h-12 mb-3 opacity-30" />
              <p className="text-sm">Preview not available for this ad</p>
              <p className="text-xs mt-1">The ad may be using a format that doesn't support previews</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StartAuditView({ accountName, onStart, isStarting }: { 
  accountName: string; 
  onStart: () => void;
  isStarting: boolean;
}) {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <BarChart3 className="w-8 h-8 text-blue-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-3">Start Weekly Audit</h2>
        <p className="text-gray-600 mb-6">
          Enable auditing for <span className="font-medium">{accountName}</span> to track performance 
          and get weekly reports on campaigns and ads.
        </p>
        
        <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left">
          <h4 className="font-medium text-gray-900 mb-3">What you'll get:</h4>
          <ul className="space-y-2 text-sm text-gray-600">
            <li className="flex items-start gap-2">
              <TrendingUp className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
              <span>Campaigns & ads performing well (month-on-month)</span>
            </li>
            <li className="flex items-start gap-2">
              <TrendingDown className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
              <span>Campaigns & ads needing attention</span>
            </li>
            <li className="flex items-start gap-2">
              <DollarSign className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
              <span>Budget utilization alerts</span>
            </li>
            <li className="flex items-start gap-2">
              <Zap className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
              <span>Daily refresh for LAN/Expansion campaigns</span>
            </li>
          </ul>
        </div>
        
        <button
          onClick={onStart}
          disabled={isStarting}
          className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        >
          {isStarting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Starting...
            </>
          ) : (
            <>
              <Play className="w-5 h-5" />
              Start Audit
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function SyncStatusBanner({ status, lastSync, onRefresh, isRefreshing, syncFrequency }: {
  status: AuditAccountStatus;
  lastSync?: string;
  onRefresh: () => void;
  isRefreshing: boolean;
  syncFrequency: 'daily' | 'weekly';
}) {
  const isSyncing = status.syncStatus === 'syncing' || status.syncStatus === 'pending';
  const hasError = status.syncStatus === 'error';
  
  return (
    <div className={`rounded-lg p-3 mb-4 flex items-center justify-between ${
      isSyncing ? 'bg-blue-50 border border-blue-200' :
      hasError ? 'bg-red-50 border border-red-200' :
      'bg-green-50 border border-green-200'
    }`}>
      <div className="flex items-center gap-3">
        {isSyncing ? (
          <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
        ) : hasError ? (
          <XCircle className="w-5 h-5 text-red-600" />
        ) : (
          <CheckCircle2 className="w-5 h-5 text-green-600" />
        )}
        <div>
          <p className={`text-sm font-medium ${
            isSyncing ? 'text-blue-800' :
            hasError ? 'text-red-800' :
            'text-green-800'
          }`}>
            {isSyncing ? 'Syncing...' :
             hasError ? 'Sync failed' :
             `${syncFrequency === 'daily' ? 'Daily' : 'Weekly'} sync active`}
          </p>
          {lastSync && !isSyncing && (
            <p className="text-xs text-gray-600">
              Last updated: {formatDate(lastSync)}
            </p>
          )}
          {hasError && status.syncError && (
            <p className="text-xs text-red-600">{status.syncError}</p>
          )}
        </div>
      </div>
      
      <button
        onClick={onRefresh}
        disabled={isSyncing || isRefreshing}
        className="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
        Refresh
      </button>
    </div>
  );
}

type StatusTab = 'needs_attention' | 'mild_issues' | 'performing_well';

export default function AuditPage({ accountId, accountName, isLiveData }: AuditPageProps) {
  const [auditStatus, setAuditStatus] = useState<AuditAccountStatus | null>(null);
  const [data, setData] = useState<AuditData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [comparisonMode, setComparisonMode] = useState<ComparisonMode>('rolling28');
  const [showModeDropdown, setShowModeDropdown] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<CampaignItem | null>(null);
  const [selectedAd, setSelectedAd] = useState<AdItem | null>(null);
  const [activeTab, setActiveTab] = useState<StatusTab>('needs_attention');
  
  const [selectedAdsCampaignId, setSelectedAdsCampaignId] = useState<string | null>(null);
  const [selectedAdsCampaignName, setSelectedAdsCampaignName] = useState<string | null>(null);
  const [scoredAds, setScoredAds] = useState<ScoredAd[]>([]);
  const [campaignAverages, setCampaignAverages] = useState<CampaignAverages | null>(null);
  const [adsLoading, setAdsLoading] = useState(false);
  const [adsError, setAdsError] = useState<string | null>(null);
  const [adsCache, setAdsCache] = useState<Record<string, { ads: ScoredAd[]; averages: CampaignAverages | null }>>({});
  const [selectedScoredAd, setSelectedScoredAd] = useState<ScoredAd | null>(null);
  const [previewAdId, setPreviewAdId] = useState<string | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const checkAuditStatus = useCallback(async () => {
    if (!accountId) return;
    
    try {
      const response = await api.get(`/audit/account/${accountId}`);
      setAuditStatus(response.data);
      return response.data;
    } catch (err) {
      console.error('Failed to check audit status:', err);
      return null;
    }
  }, [accountId]);

  const fetchAuditData = useCallback(async (mode: ComparisonMode = comparisonMode) => {
    if (!accountId) return;
    
    try {
      const response = await api.get(`/audit/data/${accountId}?comparisonMode=${mode}`);
      const rawData = response.data;
      
      setData({
        campaigns: rawData.campaigns || [],
        ads: rawData.ads || [],
        alerts: rawData.alerts || [],
        lastSyncAt: rawData.lastSyncAt,
        syncFrequency: rawData.syncFrequency || 'weekly'
      });
      
    } catch (err: any) {
      if (err.response?.status !== 404) {
        console.error('Failed to fetch audit data:', err);
        setError('Failed to load audit data');
      }
    }
  }, [accountId, comparisonMode]);

  const initialize = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    const status = await checkAuditStatus();
    
    if (status?.optedIn && status?.syncStatus === 'completed') {
      await fetchAuditData();
    }
    
    setLoading(false);
  }, [checkAuditStatus, fetchAuditData]);

  useEffect(() => {
    if (isLiveData && accountId) {
      initialize();
    } else {
      setLoading(false);
    }
  }, [accountId, isLiveData, initialize]);

  useEffect(() => {
    if (!auditStatus?.optedIn) return;
    if (auditStatus.syncStatus !== 'syncing' && auditStatus.syncStatus !== 'pending') return;
    
    const interval = setInterval(async () => {
      const status = await checkAuditStatus();
      if (status?.syncStatus === 'completed') {
        await fetchAuditData();
      }
    }, 3000);
    
    return () => clearInterval(interval);
  }, [auditStatus, checkAuditStatus, fetchAuditData]);

  const handleStartAudit = async () => {
    setIsStarting(true);
    try {
      await api.post(`/audit/start/${accountId}`, { accountName });
      await checkAuditStatus();
    } catch (err) {
      console.error('Failed to start audit:', err);
      setError('Failed to start audit');
    } finally {
      setIsStarting(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await api.post(`/audit/refresh/${accountId}`);
      await checkAuditStatus();
    } catch (err) {
      console.error('Failed to refresh:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSeeAds = async (campaignId: string, campaignName: string) => {
    if (selectedAdsCampaignId === campaignId) {
      setSelectedAdsCampaignId(null);
      setSelectedAdsCampaignName(null);
      setScoredAds([]);
      setCampaignAverages(null);
      return;
    }
    
    setSelectedAdsCampaignId(campaignId);
    setSelectedAdsCampaignName(campaignName);
    setAdsError(null);
    
    if (adsCache[campaignId]) {
      setScoredAds(adsCache[campaignId].ads);
      setCampaignAverages(adsCache[campaignId].averages);
      return;
    }
    
    setAdsLoading(true);
    try {
      const response = await api.get(`/audit/campaign-ads/${accountId}/${campaignId}`);
      const { ads, campaignAverages: avg } = response.data;
      setScoredAds(ads || []);
      setCampaignAverages(avg || null);
      setAdsCache(prev => ({
        ...prev,
        [campaignId]: { ads: ads || [], averages: avg || null }
      }));
    } catch (err: any) {
      console.error('Failed to fetch campaign ads:', err);
      setAdsError('Failed to load ads for this campaign');
      setScoredAds([]);
    } finally {
      setAdsLoading(false);
    }
  };

  const fetchAdPreview = async (adId: string) => {
    if (!accountId) return;
    setPreviewAdId(adId);
    setPreviewHtml(null);
    setPreviewLoading(true);
    
    try {
      const response = await api.get(`/linkedin/account/${accountId}/ad-preview/${adId}`);
      if (response.data?.elements?.[0]?.preview) {
        setPreviewHtml(response.data.elements[0].preview);
      }
    } catch (err) {
      console.error('Failed to fetch ad preview:', err);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleModeChange = async (mode: ComparisonMode) => {
    setComparisonMode(mode);
    setShowModeDropdown(false);
    await fetchAuditData(mode);
  };

  const getComparisonModeLabel = (mode: ComparisonMode) => {
    if (mode === 'rolling28') return 'Rolling 28 days';
    return 'Full month';
  };

  const getComparisonModeDescription = (mode: ComparisonMode) => {
    if (mode === 'rolling28') return 'Last 4 weeks vs previous 4 weeks';
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const twoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    const lastMonthName = lastMonth.toLocaleDateString('en-US', { month: 'short' });
    const twoMonthsAgoName = twoMonthsAgo.toLocaleDateString('en-US', { month: 'short' });
    return `${lastMonthName} vs ${twoMonthsAgoName}`;
  };

  if (!isLiveData) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Connect LinkedIn to View Audit</h3>
          <p className="text-gray-500">Login to enable account auditing and performance tracking.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Loading audit...</p>
        </div>
      </div>
    );
  }

  if (!auditStatus?.optedIn) {
    return (
      <StartAuditView 
        accountName={accountName}
        onStart={handleStartAudit}
        isStarting={isStarting}
      />
    );
  }

  const isSyncing = auditStatus.syncStatus === 'syncing' || auditStatus.syncStatus === 'pending';
  const hasErrorStatus = auditStatus.syncStatus === 'error';

  if (isSyncing && (!data || data.campaigns.length === 0)) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-blue-500 animate-spin mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Syncing Account Data</h3>
          <p className="text-gray-500 mb-2">
            Fetching campaigns, ads, and performance metrics...
          </p>
        </div>
      </div>
    );
  }

  if (hasErrorStatus && (!data || data.campaigns.length === 0)) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Sync Failed</h3>
          <p className="text-gray-500 mb-4">{auditStatus.syncError || 'The sync was interrupted. Please try again.'}</p>
          <button 
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Syncing...' : 'Retry Sync'}
          </button>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Failed to Load</h3>
          <p className="text-gray-500 mb-4">{error}</p>
          <button 
            onClick={handleRefresh}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  // Filter campaigns and ads by status
  const campaignsByStatus = {
    needs_attention: data.campaigns.filter(c => c.scoringStatus === 'needs_attention'),
    mild_issues: data.campaigns.filter(c => c.scoringStatus === 'mild_issues'),
    performing_well: data.campaigns.filter(c => c.scoringStatus === 'performing_well')
  };
  
  const adsByStatus = {
    needs_attention: data.ads.filter(a => a.scoringStatus === 'needs_attention'),
    mild_issues: data.ads.filter(a => a.scoringStatus === 'insufficient_data'), // Map insufficient to mild for display
    performing_well: data.ads.filter(a => a.scoringStatus === 'performing_well')
  };
  
  const otherCampaigns = data.campaigns.filter(c => ['paused', 'low_volume', 'new_campaign'].includes(c.scoringStatus || ''));

  // Get counts for tab badges
  const getCounts = (status: StatusTab) => ({
    campaigns: campaignsByStatus[status].length,
    ads: adsByStatus[status].length
  });

  // Tab styling
  const getTabStyle = (tab: StatusTab) => {
    const isActive = activeTab === tab;
    const baseStyle = 'flex-1 py-3 px-4 text-center font-medium transition-all rounded-lg flex items-center justify-center gap-2';
    
    if (tab === 'needs_attention') {
      return `${baseStyle} ${isActive ? 'bg-red-100 text-red-800 border-2 border-red-300' : 'bg-white text-gray-600 border border-gray-200 hover:bg-red-50'}`;
    }
    if (tab === 'mild_issues') {
      return `${baseStyle} ${isActive ? 'bg-amber-100 text-amber-800 border-2 border-amber-300' : 'bg-white text-gray-600 border border-gray-200 hover:bg-amber-50'}`;
    }
    return `${baseStyle} ${isActive ? 'bg-green-100 text-green-800 border-2 border-green-300' : 'bg-white text-gray-600 border border-gray-200 hover:bg-green-50'}`;
  };

  const getTabIcon = (tab: StatusTab) => {
    if (tab === 'needs_attention') return <XCircle className="w-5 h-5" />;
    if (tab === 'mild_issues') return <AlertTriangle className="w-5 h-5" />;
    return <CheckCircle2 className="w-5 h-5" />;
  };

  const getTabLabel = (tab: StatusTab) => {
    if (tab === 'needs_attention') return 'Needs Attention';
    if (tab === 'mild_issues') return 'Monitor Closely';
    return 'Strong Performance';
  };

  const getEmptyMessage = (tab: StatusTab, type: 'campaigns' | 'ads') => {
    if (tab === 'needs_attention') return `No ${type} need urgent attention`;
    if (tab === 'mild_issues') {
      return type === 'ads' ? 'No ads with insufficient data' : `No ${type} need close monitoring`;
    }
    return `No ${type} with strong performance yet`;
  };

  const currentCampaigns = campaignsByStatus[activeTab];
  const currentAds = adsByStatus[activeTab];

  return (
    <div className="h-full overflow-auto p-6">
      <SyncStatusBanner 
        status={auditStatus}
        lastSync={data.lastSyncAt}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
        syncFrequency={data.syncFrequency}
      />
      
      {/* Alerts Banner (if any) */}
      {data.alerts.length > 0 && (
        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-800">
                {data.alerts.length} alert{data.alerts.length > 1 ? 's' : ''} require attention
              </p>
              <p className="text-xs text-amber-600 mt-1">
                {data.alerts[0].message}
                {data.alerts.length > 1 && ` (+${data.alerts.length - 1} more)`}
              </p>
            </div>
          </div>
        </div>
      )}
      
      {/* Tab Navigation */}
      <div className="flex gap-3 mb-6">
        {(['needs_attention', 'mild_issues', 'performing_well'] as StatusTab[]).map(tab => {
          const counts = getCounts(tab);
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={getTabStyle(tab)}
            >
              {getTabIcon(tab)}
              <span>{getTabLabel(tab)}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                activeTab === tab ? 'bg-white/50' : 'bg-gray-100'
              }`}>
                {counts.campaigns}
              </span>
            </button>
          );
        })}
      </div>

      {/* Two-Column Layout: Campaigns Left, Ads Right */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-8">
        {/* Campaigns Column */}
        <div className={`rounded-lg p-4 border ${
          activeTab === 'needs_attention' ? 'bg-red-50 border-red-100' :
          activeTab === 'mild_issues' ? 'bg-amber-50 border-amber-100' :
          'bg-green-50 border-green-100'
        }`}>
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Target className="w-5 h-5 text-gray-600" />
            Campaigns
            <span className="text-sm font-normal text-gray-500">
              ({currentCampaigns.length})
            </span>
          </h3>
          
          {currentCampaigns.length > 0 ? (
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
              {currentCampaigns.map(campaign => (
                <CampaignCard 
                  key={campaign.id} 
                  campaign={campaign} 
                  accountId={accountId} 
                  showIssues={activeTab !== 'performing_well'} 
                  onClick={() => setSelectedCampaign(campaign)}
                  onSeeAds={() => handleSeeAds(campaign.id, campaign.name)}
                  isAdsSelected={selectedAdsCampaignId === campaign.id}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Target className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">{getEmptyMessage(activeTab, 'campaigns')}</p>
            </div>
          )}
        </div>

        {/* Ads Column - Shows scored ads when a campaign is selected */}
        <div className="rounded-lg p-4 border bg-white border-gray-200">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <MousePointer className="w-5 h-5 text-gray-600" />
              Ads
              {selectedAdsCampaignId && (
                <span className="text-sm font-normal text-gray-500">
                  ({scoredAds.length})
                </span>
              )}
            </h3>
            {selectedAdsCampaignName && (
              <div className="flex items-center justify-between mt-1">
                <p className="text-xs text-blue-600 ml-7">
                  Viewing ads for: <span className="font-medium">{selectedAdsCampaignName}</span>
                </p>
                <button 
                  onClick={() => {
                    setSelectedAdsCampaignId(null);
                    setSelectedAdsCampaignName(null);
                    setScoredAds([]);
                    setCampaignAverages(null);
                  }}
                  className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
                >
                  <X className="w-3 h-3" /> Clear
                </button>
              </div>
            )}
          </div>
          
          {adsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
            </div>
          ) : adsError ? (
            <div className="text-center py-8 text-red-500">
              <AlertTriangle className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">{adsError}</p>
            </div>
          ) : selectedAdsCampaignId ? (
            scoredAds.length > 0 ? (
              <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
                {campaignAverages && (
                  <div className="bg-gray-50 rounded-lg p-3 mb-3 text-xs">
                    <p className="font-medium text-gray-700 mb-2">Campaign Averages</p>
                    <div className="grid grid-cols-4 gap-2 text-center">
                      <div>
                        <p className="font-semibold">{formatCtr(campaignAverages.campaignCtr)}</p>
                        <p className="text-gray-500">CTR</p>
                      </div>
                      <div>
                        <p className="font-semibold">{campaignAverages.campaignDwell ? `${campaignAverages.campaignDwell.toFixed(1)}s` : '-'}</p>
                        <p className="text-gray-500">Dwell</p>
                      </div>
                      <div>
                        <p className="font-semibold">{campaignAverages.campaignCpc ? `$${campaignAverages.campaignCpc.toFixed(2)}` : '-'}</p>
                        <p className="text-gray-500">CPC</p>
                      </div>
                      <div>
                        <p className="font-semibold">{formatNumber(campaignAverages.campaignImpressionsTotal)}</p>
                        <p className="text-gray-500">Impr</p>
                      </div>
                    </div>
                  </div>
                )}
                {scoredAds.map(ad => (
                  <ScoredAdCard 
                    key={ad.adId} 
                    ad={ad} 
                    accountId={accountId}
                    campaignId={selectedAdsCampaignId}
                    onClick={() => setSelectedScoredAd(ad)}
                    onPreview={() => fetchAdPreview(ad.adId)}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <MousePointer className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No ads found for this campaign</p>
              </div>
            )
          ) : (
            <div className="text-center py-12 text-gray-400">
              <MousePointer className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium text-gray-600 mb-1">Select a campaign to view ads</p>
              <p className="text-xs">Click "See Ads" on any campaign card</p>
            </div>
          )}
        </div>
      </div>

      {/* Not Scored Section (collapsed at bottom) */}
      {otherCampaigns.length > 0 && (
        <div className="mt-4 border-t pt-4">
          <details className="group">
            <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700 flex items-center gap-2">
              <Info className="w-4 h-4" />
              {otherCampaigns.length} campaigns not scored (paused, low volume, or new)
              <ChevronDown className="w-4 h-4 group-open:rotate-180 transition-transform" />
            </summary>
            <div className="mt-3 bg-gray-50 rounded-lg p-3 border border-gray-200">
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {otherCampaigns.map(campaign => (
                  <div key={campaign.id} className="flex items-center justify-between text-sm">
                    <span className="text-gray-700 truncate">{campaign.name}</span>
                    <span className="text-xs text-gray-400 capitalize ml-2">
                      {campaign.scoringStatus?.replace('_', ' ')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </details>
        </div>
      )}
      
      {selectedCampaign && (
        <>
          <div className="fixed inset-0 bg-black/20 z-40" onClick={() => setSelectedCampaign(null)} />
          <CampaignDetailSidebar 
            campaign={selectedCampaign} 
            accountId={accountId} 
            onClose={() => setSelectedCampaign(null)} 
          />
        </>
      )}
      
      {selectedScoredAd && selectedAdsCampaignId && (
        <>
          <div className="fixed inset-0 bg-black/20 z-40" onClick={() => setSelectedScoredAd(null)} />
          <ScoredAdDetailSidebar 
            ad={selectedScoredAd} 
            campaignAverages={campaignAverages}
            accountId={accountId}
            campaignId={selectedAdsCampaignId}
            onClose={() => setSelectedScoredAd(null)}
            onPreview={() => fetchAdPreview(selectedScoredAd.adId)}
          />
        </>
      )}
      
      {previewAdId && (
        <AdPreviewModal 
          previewHtml={previewHtml}
          loading={previewLoading}
          onClose={() => {
            setPreviewAdId(null);
            setPreviewHtml(null);
          }}
        />
      )}
      
      {selectedAd && (
        <>
          <div className="fixed inset-0 bg-black/20 z-40" onClick={() => setSelectedAd(null)} />
          <AdDetailSidebar 
            ad={selectedAd} 
            accountId={accountId} 
            onClose={() => setSelectedAd(null)} 
          />
        </>
      )}
    </div>
  );
}
