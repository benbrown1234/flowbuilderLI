import React, { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, Filter, Clock, TrendingDown, AlertTriangle, Calendar, RefreshCw, BarChart3, Loader2, Play, ClipboardCheck, Users, ChevronDown, ArrowUpDown, ArrowUp, ArrowDown, Building2, ExternalLink } from 'lucide-react';

type DrilldownView = 'hourly' | 'job-titles' | 'companies';

interface DrilldownPageProps {
  accountId: string;
  accountName: string;
  onBack: () => void;
  onNavigateToAudit?: () => void;
  subView?: DrilldownView;
}

interface AuditAccountStatus {
  optedIn: boolean;
  accountId?: string;
  accountName?: string;
  optedInAt?: string;
  lastSyncAt?: string;
  syncStatus?: 'pending' | 'syncing' | 'completed' | 'error';
  syncError?: string;
}

interface HeatmapCell {
  value: number;
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  ctr: number;
  cpc: number;
  cpm: number;
  daysWithData: number;
}

interface HeatmapData {
  heatmap: (HeatmapCell | null)[][];
  dayNames: string[];
  metric: string;
  dateRange: { start: string; end: string };
}

interface CutoffData {
  cutoffs: Array<{
    date: string;
    dayOfWeek: number;
    dayName: string;
    firstDeliveryHour: number | null;
    lastDeliveryHour: number | null;
    totalImpressions: number;
    totalSpend: number;
    earlyBudgetExhaustion: boolean;
  }>;
  avgCutoffHour: number | null;
  earlyExhaustionDays: number;
  totalDaysAnalyzed: number;
  dateRange: { start: string; end: string };
}

interface CampaignWithData {
  campaign_id: string;
  campaign_name: string;
  first_date: string;
  last_date: string;
  days_with_data: number;
}

interface JobTitleData {
  jobTitleUrn: string;
  jobTitleName: string;
  impressions: number;
  clicks: number;
  ctr: number;
  syncDate: string;
}

