import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { 
  TrendingUp, 
  TrendingDown, 
  Minus,
  AlertTriangle,
  Loader2,
  Eye,
  MousePointerClick,
  Percent,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Image as ImageIcon,
  Play,
  Database,
  Clock,
  CheckCircle2,
  XCircle,
  BarChart3
} from 'lucide-react';

interface AuditPageProps {
  accountId: string;
  accountName: string;
  isLiveData: boolean;
  onNavigateToCampaign?: (campaignId: string) => void;
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
  latestDataDate?: string;
}

interface CampaignMetrics {
  campaignId: string;
  campaignName: string;
  campaignGroupId?: string;
  campaignStatus?: string;
  impressions: number;
  clicks: number;
  spend: number;
  ctr: number;
  previousMonth: {
    impressions: number;
    clicks: number;
    spend: number;
  };
  previousCtr: number;
  ctrChange: number;
  isUnderperforming: boolean;
}

interface CreativeMetrics {
  creativeId: string;
  creativeName: string;
  campaignId: string;
  creativeStatus?: string;
  creativeType?: string;
  impressions: number;
  clicks: number;
  spend: number;
  ctr: number;
  previousMonth: {
    impressions: number;
    clicks: number;
    spend: number;
  };
  previousCtr: number;
  ctrChange: number;
  isUnderperforming: boolean;
}

interface AuditData {
  campaigns: CampaignMetrics[];
  creatives: CreativeMetrics[];
  currentMonthLabel: string;
  previousMonthLabel: string;
  account: AuditAccountStatus;
}

const CTR_THRESHOLD = 0.4;
const CTR_DROP_THRESHOLD = -20;

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

function ChangeIndicator({ change, isUnderperforming }: { change: number; isUnderperforming: boolean }) {
  if (Math.abs(change) < 0.5) {
    return (
      <span className="flex items-center gap-1 text-gray-500">
        <Minus className="w-3 h-3" />
        <span className="text-xs">No change</span>
      </span>
    );
  }
  
  if (change > 0) {
    return (
      <span className="flex items-center gap-1 text-green-600">
        <TrendingUp className="w-3 h-3" />
        <span className="text-xs font-medium">{formatChange(change)}</span>
      </span>
    );
  }
  
  return (
    <span className={`flex items-center gap-1 ${isUnderperforming ? 'text-red-600' : 'text-orange-500'}`}>
      <TrendingDown className="w-3 h-3" />
      <span className="text-xs font-medium">{formatChange(change)}</span>
    </span>
  );
}

function AdPreviewCard({ creative, accountId }: { creative: CreativeMetrics; accountId: string }) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPreview = async () => {
      try {
        setLoading(true);
        const response = await axios.get(`/api/linkedin/account/${accountId}/ad-preview/${creative.creativeId}`);
        if (response.data?.previewUrl) {
          setPreviewUrl(response.data.previewUrl);
        }
      } catch (err) {
      } finally {
        setLoading(false);
      }
    };
    
    loadPreview();
  }, [creative.creativeId, accountId]);

  return (
    <div className={`bg-white rounded-lg border-2 ${creative.isUnderperforming ? 'border-red-300 ring-2 ring-red-100' : 'border-gray-200'} overflow-hidden`}>
      {creative.isUnderperforming && (
        <div className="bg-red-50 px-3 py-2 flex items-center gap-2 border-b border-red-200">
          <AlertTriangle className="w-4 h-4 text-red-500" />
          <span className="text-xs font-medium text-red-700">Consider replacing - Low CTR</span>
        </div>
      )}
      
      <div className="aspect-video bg-gray-100 relative">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
          </div>
        ) : previewUrl ? (
          <iframe 
            src={previewUrl} 
            className="w-full h-full border-0"
            title={`Ad Preview: ${creative.creativeName}`}
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
            <ImageIcon className="w-8 h-8 mb-2" />
            <span className="text-xs">Preview unavailable</span>
          </div>
        )}
      </div>
      
      <div className="p-3">
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-medium text-gray-900 truncate">{creative.creativeName || `Ad ${creative.creativeId}`}</h4>
            <p className="text-xs text-gray-500 truncate">Campaign {creative.campaignId}</p>
          </div>
          <span className="text-xs px-2 py-0.5 bg-gray-100 rounded text-gray-600 ml-2 flex-shrink-0">
            {creative.creativeType || 'Ad'}
          </span>
        </div>
        
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="flex items-center justify-center gap-1 text-gray-500 mb-1">
              <Eye className="w-3 h-3" />
            </div>
            <p className="text-sm font-medium text-gray-900">{formatNumber(creative.impressions)}</p>
            <p className="text-xs text-gray-500">Impressions</p>
          </div>
          <div>
            <div className="flex items-center justify-center gap-1 text-gray-500 mb-1">
              <MousePointerClick className="w-3 h-3" />
            </div>
            <p className="text-sm font-medium text-gray-900">{formatNumber(creative.clicks)}</p>
            <p className="text-xs text-gray-500">Clicks</p>
          </div>
          <div>
            <div className="flex items-center justify-center gap-1 text-gray-500 mb-1">
              <Percent className="w-3 h-3" />
            </div>
            <p className={`text-sm font-medium ${creative.isUnderperforming ? 'text-red-600' : 'text-gray-900'}`}>
              {formatCtr(creative.ctr)}
            </p>
            <p className="text-xs text-gray-500">CTR</p>
          </div>
        </div>
        
        <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between">
          <span className="text-xs text-gray-500">vs last month</span>
          <ChangeIndicator change={creative.ctrChange} isUnderperforming={creative.isUnderperforming} />
        </div>
      </div>
    </div>
  );
}

