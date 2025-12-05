/**
 * 100-Point Campaign Scoring Engine
 * 
 * Scoring Distribution:
 * A) Engagement Quality — 45 pts
 *    - Dwell Time (20 pts): Absolute (12) + Trend (8)
 *    - CTR (15 pts): Absolute (10) + Trend (5)
 *    - Frequency (10 pts)
 * 
 * B) Cost Efficiency — 35 pts
 *    - CPC (20 pts): Absolute (12) + Trend (8)
 *    - CPM (10 pts): Absolute (6) + Trend (4)
 *    - CPA (5 pts, only if ≥3 conversions)
 * 
 * C) Audience Quality — 20 pts
 *    - Penetration (10 pts)
 *    - Seniority (10 pts)
 */

// ============ TYPES ============

export interface CampaignMetrics {
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  activeDays: number;
  reach?: number;
  dwellTimeSeconds?: number;
  audienceSize?: number;
  audiencePenetration?: number;
}

export interface SeniorityData {
  currentDecisionMakerPct: number;
  previousDecisionMakerPct: number;
  hasData: boolean;
}

export interface TrackingData {
  suggestedBidMin?: number;
  suggestedBidMax?: number;
  previousSuggestedBidMin?: number;
  previousSuggestedBidMax?: number;
  audienceSize?: number;
  previousAudienceSize?: number;
  bidValue?: number;
  previousBidValue?: number;
  bidStrategy?: string;
  previousBidStrategy?: string;
  audienceExpansion?: boolean;
  linkedInAudienceNetwork?: boolean; // LAN enabled flag
  // 48-hour cooling-off timestamps (in milliseconds since epoch)
  lastBidChange?: number;
  lastBudgetChange?: number;
  lastTargetingChange?: number;
  lastCreativeChange?: number;
}

export interface AdMetrics {
  creativeId: string;
  campaignId: string;
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  dwellTimeSeconds?: number;
  firstActiveDate?: Date;
  contentHash?: string;
  status: string;
}

export interface ScoreBreakdown {
  category: 'engagement' | 'cost' | 'audience';
  metric: string;
  maxPoints: number;
  earnedPoints: number;
  value: string;
  threshold?: string;
  trend?: string;
}

export interface CausationInsight {
  layer: 'creative' | 'bidding' | 'targeting';
  type: string;
  severity: 'primary' | 'secondary' | 'info';
  message: string;
  recommendation?: string;
}

export interface CampaignScore {
  totalScore: number;
  maxScore: number;
  percentage: number;
  
  engagementScore: number;
  engagementMax: number;
  
  costScore: number;
  costMax: number;
  
  audienceScore: number;
  audienceMax: number;
  
  status: 'needs_attention' | 'mild_issues' | 'performing_well';
  breakdown: ScoreBreakdown[];
  issues: string[];
  positiveSignals: string[];
  causation: CausationInsight[];
  
  eligible: boolean;
  ineligibleReason?: string;
}

export interface AdDiagnostic {
  creativeId: string;
  flag: 'high_contributor' | 'stable' | 'weak' | 'learning' | 'low_volume' | 'fatigue';
  flagColor: 'green' | 'grey' | 'red' | 'yellow' | 'blue' | 'purple';
  
  // Contributor Ranking (Tier 1-3)
  tier: 1 | 2 | 3; // 1 = High Contributors, 2 = Neutral, 3 = Weak Contributors
  tierLabel: 'High Contributor' | 'Neutral' | 'Weak Contributor';
  
  ctr: number;
  ctrVsCampaign: number;
  
  dwellTime: number | null;
  dwellVsCampaign: number | null;
  
  cpc: number;
  cpcVsCampaign: number;
  
  cpm: number;
  impressionShare: number;
  
  adAgeDays: number;
  ageLabel: 'Learning' | 'Stable' | 'Fatigue';
  
  issues: string[];
  strengths: string[];
  
  // Recommended action for this ad
  recommendation?: string;
}

// ============ FALSE-POSITIVE PROTECTIONS ============

export interface EligibilityCheck {
  eligible: boolean;
  reason?: string;
}

export function checkCampaignEligibility(
  current: CampaignMetrics,
  campaignAgeDays: number
): EligibilityCheck {
  if (campaignAgeDays < 7) {
    return { eligible: false, reason: 'New campaign (< 7 days)' };
  }
  
  if (current.activeDays < 4) {
    return { eligible: false, reason: `Active < 4 of last 7 days (${current.activeDays} days)` };
  }
  
  if (current.impressions < 1000) {
    return { eligible: false, reason: `Low impressions (${current.impressions} < 1,000)` };
  }
  
  if (current.spend < 20) {
    return { eligible: false, reason: `Low spend ($${current.spend.toFixed(2)} < $20)` };
  }
  
  return { eligible: true };
}

export function canScoreCtrTrend(impressions: number): boolean {
  return impressions >= 2500;
}

export function canScoreDwellTrend(clicks: number): boolean {
  return clicks >= 20;
}

export function canScoreFrequency(impressions: number): boolean {
  return impressions >= 1000;
}

export function canScorePenetration(impressions: number): boolean {
  return impressions >= 1000;
}

export function canScoreSeniority(impressions: number): boolean {
  return impressions >= 1000;
}

export function canScoreCpa(conversions: number): boolean {
  return conversions >= 3;
}

// ============ DWELL TIME SCORING (20 pts) ============

