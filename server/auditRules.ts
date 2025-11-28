interface Recommendation {
  category: string;
  severity: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  affectedEntityType?: string;
  affectedEntityId?: string;
  affectedEntityName?: string;
}

interface CampaignData {
  id: string;
  groupId?: string;
  name: string;
  status: string;
  objectiveType?: string;
  costType?: string;
  dailyBudget?: number;
  targetingCriteria?: any;
}

interface CreativeData {
  id: string;
  campaignId: string;
  name: string;
  status: string;
  format?: string;
}

interface MetricData {
  campaignId: string;
  dateRange: string;
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  videoViews: number;
  leads: number;
  ctr?: number;
  cpc?: number;
  cpm?: number;
}

interface GroupData {
  id: string;
  name: string;
  status: string;
}

export function runAuditRules(
  groups: GroupData[],
  campaigns: CampaignData[],
  creatives: CreativeData[],
  metrics: MetricData[]
): Recommendation[] {
  const recommendations: Recommendation[] = [];

  const currentMetrics = metrics.filter(m => m.dateRange === 'current');
  const previousMetrics = metrics.filter(m => m.dateRange === 'previous');

  const activeCampaigns = campaigns.filter(c => c.status === 'ACTIVE');
  const activeCreatives = creatives.filter(c => c.status === 'ACTIVE');

  checkStructureIssues(groups, campaigns, creatives, recommendations);
  checkPerformanceIssues(campaigns, currentMetrics, previousMetrics, recommendations);
  checkTargetingIssues(campaigns, recommendations);
  checkCreativeIssues(campaigns, creatives, currentMetrics, recommendations);
  checkBudgetIssues(campaigns, currentMetrics, recommendations);

  return recommendations;
}

function checkStructureIssues(
  groups: GroupData[],
  campaigns: CampaignData[],
  creatives: CreativeData[],
  recommendations: Recommendation[]
) {
  for (const group of groups) {
    const groupCampaigns = campaigns.filter(c => c.groupId === group.id);
    
    if (groupCampaigns.length === 0) {
      recommendations.push({
        category: 'structure',
        severity: 'low',
        title: 'Empty campaign group',
        description: `Campaign group "${group.name}" has no campaigns. Consider removing unused groups to keep your account organized.`,
        affectedEntityType: 'group',
        affectedEntityId: group.id,
        affectedEntityName: group.name
      });
    }

    if (groupCampaigns.length > 20) {
      recommendations.push({
        category: 'structure',
        severity: 'medium',
        title: 'Campaign group has many campaigns',
        description: `Campaign group "${group.name}" has ${groupCampaigns.length} campaigns. Consider splitting into smaller, more focused groups for easier management.`,
        affectedEntityType: 'group',
        affectedEntityId: group.id,
        affectedEntityName: group.name
      });
    }
  }

  for (const campaign of campaigns) {
    const campaignCreatives = creatives.filter(c => c.campaignId === campaign.id);
    const activeCreatives = campaignCreatives.filter(c => c.status === 'ACTIVE');
    
    if (campaign.status === 'ACTIVE' && activeCreatives.length === 0) {
      recommendations.push({
        category: 'structure',
        severity: 'high',
        title: 'Active campaign has no active ads',
        description: `Campaign "${campaign.name}" is active but has no active ads. This campaign cannot deliver.`,
        affectedEntityType: 'campaign',
        affectedEntityId: campaign.id,
        affectedEntityName: campaign.name
      });
    }

    if (campaign.status === 'ACTIVE' && activeCreatives.length === 1) {
      recommendations.push({
        category: 'structure',
        severity: 'medium',
        title: 'Campaign has only one ad',
        description: `Campaign "${campaign.name}" has only 1 active ad. Add more ad variations to enable A/B testing and improve performance.`,
        affectedEntityType: 'campaign',
        affectedEntityId: campaign.id,
        affectedEntityName: campaign.name
      });
    }

    if (activeCreatives.length > 10) {
      recommendations.push({
        category: 'structure',
        severity: 'low',
        title: 'Campaign has many ads',
        description: `Campaign "${campaign.name}" has ${activeCreatives.length} active ads. Consider consolidating to 3-5 top performers to focus budget.`,
        affectedEntityType: 'campaign',
        affectedEntityId: campaign.id,
        affectedEntityName: campaign.name
      });
    }
  }

  const campaignsWithoutGroup = campaigns.filter(c => !c.groupId);
  if (campaignsWithoutGroup.length > 0) {
    recommendations.push({
      category: 'structure',
      severity: 'low',
      title: 'Campaigns without groups',
      description: `${campaignsWithoutGroup.length} campaigns are not organized into campaign groups. Group campaigns by objective or audience for better organization.`
    });
  }
}

