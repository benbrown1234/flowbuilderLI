import axios from 'axios';
import { 
  AccountStructure, 
  GroupNode, 
  CampaignNode, 
  CreativeNode, 
  NodeType, 
  TargetingSummary,
  AccountSummary
} from '../types';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
});

export interface AuthStatus {
  isAuthenticated: boolean;
}

export const getAuthUrl = async (): Promise<{ authUrl: string; state: string }> => {
  const response = await api.get('/auth/url');
  return response.data;
};

export const getAuthStatus = async (): Promise<AuthStatus> => {
  const response = await api.get('/auth/status');
  return response.data;
};

export const logout = async (): Promise<void> => {
  await api.post('/auth/logout');
};

export const getAdAccounts = async (): Promise<any[]> => {
  const response = await api.get('/linkedin/accounts');
  return response.data.elements || [];
};

export const getAccountHierarchy = async (accountId: string): Promise<any> => {
  const response = await api.get(`/linkedin/account/${accountId}/hierarchy`);
  return response.data;
};

const FACET_MAPPING: Record<string, keyof TargetingSummary> = {
  'urn:li:adTargetingFacet:locations': 'geos',
  'urn:li:adTargetingFacet:geoLocations': 'geos',
  'urn:li:adTargetingFacet:industries': 'industries',
  'urn:li:adTargetingFacet:jobTitles': 'jobTitles',
  'urn:li:adTargetingFacet:audienceMatchingSegments': 'audiences',
  'urn:li:adTargetingFacet:companySize': 'industries',
};

const parseTargeting = (targetingCriteria: any): TargetingSummary => {
  const summary: TargetingSummary = {
    geos: [],
    audiences: [],
    industries: [],
    jobTitles: [],
    exclusions: []
  };

  if (!targetingCriteria) return summary;

  const processInclude = (include: any) => {
    if (include?.and) {
      include.and.forEach((facetObj: any) => {
        Object.entries(facetObj).forEach(([facetKey, urns]: [string, any]) => {
          const targetKey = FACET_MAPPING[facetKey];
          if (targetKey && Array.isArray(urns)) {
            urns.forEach((urn: string) => {
              const name = urn.split(':').pop() || urn;
              summary[targetKey].push(name);
            });
          }
        });
      });
    }
  };

  const processExclude = (exclude: any) => {
    if (exclude?.or) {
      exclude.or.forEach((facetObj: any) => {
        Object.values(facetObj).forEach((urns: any) => {
          if (Array.isArray(urns)) {
            urns.forEach((urn: string) => {
              const name = urn.split(':').pop() || urn;
              summary.exclusions.push(name);
            });
          }
        });
      });
    }
  };

  processInclude(targetingCriteria.include);
  processExclude(targetingCriteria.exclude);

  return summary;
};

const aggregateTargeting = (campaigns: CampaignNode[]): TargetingSummary => {
  const allGeos = new Set<string>();
  const allAudiences = new Set<string>();
  const allIndustries = new Set<string>();
  const allJobTitles = new Set<string>();
  
  campaigns.forEach(camp => {
    camp.targetingResolved.geos.forEach(g => allGeos.add(g));
    camp.targetingResolved.audiences.forEach(a => allAudiences.add(a));
    camp.targetingResolved.industries.forEach(i => allIndustries.add(i));
    camp.targetingResolved.jobTitles.forEach(j => allJobTitles.add(j));
  });

  return {
    geos: Array.from(allGeos),
    audiences: Array.from(allAudiences),
    industries: Array.from(allIndustries),
    jobTitles: Array.from(allJobTitles),
    exclusions: []
  };
};

export const buildAccountHierarchyFromApi = async (accountId: string): Promise<AccountStructure | null> => {
  try {
    const rawData = await getAccountHierarchy(accountId);
    
    if (!rawData || !rawData.groups) {
      console.warn(`No data found for account ${accountId}`);
      return null;
    }

    const processedCampaigns: CampaignNode[] = rawData.campaigns.map((raw: any) => {
      const campaignUrn = raw.id || raw.urn;
      const campaignId = typeof campaignUrn === 'string' && campaignUrn.includes(':')
        ? campaignUrn.split(':').pop() 
        : String(campaignUrn);
      
      const creatives: CreativeNode[] = rawData.creatives
        .filter((c: any) => {
          const creativeCampaign = c.campaign || c.campaignUrn;
          return creativeCampaign === campaignUrn || creativeCampaign?.includes(campaignId);
        })
        .map((c: any) => ({
          id: c.id || c.urn,
          name: c.name || `Creative ${c.id}`,
          type: NodeType.CREATIVE,
          format: c.type || c.format || 'UNKNOWN',
        }));

      return {
        id: campaignUrn,
        name: raw.name || `Campaign ${campaignId}`,
        type: NodeType.CAMPAIGN,
        dailyBudget: raw.dailyBudget?.amount?.value || raw.dailyBudget || 0,
        status: raw.status || 'UNKNOWN',
        objective: raw.objectiveType || raw.objective || 'UNKNOWN',
        biddingStrategy: raw.costType || raw.biddingStrategy || 'UNKNOWN',
        targetingRaw: raw.targetingCriteria || {},
        targetingResolved: parseTargeting(raw.targetingCriteria),
        outputAudiences: [],
        children: creatives,
      };
    });

    const groups: GroupNode[] = rawData.groups.map((rawGroup: any) => {
      const groupUrn = rawGroup.id || rawGroup.urn;
      
      const childCampaigns = processedCampaigns.filter((c: CampaignNode) => {
        const campaign = rawData.campaigns.find((raw: any) => 
          (raw.id || raw.urn) === c.id
        );
        const campaignGroup = campaign?.campaignGroup || campaign?.campaignGroupUrn;
        const groupId = typeof groupUrn === 'string' && groupUrn.includes(':') 
          ? groupUrn.split(':').pop() 
          : String(groupUrn);
        return campaignGroup === groupUrn || (campaignGroup && String(campaignGroup).includes(groupId));
      });

      const totalBudget = childCampaigns.reduce((sum: number, c: CampaignNode) => sum + c.dailyBudget, 0);

      return {
        id: groupUrn,
        name: rawGroup.name || `Group ${groupUrn}`,
        type: NodeType.GROUP,
        status: rawGroup.status || 'UNKNOWN',
        totalBudget,
        children: childCampaigns,
        derivedTargeting: aggregateTargeting(childCampaigns),
      };
    });

    return {
      id: accountId,
      name: `Account ${accountId}`,
      currency: 'USD',
      groups,
    };
  } catch (error) {
    console.error('Error building hierarchy from API:', error);
    return null;
  }
};

export const getAvailableAccountsFromApi = async (): Promise<AccountSummary[]> => {
  try {
    const accounts = await getAdAccounts();
    return accounts.map((account: any) => {
      // account.id can be a number or a URN string
      const rawId = account.id;
      const id = typeof rawId === 'string' && rawId.includes(':') 
        ? rawId.split(':').pop() 
        : String(rawId);
      return {
        id,
        name: account.name || `Account ${id}`,
      };
    });
  } catch (error) {
    console.error('Error fetching accounts:', error);
    return [];
  }
};