export function scoreDwellTime(
  currentDwell: number | undefined,
  previousDwell: number | undefined,
  clicks: number
): { score: number; breakdown: ScoreBreakdown[] } {
  const breakdown: ScoreBreakdown[] = [];
  let absoluteScore = 0;
  let trendScore = 0;
  
  if (currentDwell === undefined || currentDwell === null) {
    breakdown.push({
      category: 'engagement',
      metric: 'Dwell Time',
      maxPoints: 20,
      earnedPoints: 0,
      value: 'N/A',
      threshold: 'No dwell data'
    });
    return { score: 0, breakdown };
  }
  
  // Absolute Quality (12 pts) - per spec
  if (currentDwell >= 15.0) {
    absoluteScore = 12;
  } else if (currentDwell >= 13.0) {
    absoluteScore = 11;
  } else if (currentDwell >= 10.0) {
    absoluteScore = 9;
  } else if (currentDwell >= 7.0) {
    absoluteScore = 7;
  } else if (currentDwell >= 5.0) {
    absoluteScore = 5;
  } else if (currentDwell >= 4.0) {
    absoluteScore = 3;
  } else if (currentDwell >= 3.0) {
    absoluteScore = 1;
  } else {
    absoluteScore = 0;
  }
  
  breakdown.push({
    category: 'engagement',
    metric: 'Dwell Time (Absolute)',
    maxPoints: 12,
    earnedPoints: absoluteScore,
    value: `${currentDwell.toFixed(1)}s`,
    threshold: absoluteScore >= 11 ? '≥13s (excellent)' : absoluteScore >= 7 ? '≥7s (good)' : '< 7s'
  });
  
  // Trend (8 pts) - requires sufficient clicks - per spec
  if (previousDwell !== undefined && previousDwell > 0 && canScoreDwellTrend(clicks)) {
    const change = ((currentDwell - previousDwell) / previousDwell) * 100;
    
    if (change >= 20) {
      trendScore = 8;
    } else if (change >= 10) {
      trendScore = 6;
    } else if (change >= 0) {
      trendScore = 4;
    } else if (change >= -10) {
      trendScore = 2;
    } else if (change >= -20) {
      trendScore = 1;
    } else {
      trendScore = 0;
    }
    
    breakdown.push({
      category: 'engagement',
      metric: 'Dwell Time (Trend)',
      maxPoints: 8,
      earnedPoints: trendScore,
      value: `${change >= 0 ? '+' : ''}${change.toFixed(0)}%`,
      trend: change >= 0 ? 'improving' : 'declining'
    });
  } else {
    // FALSE-POSITIVE PROTECTION: Award 0 points when we can't properly score
    breakdown.push({
      category: 'engagement',
      metric: 'Dwell Time (Trend)',
      maxPoints: 8,
      earnedPoints: 0, // No points when ineligible
      value: 'N/A',
      threshold: clicks < 20 ? 'Needs ≥20 clicks for scoring' : 'No previous data'
    });
    trendScore = 0;
  }
  
  return { score: absoluteScore + trendScore, breakdown };
}

// ============ CTR SCORING (15 pts) ============

export function scoreCtr(
  currentCtr: number,
  previousCtr: number | undefined,
  impressions: number
): { score: number; breakdown: ScoreBreakdown[] } {
  const breakdown: ScoreBreakdown[] = [];
  let absoluteScore = 0;
  let trendScore = 0;
  
  // Absolute Quality (10 pts) - CTR thresholds for B2B LinkedIn
  if (currentCtr >= 1.0) {
    absoluteScore = 10;
  } else if (currentCtr >= 0.7) {
    absoluteScore = 8;
  } else if (currentCtr >= 0.5) {
    absoluteScore = 6;
  } else if (currentCtr >= 0.4) {
    absoluteScore = 4;
  } else if (currentCtr >= 0.3) {
    absoluteScore = 2;
  } else {
    absoluteScore = 0;
  }
  
  breakdown.push({
    category: 'engagement',
    metric: 'CTR (Absolute)',
    maxPoints: 10,
    earnedPoints: absoluteScore,
    value: `${currentCtr.toFixed(2)}%`,
    threshold: absoluteScore >= 8 ? '≥0.7% (excellent)' : absoluteScore >= 4 ? '≥0.4% (good)' : '< 0.4%'
  });
  
  // Trend (5 pts) - per spec
  if (previousCtr !== undefined && previousCtr > 0 && canScoreCtrTrend(impressions)) {
    const change = ((currentCtr - previousCtr) / previousCtr) * 100;
    
    if (change >= 20) {
      trendScore = 5;
    } else if (change >= 10) {
      trendScore = 4;
    } else if (change >= 0) {
      trendScore = 3;
    } else if (change >= -10) {
      trendScore = 1;
    } else if (change >= -20) {
      trendScore = 0;
    } else {
      trendScore = -1; // Penalty for severe decline
    }
    
    breakdown.push({
      category: 'engagement',
      metric: 'CTR (Trend)',
      maxPoints: 5,
      earnedPoints: Math.max(0, trendScore),
      value: `${change >= 0 ? '+' : ''}${change.toFixed(0)}%`,
      trend: change >= 0 ? 'improving' : 'declining'
    });
  } else {
    // FALSE-POSITIVE PROTECTION: Award 0 points when we can't properly score
    breakdown.push({
      category: 'engagement',
      metric: 'CTR (Trend)',
      maxPoints: 5,
      earnedPoints: 0, // No points when ineligible
      value: 'N/A',
      threshold: impressions < 2500 ? 'Needs ≥2,500 impressions for scoring' : 'No previous data'
    });
    trendScore = 0;
  }
  
  return { score: absoluteScore + Math.max(0, trendScore), breakdown };
}

// ============ FREQUENCY SCORING (10 pts) ============

export function scoreFrequency(
  impressions: number,
  reach: number | undefined
): { score: number; breakdown: ScoreBreakdown[] } {
  const breakdown: ScoreBreakdown[] = [];
  
  if (!reach || reach === 0 || !canScoreFrequency(impressions)) {
    // FALSE-POSITIVE PROTECTION: Award 0 points when we can't properly score
    breakdown.push({
      category: 'engagement',
      metric: 'Frequency',
      maxPoints: 10,
      earnedPoints: 0, // No points when ineligible
      value: 'N/A',
      threshold: !canScoreFrequency(impressions) ? 'Needs ≥1,000 impressions for scoring' : 'No reach data'
    });
    return { score: 0, breakdown };
  }
  
  const frequency = impressions / reach;
  let score = 0;
  
  if (frequency >= 2.0 && frequency <= 4.0) {
    score = 10; // Optimal range
  } else if (frequency >= 1.5 && frequency < 2.0) {
    score = 7; // Slightly under-exposed
  } else if (frequency < 1.5) {
    score = 3; // Underexposed
  } else if (frequency > 4.0 && frequency <= 6.0) {
    score = 4; // High exposure
  } else if (frequency > 6.0 && frequency <= 7.0) {
    score = 2; // Fatigue emerging
  } else {
    score = 0; // Likely fatigue (>7)
  }
  
  breakdown.push({
    category: 'engagement',
    metric: 'Frequency',
    maxPoints: 10,
    earnedPoints: score,
    value: `${frequency.toFixed(1)}x`,
    threshold: score >= 7 ? '2-4x (optimal)' : frequency < 2 ? '< 2x (underexposed)' : '> 4x (high exposure)'
  });
  
  return { score, breakdown };
}

// ============ CPC SCORING (20 pts) ============
// Per spec: Uses baseline_cpc (previous period CPC) for comparison
// cpc_delta = (baseline_cpc - CPC) / baseline_cpc
// ≥40% → 20, ≥20% → 16, ≥0% → 12, ≥-20% → 6, ≥-40% → 3, else 0

