
import React, { useState, useEffect } from 'react';
import { TargetingSummary, NodeType, CreativeNode, CreativeContent, CampaignMetrics, MonthlyMetrics } from '../types';
import { Globe, Users, Briefcase, UserX, Target, FileVideo, FileImage, Layers, Play, DollarSign, Crosshair, Settings, MapPin, Building2, ExternalLink, MousePointer, FileText, Link2, Loader2, Maximize2, X, GraduationCap, User, Heart, Zap, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, BarChart3, Eye, MousePointerClick, Video } from 'lucide-react';
import { getAdPreview, getCreativeDetails, getCampaignAnalytics } from '../services/linkedinApi';

const isThoughtLeaderAd = (name: string): boolean => {
  return /^Creative\s*\d+$/i.test(name.trim());
};

interface InspectorProps {
  node: {
    type: NodeType;
    name: string;
    targeting?: TargetingSummary;
    creatives?: CreativeNode[];
    singleCreative?: CreativeNode;
    objective?: string;
    biddingStrategy?: string;
    campaignId?: string;
  } | null;
  onClose: () => void;
  accountId?: string;
  isLiveData?: boolean;
}

interface MetricRowProps {
  label: string;
  icon: any;
  current: number;
  previous: number;
  format: 'number' | 'currency' | 'percent';
  currency?: string;
}

const MetricRow: React.FC<MetricRowProps> = ({ label, icon: Icon, current, previous, format, currency = '£' }) => {
  const change = previous > 0 ? ((current - previous) / previous) * 100 : (current > 0 ? 100 : 0);
  const isPositive = change > 0;
  const isNeutral = change === 0;
  
  const formatValue = (value: number): string => {
    if (format === 'currency') {
      return `${currency}${value.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    if (format === 'percent') {
      return `${value.toFixed(2)}%`;
    }
    return value.toLocaleString('en-GB');
  };
  
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-gray-400" />
        <span className="text-sm text-gray-600">{label}</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold text-gray-900">{formatValue(current)}</span>
        {!isNeutral && (
          <div className={`flex items-center gap-0.5 text-xs font-medium ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
            {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            <span>{Math.abs(change).toFixed(1)}%</span>
          </div>
        )}
        {isNeutral && current === 0 && previous === 0 && (
          <span className="text-xs text-gray-400">-</span>
        )}
      </div>
    </div>
  );
};

interface PerformanceSectionProps {
  campaignId: string;
  accountId: string;
  isLiveData: boolean;
}