function CampaignRow({ campaign }: { campaign: CampaignMetrics }) {
  return (
    <tr className={`${campaign.isUnderperforming ? 'bg-red-50' : 'hover:bg-gray-50'}`}>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{campaign.campaignName}</p>
            {campaign.isUnderperforming && (
              <span className="inline-flex items-center gap-1 text-xs text-red-600 mt-0.5">
                <AlertTriangle className="w-3 h-3" />
                Underperforming
              </span>
            )}
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-right">
        <p className="text-sm text-gray-900">{formatNumber(campaign.impressions)}</p>
        <p className="text-xs text-gray-500">{formatNumber(campaign.previousMonth.impressions)}</p>
      </td>
      <td className="px-4 py-3 text-right">
        <p className="text-sm text-gray-900">{formatNumber(campaign.clicks)}</p>
        <p className="text-xs text-gray-500">{formatNumber(campaign.previousMonth.clicks)}</p>
      </td>
      <td className="px-4 py-3 text-right">
        <p className={`text-sm font-medium ${campaign.isUnderperforming ? 'text-red-600' : 'text-gray-900'}`}>
          {formatCtr(campaign.ctr)}
        </p>
        <p className="text-xs text-gray-500">{formatCtr(campaign.previousCtr)}</p>
      </td>
      <td className="px-4 py-3 text-right">
        <ChangeIndicator change={campaign.ctrChange} isUnderperforming={campaign.isUnderperforming} />
      </td>
    </tr>
  );
}

function StartAuditView({ accountId, accountName, onStart, isStarting }: { 
  accountId: string; 
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
        <h2 className="text-2xl font-bold text-gray-900 mb-3">Start Account Audit</h2>
        <p className="text-gray-600 mb-6">
          Enable auditing for <span className="font-medium">{accountName}</span> to track CTR performance, 
          identify underperforming ads, and store historical data for trend analysis.
        </p>
        
        <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left">
          <h4 className="font-medium text-gray-900 mb-3">What happens when you start:</h4>
          <ul className="space-y-2 text-sm text-gray-600">
            <li className="flex items-start gap-2">
              <Database className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
              <span>Campaign and ad performance data is synced and stored</span>
            </li>
            <li className="flex items-start gap-2">
              <Clock className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
              <span>Historical data is saved for month-over-month comparisons</span>
            </li>
            <li className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
              <span>Underperforming ads are highlighted automatically</span>
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
              Starting Audit...
            </>
          ) : (
            <>
              <Play className="w-5 h-5" />
              Start Audit
            </>
          )}
        </button>
        
        <p className="text-xs text-gray-500 mt-4">
          Only this account will be audited. You can stop at any time.
        </p>
      </div>
    </div>
  );
}