function checkPerformanceIssues(
  campaigns: CampaignData[],
  currentMetrics: MetricData[],
  previousMetrics: MetricData[],
  recommendations: Recommendation[]
) {
  for (const campaign of campaigns.filter(c => c.status === 'ACTIVE')) {
    const current = currentMetrics.find(m => m.campaignId === campaign.id);
    const previous = previousMetrics.find(m => m.campaignId === campaign.id);

    if (!current) continue;

    if (current.impressions > 1000 && current.ctr && current.ctr < 0.3) {
      recommendations.push({
        category: 'performance',
        severity: 'high',
        title: 'Very low click-through rate',
        description: `Campaign "${campaign.name}" has a CTR of ${current.ctr.toFixed(2)}%, which is below the LinkedIn average of 0.4-0.6%. Consider refreshing ad creative or refining targeting.`,
        affectedEntityType: 'campaign',
        affectedEntityId: campaign.id,
        affectedEntityName: campaign.name
      });
    } else if (current.impressions > 1000 && current.ctr && current.ctr < 0.5) {
      recommendations.push({
        category: 'performance',
        severity: 'medium',
        title: 'Below average click-through rate',
        description: `Campaign "${campaign.name}" has a CTR of ${current.ctr.toFixed(2)}%. Test new ad creative to improve engagement.`,
        affectedEntityType: 'campaign',
        affectedEntityId: campaign.id,
        affectedEntityName: campaign.name
      });
    }

    if (previous && previous.ctr && current.ctr) {
      const ctrChange = ((current.ctr - previous.ctr) / previous.ctr) * 100;
      if (ctrChange < -20 && previous.impressions > 500) {
        recommendations.push({
          category: 'performance',
          severity: 'high',
          title: 'Significant CTR decline',
          description: `Campaign "${campaign.name}" CTR dropped ${Math.abs(ctrChange).toFixed(0)}% vs last month. This may indicate creative fatigue or audience saturation.`,
          affectedEntityType: 'campaign',
          affectedEntityId: campaign.id,
          affectedEntityName: campaign.name
        });
      }
    }

    if (current.impressions > 1000 && current.cpc && current.cpc > 15) {
      recommendations.push({
        category: 'performance',
        severity: 'medium',
        title: 'High cost per click',
        description: `Campaign "${campaign.name}" has a CPC of $${current.cpc.toFixed(2)}. Consider broadening targeting or improving ad relevance to reduce costs.`,
        affectedEntityType: 'campaign',
        affectedEntityId: campaign.id,
        affectedEntityName: campaign.name
      });
    }

    if (current.spend > 100 && current.conversions === 0 && current.leads === 0) {
      recommendations.push({
        category: 'performance',
        severity: 'high',
        title: 'No conversions despite spend',
        description: `Campaign "${campaign.name}" has spent $${current.spend.toFixed(0)} with no conversions. Review conversion tracking setup or consider pausing.`,
        affectedEntityType: 'campaign',
        affectedEntityId: campaign.id,
        affectedEntityName: campaign.name
      });
    }

    if (current.impressions < 100 && campaign.status === 'ACTIVE') {
      recommendations.push({
        category: 'performance',
        severity: 'medium',
        title: 'Low delivery',
        description: `Campaign "${campaign.name}" has very low impressions (${current.impressions}). Check if targeting is too narrow or budget too low.`,
        affectedEntityType: 'campaign',
        affectedEntityId: campaign.id,
        affectedEntityName: campaign.name
      });
    }
  }
}

function checkTargetingIssues(
  campaigns: CampaignData[],
  recommendations: Recommendation[]
) {
  const activeCampaigns = campaigns.filter(c => c.status === 'ACTIVE');
  
  const targetingHashes = new Map<string, CampaignData[]>();
  for (const campaign of activeCampaigns) {
    if (campaign.targetingCriteria) {
      const hash = JSON.stringify(campaign.targetingCriteria);
      if (!targetingHashes.has(hash)) {
        targetingHashes.set(hash, []);
      }
      targetingHashes.get(hash)!.push(campaign);
    }
  }

  for (const [, overlappingCampaigns] of targetingHashes) {
    if (overlappingCampaigns.length > 1) {
      const names = overlappingCampaigns.map(c => c.name).join(', ');
      recommendations.push({
        category: 'targeting',
        severity: 'high',
        title: 'Duplicate targeting detected',
        description: `${overlappingCampaigns.length} campaigns have identical targeting: ${names}. This causes self-competition and inflates costs. Consider consolidating or differentiating.`,
        affectedEntityType: 'campaign',
        affectedEntityId: overlappingCampaigns[0].id,
        affectedEntityName: overlappingCampaigns[0].name
      });
    }
  }

  for (const campaign of activeCampaigns) {
    const targeting = campaign.targetingCriteria;
    if (!targeting || Object.keys(targeting).length === 0) {
      recommendations.push({
        category: 'targeting',
        severity: 'medium',
        title: 'No targeting criteria detected',
        description: `Campaign "${campaign.name}" appears to have minimal targeting. Add relevant targeting to reach the right audience.`,
        affectedEntityType: 'campaign',
        affectedEntityId: campaign.id,
        affectedEntityName: campaign.name
      });
    }
  }
}