export function scoreCpc(
  currentCpc: number,
  previousCpc: number | undefined,
  _accountAvgCpc: number, // Keep param for backward compat but don't use
  clicks: number
): { score: number; breakdown: ScoreBreakdown[] } {
  const breakdown: ScoreBreakdown[] = [];
  
  if (clicks < 20 || currentCpc === 0) {
    breakdown.push({
      category: 'cost',
      metric: 'CPC',
      maxPoints: 20,
      earnedPoints: 0,
      value: 'N/A',
      threshold: 'Needs ≥20 clicks for scoring'
    });
    return { score: 0, breakdown };
  }
  
  // Use baseline (previous period CPC) for comparison
  if (previousCpc === undefined || previousCpc <= 0) {
    breakdown.push({
      category: 'cost',
      metric: 'CPC',
      maxPoints: 20,
      earnedPoints: 0,
      value: `$${currentCpc.toFixed(2)}`,
      threshold: 'No baseline (previous period) for scoring'
    });
    return { score: 0, breakdown };
  }
  
  // cpc_delta = (baseline_cpc - CPC) / baseline_cpc
  const cpcDelta = (previousCpc - currentCpc) / previousCpc;
  let score = 0;
  
  if (cpcDelta >= 0.40) {
    score = 20;
  } else if (cpcDelta >= 0.20) {
    score = 16;
  } else if (cpcDelta >= 0.00) {
    score = 12;
  } else if (cpcDelta >= -0.20) {
    score = 6;
  } else if (cpcDelta >= -0.40) {
    score = 3;
  } else {
    score = 0;
  }
  
  breakdown.push({
    category: 'cost',
    metric: 'CPC',
    maxPoints: 20,
    earnedPoints: score,
    value: `$${currentCpc.toFixed(2)} vs $${previousCpc.toFixed(2)}`,
    trend: cpcDelta >= 0 ? 'improving' : 'worsening',
    threshold: cpcDelta >= 0 ? `${(cpcDelta * 100).toFixed(0)}% below baseline` : `${(-cpcDelta * 100).toFixed(0)}% above baseline`
  });
  
  return { score, breakdown };
}

// ============ CPM SCORING (10 pts) ============
// Per spec: Uses cpm_change (trend only, no absolute comparison)
// ≤-20% → 10, ≤-10% → 7, ≤5% → 5, ≤20% → 2, else 0

export function scoreCpm(
  currentCpm: number,
  previousCpm: number | undefined,
  _accountAvgCpm: number, // Keep param for backward compat but don't use
  impressions: number,
  isUnderDelivered: boolean = false
): { score: number; breakdown: ScoreBreakdown[] } {
  const breakdown: ScoreBreakdown[] = [];
  
  if (impressions < 1000 || currentCpm === 0) {
    breakdown.push({
      category: 'cost',
      metric: 'CPM',
      maxPoints: 10,
      earnedPoints: 0,
      value: 'N/A',
      threshold: 'Needs ≥1,000 impressions for scoring'
    });
    return { score: 0, breakdown };
  }
  
  // Per spec: If is_under_delivered is true, score = 0
  if (isUnderDelivered) {
    breakdown.push({
      category: 'cost',
      metric: 'CPM',
      maxPoints: 10,
      earnedPoints: 0,
      value: `$${currentCpm.toFixed(2)}`,
      threshold: 'Under-delivered (no CPM score)'
    });
    return { score: 0, breakdown };
  }
  
  // Use cpm_change (trend-based scoring)
  if (previousCpm === undefined || previousCpm <= 0) {
    breakdown.push({
      category: 'cost',
      metric: 'CPM',
      maxPoints: 10,
      earnedPoints: 0,
      value: `$${currentCpm.toFixed(2)}`,
      threshold: 'No baseline (previous period) for scoring'
    });
    return { score: 0, breakdown };
  }
  
  const cpmChange = ((currentCpm - previousCpm) / previousCpm) * 100;
  let score = 0;
  
  if (cpmChange <= -20) {
    score = 10;
  } else if (cpmChange <= -10) {
    score = 7;
  } else if (cpmChange <= 5) {
    score = 5;
  } else if (cpmChange <= 20) {
    score = 2;
  } else {
    score = 0;
  }
  
  breakdown.push({
    category: 'cost',
    metric: 'CPM',
    maxPoints: 10,
    earnedPoints: score,
    value: `$${currentCpm.toFixed(2)} (${cpmChange >= 0 ? '+' : ''}${cpmChange.toFixed(0)}%)`,
    trend: cpmChange <= 0 ? 'improving' : 'worsening',
    threshold: cpmChange <= 0 ? 'Decreasing CPM' : 'Increasing CPM'
  });
  
  return { score, breakdown };
}

// ============ CPA SCORING (5 pts) ============
// Per spec: Uses baseline_cpa (previous period CPA) for comparison
// cpa_delta = (baseline_cpa - CPA) / baseline_cpa
// ≥30% → 5, ≥0% → 4, ≥-20% → 2, else 0

export function scoreCpa(
  currentCpa: number,
  previousCpa: number | undefined,
  _accountAvgCpa: number, // Keep param for backward compat but don't use
  conversions: number
): { score: number; breakdown: ScoreBreakdown[] } {
  const breakdown: ScoreBreakdown[] = [];
  
  if (!canScoreCpa(conversions)) {
    breakdown.push({
      category: 'cost',
      metric: 'CPA',
      maxPoints: 5,
      earnedPoints: 0,
      value: 'N/A',
      threshold: 'Needs ≥3 conversions'
    });
    return { score: 0, breakdown };
  }
  
  // Use baseline (previous period CPA) for comparison
  if (previousCpa === undefined || previousCpa <= 0) {
    breakdown.push({
      category: 'cost',
      metric: 'CPA',
      maxPoints: 5,
      earnedPoints: 0,
      value: `$${currentCpa.toFixed(2)}`,
      threshold: 'No baseline (previous period) for scoring'
    });
    return { score: 0, breakdown };
  }
  
  // cpa_delta = (baseline_cpa - CPA) / baseline_cpa
  const cpaDelta = (previousCpa - currentCpa) / previousCpa;
  let score = 0;
  
  if (cpaDelta >= 0.30) {
    score = 5;
  } else if (cpaDelta >= 0.00) {
    score = 4;
  } else if (cpaDelta >= -0.20) {
    score = 2;
  } else {
    score = 0;
  }
  
  breakdown.push({
    category: 'cost',
    metric: 'CPA',
    maxPoints: 5,
    earnedPoints: score,
    value: `$${currentCpa.toFixed(2)} vs $${previousCpa.toFixed(2)}`,
    trend: cpaDelta >= 0 ? 'improving' : 'worsening',
    threshold: cpaDelta >= 0 ? `${(cpaDelta * 100).toFixed(0)}% below baseline` : `${(-cpaDelta * 100).toFixed(0)}% above baseline`
  });
  
  return { score, breakdown };
}