interface JobTitlesResponse {
  data: JobTitleData[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasPrevious: boolean;
  hasNext: boolean;
}

interface CompanyData {
  companyUrn: string;
  companyName: string;
  companyUrl: string | null;
  impressions: number;
  clicks: number;
  engagementRate: number;
  syncDate: string;
}

interface CompaniesResponse {
  data: CompanyData[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasPrevious: boolean;
  hasNext: boolean;
}

type SortField = 'impressions' | 'clicks' | 'ctr' | 'job_title_name';
type CompanySortField = 'impressions' | 'clicks' | 'engagement_rate' | 'company_name';
type SortDir = 'asc' | 'desc';
type DateRange = '7' | '30' | '90';

interface DrilldownSyncStatus {
  hourly: { lastSyncAt: string | null; status: 'pending' | 'syncing' | 'completed' | 'error' };
  jobTitles: { lastSyncAt: string | null; status: 'pending' | 'syncing' | 'completed' | 'error' };
  companies: { lastSyncAt: string | null; status: 'pending' | 'syncing' | 'completed' | 'error' };
}

const METRICS = [
  { key: 'impressions', label: 'Impressions', format: (v: number) => v.toLocaleString() },
  { key: 'clicks', label: 'Clicks', format: (v: number) => v.toLocaleString() },
  { key: 'spend', label: 'Spend', format: (v: number) => `$${v.toFixed(2)}` },
  { key: 'ctr', label: 'CTR', format: (v: number) => `${v.toFixed(2)}%` },
  { key: 'cpc', label: 'CPC', format: (v: number) => `$${v.toFixed(2)}` },
  { key: 'cpm', label: 'CPM', format: (v: number) => `$${v.toFixed(2)}` },
  { key: 'conversions', label: 'Conversions', format: (v: number) => v.toLocaleString() },
];

export default function DrilldownPage({ accountId, accountName, onBack, onNavigateToAudit, subView = 'hourly' }: DrilldownPageProps) {
  const selectedView = subView;
  const [selectedMetric, setSelectedMetric] = useState('impressions');
  const [selectedCampaign, setSelectedCampaign] = useState<string | undefined>(undefined);
  const [campaigns, setCampaigns] = useState<CampaignWithData[]>([]);
  const [heatmapData, setHeatmapData] = useState<HeatmapData | null>(null);
  const [cutoffData, setCutoffData] = useState<CutoffData | null>(null);
  const [loading, setLoading] = useState(true);
  const [hoveredCell, setHoveredCell] = useState<{ day: number; hour: number } | null>(null);
  const [auditStatus, setAuditStatus] = useState<AuditAccountStatus | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(true);
  
  const [jobTitlesData, setJobTitlesData] = useState<JobTitlesResponse | null>(null);
  const [jobTitlesLoading, setJobTitlesLoading] = useState(false);
  const [jobTitlesPage, setJobTitlesPage] = useState(1);
  const [jobTitlesSortBy, setJobTitlesSortBy] = useState<SortField>('impressions');
  const [jobTitlesSortDir, setJobTitlesSortDir] = useState<SortDir>('desc');
  const [jobTitlesCampaigns, setJobTitlesCampaigns] = useState<Array<{ campaignId: string; campaignName: string }>>([]);
  const [selectedJobTitlesCampaign, setSelectedJobTitlesCampaign] = useState<string | undefined>(undefined);
  const [jobTitlesDateRange, setJobTitlesDateRange] = useState<DateRange>('90');
  
  const [companiesData, setCompaniesData] = useState<CompaniesResponse | null>(null);
  const [companiesLoading, setCompaniesLoading] = useState(false);
  const [companiesPage, setCompaniesPage] = useState(1);
  const [companiesSortBy, setCompaniesSortBy] = useState<CompanySortField>('impressions');
  const [companiesSortDir, setCompaniesSortDir] = useState<SortDir>('desc');
  const [companiesCampaigns, setCompaniesCampaigns] = useState<Array<{ campaignId: string; campaignName: string }>>([]);
  const [selectedCompaniesCampaign, setSelectedCompaniesCampaign] = useState<string | undefined>(undefined);
  const [companiesDateRange, setCompaniesDateRange] = useState<DateRange>('90');
  
  const [drilldownSyncStatus, setDrilldownSyncStatus] = useState<DrilldownSyncStatus | null>(null);
  const [syncingType, setSyncingType] = useState<'hourly' | 'job_titles' | 'companies' | null>(null);

  const fetchDrilldownSyncStatus = useCallback(async () => {
    try {
      const response = await fetch(`/api/audit/drilldown-status/${accountId}`, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setDrilldownSyncStatus(data);
        return data;
      }
    } catch (error) {
      console.error('Error fetching drilldown sync status:', error);
    }
    return null;
  }, [accountId]);

  const triggerDrilldownSync = async (dataType: 'hourly' | 'job_titles' | 'companies') => {
    setSyncingType(dataType);
    try {
      const response = await fetch(`/api/audit/drilldown/sync/${accountId}/${dataType}`, {
        method: 'POST',
        credentials: 'include'
      });
      if (response.ok) {
        await fetchDrilldownSyncStatus();
        startPollingSync(dataType);
      }
    } catch (error) {
      console.error(`Error triggering ${dataType} sync:`, error);
      setSyncingType(null);
    }
  };

  const startPollingSync = (dataType: 'hourly' | 'job_titles' | 'companies') => {
    const pollInterval = setInterval(async () => {
      const status = await fetchDrilldownSyncStatus();
      const syncStatus = dataType === 'hourly' ? status?.hourly?.status :
                         dataType === 'job_titles' ? status?.jobTitles?.status :
                         status?.companies?.status;
      
      if (syncStatus === 'completed' || syncStatus === 'error') {
        clearInterval(pollInterval);
        setSyncingType(null);
        
        if (syncStatus === 'completed') {
          if (dataType === 'hourly') {
            fetchCampaigns();
            fetchData();
          } else if (dataType === 'job_titles') {
            fetchJobTitlesCampaigns();
            fetchJobTitles(1, jobTitlesSortBy, jobTitlesSortDir, selectedJobTitlesCampaign, jobTitlesDateRange);
          } else if (dataType === 'companies') {
            fetchCompaniesCampaigns();
            fetchCompanies(1, companiesSortBy, companiesSortDir, selectedCompaniesCampaign, companiesDateRange);
          }
        }
      }
    }, 2000);
    
    setTimeout(() => clearInterval(pollInterval), 600000);
  };

  const formatSyncTime = (timestamp: string | null) => {
    if (!timestamp) return 'Never synced';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const checkAuditStatus = useCallback(async () => {
    try {
      const response = await fetch(`/api/audit/account/${accountId}`, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setAuditStatus(data);
        return data;
      }
    } catch (error) {
      console.error('Error checking audit status:', error);
    }
    setCheckingStatus(false);
    return null;
  }, [accountId]);

  useEffect(() => {
    const init = async () => {
      setCheckingStatus(true);
      const status = await checkAuditStatus();
      setCheckingStatus(false);
      
      if (status?.optedIn && status?.syncStatus === 'completed') {
        fetchCampaigns();
        fetchData();
      }
    };
    init();
  }, [accountId, checkAuditStatus]);

  useEffect(() => {
    if (!auditStatus?.optedIn) return;
    if (auditStatus.syncStatus !== 'syncing' && auditStatus.syncStatus !== 'pending') return;
    
    const pollInterval = setInterval(async () => {
      const status = await checkAuditStatus();
      if (status?.syncStatus === 'completed') {
        fetchCampaigns();
        fetchData();
        clearInterval(pollInterval);
      }
    }, 3000);
    
    return () => clearInterval(pollInterval);
  }, [auditStatus, checkAuditStatus]);

  useEffect(() => {
    if (auditStatus?.optedIn && auditStatus?.syncStatus === 'completed') {
      fetchData();
    }
  }, [selectedCampaign, selectedMetric]);

  useEffect(() => {
    if (auditStatus?.optedIn) {
      fetchDrilldownSyncStatus();
    }
  }, [auditStatus, fetchDrilldownSyncStatus]);

  const fetchJobTitlesCampaigns = async () => {
    try {
      const response = await fetch(`/api/audit/drilldown/job-title-campaigns/${accountId}`, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setJobTitlesCampaigns(data);
      }
    } catch (error) {
      console.error('Error fetching job titles campaigns:', error);
    }
  };

  const fetchCampaigns = async () => {
    try {
      const response = await fetch(`/api/audit/drilldown/campaigns/${accountId}`, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setCampaigns(data);
      }
    } catch (error) {
      console.error('Error fetching campaigns:', error);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const campaignParam = selectedCampaign ? `&campaignId=${selectedCampaign}` : '';
      
      const [heatmapRes, cutoffRes] = await Promise.all([
        fetch(`/api/audit/drilldown/heatmap/${accountId}?metric=${selectedMetric}${campaignParam}`, {
          credentials: 'include'
        }),
        fetch(`/api/audit/drilldown/cutoffs/${accountId}?${campaignParam.slice(1)}`, {
          credentials: 'include'
        })
      ]);

      if (heatmapRes.ok) {
        const data = await heatmapRes.json();
        setHeatmapData(data);
      }

      if (cutoffRes.ok) {
        const data = await cutoffRes.json();
        setCutoffData(data);
      }
    } catch (error) {
      console.error('Error fetching drilldown data:', error);
    }
    setLoading(false);
  };

  const fetchJobTitles = async (page: number = 1, sortBy: SortField = 'impressions', sortDir: SortDir = 'desc', campaignId?: string, dateRange: DateRange = '90') => {
    setJobTitlesLoading(true);
    try {
      const campaignParam = campaignId ? `&campaignId=${campaignId}` : '';
      const response = await fetch(
        `/api/audit/drilldown/job-titles/${accountId}?page=${page}&pageSize=25&sortBy=${sortBy}&sortDir=${sortDir}&dateRange=${dateRange}${campaignParam}`,
        { credentials: 'include' }
      );
      if (response.ok) {
        const data = await response.json();
        setJobTitlesData(data);
      }
    } catch (error) {
      console.error('Error fetching job titles:', error);
    }
    setJobTitlesLoading(false);
  };

  useEffect(() => {
    if (auditStatus?.optedIn && auditStatus?.syncStatus === 'completed' && selectedView === 'job-titles') {
      fetchJobTitlesCampaigns();
      fetchJobTitles(jobTitlesPage, jobTitlesSortBy, jobTitlesSortDir, selectedJobTitlesCampaign, jobTitlesDateRange);
    }
  }, [selectedView, jobTitlesPage, jobTitlesSortBy, jobTitlesSortDir, selectedJobTitlesCampaign, jobTitlesDateRange, auditStatus]);

  const handleJobTitlesSort = (field: SortField) => {
    if (field === jobTitlesSortBy) {
      setJobTitlesSortDir(prev => prev === 'desc' ? 'asc' : 'desc');
    } else {
      setJobTitlesSortBy(field);
      setJobTitlesSortDir('desc');
    }
    setJobTitlesPage(1);
  };

  const fetchCompaniesCampaigns = async () => {
    try {
      const response = await fetch(`/api/audit/drilldown/company-campaigns/${accountId}`, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setCompaniesCampaigns(data);
      }
    } catch (error) {
      console.error('Error fetching companies campaigns:', error);
    }
  };

  const fetchCompanies = async (page: number = 1, sortBy: CompanySortField = 'impressions', sortDir: SortDir = 'desc', campaignId?: string, dateRange: DateRange = '90') => {
    setCompaniesLoading(true);
    try {
      const campaignParam = campaignId ? `&campaignId=${campaignId}` : '';
      const response = await fetch(
        `/api/audit/drilldown/companies/${accountId}?page=${page}&pageSize=25&sortBy=${sortBy}&sortDir=${sortDir}&dateRange=${dateRange}${campaignParam}`,
        { credentials: 'include' }
      );
      if (response.ok) {
        const data = await response.json();
        setCompaniesData(data);
      }
    } catch (error) {
      console.error('Error fetching companies:', error);
    }
    setCompaniesLoading(false);
  };

  useEffect(() => {
    if (auditStatus?.optedIn && auditStatus?.syncStatus === 'completed' && selectedView === 'companies') {
      fetchCompaniesCampaigns();
      fetchCompanies(companiesPage, companiesSortBy, companiesSortDir, selectedCompaniesCampaign, companiesDateRange);
    }
  }, [selectedView, companiesPage, companiesSortBy, companiesSortDir, selectedCompaniesCampaign, companiesDateRange, auditStatus]);

  const handleCompaniesSort = (field: CompanySortField) => {
    if (field === companiesSortBy) {
      setCompaniesSortDir(prev => prev === 'desc' ? 'asc' : 'desc');
    } else {
      setCompaniesSortBy(field);
      setCompaniesSortDir('desc');
    }
    setCompaniesPage(1);
  };

  const getColorForValue = (value: number, maxValue: number, metric: string) => {
    if (value === 0 || !maxValue) return 'bg-gray-100';
    const intensity = Math.min(value / maxValue, 1);
    
    if (metric === 'ctr' || metric === 'conversions') {
      if (intensity > 0.7) return 'bg-green-500';
      if (intensity > 0.5) return 'bg-green-400';
      if (intensity > 0.3) return 'bg-green-300';
      if (intensity > 0.15) return 'bg-green-200';
      return 'bg-green-100';
    }
    
    if (intensity > 0.7) return 'bg-blue-500';
    if (intensity > 0.5) return 'bg-blue-400';
    if (intensity > 0.3) return 'bg-blue-300';
    if (intensity > 0.15) return 'bg-blue-200';
    return 'bg-blue-100';
  };

  const getMaxValue = () => {
    if (!heatmapData?.heatmap) return 1;
    let max = 0;
    for (const row of heatmapData.heatmap) {
      for (const cell of row) {
        if (cell && cell.value > max) max = cell.value;
      }
    }
    return max || 1;
  };

  const formatMetricValue = (value: number) => {
    const metricInfo = METRICS.find(m => m.key === selectedMetric);
    return metricInfo ? metricInfo.format(value) : value.toString();
  };

  const formatHour = (hour: number) => {
    if (hour === 0) return '12am';
    if (hour < 12) return `${hour}am`;
    if (hour === 12) return '12pm';
    return `${hour - 12}pm`;
  };

  const maxValue = getMaxValue();

  if (checkingStatus) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Checking audit status...</p>
        </div>
      </div>
    );
  }

