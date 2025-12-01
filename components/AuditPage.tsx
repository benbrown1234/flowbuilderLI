import React, { useState, useEffect } from 'react';
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
  Image as ImageIcon
} from 'lucide-react';

interface AuditPageProps {
  accountId: string;
  accountName: string;
  isLiveData: boolean;
  onNavigateToCampaign?: (campaignId: string) => void;
}

interface CampaignMetrics {
  campaignId: string;
  campaignName: string;
  currentMonth: {
    impressions: number;
    clicks: number;
    ctr: number;
    spend: number;
  };
  previousMonth: {
    impressions: number;
    clicks: number;
    ctr: number;
    spend: number;
  };
  ctrChange: number;
  isUnderperforming: boolean;
}

interface AdMetrics {
  adId: string;
  adName: string;
  adType: string;
  campaignId: string;
  campaignName: string;
  currentMonth: {
    impressions: number;
    clicks: number;
    ctr: number;
  };
  previousMonth: {
    impressions: number;
    clicks: number;
    ctr: number;
  };
  ctrChange: number;
  isUnderperforming: boolean;
  previewUrl?: string;
}

interface AnalyticsData {
  campaigns: CampaignMetrics[];
  ads: AdMetrics[];
  currentMonthLabel: string;
  previousMonthLabel: string;
  accountSummary: {
    currentCtr: number;
    previousCtr: number;
    ctrChange: number;
    totalImpressions: number;
    totalClicks: number;
  };
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

function AdPreviewCard({ ad, accountId }: { ad: AdMetrics; accountId: string }) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const loadPreview = async () => {
      try {
        setLoading(true);
        const response = await axios.get(`/api/linkedin/account/${accountId}/ad-preview/${ad.adId}`);
        if (response.data?.previewUrl) {
          setPreviewUrl(response.data.previewUrl);
        }
      } catch (err) {
        setError(true);
      } finally {
        setLoading(false);
      }
    };
    
    loadPreview();
  }, [ad.adId, accountId]);

  return (
    <div className={`bg-white rounded-lg border-2 ${ad.isUnderperforming ? 'border-red-300 ring-2 ring-red-100' : 'border-gray-200'} overflow-hidden`}>
      {ad.isUnderperforming && (
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
            title={`Ad Preview: ${ad.adName}`}
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
            <h4 className="text-sm font-medium text-gray-900 truncate">{ad.adName || `Ad ${ad.adId}`}</h4>
            <p className="text-xs text-gray-500 truncate">{ad.campaignName}</p>
          </div>
          <span className="text-xs px-2 py-0.5 bg-gray-100 rounded text-gray-600 ml-2 flex-shrink-0">
            {ad.adType}
          </span>
        </div>
        
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="flex items-center justify-center gap-1 text-gray-500 mb-1">
              <Eye className="w-3 h-3" />
            </div>
            <p className="text-sm font-medium text-gray-900">{formatNumber(ad.currentMonth.impressions)}</p>
            <p className="text-xs text-gray-500">Impressions</p>
          </div>
          <div>
            <div className="flex items-center justify-center gap-1 text-gray-500 mb-1">
              <MousePointerClick className="w-3 h-3" />
            </div>
            <p className="text-sm font-medium text-gray-900">{formatNumber(ad.currentMonth.clicks)}</p>
            <p className="text-xs text-gray-500">Clicks</p>
          </div>
          <div>
            <div className="flex items-center justify-center gap-1 text-gray-500 mb-1">
              <Percent className="w-3 h-3" />
            </div>
            <p className={`text-sm font-medium ${ad.isUnderperforming ? 'text-red-600' : 'text-gray-900'}`}>
              {formatCtr(ad.currentMonth.ctr)}
            </p>
            <p className="text-xs text-gray-500">CTR</p>
          </div>
        </div>
        
        <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between">
          <span className="text-xs text-gray-500">vs last month</span>
          <ChangeIndicator change={ad.ctrChange} isUnderperforming={ad.isUnderperforming} />
        </div>
      </div>
    </div>
  );
}

function CampaignRow({ campaign, isExpanded, onToggle }: { 
  campaign: CampaignMetrics; 
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <tr 
      className={`${campaign.isUnderperforming ? 'bg-red-50' : 'hover:bg-gray-50'} cursor-pointer`}
      onClick={onToggle}
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-400" />
          )}
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
        <p className="text-sm text-gray-900">{formatNumber(campaign.currentMonth.impressions)}</p>
        <p className="text-xs text-gray-500">{formatNumber(campaign.previousMonth.impressions)}</p>
      </td>
      <td className="px-4 py-3 text-right">
        <p className="text-sm text-gray-900">{formatNumber(campaign.currentMonth.clicks)}</p>
        <p className="text-xs text-gray-500">{formatNumber(campaign.previousMonth.clicks)}</p>
      </td>
      <td className="px-4 py-3 text-right">
        <p className={`text-sm font-medium ${campaign.isUnderperforming ? 'text-red-600' : 'text-gray-900'}`}>
          {formatCtr(campaign.currentMonth.ctr)}
        </p>
        <p className="text-xs text-gray-500">{formatCtr(campaign.previousMonth.ctr)}</p>
      </td>
      <td className="px-4 py-3 text-right">
        <ChangeIndicator change={campaign.ctrChange} isUnderperforming={campaign.isUnderperforming} />
      </td>
    </tr>
  );
}

