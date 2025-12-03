import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
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
  dailyBudget?: number;
  avgDailySpend?: number;
  budgetUtilization?: number;
  currentWeekSpend?: number;
  previousWeekSpend?: number;
  currentWeekDays?: number;
  previousWeekDays?: number;
  spendChange?: number;
  hasLan?: boolean;
  hasExpansion?: boolean;
  hasMaximizeDelivery?: boolean;
  hasUnderspending?: boolean;
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
}

type AdScoringStatus = 'needs_attention' | 'performing_well' | 'insufficient_data';

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
  averageDwellTime?: number | null;
  dwellTimeChange?: number | null;
  scoringStatus?: AdScoringStatus;
  isPerformingWell: boolean;
  issues: string[];
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

function CampaignCard({ campaign, accountId, showIssues, onClick }: { campaign: CampaignItem; accountId: string; showIssues: boolean; onClick?: () => void }) {
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
        <PerformanceIndicator change={campaign.ctrChange} isPositive={campaign.ctrChange > 0} />
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
      
      {(campaign.hasLan || campaign.hasExpansion || campaign.hasMaximizeDelivery || campaign.hasUnderspending) && (
        <div className="flex items-center gap-2 flex-wrap mb-2">
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
      
      {showIssues && campaign.issues.length > 0 && (
        <div className={`mt-2 pt-2 border-t ${getIssueBorderColor()} space-y-1`}>
          {campaign.issues.map((issue, idx) => (
            <div key={idx} className={`flex items-center gap-2 ${getIssueTextColor()} text-xs`}>
              <AlertTriangle className="w-3 h-3 flex-shrink-0" />
              <span>{issue}</span>
            </div>
          ))}
        </div>
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
      return <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 rounded text-xs font-medium"><AlertTriangle className="w-3 h-3" /> Mild Issues</span>;
    }
    return <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium"><CheckCircle2 className="w-3 h-3" /> Performing Well</span>;
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
            {campaign.score !== undefined && (
              <span className="text-xs text-gray-500">Score: {campaign.score}</span>
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
        
        {/* Score Breakdown */}
        {(campaign.negativeScore !== undefined || campaign.positiveScore !== undefined) && (
          <div className="bg-gray-100 rounded-lg p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Score Breakdown</span>
              <span className="font-medium">
                <span className="text-red-600">{campaign.negativeScore || 0}</span>
                {(campaign.positiveScore || 0) > 0 && (
                  <span className="text-green-600 ml-1">+{campaign.positiveScore}</span>
                )}
                <span className="text-gray-900 ml-2">= {campaign.score}</span>
              </span>
            </div>
          </div>
        )}
        
        {campaign.issues.length > 0 && (
          <div className="bg-red-50 rounded-lg p-4 border border-red-100">
            <h5 className="font-medium text-red-800 mb-2 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> Issues Detected
            </h5>
            <ul className="space-y-1">
              {campaign.issues.map((issue, idx) => (
                <li key={idx} className="text-sm text-red-700 flex items-start gap-2">
                  <span className="text-red-400 mt-1">•</span> {issue}
                </li>
              ))}
            </ul>
          </div>
        )}
        
        {campaign.positiveSignals && campaign.positiveSignals.length > 0 && (
          <div className="bg-green-50 rounded-lg p-4 border border-green-100">
            <h5 className="font-medium text-green-800 mb-2 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> Positive Signals
            </h5>
            <ul className="space-y-1">
              {campaign.positiveSignals.map((signal, idx) => (
                <li key={idx} className="text-sm text-green-700 flex items-start gap-2">
                  <span className="text-green-400 mt-1">•</span> {signal}
                </li>
              ))}
            </ul>
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
            <Eye className="w-4 h-4" /> Volume Metrics
          </h5>
          <div className="bg-gray-50 rounded-lg p-3">
            <MetricRow 
              label="Impressions" 
              current={campaign.impressions} 
              previous={undefined}
              change={undefined} 
              isPositive={true}
            />
            <MetricRow 
              label="Clicks" 
              current={campaign.clicks} 
              previous={undefined}
              change={undefined} 
              isPositive={true}
            />
            <MetricRow 
              label="Spend" 
              current={campaign.spend} 
              previous={undefined}
              change={undefined} 
              isPositive={true}
              format="currency"
            />
          </div>
        </div>
        
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
        
        {/* Scoring Inputs - All Assessed Metrics (from backend) */}
        <div>
          <h5 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
            <Info className="w-4 h-4" /> Scoring Inputs (All Assessed Metrics)
          </h5>
          <div className="bg-slate-50 rounded-lg p-3 text-xs space-y-1 border border-slate-200">
            {/* Volume Filters first */}
            <div className="space-y-1 pb-2 border-b border-slate-200">
              <div className="font-medium text-slate-700">Volume Filters</div>
              <div className="flex justify-between">
                <span className="text-slate-500">Impressions</span>
                <span className={campaign.impressions < 1000 ? 'text-amber-600 font-medium' : 'text-slate-700'}>
                  {campaign.impressions.toLocaleString()} {campaign.impressions < 1000 ? '(excluded)' : '✓'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Spend</span>
                <span className={campaign.spend < 20 ? 'text-amber-600 font-medium' : 'text-slate-700'}>
                  ${campaign.spend.toFixed(2)} {campaign.spend < 20 ? '(excluded)' : '✓'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Active Days</span>
                <span className={(campaign.currentWeekDays || 0) < 3 ? 'text-amber-600 font-medium' : 'text-slate-700'}>
                  {campaign.currentWeekDays || 0} days {(campaign.currentWeekDays || 0) < 3 ? '(excluded)' : '✓'}
                </span>
              </div>
            </div>
            
            {/* Actual Scoring Breakdown from Backend */}
            {campaign.scoringBreakdown && campaign.scoringBreakdown.length > 0 ? (
              <div className="space-y-1 py-2">
                <div className="font-medium text-slate-700 pb-1">Per-Metric Contributions</div>
                <div className="grid grid-cols-1 gap-1">
                  {campaign.scoringBreakdown.map((item, idx) => (
                    <div key={idx} className={`flex justify-between py-1 ${item.applied ? 'bg-slate-100 rounded px-1' : ''}`}>
                      <div className="flex-1">
                        <span className={item.applied ? 'font-medium text-slate-800' : 'text-slate-500'}>
                          {item.metric}
                        </span>
                        <span className="text-slate-400 ml-1 text-[10px]">({item.threshold})</span>
                      </div>
                      <div className="text-right flex items-center gap-2">
                        <span className="text-slate-600">{item.value}</span>
                        {item.contribution !== 0 ? (
                          <span className={`font-bold min-w-[30px] text-right ${
                            item.contribution > 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {item.contribution > 0 ? '+' : ''}{item.contribution}
                          </span>
                        ) : (
                          <span className="text-slate-400 min-w-[30px] text-right">0</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="py-2 text-slate-400 italic">
                {campaign.scoringStatus === 'paused' ? 'Campaign is paused - not scored' :
                 campaign.scoringStatus === 'low_volume' ? 'Low volume - not enough data for scoring' :
                 'No scoring breakdown available'}
              </div>
            )}
            
            {/* Final Summary */}
            <div className="space-y-1 pt-2 border-t border-slate-300">
              <div className="font-medium text-slate-700">Final Score</div>
              <div className="flex justify-between">
                <span className="text-slate-500">Negative Total</span>
                <span className="text-red-600 font-medium">{campaign.negativeScore || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Positive Total</span>
                <span className="text-green-600 font-medium">
                  +{campaign.positiveScore || 0}
                  {campaign.hasHardFailure && campaign.rawPositiveScore && campaign.rawPositiveScore > 0 && (
                    <span className="text-slate-400 text-[10px] ml-1">(raw +{campaign.rawPositiveScore} disabled)</span>
                  )}
                  {!campaign.hasHardFailure && campaign.rawPositiveScore && campaign.rawPositiveScore > 2 && (
                    <span className="text-slate-400 text-[10px] ml-1">(raw +{campaign.rawPositiveScore} capped)</span>
                  )}
                </span>
              </div>
              <div className="flex justify-between font-medium">
                <span className="text-slate-700">Combined Score</span>
                <span className={`font-bold ${
                  (campaign.score || 0) <= -3 ? 'text-red-600' :
                  (campaign.score || 0) < 0 ? 'text-amber-600' : 'text-green-600'
                }`}>
                  {campaign.score || 0}
                </span>
              </div>
              <div className="text-slate-400 italic text-[10px] pt-1">
                Tiers: ≤-3 Needs Attention | &lt;0 Mild Issues | ≥0 Performing Well
              </div>
            </div>
          </div>
        </div>
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
    if (ad.scoringStatus === 'insufficient_data') {
      return <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-medium"><Info className="w-3 h-3" /> Insufficient Data</span>;
    }
    return <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium"><CheckCircle2 className="w-3 h-3" /> Performing Well</span>;
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
        
        <div className="text-xs text-gray-500 bg-gray-50 rounded-lg p-3">
          <p className="font-medium mb-1">Scoring Criteria:</p>
          <ul className="space-y-1">
            <li>• CTR decline &gt;20% from previous 4 weeks</li>
            <li>• Conversion rate decline &gt;20% (if 3+ conversions)</li>
            <li>• Minimum 500 impressions and 10 clicks required</li>
          </ul>
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

  const checkAuditStatus = useCallback(async () => {
    if (!accountId) return;
    
    try {
      const response = await axios.get(`/api/audit/account/${accountId}`);
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
      const response = await axios.get(`/api/audit/data/${accountId}?comparisonMode=${mode}`);
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
      await axios.post(`/api/audit/start/${accountId}`, { accountName });
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
      await axios.post(`/api/audit/refresh/${accountId}`);
      await checkAuditStatus();
    } catch (err) {
      console.error('Failed to refresh:', err);
    } finally {
      setIsRefreshing(false);
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
    if (tab === 'mild_issues') return 'Mild Issues';
    return 'Performing Well';
  };

  const getEmptyMessage = (tab: StatusTab, type: 'campaigns' | 'ads') => {
    if (tab === 'needs_attention') return `No ${type} need urgent attention`;
    if (tab === 'mild_issues') {
      return type === 'ads' ? 'No ads with insufficient data' : `No ${type} with mild issues`;
    }
    return `No ${type} performing well yet`;
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
                {counts.campaigns + counts.ads}
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

        {/* Ads Column */}
        <div className={`rounded-lg p-4 border ${
          activeTab === 'needs_attention' ? 'bg-red-50 border-red-100' :
          activeTab === 'mild_issues' ? 'bg-amber-50 border-amber-100' :
          'bg-green-50 border-green-100'
        }`}>
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <MousePointer className="w-5 h-5 text-gray-600" />
              Ads
              <span className="text-sm font-normal text-gray-500">
                ({currentAds.length})
              </span>
            </h3>
            {activeTab === 'mild_issues' && currentAds.length > 0 && (
              <p className="text-xs text-gray-500 mt-1 ml-7">Insufficient data for scoring</p>
            )}
          </div>
          
          {currentAds.length > 0 ? (
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
              {currentAds.map(ad => (
                <AdCard 
                  key={ad.id} 
                  ad={ad} 
                  accountId={accountId} 
                  showIssues={activeTab !== 'performing_well'} 
                  onClick={() => setSelectedAd(ad)} 
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <MousePointer className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">{getEmptyMessage(activeTab, 'ads')}</p>
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