  if (!auditStatus?.optedIn) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="text-center max-w-md">
          <ClipboardCheck className="w-16 h-16 text-gray-300 mx-auto mb-6" />
          <h3 className="text-xl font-semibold text-gray-900 mb-3">Enable Audit First</h3>
          <p className="text-gray-500 mb-6">
            Drilldown analysis requires audit data. Start the audit to begin collecting 
            hourly performance data for this account.
          </p>
          <button
            onClick={onNavigateToAudit || onBack}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Play className="w-5 h-5" />
            Go to Audit
          </button>
        </div>
      </div>
    );
  }

  if (auditStatus.syncStatus === 'syncing' || auditStatus.syncStatus === 'pending') {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-blue-500 animate-spin mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Sync In Progress</h3>
          <p className="text-gray-500 mb-2">
            Collecting hourly performance data...
          </p>
          <p className="text-sm text-gray-400">
            This may take a few minutes for large accounts.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
            <span>Back to Audit</span>
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-blue-600" />
              Performance Drilldown
            </h1>
            <p className="text-gray-500">{accountName}</p>
          </div>
          
          <button
            onClick={() => {
              if (selectedView === 'hourly') {
                fetchData();
              } else if (selectedView === 'job-titles') {
                fetchJobTitles(jobTitlesPage, jobTitlesSortBy, jobTitlesSortDir, selectedJobTitlesCampaign, jobTitlesDateRange);
              } else if (selectedView === 'companies') {
                fetchCompanies(companiesPage, companiesSortBy, companiesSortDir, selectedCompaniesCampaign, companiesDateRange);
              }
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>

        {selectedView === 'hourly' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6">
            <div className="p-4 border-b border-gray-200">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700">Filters:</span>
                </div>
                
                <select
                  value={selectedCampaign || ''}
                  onChange={(e) => setSelectedCampaign(e.target.value || undefined)}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Campaigns</option>
                  {campaigns.map(c => (
                    <option key={c.campaign_id} value={c.campaign_id}>
                      {c.campaign_name || `Campaign ${c.campaign_id}`}
                    </option>
                  ))}
                </select>

                <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                  {METRICS.map(metric => (
                    <button
                      key={metric.key}
                      onClick={() => setSelectedMetric(metric.key)}
                      className={`px-3 py-1 text-sm rounded-md transition-colors ${
                        selectedMetric === metric.key
                          ? 'bg-white shadow text-blue-600 font-medium'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      {metric.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {loading ? (
            <div className="p-12 text-center">
              <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4" />
              <p className="text-gray-500">Loading hourly data...</p>
            </div>
          ) : !heatmapData || !heatmapData.heatmap.some(row => row.some(cell => cell)) ? (
            <div className="p-12 text-center">
              <Clock className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 text-lg font-medium">No hourly data available yet</p>
              <p className="text-gray-400 text-sm mt-2 mb-6 max-w-md mx-auto">
                Hourly performance data is collected when you run an audit sync. This data shows 
                when your ads are delivering throughout the day and helps identify budget exhaustion patterns.
              </p>
              <div className="flex flex-col items-center gap-3">
                <button
                  onClick={() => { if (onNavigateToAudit) onNavigateToAudit(); else onBack(); }}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  Go to Audit and Refresh Data
                </button>
                <p className="text-xs text-gray-400">
                  Click "Refresh" on the Audit page to collect hourly data (last 14 days)
                </p>
              </div>
            </div>
          ) : (
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-blue-600" />
                  Hourly Performance Heatmap
                </h2>
                <div className="flex items-center gap-4">
                  {heatmapData.dateRange && (
                    <span className="text-sm text-gray-500 flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {heatmapData.dateRange.start} to {heatmapData.dateRange.end}
                    </span>
                  )}
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-400">
                      {formatSyncTime(drilldownSyncStatus?.hourly?.lastSyncAt || null)}
                    </span>
                    <button
                      onClick={() => triggerDrilldownSync('hourly')}
                      disabled={syncingType === 'hourly'}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        syncingType === 'hourly'
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                      }`}
                    >
                      {syncingType === 'hourly' ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Syncing...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-3.5 h-3.5" />
                          Sync Hourly
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className="w-16 px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Day
                      </th>
                      {Array.from({ length: 24 }, (_, i) => (
                        <th
                          key={i}
                          className="px-0.5 py-2 text-center text-xs font-medium text-gray-500"
                        >
                          {i}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {heatmapData.dayNames.map((dayName, dayIdx) => (
                      <tr key={dayIdx}>
                        <td className="px-2 py-1 text-sm font-medium text-gray-700">
                          {dayName}
                        </td>
                        {Array.from({ length: 24 }, (_, hourIdx) => {
                          const cell = heatmapData.heatmap[dayIdx]?.[hourIdx];
                          const value = cell?.value || 0;
                          const isHovered = hoveredCell?.day === dayIdx && hoveredCell?.hour === hourIdx;
                          
                          return (
                            <td
                              key={hourIdx}
                              className="px-0.5 py-1 relative"
                              onMouseEnter={() => setHoveredCell({ day: dayIdx, hour: hourIdx })}
                              onMouseLeave={() => setHoveredCell(null)}
                            >
                              <div
                                className={`w-full h-8 rounded transition-all ${
                                  getColorForValue(value, maxValue, selectedMetric)
                                } ${isHovered ? 'ring-2 ring-blue-600 ring-offset-1' : ''}`}
                              />
                              {isHovered && cell && (
                                <div className="absolute z-50 bottom-full left-1/2 transform -translate-x-1/2 mb-2 bg-gray-900 text-white text-xs rounded-lg p-3 shadow-lg whitespace-nowrap">
                                  <div className="font-medium mb-1">
                                    {dayName} {formatHour(hourIdx)}
                                  </div>
                                  <div className="space-y-0.5 text-gray-300">
                                    <div>Impressions: {cell.impressions.toLocaleString()}</div>
                                    <div>Clicks: {cell.clicks.toLocaleString()}</div>
                                    <div>Spend: ${cell.spend.toFixed(2)}</div>
                                    <div>CTR: {cell.ctr.toFixed(2)}%</div>
                                    <div>CPC: ${cell.cpc.toFixed(2)}</div>
                                    <div>CPM: ${cell.cpm.toFixed(2)}</div>
                                  </div>
                                  <div className="absolute left-1/2 transform -translate-x-1/2 top-full">
                                    <div className="border-8 border-transparent border-t-gray-900" />
                                  </div>
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex items-center justify-center gap-4 text-sm text-gray-500">
                <span>Lower {METRICS.find(m => m.key === selectedMetric)?.label}</span>
                <div className="flex items-center gap-1">
                  <div className="w-6 h-4 bg-gray-100 rounded" />
                  <div className="w-6 h-4 bg-blue-100 rounded" />
                  <div className="w-6 h-4 bg-blue-200 rounded" />
                  <div className="w-6 h-4 bg-blue-300 rounded" />
                  <div className="w-6 h-4 bg-blue-400 rounded" />
                  <div className="w-6 h-4 bg-blue-500 rounded" />
                </div>
                <span>Higher {METRICS.find(m => m.key === selectedMetric)?.label}</span>
              </div>
            </div>
          )}
          </div>
        )}

        {selectedView === 'hourly' && cutoffData && cutoffData.cutoffs.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <TrendingDown className="w-5 h-5 text-amber-600" />
                Delivery Cutoff Analysis
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Shows when delivery stops each day, indicating potential budget exhaustion
              </p>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="text-sm text-gray-500 mb-1">Average Cutoff Time</div>
                  <div className="text-2xl font-bold text-gray-900">
                    {cutoffData.avgCutoffHour !== null
                      ? formatHour(Math.round(cutoffData.avgCutoffHour))
                      : 'N/A'}
                  </div>
                </div>
                <div className={`rounded-lg p-4 ${
                  cutoffData.earlyExhaustionDays > 0 ? 'bg-amber-50' : 'bg-green-50'
                }`}>
                  <div className="text-sm text-gray-500 mb-1">Early Budget Exhaustion Days</div>
                  <div className={`text-2xl font-bold ${
                    cutoffData.earlyExhaustionDays > 0 ? 'text-amber-600' : 'text-green-600'
                  }`}>
                    {cutoffData.earlyExhaustionDays} / {cutoffData.totalDaysAnalyzed}
                  </div>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="text-sm text-gray-500 mb-1">Analysis Period</div>
                  <div className="text-lg font-medium text-gray-900">
                    {cutoffData.totalDaysAnalyzed} days
                  </div>
                </div>
              </div>

              {cutoffData.earlyExhaustionDays > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="font-medium text-amber-800">Budget Running Out Early</div>
                      <div className="text-sm text-amber-700 mt-1">
                        On {cutoffData.earlyExhaustionDays} out of {cutoffData.totalDaysAnalyzed} days, 
                        your ads stopped delivering before 8pm. Consider increasing daily budget to maintain 
                        visibility throughout the day.
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <div className="text-sm font-medium text-gray-700 mb-2">Daily Delivery Window</div>
                {cutoffData.cutoffs.slice(0, 14).map((cutoff, idx) => {
                  const formattedDate = new Date(cutoff.date).toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric'
                  });
                  
                  return (
                    <div key={idx} className="flex items-center gap-4">
                      <div className="w-28 text-sm text-gray-600">{formattedDate}</div>
                      <div className="flex-1 h-6 bg-gray-100 rounded-full relative overflow-hidden">
                        {cutoff.firstDeliveryHour !== null && cutoff.lastDeliveryHour !== null && (
                          <div
                            className={`absolute h-full rounded-full ${
                              cutoff.earlyBudgetExhaustion ? 'bg-amber-400' : 'bg-blue-400'
                            }`}
                            style={{
                              left: `${(cutoff.firstDeliveryHour / 24) * 100}%`,
                              width: `${((cutoff.lastDeliveryHour - cutoff.firstDeliveryHour + 1) / 24) * 100}%`
                            }}
                          />
                        )}
                        <div className="absolute inset-0 flex items-center justify-between px-2">
                          {[0, 6, 12, 18].map(h => (
                            <div
                              key={h}
                              className="w-px h-3 bg-gray-300"
                              style={{ marginLeft: h === 0 ? 0 : 'auto' }}
                            />
                          ))}
                        </div>
                      </div>
                      <div className="w-32 text-sm text-gray-500 text-right">
                        {cutoff.firstDeliveryHour !== null && cutoff.lastDeliveryHour !== null
                          ? `${formatHour(cutoff.firstDeliveryHour)} - ${formatHour(cutoff.lastDeliveryHour)}`
                          : 'No delivery'
                        }
                      </div>
                      <div className="w-24 text-sm text-gray-500 text-right">
                        ${cutoff.totalSpend.toFixed(0)}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 flex items-center justify-center gap-6 text-xs text-gray-500">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-blue-400 rounded" />
                  <span>Full day delivery</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-amber-400 rounded" />
                  <span>Early cutoff (before 8pm)</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {selectedView === 'hourly' && campaigns.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 mt-6">
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Campaigns with 7+ Days of Data</h2>
              <p className="text-sm text-gray-500 mt-1">
                Select a campaign above to see its individual performance patterns
              </p>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {campaigns.map(campaign => (
                  <button
                    key={campaign.campaign_id}
                    onClick={() => setSelectedCampaign(
                      selectedCampaign === campaign.campaign_id ? undefined : campaign.campaign_id
                    )}
                    className={`p-4 rounded-lg border text-left transition-all ${
                      selectedCampaign === campaign.campaign_id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="font-medium text-gray-900 truncate">
                      {campaign.campaign_name || `Campaign ${campaign.campaign_id}`}
                    </div>
                    <div className="text-sm text-gray-500 mt-1">
                      {campaign.days_with_data} days of data
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      {new Date(campaign.first_date).toLocaleDateString()} - {new Date(campaign.last_date).toLocaleDateString()}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {selectedView === 'job-titles' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <Users className="w-5 h-5 text-purple-600" />
                    Job Titles Breakdown
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    {selectedJobTitlesCampaign ? 'Campaign-level' : 'Account-wide'} performance metrics by job title from the last {jobTitlesDateRange} days
                  </p>
                </div>
                
                <div className="flex items-center gap-4">
                  {/* Date Range Filter */}
                  <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                    <button
                      onClick={() => { setJobTitlesDateRange('7'); setJobTitlesPage(1); }}
                      className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                        jobTitlesDateRange === '7' 
                          ? 'bg-white text-purple-700 shadow-sm' 
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      7 Days
                    </button>
                    <button
                      onClick={() => { setJobTitlesDateRange('30'); setJobTitlesPage(1); }}
                      className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                        jobTitlesDateRange === '30' 
                          ? 'bg-white text-purple-700 shadow-sm' 
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      30 Days
                    </button>
                    <button
                      onClick={() => { setJobTitlesDateRange('90'); setJobTitlesPage(1); }}
                      className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                        jobTitlesDateRange === '90' 
                          ? 'bg-white text-purple-700 shadow-sm' 
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      90 Days
                    </button>
                  </div>
                  
                  {/* Campaign Filter */}
                  {jobTitlesCampaigns.length > 0 && (
                    <div className="flex items-center gap-2">
                      <Filter className="w-4 h-4 text-gray-500" />
                      <select
                        value={selectedJobTitlesCampaign || ''}
                        onChange={(e) => {
                          setSelectedJobTitlesCampaign(e.target.value || undefined);
                          setJobTitlesPage(1);
                        }}
                        className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                      >
                        <option value="">All Campaigns</option>
                        {jobTitlesCampaigns.map(campaign => (
                          <option key={campaign.campaignId} value={campaign.campaignId}>
                            {campaign.campaignName}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  
                  {/* Sync Button */}
                  <div className="flex items-center gap-2 text-sm border-l border-gray-200 pl-4">
                    <span className="text-gray-400">
                      {formatSyncTime(drilldownSyncStatus?.jobTitles?.lastSyncAt || null)}
                    </span>
                    <button
                      onClick={() => triggerDrilldownSync('job_titles')}
                      disabled={syncingType === 'job_titles'}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        syncingType === 'job_titles'
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'bg-purple-50 text-purple-600 hover:bg-purple-100'
                      }`}
                    >
                      {syncingType === 'job_titles' ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Syncing...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-3.5 h-3.5" />
                          Sync Job Titles
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {jobTitlesLoading ? (
              <div className="p-12 text-center">
                <div className="animate-spin w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full mx-auto mb-4" />
                <p className="text-gray-500">Loading job titles data...</p>
              </div>
            ) : !jobTitlesData || jobTitlesData.data.length === 0 ? (
              <div className="p-12 text-center">
                <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 text-lg font-medium">No job titles data available</p>
                <p className="text-gray-400 text-sm mt-2 max-w-md mx-auto">
                  Job titles data is collected during the audit sync. Run an audit refresh to collect this data.
                </p>
              </div>
            ) : (
              <div className="p-6">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Job Title</th>
                        <th 
                          className="text-right py-3 px-4 font-medium text-gray-600 cursor-pointer hover:text-gray-900"
                          onClick={() => handleJobTitlesSort('impressions')}
                        >
                          <span className="flex items-center justify-end gap-1">
                            Impressions
                            {jobTitlesSortBy === 'impressions' && (
                              <span>{jobTitlesSortDir === 'desc' ? '↓' : '↑'}</span>
                            )}
                          </span>
                        </th>
                        <th 
                          className="text-right py-3 px-4 font-medium text-gray-600 cursor-pointer hover:text-gray-900"
                          onClick={() => handleJobTitlesSort('clicks')}
                        >
                          <span className="flex items-center justify-end gap-1">
                            Clicks
                            {jobTitlesSortBy === 'clicks' && (
                              <span>{jobTitlesSortDir === 'desc' ? '↓' : '↑'}</span>
                            )}
                          </span>
                        </th>
                        <th 
                          className="text-right py-3 px-4 font-medium text-gray-600 cursor-pointer hover:text-gray-900"
                          onClick={() => handleJobTitlesSort('ctr')}
                        >
                          <span className="flex items-center justify-end gap-1">
                            CTR
                            {jobTitlesSortBy === 'ctr' && (
                              <span>{jobTitlesSortDir === 'desc' ? '↓' : '↑'}</span>
                            )}
                          </span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {jobTitlesData.data.map((item, idx) => (
                        <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-3 px-4">
                            <div className="font-medium text-gray-900">{item.jobTitleName}</div>
                          </td>
                          <td className="py-3 px-4 text-right text-gray-700">
                            {item.impressions.toLocaleString()}
                          </td>
                          <td className="py-3 px-4 text-right text-gray-700">
                            {item.clicks.toLocaleString()}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span className={`font-medium ${
                              item.ctr >= 0.5 ? 'text-green-600' : 
                              item.ctr >= 0.3 ? 'text-amber-600' : 'text-gray-600'
                            }`}>
                              {item.ctr.toFixed(2)}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {jobTitlesData.total > 25 && (
                  <div className="mt-4 flex items-center justify-between">
                    <div className="text-sm text-gray-500">
                      Showing {((jobTitlesPage - 1) * 25) + 1} - {Math.min(jobTitlesPage * 25, jobTitlesData.total)} of {jobTitlesData.total} job titles
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setJobTitlesPage(prev => Math.max(1, prev - 1))}
                        disabled={jobTitlesPage === 1}
                        className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                      >
                        Previous
                      </button>
                      <span className="text-sm text-gray-600">
                        Page {jobTitlesPage} of {Math.ceil(jobTitlesData.total / 25)}
                      </span>
                      <button
                        onClick={() => setJobTitlesPage(prev => prev + 1)}
                        disabled={jobTitlesPage >= Math.ceil(jobTitlesData.total / 25)}
                        className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {selectedView === 'companies' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-orange-600" />
                    Companies Breakdown
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    {selectedCompaniesCampaign ? 'Campaign-level' : 'Account-wide'} performance metrics by company from the last {companiesDateRange} days
                  </p>
                </div>
                
                <div className="flex items-center gap-4">
                  {/* Date Range Filter */}
                  <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                    <button
                      onClick={() => { setCompaniesDateRange('7'); setCompaniesPage(1); }}
                      className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                        companiesDateRange === '7' 
                          ? 'bg-white text-orange-700 shadow-sm' 
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      7 Days
                    </button>
                    <button
                      onClick={() => { setCompaniesDateRange('30'); setCompaniesPage(1); }}
                      className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                        companiesDateRange === '30' 
                          ? 'bg-white text-orange-700 shadow-sm' 
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      30 Days
                    </button>
                    <button
                      onClick={() => { setCompaniesDateRange('90'); setCompaniesPage(1); }}
                      className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                        companiesDateRange === '90' 
                          ? 'bg-white text-orange-700 shadow-sm' 
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      90 Days
                    </button>
                  </div>
                  
                  {/* Campaign Filter */}
                  {companiesCampaigns.length > 0 && (
                    <div className="flex items-center gap-2">
                      <Filter className="w-4 h-4 text-gray-500" />
                      <select
                        value={selectedCompaniesCampaign || ''}
                        onChange={(e) => {
                          setSelectedCompaniesCampaign(e.target.value || undefined);
                          setCompaniesPage(1);
                        }}
                        className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      >
                        <option value="">All Campaigns</option>
                        {companiesCampaigns.map(campaign => (
                          <option key={campaign.campaignId} value={campaign.campaignId}>
                            {campaign.campaignName}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  
                  {/* Sync Button */}
                  <div className="flex items-center gap-2 text-sm border-l border-gray-200 pl-4">
                    <span className="text-gray-400">
                      {formatSyncTime(drilldownSyncStatus?.companies?.lastSyncAt || null)}
                    </span>
                    <button
                      onClick={() => triggerDrilldownSync('companies')}
                      disabled={syncingType === 'companies'}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        syncingType === 'companies'
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'bg-orange-50 text-orange-600 hover:bg-orange-100'
                      }`}
                    >
                      {syncingType === 'companies' ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Syncing...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-3.5 h-3.5" />
                          Sync Companies
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {companiesLoading ? (
              <div className="p-12 text-center">
                <div className="animate-spin w-8 h-8 border-4 border-orange-600 border-t-transparent rounded-full mx-auto mb-4" />
                <p className="text-gray-500">Loading companies data...</p>
              </div>
            ) : !companiesData || companiesData.data.length === 0 ? (
              <div className="p-12 text-center">
                <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 text-lg font-medium">No companies data available</p>
                <p className="text-gray-400 text-sm mt-2 max-w-md mx-auto">
                  Companies data is collected during the audit sync. Run an audit refresh to collect this data.
                </p>
              </div>
            ) : (
              <div className="p-6">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Company</th>
                        <th 
                          className="text-right py-3 px-4 font-medium text-gray-600 cursor-pointer hover:text-gray-900"
                          onClick={() => handleCompaniesSort('impressions')}
                        >
                          <span className="flex items-center justify-end gap-1">
                            Impressions
                            {companiesSortBy === 'impressions' && (
                              <span>{companiesSortDir === 'desc' ? '↓' : '↑'}</span>
                            )}
                          </span>
                        </th>
                        <th 
                          className="text-right py-3 px-4 font-medium text-gray-600 cursor-pointer hover:text-gray-900"
                          onClick={() => handleCompaniesSort('clicks')}
                        >
                          <span className="flex items-center justify-end gap-1">
                            Clicks
                            {companiesSortBy === 'clicks' && (
                              <span>{companiesSortDir === 'desc' ? '↓' : '↑'}</span>
                            )}
                          </span>
                        </th>
                        <th 
                          className="text-right py-3 px-4 font-medium text-gray-600 cursor-pointer hover:text-gray-900"
                          onClick={() => handleCompaniesSort('engagement_rate')}
                        >
                          <span className="flex items-center justify-end gap-1">
                            Eng. Rate
                            {companiesSortBy === 'engagement_rate' && (
                              <span>{companiesSortDir === 'desc' ? '↓' : '↑'}</span>
                            )}
                          </span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {companiesData.data.map((item, idx) => (
                        <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-900">{item.companyName}</span>
                              {item.companyUrl && (
                                <a 
                                  href={item.companyUrl} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-orange-600 hover:text-orange-700"
                                  title="View on LinkedIn"
                                >
                                  <ExternalLink className="w-4 h-4" />
                                </a>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right text-gray-700">
                            {item.impressions.toLocaleString()}
                          </td>
                          <td className="py-3 px-4 text-right text-gray-700">
                            {item.clicks.toLocaleString()}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span className={`font-medium ${
                              item.engagementRate >= 0.5 ? 'text-green-600' : 
                              item.engagementRate >= 0.3 ? 'text-amber-600' : 'text-gray-600'
                            }`}>
                              {item.engagementRate.toFixed(2)}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {companiesData.total > 25 && (
                  <div className="mt-4 flex items-center justify-between">
                    <div className="text-sm text-gray-500">
                      Showing {((companiesPage - 1) * 25) + 1} - {Math.min(companiesPage * 25, companiesData.total)} of {companiesData.total} companies
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setCompaniesPage(prev => Math.max(1, prev - 1))}
                        disabled={companiesPage === 1}
                        className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                      >
                        Previous
                      </button>
                      <span className="text-sm text-gray-600">
                        Page {companiesPage} of {Math.ceil(companiesData.total / 25)}
                      </span>
                      <button
                        onClick={() => setCompaniesPage(prev => prev + 1)}
                        disabled={companiesPage >= Math.ceil(companiesData.total / 25)}
                        className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
