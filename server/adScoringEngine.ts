export type AgeState = 'learning' | 'stable' | 'fatigue_risk';
export type PerformanceStatus = 'strong' | 'weak' | 'neutral';
export type CpcStatus = 'efficient' | 'inefficient' | 'neutral';
export type DistributionFlag = 'over_served' | 'under_served' | 'normal';
export type FatigueFlag = 'fatigued' | 'ageing_but_ok' | 'not_fatigued';
export type Contribution = 'high_contributor' | 'neutral_contributor' | 'weak_contributor' | 'learning' | 'not_evaluable';

export interface AdInput {
  adId: string;
  adName: string;
  adCtr: number;
  adDwell: number | null;
  adCpc: number | null;
  adCpm: number | null;
  adImpressions: number;
  adClicks: number;
  adAgeDays: number;
  adSpend: number;
  adStatus: 'ACTIVE' | 'PAUSED' | 'ARCHIVED' | string;
}

export interface CampaignAverages {
  campaignCtr: number;
  campaignDwell: number | null;
  campaignCpc: number | null;
  campaignCpm: number | null;
  campaignImpressionsTotal: number;
}

export interface AdScoringResult {
  adId: string;
  adName: string;
  adStatus: string;
  ageState: AgeState | null;
  impressionShare: number;
  ctrDelta: number | null;
  dwellDelta: number | null;
  cpcDelta: number | null;
  ctrStatus: PerformanceStatus | null;
  dwellStatus: PerformanceStatus | null;
  cpcStatus: CpcStatus | null;
  contribution: Contribution;
  fatigueFlag: FatigueFlag;
  distributionFlag: DistributionFlag;
  conflictReason: string | null;
  recommendation: string;
  lowVolume: boolean;
  adCtr: number;
  adDwell: number | null;
  adCpc: number | null;
  adCpm: number | null;
  adImpressions: number;
  adClicks: number;
  adAgeDays: number;
  adSpend: number;
}