function checkCreativeIssues(
  campaigns: CampaignData[],
  creatives: CreativeData[],
  metrics: MetricData[],
  recommendations: Recommendation[]
) {
  const formatCounts = new Map<string, number>();
  for (const creative of creatives.filter(c => c.status === 'ACTIVE')) {
    const format = creative.format || 'unknown';
    formatCounts.set(format, (formatCounts.get(format) || 0) + 1);
  }

  const hasVideo = formatCounts.has('VIDEO') || 
    Array.from(formatCounts.keys()).some(k => k.toLowerCase().includes('video'));
  const totalActive = creatives.filter(c => c.status === 'ACTIVE').length;

  if (totalActive > 5 && !hasVideo) {
    recommendations.push({
      category: 'creative',
      severity: 'low',
      title: 'No video ads detected',
      description: 'Your account has no video ads. Video typically drives higher engagement on LinkedIn. Consider testing video content.',
    });
  }

  const hasCarousel = Array.from(formatCounts.keys()).some(k => 
    k.toLowerCase().includes('carousel')
  );
  if (totalActive > 5 && !hasCarousel) {
    recommendations.push({
      category: 'creative',
      severity: 'low',
      title: 'No carousel ads detected',
      description: 'Consider testing carousel ads to showcase multiple products or tell a story across multiple cards.',
    });
  }
}

function checkBudgetIssues(
  campaigns: CampaignData[],
  metrics: MetricData[],
  recommendations: Recommendation[]
) {
  const activeCampaigns = campaigns.filter(c => c.status === 'ACTIVE');
  
  for (const campaign of activeCampaigns) {
    if (campaign.dailyBudget && campaign.dailyBudget < 10) {
      recommendations.push({
        category: 'budget',
        severity: 'low',
        title: 'Low daily budget',
        description: `Campaign "${campaign.name}" has a daily budget of $${campaign.dailyBudget}. LinkedIn recommends at least $10/day for meaningful delivery.`,
        affectedEntityType: 'campaign',
        affectedEntityId: campaign.id,
        affectedEntityName: campaign.name
      });
    }

    const metric = metrics.find(m => m.campaignId === campaign.id);
    if (campaign.dailyBudget && metric) {
      const daysInMonth = 30;
      const expectedSpend = campaign.dailyBudget * daysInMonth;
      const actualSpend = metric.spend || 0;
      const pacing = (actualSpend / expectedSpend) * 100;

      if (pacing < 50 && actualSpend > 0) {
        recommendations.push({
          category: 'budget',
          severity: 'medium',
          title: 'Campaign underspending',
          description: `Campaign "${campaign.name}" is only spending ${pacing.toFixed(0)}% of budget. Targeting may be too narrow or bids too low.`,
          affectedEntityType: 'campaign',
          affectedEntityId: campaign.id,
          affectedEntityName: campaign.name
        });
      }
    }
  }

  const totalBudget = activeCampaigns.reduce((sum, c) => sum + (c.dailyBudget || 0), 0);
  if (totalBudget > 0) {
    const budgetDistribution = activeCampaigns.map(c => ({
      campaign: c,
      share: ((c.dailyBudget || 0) / totalBudget) * 100
    }));

    const topCampaign = budgetDistribution.sort((a, b) => b.share - a.share)[0];
    if (topCampaign && topCampaign.share > 70 && activeCampaigns.length > 3) {
      recommendations.push({
        category: 'budget',
        severity: 'medium',
        title: 'Budget concentration risk',
        description: `Campaign "${topCampaign.campaign.name}" receives ${topCampaign.share.toFixed(0)}% of total budget. Consider diversifying budget across more campaigns.`,
        affectedEntityType: 'campaign',
        affectedEntityId: topCampaign.campaign.id,
        affectedEntityName: topCampaign.campaign.name
      });
    }
  }
}

export function calculateAccountScore(recommendations: Recommendation[]): {
  score: number;
  grade: string;
  breakdown: { category: string; score: number }[];
} {
  const categories = ['structure', 'performance', 'targeting', 'creative', 'budget'];
  const breakdown: { category: string; score: number }[] = [];

  let totalDeductions = 0;

  for (const category of categories) {
    const categoryRecs = recommendations.filter(r => r.category === category);
    let deduction = 0;
    
    for (const rec of categoryRecs) {
      if (rec.severity === 'high') deduction += 15;
      else if (rec.severity === 'medium') deduction += 8;
      else deduction += 3;
    }

    const categoryScore = Math.max(0, 100 - deduction);
    breakdown.push({ category, score: categoryScore });
    totalDeductions += deduction;
  }

  const score = Math.max(0, Math.min(100, 100 - (totalDeductions / categories.length)));
  
  let grade = 'A';
  if (score < 60) grade = 'F';
  else if (score < 70) grade = 'D';
  else if (score < 80) grade = 'C';
  else if (score < 90) grade = 'B';

  return { score: Math.round(score), grade, breakdown };
}