// ============ PENETRATION SCORING (10 pts) ============

export function scorePenetration(
  penetration: number | undefined,
  impressions: number
): { score: number; breakdown: ScoreBreakdown[] } {
  const breakdown: ScoreBreakdown[] = [];
  
  if (penetration === undefined || !canScorePenetration(impressions)) {
    // FALSE-POSITIVE PROTECTION: Award 0 points when we can't properly score
    breakdown.push({
      category: 'audience',
      metric: 'Audience Penetration',
      maxPoints: 10,
      earnedPoints: 0, // No points when ineligible
      value: 'N/A',
      threshold: !canScorePenetration(impressions) ? 'Needs ≥1,000 impressions for scoring' : 'No penetration data'
    });
    return { score: 0, breakdown };
  }
  
  let score = 0;
  
  // Optimal is 10-30%, higher means fatigue risk
  if (penetration >= 10 && penetration <= 30) {
    score = 10; // Sweet spot
  } else if (penetration > 30 && penetration <= 45) {
    score = 7;
  } else if (penetration > 45 && penetration <= 60) {
    score = 4;
  } else if (penetration > 60) {
    score = 1; // Likely fatigue
  } else if (penetration < 10) {
    score = 2; // Under-delivery
  }
  
  breakdown.push({
    category: 'audience',
    metric: 'Audience Penetration',
    maxPoints: 10,
    earnedPoints: score,
    value: `${penetration.toFixed(0)}%`,
    threshold: score >= 7 ? '10-45% (healthy)' : penetration > 60 ? '> 60% (fatigue risk)' : '< 10% (under-delivery)'
  });
  
  return { score, breakdown };
}

// ============ SENIORITY SCORING (10 pts) ============

export function scoreSeniority(
  seniorityData: SeniorityData | undefined,
  impressions: number
): { score: number; breakdown: ScoreBreakdown[] } {
  const breakdown: ScoreBreakdown[] = [];
  
  if (!seniorityData?.hasData || !canScoreSeniority(impressions)) {
    // FALSE-POSITIVE PROTECTION: Award 0 points when we can't properly score
    breakdown.push({
      category: 'audience',
      metric: 'Seniority Quality',
      maxPoints: 10,
      earnedPoints: 0, // No points when ineligible
      value: 'N/A',
      threshold: !canScoreSeniority(impressions) ? 'Needs ≥1,000 impressions for scoring' : 'No seniority data'
    });
    return { score: 0, breakdown };
  }
  
  // Per spec: seniority_shift thresholds - ≥10%→10, ≥5%→7, ≥0%→5, else 0
  const shift = seniorityData.currentDecisionMakerPct - seniorityData.previousDecisionMakerPct;
  let score = 0;
  
  if (shift >= 10) {
    score = 10; // Strong shift toward decision-makers
  } else if (shift >= 5) {
    score = 7;
  } else if (shift >= 0) {
    score = 5; // Stable or improving
  } else {
    score = 0; // Shift downward
  }
  
  breakdown.push({
    category: 'audience',
    metric: 'Seniority Quality',
    maxPoints: 10,
    earnedPoints: score,
    value: `${seniorityData.currentDecisionMakerPct.toFixed(0)}% DM`,
    trend: shift >= 0 ? `+${shift.toFixed(0)}%` : `${shift.toFixed(0)}%`,
    threshold: score >= 7 ? 'Improving toward DMs' : score === 5 ? 'Stable' : 'Shifting away from DMs'
  });
  
  return { score, breakdown };
}

// ============ MAIN CAMPAIGN SCORING FUNCTION ============

export function scoreCampaign(
  current: CampaignMetrics,
  previous: CampaignMetrics | undefined,
  accountAvgCpc: number,
  accountAvgCpm: number,
  accountAvgCpa: number,
  seniorityData: SeniorityData | undefined,
  campaignAgeDays: number
): CampaignScore {
  // Check eligibility
  const eligibility = checkCampaignEligibility(current, campaignAgeDays);
  
  if (!eligibility.eligible) {
    return {
      totalScore: 0,
      maxScore: 100,
      percentage: 0,
      engagementScore: 0,
      engagementMax: 45,
      costScore: 0,
      costMax: 35,
      audienceScore: 0,
      audienceMax: 20,
      status: 'performing_well', // Don't flag ineligible as problems
      breakdown: [],
      issues: [],
      positiveSignals: [],
      causation: [],
      eligible: false,
      ineligibleReason: eligibility.reason
    };
  }
  
  const allBreakdown: ScoreBreakdown[] = [];
  const issues: string[] = [];
  const positiveSignals: string[] = [];
  
  // Calculate metrics
  const currentCtr = current.impressions > 0 ? (current.clicks / current.impressions) * 100 : 0;
  const previousCtr = previous && previous.impressions > 0 ? (previous.clicks / previous.impressions) * 100 : undefined;
  
  const currentCpc = current.clicks > 0 ? current.spend / current.clicks : 0;
  const previousCpc = previous && previous.clicks > 0 ? previous.spend / previous.clicks : undefined;
  
  const currentCpm = current.impressions > 0 ? (current.spend / current.impressions) * 1000 : 0;
  const previousCpm = previous && previous.impressions > 0 ? (previous.spend / previous.impressions) * 1000 : undefined;
  
  const currentCpa = current.conversions > 0 ? current.spend / current.conversions : 0;
  const previousCpa = previous && previous.conversions > 0 ? previous.spend / previous.conversions : undefined;
  
  // ============ ENGAGEMENT (45 pts) ============
  
  // Dwell Time (20 pts)
  const dwellResult = scoreDwellTime(
    current.dwellTimeSeconds,
    previous?.dwellTimeSeconds,
    current.clicks
  );
  allBreakdown.push(...dwellResult.breakdown);
  
  // CTR (15 pts)
  const ctrResult = scoreCtr(currentCtr, previousCtr, current.impressions);
  allBreakdown.push(...ctrResult.breakdown);
  
  // Frequency (10 pts)
  const frequencyResult = scoreFrequency(current.impressions, current.reach);
  allBreakdown.push(...frequencyResult.breakdown);
  
  const engagementScore = dwellResult.score + ctrResult.score + frequencyResult.score;
  
  // ============ COST EFFICIENCY (35 pts) ============
  
  // CPC (20 pts)
  const cpcResult = scoreCpc(currentCpc, previousCpc, accountAvgCpc, current.clicks);
  allBreakdown.push(...cpcResult.breakdown);
  
  // CPM (10 pts)
  const cpmResult = scoreCpm(currentCpm, previousCpm, accountAvgCpm, current.impressions);
  allBreakdown.push(...cpmResult.breakdown);
  
  // CPA (5 pts)
  const cpaResult = scoreCpa(currentCpa, previousCpa, accountAvgCpa, current.conversions);
  allBreakdown.push(...cpaResult.breakdown);
  
  const costScore = cpcResult.score + cpmResult.score + cpaResult.score;
  
  // ============ AUDIENCE QUALITY (20 pts) ============
  
  // Penetration (10 pts)
  const penetrationResult = scorePenetration(current.audiencePenetration, current.impressions);
  allBreakdown.push(...penetrationResult.breakdown);
  
  // Seniority (10 pts)
  const seniorityResult = scoreSeniority(seniorityData, current.impressions);
  allBreakdown.push(...seniorityResult.breakdown);
  
  const audienceScore = penetrationResult.score + seniorityResult.score;
  
  // ============ TOTAL & STATUS ============
  
  const totalScore = engagementScore + costScore + audienceScore;
  const percentage = (totalScore / 100) * 100;
  
  // Determine status based on percentage
  // Thresholds: 0-49 = needs_attention, 50-69 = mild_issues (Monitor Closely), 70-100 = performing_well (Strong Performance)
  let status: 'needs_attention' | 'mild_issues' | 'performing_well';
  if (percentage < 50) {
    status = 'needs_attention';
  } else if (percentage < 70) {
    status = 'mild_issues';
  } else {
    status = 'performing_well';
  }
  
  // Generate issues and positive signals from breakdown
  for (const item of allBreakdown) {
    const pctEarned = item.maxPoints > 0 ? (item.earnedPoints / item.maxPoints) * 100 : 0;
    
    if (pctEarned <= 25) {
      issues.push(`${item.metric}: ${item.value}`);
    } else if (pctEarned >= 80) {
      positiveSignals.push(`${item.metric}: ${item.value}`);
    }
  }
  
  return {
    totalScore,
    maxScore: 100,
    percentage,
    engagementScore,
    engagementMax: 45,
    costScore,
    costMax: 35,
    audienceScore,
    audienceMax: 20,
    status,
    breakdown: allBreakdown,
    issues: issues.slice(0, 5), // Top 5 issues
    positiveSignals: positiveSignals.slice(0, 3), // Top 3 strengths
    causation: [], // Will be filled by causation engine
    eligible: true
  };
}