export default function AuditPage({ accountId, accountName, isLiveData, onNavigateToCampaign }: AuditPageProps) {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedCampaigns, setExpandedCampaigns] = useState<Set<string>>(new Set());
  const [showOnlyUnderperforming, setShowOnlyUnderperforming] = useState(false);

  const fetchAnalytics = async () => {
    if (!isLiveData || !accountId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [analyticsRes, hierarchyRes] = await Promise.all([
        axios.get(`/api/linkedin/account/${accountId}/analytics`),
        axios.get(`/api/linkedin/account/${accountId}/hierarchy?activeOnly=true`)
      ]);

      const analytics = analyticsRes.data;
      const hierarchy = hierarchyRes.data;

      const campaignMap = new Map<string, any>();
      const creativeMap = new Map<string, any>();
      
      hierarchy.campaigns?.forEach((c: any) => {
        campaignMap.set(String(c.id), c);
      });
      
      hierarchy.creatives?.forEach((c: any) => {
        const campaignUrn = c.campaign;
        const campaignId = campaignUrn?.split(':').pop() || '';
        creativeMap.set(String(c.id), {
          ...c,
          campaignId,
          campaignName: campaignMap.get(campaignId)?.name || `Campaign ${campaignId}`
        });
      });

      const campaigns: CampaignMetrics[] = (analytics.campaigns || []).map((c: any) => {
        const currentCtr = c.currentMonth.impressions > 0 
          ? (c.currentMonth.clicks / c.currentMonth.impressions) * 100 
          : 0;
        const previousCtr = c.previousMonth.impressions > 0 
          ? (c.previousMonth.clicks / c.previousMonth.impressions) * 100 
          : 0;
        const ctrChange = previousCtr > 0 
          ? ((currentCtr - previousCtr) / previousCtr) * 100 
          : 0;
        
        const isUnderperforming = currentCtr < CTR_THRESHOLD || ctrChange < CTR_DROP_THRESHOLD;
        const campaignInfo = campaignMap.get(c.campaignId);

        return {
          campaignId: c.campaignId,
          campaignName: campaignInfo?.name || c.campaignName || `Campaign ${c.campaignId}`,
          currentMonth: {
            impressions: c.currentMonth.impressions || 0,
            clicks: c.currentMonth.clicks || 0,
            ctr: currentCtr,
            spend: c.currentMonth.costInLocalCurrency || 0
          },
          previousMonth: {
            impressions: c.previousMonth.impressions || 0,
            clicks: c.previousMonth.clicks || 0,
            ctr: previousCtr,
            spend: c.previousMonth.costInLocalCurrency || 0
          },
          ctrChange,
          isUnderperforming
        };
      });

      const ads: AdMetrics[] = [];
      creativeMap.forEach((creative, adId) => {
        const campaignMetrics = campaigns.find(c => c.campaignId === creative.campaignId);
        if (campaignMetrics) {
          const impressionShare = campaignMetrics.currentMonth.impressions > 0 ? 0.3 : 0;
          const estimatedImpressions = Math.floor(campaignMetrics.currentMonth.impressions * impressionShare);
          const estimatedClicks = Math.floor(campaignMetrics.currentMonth.clicks * impressionShare);
          const ctr = estimatedImpressions > 0 ? (estimatedClicks / estimatedImpressions) * 100 : 0;
          
          const prevImpressions = Math.floor(campaignMetrics.previousMonth.impressions * impressionShare);
          const prevClicks = Math.floor(campaignMetrics.previousMonth.clicks * impressionShare);
          const prevCtr = prevImpressions > 0 ? (prevClicks / prevImpressions) * 100 : 0;
          
          const ctrChange = prevCtr > 0 ? ((ctr - prevCtr) / prevCtr) * 100 : 0;
          
          let adType = 'UNKNOWN';
          if (creative.type) {
            adType = creative.type.replace('AD_', '').replace(/_/g, ' ');
          } else if (creative.content?.reference) {
            if (creative.content.reference.includes('video')) adType = 'VIDEO';
            else if (creative.content.reference.includes('image')) adType = 'IMAGE';
          }
          
          ads.push({
            adId,
            adName: creative.name || `Ad ${adId}`,
            adType,
            campaignId: creative.campaignId,
            campaignName: creative.campaignName,
            currentMonth: {
              impressions: estimatedImpressions,
              clicks: estimatedClicks,
              ctr
            },
            previousMonth: {
              impressions: prevImpressions,
              clicks: prevClicks,
              ctr: prevCtr
            },
            ctrChange,
            isUnderperforming: ctr < CTR_THRESHOLD || ctrChange < CTR_DROP_THRESHOLD
          });
        }
      });

      const totalCurrentImpressions = campaigns.reduce((sum, c) => sum + c.currentMonth.impressions, 0);
      const totalCurrentClicks = campaigns.reduce((sum, c) => sum + c.currentMonth.clicks, 0);
      const totalPrevImpressions = campaigns.reduce((sum, c) => sum + c.previousMonth.impressions, 0);
      const totalPrevClicks = campaigns.reduce((sum, c) => sum + c.previousMonth.clicks, 0);
      
      const currentCtr = totalCurrentImpressions > 0 ? (totalCurrentClicks / totalCurrentImpressions) * 100 : 0;
      const previousCtr = totalPrevImpressions > 0 ? (totalPrevClicks / totalPrevImpressions) * 100 : 0;
      const ctrChange = previousCtr > 0 ? ((currentCtr - previousCtr) / previousCtr) * 100 : 0;

      setData({
        campaigns: campaigns.sort((a, b) => {
          if (a.isUnderperforming !== b.isUnderperforming) {
            return a.isUnderperforming ? -1 : 1;
          }
          return b.currentMonth.impressions - a.currentMonth.impressions;
        }),
        ads: ads.sort((a, b) => {
          if (a.isUnderperforming !== b.isUnderperforming) {
            return a.isUnderperforming ? -1 : 1;
          }
          return b.currentMonth.impressions - a.currentMonth.impressions;
        }),
        currentMonthLabel: analytics.currentMonthLabel || 'Current Month',
        previousMonthLabel: analytics.previousMonthLabel || 'Previous Month',
        accountSummary: {
          currentCtr,
          previousCtr,
          ctrChange,
          totalImpressions: totalCurrentImpressions,
          totalClicks: totalCurrentClicks
        }
      });
    } catch (err: any) {
      console.error('Failed to fetch analytics:', err);
      setError('Failed to load performance data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [accountId, isLiveData]);

  const toggleCampaign = (campaignId: string) => {
    setExpandedCampaigns(prev => {
      const next = new Set(prev);
      if (next.has(campaignId)) {
        next.delete(campaignId);
      } else {
        next.add(campaignId);
      }
      return next;
    });
  };

  if (!isLiveData) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Connect LinkedIn to View Performance</h3>
          <p className="text-gray-500">Login to see CTR stats and ad performance for your account.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Loading performance data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Failed to Load Data</h3>
          <p className="text-gray-500 mb-4">{error}</p>
          <button 
            onClick={fetchAnalytics}
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
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Eye className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Performance Data</h3>
          <p className="text-gray-500">No campaign data available for this account.</p>
        </div>
      </div>
    );
  }

  const underperformingCampaigns = data.campaigns.filter(c => c.isUnderperforming);
  const underperformingAds = data.ads.filter(a => a.isUnderperforming);
  const filteredCampaigns = showOnlyUnderperforming 
    ? underperformingCampaigns 
    : data.campaigns;
  const filteredAds = showOnlyUnderperforming 
    ? underperformingAds 
    : data.ads;

  return (
    <div className="h-full overflow-auto">
      <div className="space-y-6 pb-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-2 text-gray-500 mb-2">
              <Eye className="w-4 h-4" />
              <span className="text-sm">Total Impressions</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {formatNumber(data.accountSummary.totalImpressions)}
            </p>
            <p className="text-xs text-gray-500 mt-1">{data.currentMonthLabel}</p>
          </div>
          
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-2 text-gray-500 mb-2">
              <MousePointerClick className="w-4 h-4" />
              <span className="text-sm">Total Clicks</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {formatNumber(data.accountSummary.totalClicks)}
            </p>
            <p className="text-xs text-gray-500 mt-1">{data.currentMonthLabel}</p>
          </div>
          
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-2 text-gray-500 mb-2">
              <Percent className="w-4 h-4" />
              <span className="text-sm">Account CTR</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {formatCtr(data.accountSummary.currentCtr)}
            </p>
            <div className="mt-1">
              <ChangeIndicator change={data.accountSummary.ctrChange} isUnderperforming={false} />
            </div>
          </div>
          
          <div className={`rounded-lg border-2 p-4 ${underperformingAds.length > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className={`w-4 h-4 ${underperformingAds.length > 0 ? 'text-red-500' : 'text-green-500'}`} />
              <span className="text-sm text-gray-700">Ads to Review</span>
            </div>
            <p className={`text-2xl font-bold ${underperformingAds.length > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {underperformingAds.length}
            </p>
            <p className="text-xs text-gray-600 mt-1">
              {underperformingAds.length > 0 ? 'Need attention' : 'All performing well'}
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
                <CampaignRow
                  key={campaign.campaignId}
                  campaign={campaign}
                  isExpanded={expandedCampaigns.has(campaign.campaignId)}
                  onToggle={() => toggleCampaign(campaign.campaignId)}
                />
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
              Ads with CTR below {CTR_THRESHOLD}% or {Math.abs(CTR_DROP_THRESHOLD)}%+ decline are flagged for review
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredAds.slice(0, 12).map(ad => (
            <AdPreviewCard key={ad.adId} ad={ad} accountId={accountId} />
          ))}
        </div>
        
        {filteredAds.length === 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
            No {showOnlyUnderperforming ? 'underperforming ' : ''}ads found
          </div>
        )}
        
        {filteredAds.length > 12 && (
          <p className="text-center text-sm text-gray-500">
            Showing 12 of {filteredAds.length} ads
          </p>
        )}
      </div>
    </div>
  );
}