function SyncStatusBanner({ status, lastSync, onRefresh, isRefreshing }: {
  status: AuditAccountStatus;
  lastSync?: string;
  onRefresh: () => void;
  isRefreshing: boolean;
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
            {isSyncing ? 'Syncing data from LinkedIn...' :
             hasError ? 'Sync failed' :
             'Data synced'}
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
  const [showOnlyUnderperforming, setShowOnlyUnderperforming] = useState(false);

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
      
      const campaigns: CampaignMetrics[] = (rawData.campaigns || []).map((c: any) => {
        const isUnderperforming = c.ctr < CTR_THRESHOLD || c.ctrChange < CTR_DROP_THRESHOLD;
        return {
          campaignId: c.campaignId,
          campaignName: c.campaignName || `Campaign ${c.campaignId}`,
          campaignGroupId: c.campaignGroupId,
          campaignStatus: c.campaignStatus,
          impressions: c.impressions || 0,
          clicks: c.clicks || 0,
          spend: c.spend || 0,
          ctr: c.ctr || 0,
          previousMonth: c.previousMonth || { impressions: 0, clicks: 0, spend: 0 },
          previousCtr: c.previousCtr || 0,
          ctrChange: c.ctrChange || 0,
          isUnderperforming
        };
      }).sort((a: CampaignMetrics, b: CampaignMetrics) => {
        if (a.isUnderperforming !== b.isUnderperforming) {
          return a.isUnderperforming ? -1 : 1;
        }
        return b.impressions - a.impressions;
      });
      
      const creatives: CreativeMetrics[] = (rawData.creatives || []).map((c: any) => {
        const isUnderperforming = c.ctr < CTR_THRESHOLD || c.ctrChange < CTR_DROP_THRESHOLD;
        return {
          creativeId: c.creativeId,
          creativeName: c.creativeName || `Creative ${c.creativeId}`,
          campaignId: c.campaignId,
          creativeStatus: c.creativeStatus,
          creativeType: c.creativeType,
          impressions: c.impressions || 0,
          clicks: c.clicks || 0,
          spend: c.spend || 0,
          ctr: c.ctr || 0,
          previousMonth: c.previousMonth || { impressions: 0, clicks: 0, spend: 0 },
          previousCtr: c.previousCtr || 0,
          ctrChange: c.ctrChange || 0,
          isUnderperforming
        };
      }).sort((a: CreativeMetrics, b: CreativeMetrics) => {
        if (a.isUnderperforming !== b.isUnderperforming) {
          return a.isUnderperforming ? -1 : 1;
        }
        return b.impressions - a.impressions;
      });
      
      setData({
        campaigns,
        creatives,
        currentMonthLabel: rawData.currentMonthLabel || 'Current Month',
        previousMonthLabel: rawData.previousMonthLabel || 'Previous Month',
        account: rawData.account
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
          <p className="text-gray-500">Loading audit status...</p>
        </div>
      </div>
    );
  }

  if (!auditStatus?.optedIn) {
    return (
      <StartAuditView 
        accountId={accountId}
        accountName={accountName}
        onStart={handleStartAudit}
        isStarting={isStarting}
      />
    );
  }

  const isSyncing = auditStatus.syncStatus === 'syncing' || auditStatus.syncStatus === 'pending';

  if (isSyncing && (!data || data.campaigns.length === 0)) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-blue-500 animate-spin mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Syncing Account Data</h3>
          <p className="text-gray-500 mb-2">
            Fetching campaigns, ads, and performance metrics from LinkedIn...
          </p>
          <p className="text-xs text-gray-400">
            This may take a minute for large accounts
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Failed to Load Audit Data</h3>
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

  if (!data || data.campaigns.length === 0) {
    return (
      <div className="p-6">
        <SyncStatusBanner 
          status={auditStatus}
          lastSync={auditStatus.lastSyncAt}
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
        />
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Eye className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Performance Data Yet</h3>
            <p className="text-gray-500">
              Data will appear here after campaigns generate impressions.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const underperformingCampaigns = data.campaigns.filter(c => c.isUnderperforming);
  const underperformingCreatives = data.creatives.filter(c => c.isUnderperforming);
  const filteredCampaigns = showOnlyUnderperforming ? underperformingCampaigns : data.campaigns;
  const filteredCreatives = showOnlyUnderperforming ? underperformingCreatives : data.creatives;

  const totalImpressions = data.campaigns.reduce((sum, c) => sum + c.impressions, 0);
  const totalClicks = data.campaigns.reduce((sum, c) => sum + c.clicks, 0);
  const accountCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
  
  const totalPrevImpressions = data.campaigns.reduce((sum, c) => sum + c.previousMonth.impressions, 0);
  const totalPrevClicks = data.campaigns.reduce((sum, c) => sum + c.previousMonth.clicks, 0);
  const prevAccountCtr = totalPrevImpressions > 0 ? (totalPrevClicks / totalPrevImpressions) * 100 : 0;
  const accountCtrChange = prevAccountCtr > 0 ? ((accountCtr - prevAccountCtr) / prevAccountCtr) * 100 : 0;

  return (
    <div className="h-full overflow-auto p-6">
      <SyncStatusBanner 
        status={auditStatus}
        lastSync={auditStatus.lastSyncAt}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
      />
      
      <div className="space-y-6 pb-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-2 text-gray-500 mb-2">
              <Eye className="w-4 h-4" />
              <span className="text-sm">Total Impressions</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {formatNumber(totalImpressions)}
            </p>
            <p className="text-xs text-gray-500 mt-1">{data.currentMonthLabel}</p>
          </div>
          
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-2 text-gray-500 mb-2">
              <MousePointerClick className="w-4 h-4" />
              <span className="text-sm">Total Clicks</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {formatNumber(totalClicks)}
            </p>
            <p className="text-xs text-gray-500 mt-1">{data.currentMonthLabel}</p>
          </div>
          
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-2 text-gray-500 mb-2">
              <Percent className="w-4 h-4" />
              <span className="text-sm">Account CTR</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {formatCtr(accountCtr)}
            </p>
            <div className="mt-1">
              <ChangeIndicator change={accountCtrChange} isUnderperforming={false} />
            </div>
          </div>
          
          <div className={`rounded-lg border-2 p-4 ${underperformingCreatives.length > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className={`w-4 h-4 ${underperformingCreatives.length > 0 ? 'text-red-500' : 'text-green-500'}`} />
              <span className="text-sm text-gray-700">Ads to Review</span>
            </div>
            <p className={`text-2xl font-bold ${underperformingCreatives.length > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {underperformingCreatives.length}
            </p>
            <p className="text-xs text-gray-600 mt-1">
              {underperformingCreatives.length > 0 ? 'Need attention' : 'All performing well'}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Campaign Performance</h3>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showOnlyUnderperforming}
              onChange={(e) => setShowOnlyUnderperforming(e.target.checked)}
              className="rounded border-gray-300 text-red-600 focus:ring-red-500"
            />
            <span className="text-sm text-gray-600">
              Show only underperforming ({underperformingCampaigns.length})
            </span>
          </label>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Campaign</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Impressions</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Clicks</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">CTR</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Change</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredCampaigns.map(campaign => (
                <CampaignRow key={campaign.campaignId} campaign={campaign} />
              ))}
            </tbody>
          </table>
          
          {filteredCampaigns.length === 0 && (
            <div className="p-8 text-center text-gray-500">
              No {showOnlyUnderperforming ? 'underperforming ' : ''}campaigns found
            </div>
          )}
        </div>

        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Ad Creative Performance</h3>
            <p className="text-sm text-gray-500">
              Ads with CTR below {CTR_THRESHOLD}% or more than {Math.abs(CTR_DROP_THRESHOLD)}% decline are highlighted
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredCreatives.map(creative => (
            <AdPreviewCard key={creative.creativeId} creative={creative} accountId={accountId} />
          ))}
        </div>
        
        {filteredCreatives.length === 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
            No {showOnlyUnderperforming ? 'underperforming ' : ''}ads found
          </div>
        )}
      </div>
    </div>
  );
}