// ============ AD DIAGNOSTICS ============

export function getAdAgeBucket(firstActiveDate: Date | undefined): { days: number; label: 'Learning' | 'Stable' | 'Fatigue' } {
  if (!firstActiveDate) {
    return { days: 0, label: 'Learning' };
  }
  
  const days = Math.floor((Date.now() - firstActiveDate.getTime()) / (1000 * 60 * 60 * 24));
  
  // Per spec: 0-13 days = Learning, 14-59 days = Stable, ≥60 days = Potential fatigue
  if (days < 14) {
    return { days, label: 'Learning' };
  } else if (days < 60) {
    return { days, label: 'Stable' };
  } else {
    return { days, label: 'Fatigue' };
  }
}

export function diagnoseAd(
  ad: AdMetrics,
  campaignAvgCtr: number,
  campaignAvgDwell: number | null,
  campaignAvgCpc: number,
  campaignTotalImpressions: number,
  previousAd: AdMetrics | undefined
): AdDiagnostic {
  const ctr = ad.impressions > 0 ? (ad.clicks / ad.impressions) * 100 : 0;
  const cpc = ad.clicks > 0 ? ad.spend / ad.clicks : 0;
  const cpm = ad.impressions > 0 ? (ad.spend / ad.impressions) * 1000 : 0;
  const dwellTime = ad.dwellTimeSeconds || null;
  
  const impressionShare = campaignTotalImpressions > 0 
    ? (ad.impressions / campaignTotalImpressions) * 100 
    : 0;
  
  const ctrVsCampaign = campaignAvgCtr > 0 ? ((ctr - campaignAvgCtr) / campaignAvgCtr) * 100 : 0;
  const dwellVsCampaign = campaignAvgDwell && dwellTime 
    ? ((dwellTime - campaignAvgDwell) / campaignAvgDwell) * 100 
    : null;
  const cpcVsCampaign = campaignAvgCpc > 0 ? ((cpc - campaignAvgCpc) / campaignAvgCpc) * 100 : 0;
  
  const { days: adAgeDays, label: ageLabel } = getAdAgeBucket(ad.firstActiveDate);
  
  const issues: string[] = [];
  const strengths: string[] = [];
  let recommendation: string | undefined;
  
  // Determine flag
  let flag: AdDiagnostic['flag'];
  let flagColor: AdDiagnostic['flagColor'];
  let tier: 1 | 2 | 3;
  let tierLabel: 'High Contributor' | 'Neutral' | 'Weak Contributor';
  
  // Low volume check first (Tier 2 - cannot evaluate)
  if (ad.impressions < 1000) {
    flag = 'low_volume';
    flagColor = 'blue';
    tier = 2;
    tierLabel = 'Neutral';
    recommendation = 'Cannot evaluate - needs ≥1,000 impressions';
  }
  // Learning phase (Tier 2 - still learning)
  else if (ageLabel === 'Learning') {
    flag = 'learning';
    flagColor = 'yellow';
    tier = 2;
    tierLabel = 'Neutral';
    recommendation = 'Performance unstable - allow 14+ days to stabilize';
  }
  // Fatigue detection (Tier 3 - needs refresh)
  else if (ageLabel === 'Fatigue' && ctrVsCampaign < -10 && (dwellVsCampaign === null || dwellVsCampaign < -10)) {
    flag = 'fatigue';
    flagColor = 'purple';
    tier = 3;
    tierLabel = 'Weak Contributor';
    issues.push(`Ad is ${adAgeDays} days old with declining performance`);
    recommendation = `Pause ad - pulling down campaign (${adAgeDays} days old, CTR ${ctrVsCampaign.toFixed(0)}% below avg)`;
  }
  // Weak contributor (Tier 3)
  else if (ctrVsCampaign < -15 || (dwellVsCampaign !== null && dwellVsCampaign < -10)) {
    flag = 'weak';
    flagColor = 'red';
    tier = 3;
    tierLabel = 'Weak Contributor';
    if (ctrVsCampaign < -15) issues.push(`CTR ${Math.abs(ctrVsCampaign).toFixed(0)}% below campaign avg`);
    if (dwellVsCampaign !== null && dwellVsCampaign < -10) issues.push(`Dwell ${Math.abs(dwellVsCampaign).toFixed(0)}% below avg`);
    if (impressionShare > 70) {
      issues.push(`Over-served (${impressionShare.toFixed(0)}% impression share)`);
      recommendation = `Ad overload: ${impressionShare.toFixed(0)}% impressions to one creative - refresh needed`;
    } else {
      recommendation = `Consider pausing - dragging down campaign (${ctrVsCampaign.toFixed(0)}% CTR, ${dwellVsCampaign !== null ? dwellVsCampaign.toFixed(0) + '% dwell' : 'no dwell data'})`;
    }
  }
  // High contributor (Tier 1)
  else if (ctrVsCampaign >= 15 && (dwellVsCampaign === null || dwellVsCampaign >= 0) && cpcVsCampaign <= 10) {
    flag = 'high_contributor';
    flagColor = 'green';
    tier = 1;
    tierLabel = 'High Contributor';
    strengths.push(`CTR ${ctrVsCampaign.toFixed(0)}% above campaign avg`);
    if (dwellVsCampaign !== null && dwellVsCampaign >= 10) strengths.push(`Dwell ${dwellVsCampaign.toFixed(0)}% above avg`);
    if (cpcVsCampaign < -10) strengths.push(`CPC ${Math.abs(cpcVsCampaign).toFixed(0)}% below avg`);
    recommendation = `Strong performer - create a variant based on this ad`;
  }
  // Stable (Tier 2)
  else {
    flag = 'stable';
    flagColor = 'grey';
    tier = 2;
    tierLabel = 'Neutral';
  }
  
  return {
    creativeId: ad.creativeId,
    flag,
    flagColor,
    tier,
    tierLabel,
    ctr,
    ctrVsCampaign,
    dwellTime,
    dwellVsCampaign,
    cpc,
    cpcVsCampaign,
    cpm,
    impressionShare,
    adAgeDays,
    ageLabel,
    issues,
    strengths,
    recommendation
  };
}

