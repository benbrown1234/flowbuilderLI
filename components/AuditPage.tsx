import React, { useState, useEffect } from 'react';
import { 
  Play, 
  RefreshCw, 
  Trash2, 
  AlertTriangle, 
  AlertCircle, 
  Info,
  CheckCircle,
  TrendingDown,
  Target,
  Layout,
  Image,
  DollarSign,
  Loader2,
  ChevronDown,
  ChevronRight,
  ExternalLink
} from 'lucide-react';

interface AuditPageProps {
  accountId: string;
  accountName: string;
  isLiveData: boolean;
  onNavigateToCampaign?: (campaignId: string) => void;
}

interface Recommendation {
  id: number;
  category: string;
  severity: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  affected_entity_type?: string;
  affected_entity_id?: string;
  affected_entity_name?: string;
}

interface AuditData {
  snapshot: {
    id: number;
    account_id: string;
    account_name: string;
    snapshot_date: string;
    status: string;
  };
  groups: any[];
  campaigns: any[];
  creatives: any[];
  metrics: any[];
  recommendations: Recommendation[];
  score: {
    score: number;
    grade: string;
    breakdown: { category: string; score: number }[];
  };
}

const categoryIcons: Record<string, React.ReactNode> = {
  structure: <Layout className="w-4 h-4" />,
  performance: <TrendingDown className="w-4 h-4" />,
  targeting: <Target className="w-4 h-4" />,
  creative: <Image className="w-4 h-4" />,
  budget: <DollarSign className="w-4 h-4" />
};

const categoryLabels: Record<string, string> = {
  structure: 'Account Structure',
  performance: 'Performance',
  targeting: 'Targeting',
  creative: 'Creative',
  budget: 'Budget & Pacing'
};

const severityColors: Record<string, { bg: string; border: string; icon: React.ReactNode }> = {
  high: { 
    bg: 'bg-red-50', 
    border: 'border-red-200',
    icon: <AlertTriangle className="w-4 h-4 text-red-500" />
  },
  medium: { 
    bg: 'bg-yellow-50', 
    border: 'border-yellow-200',
    icon: <AlertCircle className="w-4 h-4 text-yellow-600" />
  },
  low: { 
    bg: 'bg-blue-50', 
    border: 'border-blue-200',
    icon: <Info className="w-4 h-4 text-blue-500" />
  }
};

