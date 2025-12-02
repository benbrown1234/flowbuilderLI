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
  ChevronDown
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
  score?: number;
  scoringStatus?: ScoringStatus;
  isPerformingWell: boolean;
  issues: string[];
  flags?: string[];
}

interface AdItem {
  id: string;
  name: string;
  campaignId: string;
  campaignName: string;
  ctr: number;
  ctrChange: number;
  conversions?: number;
  cvr?: number;
  cvrChange?: number;
  impressions: number;
  clicks: number;
  isPerformingWell: boolean;
  issues: string[];
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

function PerformanceIndicator({ change, isPositive }: { change: number; isPositive: boolean }) {
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

function CampaignCard({ campaign, accountId, showIssues }: { campaign: CampaignItem; accountId: string; showIssues: boolean }) {
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
    <div className={`bg-white rounded-lg border ${getBorderColor()} p-4`}>
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
          <p className="text-lg font-semibold text-gray-900">{formatCtr(campaign.ctr)}</p>
          <p className="text-xs text-gray-500">CTR</p>
        </div>
        <div>
          <p className="text-lg font-semibold text-gray-900">{formatNumber(campaign.impressions)}</p>
          <p className="text-xs text-gray-500">Impressions</p>
        </div>
        <div>
          <p className="text-lg font-semibold text-gray-900">${formatNumber(campaign.spend)}</p>
          <p className="text-xs text-gray-500">Spend</p>
        </div>
      </div>
      
      {(campaign.hasLan || campaign.hasExpansion || campaign.hasMaximizeDelivery) && (
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

function AdCard({ ad, accountId, showIssues }: { ad: AdItem; accountId: string; showIssues: boolean }) {
  const linkedInUrl = getLinkedInAdUrl(accountId, ad.campaignId, ad.id);
  
  return (
    <div className={`bg-white rounded-lg border ${showIssues ? 'border-red-200' : 'border-green-200'} p-4`}>
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

export default function AuditPage({ accountId, accountName, isLiveData }: AuditPageProps) {
  const [auditStatus, setAuditStatus] = useState<AuditAccountStatus | null>(null);
  const [data, setData] = useState<AuditData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [comparisonMode, setComparisonMode] = useState<ComparisonMode>('rolling28');
  const [showModeDropdown, setShowModeDropdown] = useState(false);

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

  const performingWellCampaigns = data.campaigns.filter(c => c.scoringStatus === 'performing_well');
  const mildIssuesCampaigns = data.campaigns.filter(c => c.scoringStatus === 'mild_issues');
  const needsAttentionCampaigns = data.campaigns.filter(c => c.scoringStatus === 'needs_attention');
  const otherCampaigns = data.campaigns.filter(c => ['paused', 'low_volume', 'new_campaign'].includes(c.scoringStatus || ''));
  const performingWellAds = data.ads.filter(a => a.isPerformingWell);
  const needsAttentionAds = data.ads.filter(a => !a.isPerformingWell);

  return (
    <div className="h-full overflow-auto p-6">
      <SyncStatusBanner 
        status={auditStatus}
        lastSync={data.lastSyncAt}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
        syncFrequency={data.syncFrequency}
      />
      
      <div className="flex items-center justify-between mb-4">
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 flex items-start gap-2 flex-1 mr-4">
          <Info className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-gray-600">
            Budget alerts flag campaigns spending less than 80% of their daily budget (requires 7 days of activity).
          </p>
        </div>
        
        <div className="relative">
          <button
            onClick={() => setShowModeDropdown(!showModeDropdown)}
            className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
          >
            <Calendar className="w-4 h-4 text-gray-500" />
            <span className="font-medium">{getComparisonModeLabel(comparisonMode)}</span>
            <span className="text-gray-500 text-xs">({getComparisonModeDescription(comparisonMode)})</span>
            <ChevronDown className="w-4 h-4 text-gray-400" />
          </button>
          
          {showModeDropdown && (
            <div className="absolute right-0 mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
              <button
                onClick={() => handleModeChange('rolling28')}
                className={`w-full px-4 py-3 text-left hover:bg-gray-50 first:rounded-t-lg ${comparisonMode === 'rolling28' ? 'bg-blue-50' : ''}`}
              >
                <div className="font-medium text-sm">Rolling 28 days</div>
                <div className="text-xs text-gray-500">Last 4 weeks vs previous 4 weeks</div>
              </button>
              <button
                onClick={() => handleModeChange('fullMonth')}
                className={`w-full px-4 py-3 text-left hover:bg-gray-50 last:rounded-b-lg border-t border-gray-100 ${comparisonMode === 'fullMonth' ? 'bg-blue-50' : ''}`}
              >
                <div className="font-medium text-sm">Full month</div>
                <div className="text-xs text-gray-500">{getComparisonModeDescription('fullMonth')}</div>
              </button>
            </div>
          )}
        </div>
      </div>
      
      <div className="space-y-8 pb-8">
        {data.alerts.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Alerts
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {data.alerts.slice(0, 6).map((alert, idx) => (
                <AlertCard key={idx} alert={alert} accountId={accountId} />
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Needs Attention - Red */}
          <div className="bg-red-50 rounded-lg p-4 border border-red-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <XCircle className="w-5 h-5 text-red-500" />
              Needs Attention
              <span className="text-sm font-normal text-gray-500">
                ({needsAttentionCampaigns.length})
              </span>
            </h3>
            
            {needsAttentionCampaigns.length > 0 ? (
              <div className="space-y-3">
                {needsAttentionCampaigns.map(campaign => (
                  <CampaignCard key={campaign.id} campaign={campaign} accountId={accountId} showIssues={true} />
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">No campaigns need urgent attention.</p>
            )}
          </div>

          {/* Mild Issues - Amber */}
          <div className="bg-amber-50 rounded-lg p-4 border border-amber-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Mild Issues
              <span className="text-sm font-normal text-gray-500">
                ({mildIssuesCampaigns.length})
              </span>
            </h3>
            
            {mildIssuesCampaigns.length > 0 ? (
              <div className="space-y-3">
                {mildIssuesCampaigns.map(campaign => (
                  <CampaignCard key={campaign.id} campaign={campaign} accountId={accountId} showIssues={true} />
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">No campaigns with mild issues.</p>
            )}
          </div>

          {/* Performing Well - Green */}
          <div className="bg-green-50 rounded-lg p-4 border border-green-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              Performing Well
              <span className="text-sm font-normal text-gray-500">
                ({performingWellCampaigns.length})
              </span>
            </h3>
            
            {performingWellCampaigns.length > 0 ? (
              <div className="space-y-3">
                {performingWellCampaigns.slice(0, 5).map(campaign => (
                  <CampaignCard key={campaign.id} campaign={campaign} accountId={accountId} showIssues={false} />
                ))}
                {performingWellCampaigns.length > 5 && (
                  <p className="text-sm text-gray-500 text-center">+{performingWellCampaigns.length - 5} more</p>
                )}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">No campaigns performing well yet.</p>
            )}
          </div>
        </div>

        {/* Ads Section */}
        {(needsAttentionAds.length > 0 || performingWellAds.length > 0) && (
          <div className="mt-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Ad Performance</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {needsAttentionAds.length > 0 && (
                <div className="bg-red-50 rounded-lg p-4 border border-red-100">
                  <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                    <XCircle className="w-4 h-4 text-red-500" />
                    Ads Needing Attention ({needsAttentionAds.length})
                  </h4>
                  <div className="space-y-3">
                    {needsAttentionAds.slice(0, 5).map(ad => (
                      <AdCard key={ad.id} ad={ad} accountId={accountId} showIssues={true} />
                    ))}
                  </div>
                </div>
              )}
              
              {performingWellAds.length > 0 && (
                <div className="bg-green-50 rounded-lg p-4 border border-green-100">
                  <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    Ads Performing Well ({performingWellAds.length})
                  </h4>
                  <div className="space-y-3">
                    {performingWellAds.slice(0, 5).map(ad => (
                      <AdCard key={ad.id} ad={ad} accountId={accountId} showIssues={false} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Other Campaigns (Paused, Low Volume, New) */}
        {otherCampaigns.length > 0 && (
          <div className="mt-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Info className="w-5 h-5 text-gray-400" />
              Not Scored
              <span className="text-sm font-normal text-gray-500">
                ({otherCampaigns.length} campaigns)
              </span>
            </h3>
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <div className="space-y-2">
                {otherCampaigns.slice(0, 5).map(campaign => (
                  <div key={campaign.id} className="flex items-center justify-between text-sm">
                    <span className="text-gray-700">{campaign.name}</span>
                    <span className="text-gray-500 capitalize">
                      {campaign.scoringStatus === 'low_volume' ? 'Low volume' : 
                       campaign.scoringStatus === 'new_campaign' ? 'New campaign' : 'Paused'}
                    </span>
                  </div>
                ))}
                {otherCampaigns.length > 5 && (
                  <p className="text-sm text-gray-500 text-center">+{otherCampaigns.length - 5} more</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
