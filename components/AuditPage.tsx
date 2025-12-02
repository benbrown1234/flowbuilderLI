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
  Info
} from 'lucide-react';

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

interface CampaignItem {
  id: string;
  name: string;
  ctr: number;
  ctrChange: number;
  impressions: number;
  clicks: number;
  spend: number;
  dailyBudget?: number;
  budgetUtilization?: number;
  currentWeekSpend?: number;
  previousWeekSpend?: number;
  spendChange?: number;
  hasLan?: boolean;
  hasExpansion?: boolean;
  audiencePenetration?: number;
  isPerformingWell: boolean;
  issues: string[];
}

interface AdItem {
  id: string;
  name: string;
  campaignId: string;
  campaignName: string;
  ctr: number;
  ctrChange: number;
  dwellTime?: number;
  dwellTimeChange?: number;
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
      
      {(campaign.hasLan || campaign.hasExpansion) && (
        <div className="flex items-center gap-2 text-blue-600 text-xs bg-blue-50 rounded px-2 py-1 mb-2">
          <Zap className="w-3 h-3" />
          <span>{campaign.hasLan ? 'LAN' : ''}{campaign.hasLan && campaign.hasExpansion ? ' + ' : ''}{campaign.hasExpansion ? 'Expansion' : ''} enabled</span>
        </div>
      )}
      
      {showIssues && campaign.issues.length > 0 && (
        <div className="mt-2 pt-2 border-t border-red-100 space-y-1">
          {campaign.issues.map((issue, idx) => (
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
          <p className="text-lg font-semibold text-gray-900">{ad.dwellTime ? `${ad.dwellTime.toFixed(1)}s` : '-'}</p>
          <p className="text-xs text-gray-500">Dwell Time</p>
        </div>
        <div>
          <p className="text-lg font-semibold text-gray-900">{formatNumber(ad.clicks)}</p>
          <p className="text-xs text-gray-500">Clicks</p>
        </div>
      </div>
      
      {ad.dwellTimeChange !== undefined && Math.abs(ad.dwellTimeChange) > 0.5 && (
        <div className={`flex items-center gap-2 text-xs rounded px-2 py-1 mb-2 ${ad.dwellTimeChange > 0 ? 'text-green-600 bg-green-50' : 'text-amber-600 bg-amber-50'}`}>
          <Clock className="w-3 h-3" />
          <span>Dwell time {ad.dwellTimeChange > 0 ? 'up' : 'down'} {formatChange(ad.dwellTimeChange)}</span>
        </div>
      )}
      
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

  const fetchAuditData = useCallback(async () => {
    if (!accountId) return;
    
    try {
      const response = await axios.get(`/api/audit/data/${accountId}`);
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
  }, [accountId]);

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

  const performingWellCampaigns = data.campaigns.filter(c => c.isPerformingWell);
  const needsAttentionCampaigns = data.campaigns.filter(c => !c.isPerformingWell);
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
      
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-4 flex items-start gap-2">
        <Info className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-gray-600">
          Note: LinkedIn Audience Network (LAN) and Audience Expansion settings are not available via the LinkedIn API. 
          Budget alerts flag campaigns spending less than 80% of their daily budget over the previous week.
        </p>
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              Performing Well
              <span className="text-sm font-normal text-gray-500">
                ({performingWellCampaigns.length} campaigns, {performingWellAds.length} ads)
              </span>
            </h3>
            
            {performingWellCampaigns.length > 0 && (
              <div className="mb-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Campaigns</h4>
                <div className="space-y-3">
                  {performingWellCampaigns.slice(0, 5).map(campaign => (
                    <CampaignCard key={campaign.id} campaign={campaign} accountId={accountId} showIssues={false} />
                  ))}
                </div>
              </div>
            )}
            
            {performingWellAds.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">Ads</h4>
                <div className="space-y-3">
                  {performingWellAds.slice(0, 5).map(ad => (
                    <AdCard key={ad.id} ad={ad} accountId={accountId} showIssues={false} />
                  ))}
                </div>
              </div>
            )}
            
            {performingWellCampaigns.length === 0 && performingWellAds.length === 0 && (
              <p className="text-gray-500 text-sm">No campaigns or ads performing well this period.</p>
            )}
          </div>

          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              Needs Attention
              <span className="text-sm font-normal text-gray-500">
                ({needsAttentionCampaigns.length} campaigns, {needsAttentionAds.length} ads)
              </span>
            </h3>
            
            {needsAttentionCampaigns.length > 0 && (
              <div className="mb-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Campaigns</h4>
                <div className="space-y-3">
                  {needsAttentionCampaigns.map(campaign => (
                    <CampaignCard key={campaign.id} campaign={campaign} accountId={accountId} showIssues={true} />
                  ))}
                </div>
              </div>
            )}
            
            {needsAttentionAds.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">Ads</h4>
                <div className="space-y-3">
                  {needsAttentionAds.map(ad => (
                    <AdCard key={ad.id} ad={ad} accountId={accountId} showIssues={true} />
                  ))}
                </div>
              </div>
            )}
            
            {needsAttentionCampaigns.length === 0 && needsAttentionAds.length === 0 && (
              <p className="text-gray-500 text-sm">All campaigns and ads are performing well!</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