const PerformanceSection: React.FC<PerformanceSectionProps> = ({ campaignId, accountId, isLiveData }) => {
  const [metrics, setMetrics] = useState<CampaignMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [labels, setLabels] = useState<{ current: string; previous: string }>({ current: '', previous: '' });
  
  useEffect(() => {
    if (!isLiveData || !accountId || !campaignId) return;
    
    setLoading(true);
    setError(null);
    
    getCampaignAnalytics(accountId)
      .then(data => {
        const campaignMetrics = data.campaigns.find(c => c.campaignId === campaignId);
        if (campaignMetrics) {
          setMetrics(campaignMetrics);
        }
        setLabels({
          current: data.currentMonthLabel,
          previous: data.previousMonthLabel,
        });
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch analytics:', err);
        setError('Unable to load performance data');
        setLoading(false);
      });
  }, [campaignId, accountId, isLiveData]);
  
  if (!isLiveData) {
    return (
      <div className="mb-6">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center">
          <BarChart3 className="w-3.5 h-3.5 mr-1.5" /> Performance
        </h3>
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-100 text-center">
          <p className="text-sm text-gray-500">Connect LinkedIn to see performance metrics</p>
        </div>
      </div>
    );
  }
  
  if (loading) {
    return (
      <div className="mb-6">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center">
          <BarChart3 className="w-3.5 h-3.5 mr-1.5" /> Performance
        </h3>
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-100 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          <span className="ml-2 text-sm text-gray-500">Loading metrics...</span>
        </div>
      </div>
    );
  }
  
  if (error || !metrics) {
    return (
      <div className="mb-6">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center">
          <BarChart3 className="w-3.5 h-3.5 mr-1.5" /> Performance
        </h3>
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-100 text-center">
          <p className="text-sm text-gray-500">{error || 'No performance data available'}</p>
        </div>
      </div>
    );
  }
  
  const ctr = metrics.currentMonth.impressions > 0 
    ? (metrics.currentMonth.clicks / metrics.currentMonth.impressions) * 100 
    : 0;
  const prevCtr = metrics.previousMonth.impressions > 0 
    ? (metrics.previousMonth.clicks / metrics.previousMonth.impressions) * 100 
    : 0;
  
  return (
    <div className="mb-6">
      <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center">
        <BarChart3 className="w-3.5 h-3.5 mr-1.5" /> Performance ({labels.current} vs {labels.previous})
      </h3>
      <div className="bg-gradient-to-br from-slate-50 to-gray-50 rounded-lg p-4 border border-gray-200">
        <MetricRow 
          label="Impressions" 
          icon={Eye} 
          current={metrics.currentMonth.impressions} 
          previous={metrics.previousMonth.impressions}
          format="number"
        />
        <MetricRow 
          label="Clicks" 
          icon={MousePointerClick} 
          current={metrics.currentMonth.clicks} 
          previous={metrics.previousMonth.clicks}
          format="number"
        />
        <MetricRow 
          label="CTR" 
          icon={Target} 
          current={ctr} 
          previous={prevCtr}
          format="percent"
        />
        <MetricRow 
          label="Spend" 
          icon={DollarSign} 
          current={metrics.currentMonth.spend} 
          previous={metrics.previousMonth.spend}
          format="currency"
          currency={metrics.currency === 'GBP' ? '£' : metrics.currency === 'USD' ? '$' : '€'}
        />
        {(metrics.currentMonth.leads > 0 || metrics.previousMonth.leads > 0) && (
          <MetricRow 
            label="Leads" 
            icon={Users} 
            current={metrics.currentMonth.leads} 
            previous={metrics.previousMonth.leads}
            format="number"
          />
        )}
        {(metrics.currentMonth.conversions > 0 || metrics.previousMonth.conversions > 0) && (
          <MetricRow 
            label="Conversions" 
            icon={Zap} 
            current={metrics.currentMonth.conversions} 
            previous={metrics.previousMonth.conversions}
            format="number"
          />
        )}
        {(metrics.currentMonth.videoViews > 0 || metrics.previousMonth.videoViews > 0) && (
          <MetricRow 
            label="Video Views" 
            icon={Video} 
            current={metrics.currentMonth.videoViews} 
            previous={metrics.previousMonth.videoViews}
            format="number"
          />
        )}
      </div>
    </div>
  );
};

const TargetingSection = ({ title, items, icon: Icon, colorClass, borderColor }: { title: string, items: string[], icon: any, colorClass: string, borderColor: string }) => {
  if (!items || items.length === 0) return null;
  return (
    <div className={`mb-4 p-3 rounded-lg border ${borderColor} bg-opacity-50`}>
      <h4 className="flex items-center text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">
        <Icon className="w-3.5 h-3.5 mr-2" />
        {title}
      </h4>
      <div className="flex flex-wrap gap-2">
        {items.map((item, idx) => (
          <span key={idx} className={`px-2.5 py-1 rounded text-sm font-medium border ${colorClass}`}>
            {item}
          </span>
        ))}
      </div>
    </div>
  );
};

interface CategoryBoxProps {
  title: string;
  icon: any;
  items: { label: string; values: string[] }[];
  colorClass: string;
  borderColor: string;
  bgColor: string;
}