export function scoreAd(ad: AdInput, campaignAvg: CampaignAverages): AdScoringResult {
  const impressionShare = campaignAvg.campaignImpressionsTotal > 0 
    ? ad.adImpressions / campaignAvg.campaignImpressionsTotal 
    : 0;

  const result: AdScoringResult = {
    adId: ad.adId,
    adName: ad.adName,
    adStatus: ad.adStatus,
    ageState: null,
    impressionShare,
    ctrDelta: null,
    dwellDelta: null,
    cpcDelta: null,
    ctrStatus: null,
    dwellStatus: null,
    cpcStatus: null,
    contribution: 'not_evaluable',
    fatigueFlag: 'not_fatigued',
    distributionFlag: 'normal',
    conflictReason: null,
    recommendation: 'insufficient_data',
    lowVolume: false,
    adCtr: ad.adCtr,
    adDwell: ad.adDwell,
    adCpc: ad.adCpc,
    adCpm: ad.adCpm,
    adImpressions: ad.adImpressions,
    adClicks: ad.adClicks,
    adAgeDays: ad.adAgeDays,
    adSpend: ad.adSpend,
  };

  if (ad.adStatus === 'PAUSED') {
    result.recommendation = 'no_action_ad_paused';
    return result;
  }

  if (ad.adImpressions < 1000) {
    result.lowVolume = true;
    result.contribution = 'not_evaluable';
    result.recommendation = 'insufficient_data';
    return result;
  }

  if (ad.adAgeDays <= 13) {
    result.ageState = 'learning';
  } else if (ad.adAgeDays >= 14 && ad.adAgeDays <= 59) {
    result.ageState = 'stable';
  } else {
    result.ageState = 'fatigue_risk';
  }

  if (campaignAvg.campaignCtr > 0) {
    result.ctrDelta = (ad.adCtr - campaignAvg.campaignCtr) / campaignAvg.campaignCtr;
  }
  if (campaignAvg.campaignDwell && campaignAvg.campaignDwell > 0 && ad.adDwell !== null) {
    result.dwellDelta = (ad.adDwell - campaignAvg.campaignDwell) / campaignAvg.campaignDwell;
  }
  if (campaignAvg.campaignCpc && campaignAvg.campaignCpc > 0 && ad.adCpc !== null) {
    result.cpcDelta = (campaignAvg.campaignCpc - ad.adCpc) / campaignAvg.campaignCpc;
  }

  if (result.ageState === 'learning') {
    result.contribution = 'learning';
    result.recommendation = 'allow_more_time';
    result.conflictReason = 'learning_phase_uncertain';
    return result;
  }

  if (result.ctrDelta !== null) {
    if (result.ctrDelta >= 0.10) {
      result.ctrStatus = 'strong';
    } else if (result.ctrDelta <= -0.15) {
      result.ctrStatus = 'weak';
    } else {
      result.ctrStatus = 'neutral';
    }
  }

  if (result.dwellDelta !== null) {
    if (result.dwellDelta >= 0.10) {
      result.dwellStatus = 'strong';
    } else if (result.dwellDelta <= -0.10) {
      result.dwellStatus = 'weak';
    } else {
      result.dwellStatus = 'neutral';
    }
  }

  if (result.cpcDelta !== null) {
    if (result.cpcDelta >= 0.10) {
      result.cpcStatus = 'efficient';
    } else if (result.cpcDelta <= -0.15) {
      result.cpcStatus = 'inefficient';
    } else {
      result.cpcStatus = 'neutral';
    }
  }

  if (impressionShare >= 0.70) {
    result.distributionFlag = 'over_served';
  } else if (impressionShare < 0.10) {
    result.distributionFlag = 'under_served';
  } else {
    result.distributionFlag = 'normal';
  }

  if (result.ageState === 'fatigue_risk') {
    if (result.ctrStatus === 'weak' || result.dwellStatus === 'weak') {
      result.fatigueFlag = 'fatigued';
    } else {
      result.fatigueFlag = 'ageing_but_ok';
    }
  } else {
    result.fatigueFlag = 'not_fatigued';
  }

  const ctrStrong = result.ctrStatus === 'strong';
  const dwellStrong = result.dwellStatus === 'strong';
  const cpcNotInefficient = result.cpcStatus !== 'inefficient';
  const ctrWeak = result.ctrStatus === 'weak';
  const dwellWeak = result.dwellStatus === 'weak';
  const cpcInefficient = result.cpcStatus === 'inefficient';

  if (ctrStrong && dwellStrong && cpcNotInefficient) {
    result.contribution = 'high_contributor';
  } else if (ctrWeak || dwellWeak || cpcInefficient) {
    result.contribution = 'weak_contributor';
  } else {
    result.contribution = 'neutral_contributor';
  }

  if (ctrWeak && dwellStrong) {
    result.conflictReason = 'senior_audience_or_message_depth';
    result.recommendation = 'strong_message_but_cta_weak';
  } else if (ctrStrong && dwellWeak) {
    result.conflictReason = 'curiosity_clicks';
    result.recommendation = 'improve_post_click_experience';
  } else if (result.distributionFlag === 'over_served' && result.contribution === 'weak_contributor') {
    result.conflictReason = 'algorithm_over_serving_weak_ad';
    result.recommendation = 'pause_or_replace';
  } else if (result.distributionFlag === 'over_served' && result.contribution === 'high_contributor') {
    result.conflictReason = 'top_ad_over_served';
    result.recommendation = 'create_variants';
  }

  if (!result.recommendation || result.recommendation === 'insufficient_data') {
    if (result.contribution === 'high_contributor') {
      result.recommendation = 'scale_or_duplicate';
    } else if (result.contribution === 'neutral_contributor') {
      result.recommendation = 'keep_running';
    } else if (result.contribution === 'weak_contributor') {
      if (result.fatigueFlag === 'fatigued') {
        result.recommendation = 'refresh_or_replace_creative';
      } else if (result.distributionFlag === 'over_served') {
        result.recommendation = 'reduce_impression_share_or_pause';
      } else {
        result.recommendation = 'pause_or_optimize';
      }
    }
  }

  return result;
}

export function scoreAllAdsInCampaign(ads: AdInput[], campaignAvg: CampaignAverages): AdScoringResult[] {
  const results = ads.map(ad => scoreAd(ad, campaignAvg));
  
  const contributionOrder: Record<Contribution, number> = {
    'high_contributor': 0,
    'neutral_contributor': 1,
    'weak_contributor': 2,
    'learning': 3,
    'not_evaluable': 4,
  };
  
  results.sort((a, b) => {
    const orderA = contributionOrder[a.contribution] ?? 5;
    const orderB = contributionOrder[b.contribution] ?? 5;
    if (orderA !== orderB) return orderA - orderB;
    return b.adImpressions - a.adImpressions;
  });
  
  return results;
}

export function computeCampaignAverages(ads: AdInput[]): CampaignAverages {
  const totalImpressions = ads.reduce((sum, ad) => sum + ad.adImpressions, 0);
  const totalClicks = ads.reduce((sum, ad) => sum + ad.adClicks, 0);
  const totalSpend = ads.reduce((sum, ad) => sum + ad.adSpend, 0);
  
  const adsWithDwell = ads.filter(ad => ad.adDwell !== null && ad.adDwell > 0);
  const totalDwellWeighted = adsWithDwell.reduce((sum, ad) => sum + (ad.adDwell! * ad.adImpressions), 0);
  const dwellImpressions = adsWithDwell.reduce((sum, ad) => sum + ad.adImpressions, 0);
  
  return {
    campaignCtr: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
    campaignDwell: dwellImpressions > 0 ? totalDwellWeighted / dwellImpressions : null,
    campaignCpc: totalClicks > 0 ? totalSpend / totalClicks : null,
    campaignCpm: totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : null,
    campaignImpressionsTotal: totalImpressions,
  };
}