function ScoreGauge({ score, grade }: { score: number; grade: string }) {
  const getScoreColor = () => {
    if (score >= 90) return 'text-green-500';
    if (score >= 80) return 'text-lime-500';
    if (score >= 70) return 'text-yellow-500';
    if (score >= 60) return 'text-orange-500';
    return 'text-red-500';
  };

  const getGradeColor = () => {
    if (grade === 'A') return 'bg-green-500';
    if (grade === 'B') return 'bg-lime-500';
    if (grade === 'C') return 'bg-yellow-500';
    if (grade === 'D') return 'bg-orange-500';
    return 'bg-red-500';
  };

  return (
    <div className="flex items-center gap-6">
      <div className="relative w-32 h-32">
        <svg className="w-32 h-32 transform -rotate-90">
          <circle
            cx="64"
            cy="64"
            r="56"
            stroke="currentColor"
            strokeWidth="12"
            fill="none"
            className="text-gray-200"
          />
          <circle
            cx="64"
            cy="64"
            r="56"
            stroke="currentColor"
            strokeWidth="12"
            fill="none"
            strokeDasharray={`${(score / 100) * 352} 352`}
            className={getScoreColor()}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-3xl font-bold ${getScoreColor()}`}>{score}</span>
        </div>
      </div>
      <div>
        <div className={`w-12 h-12 rounded-lg ${getGradeColor()} flex items-center justify-center`}>
          <span className="text-2xl font-bold text-white">{grade}</span>
        </div>
        <p className="text-sm text-gray-500 mt-1">Overall Grade</p>
      </div>
    </div>
  );
}

function CategoryBreakdown({ breakdown }: { breakdown: { category: string; score: number }[] }) {
  return (
    <div className="grid grid-cols-5 gap-3">
      {breakdown.map(({ category, score }) => (
        <div key={category} className="text-center">
          <div className="flex items-center justify-center gap-1 text-gray-600 mb-1">
            {categoryIcons[category]}
            <span className="text-xs">{categoryLabels[category]}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className={`h-2 rounded-full ${
                score >= 80 ? 'bg-green-500' : score >= 60 ? 'bg-yellow-500' : 'bg-red-500'
              }`}
              style={{ width: `${score}%` }}
            />
          </div>
          <span className="text-xs text-gray-500">{score}%</span>
        </div>
      ))}
    </div>
  );
}

interface RecommendationCardProps {
  recommendation: Recommendation;
  onNavigate?: (campaignId: string) => void;
}

function RecommendationCard({ 
  recommendation,
  onNavigate 
}: RecommendationCardProps) {
  const [expanded, setExpanded] = useState(false);
  const style = severityColors[recommendation.severity];

  return (
    <div className={`p-4 rounded-lg border ${style.bg} ${style.border}`}>
      <div 
        className="flex items-start gap-3 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        {style.icon}
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h4 className="font-medium text-gray-900">{recommendation.title}</h4>
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              recommendation.severity === 'high' ? 'bg-red-100 text-red-700' :
              recommendation.severity === 'medium' ? 'bg-yellow-100 text-yellow-700' :
              'bg-blue-100 text-blue-700'
            }`}>
              {recommendation.severity}
            </span>
          </div>
          {recommendation.affected_entity_name && (
            <p className="text-sm text-gray-600 mt-1">
              Affects: {recommendation.affected_entity_name}
            </p>
          )}
        </div>
        {expanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
      </div>
      {expanded && (
        <div className="mt-3 pl-7">
          <p className="text-sm text-gray-700">{recommendation.description}</p>
          {recommendation.affected_entity_type === 'campaign' && recommendation.affected_entity_id && onNavigate && (
            <button 
              onClick={() => onNavigate(recommendation.affected_entity_id!)}
              className="mt-2 text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
            >
              View Campaign <ExternalLink className="w-3 h-3" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function AuditPage({ accountId, accountName, isLiveData, onNavigateToCampaign }: AuditPageProps) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'syncing' | 'complete' | 'error'>('idle');
  const [auditData, setAuditData] = useState<AuditData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  useEffect(() => {
    checkAuditStatus();
  }, [accountId]);

  const checkAuditStatus = async () => {
    try {
      setStatus('loading');
      const response = await fetch(`/api/linkedin/audit/status/${accountId}`, {
        credentials: 'include'
      });
      const data = await response.json();
      
      if (data.hasAudit && data.status === 'complete') {
        await loadAuditResults();
      } else if (data.hasAudit && data.status === 'syncing') {
        setStatus('syncing');
        setTimeout(checkAuditStatus, 2000);
      } else {
        setStatus('idle');
      }
    } catch (err) {
      setStatus('idle');
    }
  };

  const loadAuditResults = async () => {
    try {
      const response = await fetch(`/api/linkedin/audit/results/${accountId}`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to load audit results');
      }
      
      const data = await response.json();
      setAuditData(data);
      setStatus('complete');
    } catch (err: any) {
      setError(err.message);
      setStatus('error');
    }
  };

  const runAudit = async () => {
    try {
      setStatus('syncing');
      setError(null);
      
      const response = await fetch(`/api/linkedin/audit/run/${accountId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ accountName })
      });
      
      if (!response.ok) {
        throw new Error('Failed to start audit');
      }
      
      const pollStatus = async () => {
        const statusResponse = await fetch(`/api/linkedin/audit/status/${accountId}`, {
          credentials: 'include'
        });
        const statusData = await statusResponse.json();
        
        if (statusData.status === 'complete') {
          await loadAuditResults();
        } else if (statusData.status === 'error') {
          setError('Audit failed. Please try again.');
          setStatus('error');
        } else {
          setTimeout(pollStatus, 2000);
        }
      };
      
      setTimeout(pollStatus, 3000);
    } catch (err: any) {
      setError(err.message);
      setStatus('error');
    }
  };

  const deleteAudit = async () => {
    try {
      await fetch(`/api/linkedin/audit/${accountId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      setAuditData(null);
      setStatus('idle');
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (!isLiveData) {
    return (
      <div className="p-8 text-center">
        <div className="max-w-md mx-auto">
          <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Live Data Required</h2>
          <p className="text-gray-600">
            The Audit feature requires live LinkedIn data. Please connect your LinkedIn account and enable Live Data mode to run an audit.
          </p>
        </div>
      </div>
    );
  }

  if (status === 'loading') {
    return (
      <div className="p-8 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (status === 'idle') {
    return (
      <div className="p-8">
        <div className="max-w-xl mx-auto text-center">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Target className="w-8 h-8 text-blue-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Account Audit</h2>
          <p className="text-gray-600 mb-6">
            Run a comprehensive audit of your LinkedIn Ads account to identify optimization opportunities, 
            structural issues, and performance insights.
          </p>
          <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left">
            <h3 className="font-medium text-gray-900 mb-2">What we'll analyze:</h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                Campaign structure and organization
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                Performance metrics and trends
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                Targeting overlap and opportunities
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                Creative diversity and fatigue
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                Budget allocation and pacing
              </li>
            </ul>
          </div>
          <button
            onClick={runAudit}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Play className="w-5 h-5" />
            Run Audit
          </button>
          <p className="text-xs text-gray-500 mt-4">
            This will take 30-60 seconds to complete
          </p>
        </div>
      </div>
    );
  }

  if (status === 'syncing') {
    return (
      <div className="p-8">
        <div className="max-w-md mx-auto text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Running Audit</h2>
          <p className="text-gray-600">
            Analyzing your account structure, performance metrics, and targeting...
          </p>
          <div className="mt-6 space-y-2">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <CheckCircle className="w-4 h-4 text-green-500" />
              Fetching campaign data
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              Analyzing performance metrics
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <div className="w-4 h-4" />
              Generating recommendations
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="p-8 text-center">
        <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Audit Failed</h2>
        <p className="text-gray-600 mb-4">{error || 'An error occurred while running the audit.'}</p>
        <button
          onClick={runAudit}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <RefreshCw className="w-4 h-4" />
          Try Again
        </button>
      </div>
    );
  }

  if (!auditData) {
    return null;
  }

  const categories = ['structure', 'performance', 'targeting', 'creative', 'budget'];
  const filteredRecommendations = selectedCategory 
    ? auditData.recommendations.filter(r => r.category === selectedCategory)
    : auditData.recommendations;

  const recommendationsByCategory = categories.reduce((acc, cat) => {
    acc[cat] = auditData.recommendations.filter(r => r.category === cat);
    return acc;
  }, {} as Record<string, Recommendation[]>);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Account Audit</h1>
          <p className="text-sm text-gray-500">
            Last updated: {new Date(auditData.snapshot.snapshot_date).toLocaleDateString()} at{' '}
            {new Date(auditData.snapshot.snapshot_date).toLocaleTimeString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={runAudit}
            className="inline-flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <RefreshCw className="w-4 h-4" />
            Re-run Audit
          </button>
          <button
            onClick={deleteAudit}
            className="inline-flex items-center gap-2 px-4 py-2 text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6 mb-6">
        <div className="col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Account Health Score</h2>
          <div className="flex items-center justify-between">
            <ScoreGauge score={auditData.score.score} grade={auditData.score.grade} />
            <div className="flex-1 ml-8">
              <CategoryBreakdown breakdown={auditData.score.breakdown} />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Summary</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Campaign Groups</span>
              <span className="font-medium">{auditData.groups.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Campaigns</span>
              <span className="font-medium">{auditData.campaigns.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Ads</span>
              <span className="font-medium">{auditData.creatives.length}</span>
            </div>
            <hr />
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Issues Found</span>
              <span className="font-medium text-orange-600">{auditData.recommendations.length}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full">
                {auditData.recommendations.filter(r => r.severity === 'high').length} High
              </span>
              <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full">
                {auditData.recommendations.filter(r => r.severity === 'medium').length} Medium
              </span>
              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
                {auditData.recommendations.filter(r => r.severity === 'low').length} Low
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Recommendations</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`px-3 py-1.5 rounded-lg text-sm ${
                !selectedCategory ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All ({auditData.recommendations.length})
            </button>
            {categories.map(cat => {
              const count = recommendationsByCategory[cat].length;
              if (count === 0) return null;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-1 ${
                    selectedCategory === cat ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {categoryIcons[cat]}
                  {categoryLabels[cat]} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {filteredRecommendations.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-2" />
            <p>No issues found in this category!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredRecommendations.map((rec) => {
              return (
                <RecommendationCard 
                  key={rec.id} 
                  recommendation={rec}
                  onNavigate={onNavigateToCampaign}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