const CategoryBox: React.FC<CategoryBoxProps> = ({ title, icon: Icon, items, colorClass, borderColor, bgColor }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  
  const hasData = items.some(item => item.values.length > 0);
  if (!hasData) return null;
  
  return (
    <div className={`mb-4 rounded-lg border ${borderColor} ${bgColor} overflow-hidden`}>
      <button 
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-opacity-80 transition-colors"
      >
        <h4 className="flex items-center text-sm font-bold text-gray-700 uppercase tracking-wide">
          <Icon className="w-4 h-4 mr-2" />
          {title}
        </h4>
        {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
      </button>
      
      {isExpanded && (
        <div className="px-4 pb-3 space-y-3">
          {items.map((item, idx) => {
            if (item.values.length === 0) return null;
            return (
              <div key={idx}>
                <p className="text-xs font-medium text-gray-500 mb-1.5">{item.label}</p>
                <div className="flex flex-wrap gap-1.5">
                  {item.values.map((value, vIdx) => (
                    <span key={vIdx} className={`px-2 py-1 rounded text-xs font-medium border ${colorClass}`}>
                      {value}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

interface RichCreativePreviewProps {
  creative: CreativeNode;
  accountId?: string;
  isLiveData?: boolean;
  compact?: boolean;
}

const RichCreativePreview: React.FC<RichCreativePreviewProps> = ({ creative, accountId, isLiveData = false, compact = false }) => {
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [creativeDetails, setCreativeDetails] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPreviewExpanded, setIsPreviewExpanded] = useState(false);

  useEffect(() => {
    if (!compact && isLiveData && accountId && creative.id) {
      setLoading(true);
      setError(null);
      
      Promise.all([
        getAdPreview(accountId, creative.id).catch(err => {
          console.warn('Ad preview fetch failed:', err);
          return null;
        }),
        getCreativeDetails(accountId, creative.id).catch(err => {
          console.warn('Creative details fetch failed:', err);
          return null;
        })
      ]).then(([previewData, detailsData]) => {
        if (previewData?.elements?.[0]?.preview) {
          setPreviewHtml(previewData.elements[0].preview);
        }
        if (detailsData) {
          setCreativeDetails(detailsData);
        }
        setLoading(false);
      }).catch(err => {
        setError('Failed to load preview');
        setLoading(false);
      });
    }
  }, [creative.id, accountId, isLiveData, compact]);

  const getIcon = () => {
    switch (creative.format) {
      case 'VIDEO': return <FileVideo className={compact ? "w-5 h-5" : "w-8 h-8"} />;
      case 'CAROUSEL': return <Layers className={compact ? "w-5 h-5" : "w-8 h-8"} />;
      default: return <FileImage className={compact ? "w-5 h-5" : "w-8 h-8"} />;
    }
  };

  const getBgColor = () => {
    switch (creative.format) {
      case 'VIDEO': return 'bg-purple-100 text-purple-600';
      case 'CAROUSEL': return 'bg-orange-100 text-orange-600';
      default: return 'bg-blue-100 text-blue-600';
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'ACTIVE': return 'bg-green-100 text-green-700 border-green-200';
      case 'PAUSED': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'DRAFT': return 'bg-gray-100 text-gray-700 border-gray-200';
      default: return 'bg-gray-100 text-gray-600 border-gray-200';
    }
  };

  if (compact) {
    return (
      <div className="flex items-center gap-3 p-2.5 rounded-lg border border-gray-100 bg-white hover:border-gray-300 transition-all">
        <div className={`p-2 rounded ${getBgColor()}`}>
          {getIcon()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{creative.name}</p>
          <p className="text-xs text-gray-500 font-mono mt-0.5">{creative.format}</p>
        </div>
      </div>
    );
  }

  const parsedContent = creativeDetails?.parsedContent;
  const leadgenCta = creativeDetails?.leadgenCallToAction;
  const status = creativeDetails?.intendedStatus || creative.status;
  const adType = creative.format || 'SPONSORED_UPDATE';

  return (
    <div className="space-y-4">
      <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
        {loading && (
          <div className="w-full h-48 flex flex-col items-center justify-center bg-gray-50">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            <span className="text-xs text-gray-500 mt-2">Loading preview...</span>
          </div>
        )}
        
        {!loading && previewHtml && (
          <>
            <div className="relative">
              <div className="w-full overflow-hidden max-h-72">
                <div 
                  className="w-full origin-top-left"
                  style={{ 
                    transform: 'scale(0.55)',
                    transformOrigin: 'top left',
                    width: '182%'
                  }}
                  dangerouslySetInnerHTML={{ __html: previewHtml }} 
                />
              </div>
              <div className="absolute bottom-8 left-0 right-0 h-8 bg-gradient-to-t from-white to-transparent pointer-events-none" />
              <button
                onClick={() => setIsPreviewExpanded(true)}
                className="w-full py-2 flex items-center justify-center gap-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 border-t border-gray-100 transition-colors"
              >
                <Maximize2 className="w-4 h-4" />
                View Full Preview
              </button>
            </div>
            
            {isPreviewExpanded && (
              <div 
                className="fixed inset-0 bg-black bg-opacity-50 z-[100] flex items-center justify-center p-4"
                onClick={() => setIsPreviewExpanded(false)}
              >
                <div 
                  className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-auto relative"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between z-10">
                    <h3 className="font-semibold text-gray-900">Ad Preview</h3>
                    <button
                      onClick={() => setIsPreviewExpanded(false)}
                      className="p-1.5 hover:bg-gray-100 rounded-full text-gray-500 hover:text-gray-700 transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="p-4">
                    <div 
                      className="w-full"
                      dangerouslySetInnerHTML={{ __html: previewHtml }} 
                    />
                  </div>
                </div>
              </div>
            )}
          </>
        )}
        
        {!loading && !previewHtml && (
          <div className={`w-full h-40 flex flex-col items-center justify-center ${getBgColor()} relative`}>
            {getIcon()}
            {creative.format === 'VIDEO' && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="bg-white p-2 rounded-full shadow-lg opacity-80">
                  <Play className="w-5 h-5 text-black fill-current" />
                </div>
              </div>
            )}
            <span className="text-xs font-medium mt-2 opacity-75">{creative.format} Preview</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <span className={`text-xs font-semibold px-2.5 py-1 rounded border ${getStatusColor(status)}`}>
          {status || 'UNKNOWN'}
        </span>
        <span className="text-xs font-semibold px-2.5 py-1 rounded bg-gray-50 text-gray-600 border border-gray-200">
          {adType}
        </span>
      </div>

      <div className="space-y-1">
        <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Ad Name</label>
        <p className="text-base font-semibold text-gray-900 leading-snug">{creative.name}</p>
        {isThoughtLeaderAd(creative.name) && (
          <span className="inline-block mt-1 text-xs font-medium px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 border border-purple-200">
            Thought Leader Ad
          </span>
        )}
      </div>
      
      <div className="space-y-1">
        <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Creative ID</label>
        <p className="text-sm font-mono text-gray-600">{creative.id}</p>
      </div>

      {parsedContent?.description && (
        <div className="space-y-1 pt-2 border-t border-gray-100">
          <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Description</label>
          <p className="text-sm text-gray-700 leading-relaxed">{parsedContent.description}</p>
        </div>
      )}

      {(parsedContent?.callToAction || leadgenCta?.buttonLabel) && (
        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-1">
            <MousePointer className="w-3 h-3" /> Call to Action
          </label>
          <p className="text-sm font-semibold text-blue-600">
            {parsedContent?.callToAction || leadgenCta?.buttonLabel}
          </p>
        </div>
      )}
      
      {(parsedContent?.destinationUrl || parsedContent?.landingPageUrl || leadgenCta?.destinationUrl) && (
        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-1">
            <Link2 className="w-3 h-3" /> Destination URL
          </label>
          <a 
            href={parsedContent?.destinationUrl || parsedContent?.landingPageUrl || leadgenCta?.destinationUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-600 hover:text-blue-800 hover:underline break-all flex items-start gap-1"
          >
            <span className="flex-1">{parsedContent?.destinationUrl || parsedContent?.landingPageUrl || leadgenCta?.destinationUrl}</span>
            <ExternalLink className="w-3 h-3 flex-shrink-0 mt-0.5" />
          </a>
        </div>
      )}
      
      {(parsedContent?.leadFormId || leadgenCta?.leadgenCreativeFormId) && (
        <div className="space-y-1 bg-green-50 border border-green-200 rounded-lg p-3">
          <label className="text-[11px] font-semibold text-green-700 uppercase tracking-wide flex items-center gap-1">
            <FileText className="w-3 h-3" /> Lead Form
          </label>
          <p className="text-sm text-green-800 font-mono">
            {parsedContent?.leadFormId || leadgenCta?.leadgenCreativeFormId}
          </p>
        </div>
      )}
      
      {error && (
        <div className="text-xs text-red-500 bg-red-50 p-2 rounded border border-red-100">
          {error}
        </div>
      )}
    </div>
  );
};

const CreativePreview: React.FC<{ creative: CreativeNode, compact?: boolean }> = ({ creative, compact = false }) => {
  return <RichCreativePreview creative={creative} compact={compact} />;
};

export const TargetingInspector: React.FC<InspectorProps> = ({ node, onClose, accountId, isLiveData }) => {
  if (!node) return null;

  const getPrimaryFormat = () => {
    if (!node.creatives || node.creatives.length === 0) return 'Unknown';
    return node.creatives[0].format;
  };

  const hasAnyExclusions = node.targeting?.exclusions && (
    node.targeting.exclusions.geos.length > 0 ||
    node.targeting.exclusions.companyLists.length > 0 ||
    node.targeting.exclusions.audiences.length > 0 ||
    node.targeting.exclusions.company.length > 0 ||
    node.targeting.exclusions.demographics.length > 0 ||
    node.targeting.exclusions.education.length > 0 ||
    node.targeting.exclusions.jobExperience.length > 0 ||
    node.targeting.exclusions.interestsTraits.length > 0 ||
    node.targeting.exclusions.other.length > 0
  );

  const hasAnyTargeting = node.targeting && (
    node.targeting.geos.length > 0 ||
    node.targeting.audiences.length > 0 ||
    (node.targeting.companyLists?.length || 0) > 0 ||
    node.targeting.company?.industries?.length > 0 ||
    node.targeting.company?.sizes?.length > 0 ||
    node.targeting.company?.names?.length > 0 ||
    node.targeting.company?.followers?.length > 0 ||
    node.targeting.company?.category?.length > 0 ||
    node.targeting.demographics?.ages?.length > 0 ||
    node.targeting.demographics?.genders?.length > 0 ||
    node.targeting.education?.fieldsOfStudy?.length > 0 ||
    node.targeting.education?.degrees?.length > 0 ||
    node.targeting.education?.schools?.length > 0 ||
    node.targeting.jobExperience?.titles?.length > 0 ||
    node.targeting.jobExperience?.functions?.length > 0 ||
    node.targeting.jobExperience?.seniorities?.length > 0 ||
    node.targeting.jobExperience?.yearsOfExperience?.length > 0 ||
    node.targeting.jobExperience?.skills?.length > 0 ||
    node.targeting.interestsTraits?.memberInterests?.length > 0 ||
    node.targeting.interestsTraits?.memberTraits?.length > 0 ||
    node.targeting.interestsTraits?.memberGroups?.length > 0 ||
    hasAnyExclusions
  );

  return (
    <div className="fixed inset-y-0 right-0 w-full md:w-[400px] bg-white shadow-2xl transform transition-transform duration-300 ease-in-out border-l border-gray-200 z-50 overflow-y-auto">
      <div className="p-6">
        <div className="flex justify-between items-start mb-4">
          <div className="pr-4">
            <span className={`text-[10px] font-bold px-2 py-1 rounded tracking-wider uppercase ${
              node.type === NodeType.GROUP ? 'bg-gray-100 text-gray-700' : 
              node.type === NodeType.CAMPAIGN ? 'bg-orange-100 text-orange-800' :
              'bg-green-100 text-green-800'
            }`}>
              {node.type === NodeType.GROUP ? 'CAMPAIGN GROUP' : 
               node.type === NodeType.CAMPAIGN ? 'CAMPAIGN' : 'AD'}
            </span>
            {node.type !== NodeType.CREATIVE && (
              <h2 className="text-xl font-bold text-gray-900 mt-3 leading-snug break-words">{node.name}</h2>
            )}
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {node.type === NodeType.CREATIVE && node.singleCreative && (
          <div className="mb-8">
            <RichCreativePreview 
              creative={node.singleCreative} 
              accountId={accountId}
              isLiveData={isLiveData}
            />
          </div>
        )}

        {node.type === NodeType.CAMPAIGN && (
          <>
            {accountId && node.campaignId && (
              <PerformanceSection 
                campaignId={node.campaignId} 
                accountId={accountId} 
                isLiveData={isLiveData || false}
              />
            )}

            <div className="mb-6">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center">
                 <Settings className="w-3.5 h-3.5 mr-1.5" /> Campaign Settings
              </h3>
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-100 space-y-3">
                <div className="flex justify-between items-center border-b border-gray-100 pb-2">
                   <div className="flex items-center text-xs text-gray-500">
                      <Crosshair className="w-3.5 h-3.5 mr-2" /> Objective
                   </div>
                   <div className="text-sm font-semibold text-gray-900 text-right">
                      {node.objective || 'Brand Awareness'}
                   </div>
                </div>
                
                <div className="flex justify-between items-center border-b border-gray-100 pb-2">
                   <div className="flex items-center text-xs text-gray-500">
                      <DollarSign className="w-3.5 h-3.5 mr-2" /> Bidding Strategy
                   </div>
                   <div className="text-sm font-semibold text-gray-900 text-right">
                      {node.biddingStrategy || 'Auto Bid'}
                   </div>
                </div>

                <div className="flex justify-between items-center">
                   <div className="flex items-center text-xs text-gray-500">
                      <Layers className="w-3.5 h-3.5 mr-2" /> Creative Type
                   </div>
                   <div className="text-sm font-semibold text-gray-900 text-right">
                      {getPrimaryFormat()}
                   </div>
                </div>
              </div>
            </div>

            {node.targeting && (
              <div className="mb-6">
                 <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center">
                   <Target className="w-3.5 h-3.5 mr-1.5" /> Targeting Rules
                 </h3>
                
                <TargetingSection 
                   title="Locations" 
                   items={node.targeting.geos} 
                   icon={MapPin}
                   colorClass="bg-blue-50 text-blue-700 border-blue-200"
                   borderColor="border-blue-100"
                 />

                <CategoryBox
                  title="Company"
                  icon={Building2}
                  items={[
                    { label: 'Company Names', values: node.targeting.company?.names || [] },
                    { label: 'Industries', values: node.targeting.company?.industries || [] },
                    { label: 'Company Sizes', values: node.targeting.company?.sizes || [] },
                    { label: 'Followers / Connections', values: node.targeting.company?.followers || [] },
                    { label: 'Growth Rate', values: node.targeting.company?.growthRate || [] },
                    { label: 'Company Category', values: node.targeting.company?.category || [] },
                  ]}
                  colorClass="bg-indigo-50 text-indigo-700 border-indigo-200"
                  borderColor="border-indigo-200"
                  bgColor="bg-indigo-50/50"
                />

                <CategoryBox
                  title="Demographics"
                  icon={User}
                  items={[
                    { label: 'Age Ranges', values: node.targeting.demographics?.ages || [] },
                    { label: 'Gender', values: node.targeting.demographics?.genders || [] },
                  ]}
                  colorClass="bg-pink-50 text-pink-700 border-pink-200"
                  borderColor="border-pink-200"
                  bgColor="bg-pink-50/50"
                />

                <CategoryBox
                  title="Education"
                  icon={GraduationCap}
                  items={[
                    { label: 'Fields of Study', values: node.targeting.education?.fieldsOfStudy || [] },
                    { label: 'Degrees', values: node.targeting.education?.degrees || [] },
                    { label: 'Schools / Institutions', values: node.targeting.education?.schools || [] },
                  ]}
                  colorClass="bg-amber-50 text-amber-700 border-amber-200"
                  borderColor="border-amber-200"
                  bgColor="bg-amber-50/50"
                />

                <CategoryBox
                  title="Job Experience"
                  icon={Briefcase}
                  items={[
                    { label: 'Job Titles', values: node.targeting.jobExperience?.titles || [] },
                    { label: 'Job Functions', values: node.targeting.jobExperience?.functions || [] },
                    { label: 'Seniority Levels', values: node.targeting.jobExperience?.seniorities || [] },
                    { label: 'Years of Experience', values: node.targeting.jobExperience?.yearsOfExperience || [] },
                    { label: 'Skills', values: node.targeting.jobExperience?.skills || [] },
                  ]}
                  colorClass="bg-orange-50 text-orange-700 border-orange-200"
                  borderColor="border-orange-200"
                  bgColor="bg-orange-50/50"
                />

                <CategoryBox
                  title="Interests & Traits"
                  icon={Heart}
                  items={[
                    { label: 'Member Interests', values: node.targeting.interestsTraits?.memberInterests || [] },
                    { label: 'Member Traits / Behaviors', values: node.targeting.interestsTraits?.memberTraits || [] },
                    { label: 'Groups', values: node.targeting.interestsTraits?.memberGroups || [] },
                  ]}
                  colorClass="bg-rose-50 text-rose-700 border-rose-200"
                  borderColor="border-rose-200"
                  bgColor="bg-rose-50/50"
                />

                <TargetingSection 
                  title="Company Lists" 
                  items={node.targeting.companyLists || []} 
                  icon={Building2}
                  colorClass="bg-cyan-50 text-cyan-700 border-cyan-200"
                  borderColor="border-cyan-100"
                />

                <TargetingSection 
                  title="Audience Segments" 
                  items={node.targeting.audiences} 
                  icon={Users}
                  colorClass="bg-purple-50 text-purple-700 border-purple-200"
                  borderColor="border-purple-100"
                />

                {hasAnyExclusions && (
                  <div className="mt-6 pt-4 border-t border-red-100">
                    <h4 className="flex items-center text-xs font-bold text-red-600 mb-3 uppercase tracking-wide">
                      <UserX className="w-3.5 h-3.5 mr-2" />
                      Exclusions
                    </h4>
                    
                    <TargetingSection 
                      title="Excluded Locations" 
                      items={node.targeting.exclusions.geos} 
                      icon={MapPin}
                      colorClass="bg-red-50 text-red-700 border-red-200"
                      borderColor="border-red-100"
                    />
                    
                    <TargetingSection 
                      title="Excluded Company Lists" 
                      items={node.targeting.exclusions.companyLists} 
                      icon={Building2}
                      colorClass="bg-red-50 text-red-700 border-red-200"
                      borderColor="border-red-100"
                    />
                    
                    <TargetingSection 
                      title="Excluded Audiences" 
                      items={node.targeting.exclusions.audiences} 
                      icon={Users}
                      colorClass="bg-red-50 text-red-700 border-red-200"
                      borderColor="border-red-100"
                    />
                    
                    <TargetingSection 
                      title="Excluded Company Criteria" 
                      items={node.targeting.exclusions.company} 
                      icon={Building2}
                      colorClass="bg-red-50 text-red-700 border-red-200"
                      borderColor="border-red-100"
                    />
                    
                    <TargetingSection 
                      title="Excluded Job Experience" 
                      items={node.targeting.exclusions.jobExperience} 
                      icon={Briefcase}
                      colorClass="bg-red-50 text-red-700 border-red-200"
                      borderColor="border-red-100"
                    />
                    
                    <TargetingSection 
                      title="Other Exclusions" 
                      items={node.targeting.exclusions.other} 
                      icon={UserX}
                      colorClass="bg-red-50 text-red-700 border-red-200"
                      borderColor="border-red-100"
                    />
                  </div>
                )}
                
                {!hasAnyTargeting && (
                  <div className="text-gray-400 italic text-sm text-center py-4 bg-gray-50 rounded border border-gray-100 border-dashed">
                    No specific targeting criteria found.
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {node.type === NodeType.GROUP && (
           <div className="text-gray-500 text-sm">
             <p className="mb-4">This contains specific ad groups that define targeting.</p>
             <div className="p-4 bg-gray-50 rounded border border-gray-100 flex items-center gap-3">
                <Briefcase className="text-gray-400 w-5 h-5" />
                <span className="font-medium text-gray-700">Settings are inherited by Ad Groups.</span>
             </div>
           </div>
        )}

        {node.type === NodeType.CAMPAIGN && node.creatives && node.creatives.length > 0 && (
          <div className="mt-8 pt-6 border-t border-gray-100">
            <h3 className="text-xs font-bold uppercase text-gray-500 mb-4 flex items-center tracking-wider">
              <Layers className="w-3.5 h-3.5 mr-2" />
              Active Ads ({node.creatives.length})
            </h3>
            <div className="space-y-2">
              {node.creatives.map(creative => (
                <CreativePreview key={creative.id} creative={creative} compact={true} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