// ============ CAUSATION ENGINE ============

// 48-hour cooling-off period (in milliseconds)
const COOLING_OFF_MS = 48 * 60 * 60 * 1000;

// Helper to check if change is at least 48 hours old
function isChangeOldEnough(changeTimestamp: number | undefined): boolean {
  if (!changeTimestamp) return true; // No change recorded means no cooling-off needed
  const now = Date.now();
  const changeAge = now - changeTimestamp;
  return changeAge >= COOLING_OFF_MS;
}

export function analyzeCausation(
  current: CampaignMetrics,
  previous: CampaignMetrics | undefined,
  tracking: TrackingData | undefined,
  adDiagnostics: AdDiagnostic[],
  seniorityData?: SeniorityData
): CausationInsight[] {
  const insights: CausationInsight[] = [];
  
  if (!previous || !tracking) {
    return insights;
  }
  
  // 48-HOUR COOLING-OFF SAFEGUARD: Don't produce insights for changes less than 48 hours old
  const mostRecentChange = Math.max(
    tracking.lastBidChange || 0,
    tracking.lastBudgetChange || 0,
    tracking.lastTargetingChange || 0,
    tracking.lastCreativeChange || 0
  );
  
  const changeOldEnough = isChangeOldEnough(mostRecentChange);
  
  const currentCtr = current.impressions > 0 ? (current.clicks / current.impressions) * 100 : 0;
  const previousCtr = previous.impressions > 0 ? (previous.clicks / previous.impressions) * 100 : 0;
  const ctrChange = previousCtr > 0 ? ((currentCtr - previousCtr) / previousCtr) * 100 : 0;
  
  const currentCpm = current.impressions > 0 ? (current.spend / current.impressions) * 1000 : 0;
  const previousCpm = previous.impressions > 0 ? (previous.spend / previous.impressions) * 1000 : 0;
  const cpmChange = previousCpm > 0 ? ((currentCpm - previousCpm) / previousCpm) * 100 : 0;
  
  const currentDwell = current.dwellTimeSeconds || 0;
  const previousDwell = previous.dwellTimeSeconds || 0;
  const dwellChange = previousDwell > 0 ? ((currentDwell - previousDwell) / previousDwell) * 100 : 0;
  
  // ============ LAYER 1: CREATIVE CAUSATION ============
  
  // Check for fatigue ads (Age ≥60 days + CTR↓ & Dwell↓ + Impression share >70%)
  const fatigueAds = adDiagnostics.filter(ad => ad.flag === 'fatigue');
  if (fatigueAds.length > 0) {
    const totalImpShare = fatigueAds.reduce((sum, ad) => sum + ad.impressionShare, 0);
    if (totalImpShare > 50) {
      insights.push({
        layer: 'creative',
        type: 'creative_fatigue',
        severity: 'primary',
        message: `Creative fatigue: ${fatigueAds.length} ad(s) over 60 days old account for ${totalImpShare.toFixed(0)}% of impressions`,
        recommendation: 'Refresh creatives with new variants'
      });
    }
  }
  
  // Check for over-served ad (Impression share >70%)
  const overServedAds = adDiagnostics.filter(ad => ad.impressionShare > 70);
  if (overServedAds.length > 0) {
    const severity = ctrChange < -10 ? 'primary' : 'secondary';
    insights.push({
      layer: 'creative',
      type: 'over_served',
      severity,
      message: `Algorithm over-serving ${overServedAds[0].impressionShare.toFixed(0)}% impressions to one ad - likely causing fatigue`,
      recommendation: 'Add 2-3 new ad variants to distribute delivery'
    });
  }
  
  // Check for too few ads (<3 active)
  const activeAds = adDiagnostics.filter(ad => ad.flag !== 'low_volume');
  if (activeAds.length < 3) {
    insights.push({
      layer: 'creative',
      type: 'insufficient_creatives',
      severity: 'secondary',
      message: `Only ${activeAds.length} active ad(s) - LinkedIn serves 1 ad per user per day`,
      recommendation: 'Add more ads to increase exposure variety and delivery'
    });
  }
  
  // NEW: New creative impact analysis - check if new ads (<13 days) are performing better
  const learningAds = adDiagnostics.filter(ad => ad.ageLabel === 'Learning' && ad.flag !== 'low_volume');
  const stableAds = adDiagnostics.filter(ad => ad.ageLabel === 'Stable' && ad.flag !== 'low_volume');
  
  if (learningAds.length > 0 && stableAds.length > 0) {
    const avgNewCtr = learningAds.reduce((sum, ad) => sum + ad.ctr, 0) / learningAds.length;
    const avgOldCtr = stableAds.reduce((sum, ad) => sum + ad.ctr, 0) / stableAds.length;
    const avgNewDwell = learningAds.reduce((sum, ad) => sum + ad.dwellTime, 0) / learningAds.length;
    const avgOldDwell = stableAds.reduce((sum, ad) => sum + ad.dwellTime, 0) / stableAds.length;
    
    if (avgNewCtr > avgOldCtr * 1.15 && avgNewDwell > avgOldDwell * 1.1) {
      insights.push({
        layer: 'creative',
        type: 'new_creative_uplift',
        severity: 'info',
        message: `New creatives (<13 days) outperforming older ads: +${((avgNewCtr / avgOldCtr - 1) * 100).toFixed(0)}% CTR, +${((avgNewDwell / avgOldDwell - 1) * 100).toFixed(0)}% dwell`,
        recommendation: 'Consider pausing underperforming older ads to boost new creative delivery'
      });
    } else if (avgNewCtr < avgOldCtr * 0.85 || avgNewDwell < avgOldDwell * 0.9) {
      insights.push({
        layer: 'creative',
        type: 'new_creative_underperform',
        severity: 'info',
        message: `New creatives (<13 days) underperforming vs established ads - still in learning phase`,
        recommendation: 'Give new creatives time to optimize, or review messaging alignment'
      });
    }
  }
  
  // CTR↓ but Dwell↑ pattern - B2B deep consumption
  if (ctrChange < -10 && dwellChange > 10) {
    insights.push({
      layer: 'creative',
      type: 'deep_consumption',
      severity: 'info',
      message: 'CTR declining but dwell time increasing - indicates deep B2B content consumption',
      recommendation: 'Content is resonating post-click; consider optimizing ad copy for higher CTR'
    });
  }
  
  // CTR↑ but Dwell↓ pattern - Curiosity clicks
  if (ctrChange > 10 && dwellChange < -10) {
    insights.push({
      layer: 'creative',
      type: 'curiosity_clicks',
      severity: 'secondary',
      message: 'CTR increasing but dwell time decreasing - curiosity clicks not converting to engagement',
      recommendation: 'Review landing page alignment with ad messaging'
    });
  }
  
  // ============ LAYER 2: BIDDING CAUSATION ============
  // 48-HOUR COOLING-OFF: Only analyze bidding changes if changes are at least 48 hours old
  
  if (changeOldEnough) {
  // Suggested bid movement (THE MOST IMPORTANT EXTERNAL SIGNAL)
  // Per spec: ↑>20% = Auction pressure high, ↑10-20% = Moderate, ↓>10% = Cheaper, ↓>20% = Major drop
  if (tracking.suggestedBidMin && tracking.previousSuggestedBidMin) {
    const bidChange = ((tracking.suggestedBidMin - tracking.previousSuggestedBidMin) / tracking.previousSuggestedBidMin) * 100;
    
    if (bidChange > 20) {
      // High auction pressure - competitors bidding more aggressively
      insights.push({
        layer: 'bidding',
        type: 'auction_pressure_high',
        severity: cpmChange > 15 ? 'primary' : 'secondary',
        message: `High auction pressure: suggested bid up ${bidChange.toFixed(0)}% (competitors bidding more)`,
        recommendation: cpmChange > 15 
          ? 'Raise bid to maintain placements, or accept lower delivery volume' 
          : 'Monitor for further increases - may need to adjust bid'
      });
      
      // Check correlated effects
      if (ctrChange < -10) {
        insights.push({
          layer: 'bidding',
          type: 'placement_quality_drop',
          severity: 'secondary',
          message: 'CTR declining with bid pressure - worse placements likely',
          recommendation: 'Higher bids may restore premium placements'
        });
      }
    } else if (bidChange > 10) {
      // Moderate auction pressure
      insights.push({
        layer: 'bidding',
        type: 'auction_pressure_moderate',
        severity: 'info',
        message: `Moderate auction pressure: suggested bid up ${bidChange.toFixed(0)}%`,
        recommendation: 'Monitor for further increases'
      });
    } else if (bidChange < -20) {
      // Major drop in demand
      insights.push({
        layer: 'bidding',
        type: 'auction_opportunity_major',
        severity: 'info',
        message: `Major drop in auction demand: suggested bid down ${Math.abs(bidChange).toFixed(0)}%`,
        recommendation: 'Opportunity to significantly reduce costs while maintaining volume'
      });
    } else if (bidChange < -10) {
      // Cheaper auction
      insights.push({
        layer: 'bidding',
        type: 'auction_opportunity',
        severity: 'info',
        message: `Auction becoming cheaper: suggested bid down ${Math.abs(bidChange).toFixed(0)}%`,
        recommendation: 'Opportunity to maintain results at lower cost'
      });
    }
  }
  
  // Bid strategy change detection
  if (tracking.bidStrategy !== tracking.previousBidStrategy && tracking.previousBidStrategy) {
    if (tracking.bidStrategy === 'MAXIMIZE_DELIVERY' && tracking.previousBidStrategy === 'MANUAL') {
      insights.push({
        layer: 'bidding',
        type: 'strategy_to_max_delivery',
        severity: 'secondary',
        message: 'Switched from Manual to Maximize Delivery - expect CPM↑ and CPC↓',
        recommendation: 'Monitor spend closely - Maximize Delivery will spend full budget'
      });
    } else if (tracking.bidStrategy === 'MANUAL' && tracking.previousBidStrategy === 'MAXIMIZE_DELIVERY') {
      insights.push({
        layer: 'bidding',
        type: 'strategy_to_manual',
        severity: 'secondary',
        message: 'Switched from Maximize Delivery to Manual bidding - may see volatility',
        recommendation: 'Allow 48-72 hours for performance to stabilize'
      });
    } else {
      insights.push({
        layer: 'bidding',
        type: 'strategy_change',
        severity: 'secondary',
        message: `Bidding strategy changed from ${tracking.previousBidStrategy} to ${tracking.bidStrategy}`,
        recommendation: 'Monitor metrics as system re-optimizes'
      });
    }
  }
  
  // Manual bid change detection
  if (tracking.bidValue && tracking.previousBidValue) {
    const bidChange = ((tracking.bidValue - tracking.previousBidValue) / tracking.previousBidValue) * 100;
    if (bidChange > 15) {
      insights.push({
        layer: 'bidding',
        type: 'bid_increased',
        severity: 'secondary',
        message: `Manual bid increased ${bidChange.toFixed(0)}%`,
        recommendation: 'Expect CTR decrease (worse quality placements) but delivery increase'
      });
    } else if (bidChange < -15) {
      insights.push({
        layer: 'bidding',
        type: 'bid_decreased',
        severity: 'secondary',
        message: `Manual bid decreased ${Math.abs(bidChange).toFixed(0)}%`,
        recommendation: 'Expect CTR increase (better quality placements) but delivery may decrease'
      });
    }
  }
  
  // CPC↑ with stable CTR = cost inflation
  const currentCpc = current.clicks > 0 ? current.spend / current.clicks : 0;
  const previousCpc = previous.clicks > 0 ? previous.spend / previous.clicks : 0;
  const cpcChange = previousCpc > 0 ? ((currentCpc - previousCpc) / previousCpc) * 100 : 0;
  
  if (cpcChange > 15 && Math.abs(ctrChange) < 10) {
    insights.push({
      layer: 'bidding',
      type: 'cost_inflation',
      severity: 'secondary',
      message: `CPC up ${cpcChange.toFixed(0)}% with stable CTR - auction cost inflation`,
      recommendation: 'Review bid strategy or wait for market conditions to normalize'
    });
  }
  } // End of Layer 2 changeOldEnough guard
  
  // ============ LAYER 3: TARGETING CAUSATION ============
  // 48-HOUR COOLING-OFF: Only analyze targeting changes if changes are at least 48 hours old
  
  if (changeOldEnough) {
  // Audience size change (Shrank >20% → CPM↑, CTR↓ | Expanded → CPM↓, CTR more volatile)
  if (tracking.audienceSize && tracking.previousAudienceSize) {
    const sizeChange = ((tracking.audienceSize - tracking.previousAudienceSize) / tracking.previousAudienceSize) * 100;
    
    if (sizeChange < -20) {
      insights.push({
        layer: 'targeting',
        type: 'audience_shrink',
        severity: cpmChange > 15 || ctrChange < -10 ? 'primary' : 'secondary',
        message: `Audience shrank ${Math.abs(sizeChange).toFixed(0)}% - expect CPM↑, CTR↓`,
        recommendation: 'Expand targeting criteria or add new segments'
      });
    } else if (sizeChange > 30) {
      insights.push({
        layer: 'targeting',
        type: 'audience_expand',
        severity: 'info',
        message: `Audience expanded ${sizeChange.toFixed(0)}%`,
        recommendation: 'Monitor CTR - larger audiences may have more volatility'
      });
    }
  }
  
  // Penetration exhaustion (>60% = audience fatigue)
  if (current.audiencePenetration && current.audiencePenetration > 60) {
    const currentFreq = current.impressions > 0 && current.reach ? current.impressions / current.reach : 0;
    insights.push({
      layer: 'targeting',
      type: 'audience_exhaustion',
      severity: ctrChange < -10 ? 'primary' : 'secondary',
      message: `Audience penetration at ${current.audiencePenetration.toFixed(0)}%${currentFreq > 6 ? ` with high frequency (${currentFreq.toFixed(1)})` : ''} - exhaustion likely`,
      recommendation: 'Expand audience, rotate targeting, or add new segments'
    });
  }
  
  // Seniority shift analysis (per spec)
  if (seniorityData?.hasData) {
    const shift = seniorityData.currentDecisionMakerPct - seniorityData.previousDecisionMakerPct;
    
    if (shift >= 10) {
      // +10% seniors → CTR↓, dwell↑, CPC↑
      insights.push({
        layer: 'targeting',
        type: 'seniority_shift_up',
        severity: 'info',
        message: `Seniority shifted +${shift.toFixed(0)}% toward decision-makers`,
        recommendation: ctrChange < -10 
          ? 'CTR decline is normal for senior audiences - they click less but engage deeper'
          : 'Quality audience shift - expect higher dwell time and CPC'
      });
    } else if (shift <= -10) {
      // -seniority → CTR↑, dwell↓
      insights.push({
        layer: 'targeting',
        type: 'seniority_shift_down',
        severity: ctrChange > 10 && dwellChange < -10 ? 'secondary' : 'info',
        message: `Seniority shifted ${shift.toFixed(0)}% away from decision-makers`,
        recommendation: 'Reaching more junior audiences - may see higher CTR but lower dwell time'
      });
    }
  }
  
  // Audience expansion impact
  if (tracking.audienceExpansion && ctrChange < -15) {
    insights.push({
      layer: 'targeting',
      type: 'expansion_impact',
      severity: 'secondary',
      message: 'Audience Expansion enabled - reaching lower-intent users',
      recommendation: 'Consider disabling Expansion if quality is priority over volume'
    });
  }
  
  // LAN (LinkedIn Audience Network) impact check
  if (tracking.linkedInAudienceNetwork && ctrChange < -20) {
    insights.push({
      layer: 'targeting',
      type: 'lan_impact',
      severity: 'secondary',
      message: 'LinkedIn Audience Network enabled - off-platform delivery often has lower CTR',
      recommendation: 'Consider disabling LAN if CTR quality is critical'
    });
  }
  } // End of Layer 3 changeOldEnough guard
  
  // Sort by severity
  const severityOrder = { primary: 0, secondary: 1, info: 2 };
  insights.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
  
  return insights;
}

