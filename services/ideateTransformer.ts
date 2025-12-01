import { AccountStructure, GroupNode, CampaignNode, CreativeNode, TargetingSummary } from '../types';

export interface IdeateNode {
  id: string;
  type: 'group' | 'campaign' | 'ad' | 'audience';
  name: string;
  x: number;
  y: number;
  parentId?: string;
  objective?: string;
  dailyBudget?: number;
  status?: string;
  adFormat?: string;
  isThoughtLeader?: boolean;
  audienceCategory?: 'remarketing' | 'bof' | 'tof';
  audienceType?: string;
  targetCampaignId?: string;
  targetGroupId?: string;
  sourceCampaignId?: string;
  conversionPercent?: number;
  targeting?: TargetingSummary;
  savedAudienceTargeting?: {
    industries?: string[];
    companySizes?: string[];
    seniorities?: string[];
  };
  biddingType?: 'manual' | 'maximize';
  enhancedAudience?: boolean;
  linkedinAudienceNetwork?: boolean;
}

const generateId = () => Math.random().toString(36).substr(2, 9);

const mapObjectiveToIdeate = (objective: string): string => {
  const mapping: Record<string, string> = {
    'BRAND_AWARENESS': 'brand_awareness',
    'WEBSITE_VISITS': 'website_visits',
    'ENGAGEMENT': 'engagement',
    'VIDEO_VIEWS': 'video_views',
    'LEAD_GENERATION': 'lead_generation',
    'TALENT_LEADS': 'talent_leads',
    'WEBSITE_CONVERSIONS': 'website_conversions',
    'JOB_APPLICANTS': 'job_applicants',
  };
  return mapping[objective] || 'website_visits';
};

const mapAdFormat = (creative: CreativeNode): string => {
  const mediaType = creative.content?.mediaType?.toLowerCase() || '';
  const format = creative.format?.toLowerCase() || '';
  
  if (mediaType === 'video' || format.includes('video')) return 'video';
  if (format.includes('carousel')) return 'carousel';
  if (format.includes('document')) return 'document';
  if (format.includes('event')) return 'event';
  if (format.includes('message') || format.includes('conversation')) return 'message';
  if (format.includes('text')) return 'text';
  return 'single_image';
};

export const transformAccountToIdeateNodes = (account: AccountStructure): IdeateNode[] => {
  const nodes: IdeateNode[] = [];
  
  const GROUP_X = 100;
  const CAMPAIGN_X = 450;
  const AD_X = 800;
  const VERTICAL_SPACING = 280;
  const CAMPAIGN_SPACING = 150;
  const AD_SPACING = 80;
  
  let currentGroupY = 80;
  
  account.groups.forEach((group: GroupNode, groupIndex: number) => {
    const groupId = generateId();
    
    nodes.push({
      id: groupId,
      type: 'group',
      name: group.name,
      x: GROUP_X,
      y: currentGroupY,
      status: group.status,
    });
    
    let campaignY = currentGroupY;
    const campaigns = group.children || [];
    
    campaigns.forEach((campaign: CampaignNode, campaignIndex: number) => {
      const campaignId = generateId();
      
      nodes.push({
        id: campaignId,
        type: 'campaign',
        name: campaign.name,
        x: CAMPAIGN_X,
        y: campaignY,
        parentId: groupId,
        objective: mapObjectiveToIdeate(campaign.objective || ''),
        dailyBudget: campaign.dailyBudget,
        status: campaign.status,
        targeting: campaign.targetingResolved,
        biddingType: campaign.biddingStrategy?.toLowerCase().includes('manual') ? 'manual' : 'maximize',
      });
      
      const ads = campaign.children || [];
      let adY = campaignY - ((ads.length - 1) * AD_SPACING) / 2;
      
      ads.forEach((ad: CreativeNode, adIndex: number) => {
        const adId = generateId();
        const adFormat = mapAdFormat(ad);
        
        nodes.push({
          id: adId,
          type: 'ad',
          name: ad.name || `Ad ${adIndex + 1}`,
          x: AD_X + (adIndex % 2) * 140,
          y: adY + Math.floor(adIndex / 2) * AD_SPACING,
          parentId: campaignId,
          adFormat: adFormat,
          isThoughtLeader: ad.content?.isThoughtLeader || false,
          status: ad.status,
        });
      });
      
      campaignY += Math.max(CAMPAIGN_SPACING, Math.ceil(ads.length / 2) * AD_SPACING + 40);
    });
    
    currentGroupY = campaignY + VERTICAL_SPACING - CAMPAIGN_SPACING;
  });
  
  return nodes;
};

export const createTofAudiencesFromTargeting = (nodes: IdeateNode[]): IdeateNode[] => {
  const audiences: IdeateNode[] = [];
  const AUDIENCE_X = -100;
  let audienceY = 100;
  
  const targetingGroups = new Map<string, { campaigns: IdeateNode[], targeting: TargetingSummary }>();
  
  nodes.filter(n => n.type === 'campaign' && n.targeting).forEach(campaign => {
    const targeting = campaign.targeting!;
    const key = JSON.stringify({
      industries: targeting.company?.industries || [],
      sizes: targeting.company?.sizes || [],
      seniorities: targeting.jobExperience?.seniorities || [],
    });
    
    if (!targetingGroups.has(key)) {
      targetingGroups.set(key, { campaigns: [], targeting });
    }
    targetingGroups.get(key)!.campaigns.push(campaign);
  });
  
  targetingGroups.forEach((group, key) => {
    const targeting = group.targeting;
    const hasTargeting = (targeting.company?.industries?.length || 0) > 0 ||
                         (targeting.company?.sizes?.length || 0) > 0 ||
                         (targeting.jobExperience?.seniorities?.length || 0) > 0;
    
    if (!hasTargeting) return;
    
    const industries = targeting.company?.industries || [];
    const sizes = targeting.company?.sizes || [];
    const seniorities = targeting.jobExperience?.seniorities || [];
    
    const nameParts: string[] = [];
    if (industries.length > 0) nameParts.push(industries.slice(0, 2).join(', '));
    if (seniorities.length > 0) nameParts.push(seniorities.slice(0, 2).join(', '));
    if (sizes.length > 0) nameParts.push(sizes.slice(0, 1).join(''));
    
    const audienceId = generateId();
    const audienceName = nameParts.length > 0 ? nameParts.join(' - ') : 'Saved Audience';
    
    const campaignWithParent = group.campaigns.find(c => c.parentId);
    const targetGroupId = campaignWithParent?.parentId;
    
    audiences.push({
      id: audienceId,
      type: 'audience',
      name: audienceName.length > 50 ? audienceName.substring(0, 47) + '...' : audienceName,
      x: AUDIENCE_X,
      y: audienceY,
      audienceCategory: 'tof',
      audienceType: 'saved_audience',
      targetGroupId: targetGroupId,
      savedAudienceTargeting: {
        industries: industries,
        companySizes: sizes,
        seniorities: seniorities,
      },
    });
    
    audienceY += 100;
  });
  
  return audiences;
};