// ============ NARRATIVE GENERATOR ============

export function generateNarrative(
  score: CampaignScore,
  causation: CausationInsight[]
): string {
  if (!score.eligible) {
    return score.ineligibleReason || 'Insufficient data for analysis';
  }
  
  const parts: string[] = [];
  
  // Score summary
  parts.push(`Score: ${score.totalScore}/100 (${score.percentage.toFixed(0)}%)`);
  
  // Category breakdown
  const engagementPct = (score.engagementScore / score.engagementMax * 100).toFixed(0);
  const costPct = (score.costScore / score.costMax * 100).toFixed(0);
  const audiencePct = (score.audienceScore / score.audienceMax * 100).toFixed(0);
  parts.push(`Engagement: ${engagementPct}% | Cost: ${costPct}% | Audience: ${audiencePct}%`);
  
  // Primary cause
  const primaryCause = causation.find(c => c.severity === 'primary');
  if (primaryCause) {
    parts.push(`Primary cause: ${primaryCause.message}`);
  }
  
  // Secondary causes
  const secondaryCauses = causation.filter(c => c.severity === 'secondary').slice(0, 2);
  if (secondaryCauses.length > 0) {
    parts.push(`Also: ${secondaryCauses.map(c => c.message).join('; ')}`);
  }
  
  // Top recommendation
  const topRec = causation.find(c => c.recommendation);
  if (topRec) {
    parts.push(`Recommendation: ${topRec.recommendation}`);
  }
  
  return parts.join('\n');
}
