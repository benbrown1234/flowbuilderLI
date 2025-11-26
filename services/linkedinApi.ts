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
  const maxRetries = 3;
  const delay = 1000;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await api.get('/auth/status');
      return response.data;
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  return { isAuthenticated: false };
};

export const logout = async (): Promise<void> => {
  await api.post('/auth/logout');
};

export const getAdAccounts = async (): Promise<any[]> => {
  const response = await api.get('/linkedin/accounts');
  return response.data.elements || [];
};

export const getAccountHierarchy = async (accountId: string, activeOnly: boolean = false): Promise<any> => {
  const response = await api.get(`/linkedin/account/${accountId}/hierarchy`, {
    params: { activeOnly: activeOnly.toString() }
  });
  return response.data;
};

export const getAccountSegments = async (accountId: string): Promise<any[]> => {
  const response = await api.get(`/linkedin/account/${accountId}/segments`);
  return response.data.elements || [];
};

const FACET_MAPPING: Record<string, keyof TargetingSummary> = {
  'urn:li:adTargetingFacet:locations': 'geos',
  'urn:li:adTargetingFacet:geoLocations': 'geos',
  'urn:li:adTargetingFacet:interfaceLocales': 'geos',
  'urn:li:adTargetingFacet:industries': 'industries',
  'urn:li:adTargetingFacet:jobTitles': 'jobTitles',
  'urn:li:adTargetingFacet:titles': 'jobTitles',
  'urn:li:adTargetingFacet:audienceMatchingSegments': 'audiences',
  'urn:li:adTargetingFacet:similarAudiences': 'audiences',
  'urn:li:adTargetingFacet:companySize': 'industries',
  'urn:li:adTargetingFacet:seniorities': 'jobTitles',
  'urn:li:adTargetingFacet:functions': 'jobTitles',
  'urn:li:adTargetingFacet:skills': 'jobTitles',
  'urn:li:adTargetingFacet:memberBehaviors': 'audiences',
  'urn:li:adTargetingFacet:yearsOfExperience': 'jobTitles',
};

let resolvedUrnCache: Record<string, string> = {};

export const resolveTargetingUrns = async (urns: string[]): Promise<Record<string, string>> => {
  const uncachedUrns = urns.filter(u => !resolvedUrnCache[u]);
  
  if (uncachedUrns.length === 0) {
    return resolvedUrnCache;
  }
  
  console.log(`Requesting resolution for ${uncachedUrns.length} URNs...`);
  
  try {
    const response = await api.post('/linkedin/resolve-targeting', { urns: uncachedUrns });
    console.log('Resolution response:', response.data);
    if (response.data.resolved) {
      const resolvedCount = Object.keys(response.data.resolved).length;
      console.log(`Successfully resolved ${resolvedCount} URNs`);
      Object.assign(resolvedUrnCache, response.data.resolved);
    }
  } catch (err: any) {
    console.warn('Failed to resolve targeting URNs:', err?.response?.data || err?.message || err);
  }
  
  return resolvedUrnCache;
};

const extractReadableName = (urn: string, resolvedNames?: Record<string, string>): string => {
  if (!urn || typeof urn !== 'string') return String(urn);
  
  if (resolvedNames && resolvedNames[urn]) {
    return resolvedNames[urn];
  }
  
  if (resolvedUrnCache[urn]) {
    return resolvedUrnCache[urn];
  }
  
  if (urn.includes('urn:li:geo:')) {
    const geoId = urn.split(':').pop();
    const geoNames: Record<string, string> = {
      '101165590': 'United Kingdom',
      '102095887': 'California, US',
      '103644278': 'United States',
      '101174742': 'Canada',
      '102713980': 'India',
      '101452733': 'Australia',
      '100506914': 'New York, US',
      '90009496': 'San Francisco Bay Area',
    };
    if (geoId && geoNames[geoId]) return geoNames[geoId];
  }
  
  if (urn.includes('urn:li:seniority:')) {
    const senId = urn.split(':').pop();
    const seniorityNames: Record<string, string> = {
      '1': 'Unpaid', '2': 'Training', '3': 'Entry', '4': 'Senior',
      '5': 'Manager', '6': 'Director', '7': 'VP', '8': 'CXO',
      '9': 'Partner', '10': 'Owner',
    };
    if (senId && seniorityNames[senId]) return seniorityNames[senId];
  }
  
  const lastPart = urn.split(':').pop() || urn;
  
  if (lastPart.includes('(')) {
    const match = lastPart.match(/\(([^)]+)\)/);
    if (match) return match[1];
  }
  
  if (/^\d+$/.test(lastPart)) {
    const urnType = urn.split(':')[2] || 'item';
    return `${urnType.charAt(0).toUpperCase()}${urnType.slice(1)} #${lastPart}`;
  }
  
  return lastPart
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .trim();
};

const parseTargeting = (targetingCriteria: any): TargetingSummary => {
  const summary: TargetingSummary = {
    geos: [],
    audiences: [],
    industries: [],
    jobTitles: [],
    exclusions: []
  };

  if (!targetingCriteria) {
    return summary;
  }

  const addToSummary = (facetKey: string, urns: string[]) => {
    const targetKey = FACET_MAPPING[facetKey];
    urns.forEach((urn: string) => {
      const name = extractReadableName(urn);
      if (!name) return;
      
      if (targetKey) {
        if (!summary[targetKey].includes(name)) {
          summary[targetKey].push(name);
        }
      } else if (facetKey.includes('adTargetingFacet')) {
        if (!summary.audiences.includes(name)) {
          summary.audiences.push(name);
        }
      }
    });
  };

  const processFacetObject = (obj: any) => {
    if (!obj || typeof obj !== 'object') return;
    
    Object.entries(obj).forEach(([key, value]: [string, any]) => {
      if (key === 'or' && typeof value === 'object' && !Array.isArray(value)) {
        Object.entries(value).forEach(([facetKey, urns]: [string, any]) => {
          if (Array.isArray(urns)) {
            addToSummary(facetKey, urns);
          }
        });
      } else if (key.includes('adTargetingFacet') && Array.isArray(value)) {
        addToSummary(key, value);
      }
    });
  };

  if (targetingCriteria.include?.and && Array.isArray(targetingCriteria.include.and)) {
    targetingCriteria.include.and.forEach((andItem: any) => {
      processFacetObject(andItem);
    });
  }

  if (targetingCriteria.exclude?.or && Array.isArray(targetingCriteria.exclude.or)) {
    targetingCriteria.exclude.or.forEach((orItem: any) => {
      Object.entries(orItem).forEach(([key, value]: [string, any]) => {
        if (key === 'or' && typeof value === 'object') {
          Object.values(value).forEach((urns: any) => {
            if (Array.isArray(urns)) {
              urns.forEach((urn: string) => {
                const name = extractReadableName(urn);
                if (name && !summary.exclusions.includes(name)) {
                  summary.exclusions.push(name);
                }
              });
            }
          });
        } else if (Array.isArray(value)) {
          value.forEach((urn: string) => {
            const name = extractReadableName(urn);
            if (name && !summary.exclusions.includes(name)) {
              summary.exclusions.push(name);
            }
          });
        }
      });
    });
  }

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

const extractIdFromUrn = (urnOrId: any): string => {
  if (typeof urnOrId === 'string' && urnOrId.includes(':')) {
    return urnOrId.split(':').pop() || urnOrId;
  }
  return String(urnOrId);
};

const parseBudget = (budget: any): number => {
  if (!budget) return 0;
  if (typeof budget === 'number') return budget;
  if (budget.amount) {
    const rawAmount = typeof budget.amount === 'string' ? parseFloat(budget.amount) : budget.amount;
    if (isNaN(rawAmount)) return 0;
    return rawAmount / 100;
  }
  return 0;
};

const collectTargetingUrns = (campaigns: any[]): string[] => {
  const urns: string[] = [];
  
  campaigns.forEach((campaign: any) => {
    const criteria = campaign.targetingCriteria;
    if (!criteria) return;
    
    const processAndGroup = (andGroup: any) => {
      if (!andGroup?.and) return;
      andGroup.and.forEach((orGroup: any) => {
        if (orGroup?.or) {
          Object.values(orGroup.or).forEach((values: any) => {
            if (Array.isArray(values)) {
              values.forEach((urn: string) => {
                if (typeof urn === 'string' && urn.startsWith('urn:')) {
                  urns.push(urn);
                }
              });
            }
          });
        }
        Object.entries(orGroup).forEach(([key, values]: [string, any]) => {
          if (key !== 'or' && Array.isArray(values)) {
            values.forEach((urn: string) => {
              if (typeof urn === 'string' && urn.startsWith('urn:')) {
                urns.push(urn);
              }
            });
          }
        });
      });
    };
    
    processAndGroup(criteria.include);
    if (criteria.exclude) {
      if (criteria.exclude.or && typeof criteria.exclude.or === 'object') {
        Object.values(criteria.exclude.or).forEach((values: any) => {
          if (Array.isArray(values)) {
            values.forEach((urn: string) => {
              if (typeof urn === 'string' && urn.startsWith('urn:')) {
                urns.push(urn);
              }
            });
          }
        });
      }
      if (criteria.exclude.and && Array.isArray(criteria.exclude.and)) {
        criteria.exclude.and.forEach((orGroup: any) => {
          if (orGroup?.or && typeof orGroup.or === 'object') {
            Object.values(orGroup.or).forEach((values: any) => {
              if (Array.isArray(values)) {
                values.forEach((urn: string) => {
                  if (typeof urn === 'string' && urn.startsWith('urn:')) {
                    urns.push(urn);
                  }
                });
              }
            });
          }
        });
      }
    }
  });
  
  return [...new Set(urns)];
};

export const buildAccountHierarchyFromApi = async (accountId: string, activeOnly: boolean = false): Promise<AccountStructure | null> => {
  try {
    console.log(`Fetching hierarchy for account: ${accountId} (activeOnly: ${activeOnly})`);
    const rawData = await getAccountHierarchy(accountId, activeOnly);
    
    console.log('Raw API response:', rawData);
    
    if (!rawData) {
      console.warn(`No data found for account ${accountId}`);
      return null;
    }

    const groups = rawData.groups || [];
    const campaigns = rawData.campaigns || [];
    const creatives = rawData.creatives || [];
    const segments = rawData.segments || [];

    console.log(`Found ${groups.length} groups, ${campaigns.length} campaigns, ${creatives.length} creatives, ${segments.length} segments`);
    
    if (rawData._debug?.errors) {
      console.warn('API returned errors:', rawData._debug.errors);
    }

    try {
      console.log('Collecting targeting URNs from campaigns...');
      const targetingUrns = collectTargetingUrns(campaigns);
      console.log(`Collected ${targetingUrns.length} targeting URNs`);
      if (targetingUrns.length > 0) {
        console.log(`Resolving ${targetingUrns.length} targeting URNs...`);
        await resolveTargetingUrns(targetingUrns);
        console.log('URN resolution complete');
      }
    } catch (resolveErr: any) {
      console.warn('Non-blocking: Failed to resolve targeting URNs:', 
        resolveErr?.message || resolveErr?.toString() || JSON.stringify(resolveErr) || 'Unknown error');
    }

    const processedCampaigns: CampaignNode[] = campaigns.map((raw: any) => {
      const campaignId = extractIdFromUrn(raw.id);
      const campaignUrn = typeof raw.id === 'number' 
        ? `urn:li:sponsoredCampaign:${raw.id}` 
        : raw.id;
      
      const matchingCreatives: CreativeNode[] = creatives
        .filter((c: any) => {
          const creativeCampaignUrn = c.campaign;
          const creativeCampaignId = extractIdFromUrn(creativeCampaignUrn);
          return creativeCampaignId === campaignId || creativeCampaignUrn === campaignUrn;
        })
        .map((c: any) => ({
          id: extractIdFromUrn(c.id),
          name: c.name || `Creative ${extractIdFromUrn(c.id)}`,
          type: NodeType.CREATIVE,
          format: c.type || 'SPONSORED_UPDATE',
        }));

      const dailyBudget = parseBudget(raw.dailyBudget);

      return {
        id: campaignId,
        name: raw.name || `Campaign ${campaignId}`,
        type: NodeType.CAMPAIGN,
        dailyBudget,
        status: raw.status || 'UNKNOWN',
        objective: raw.objectiveType || 'UNKNOWN',
        biddingStrategy: raw.costType || 'CPM',
        targetingRaw: raw.targetingCriteria || {},
        targetingResolved: parseTargeting(raw.targetingCriteria),
        outputAudiences: [],
        children: matchingCreatives,
        campaignGroupUrn: raw.campaignGroup,
      };
    });

    const processedGroups: GroupNode[] = groups.map((rawGroup: any) => {
      const groupId = extractIdFromUrn(rawGroup.id);
      const groupUrn = typeof rawGroup.id === 'number'
        ? `urn:li:sponsoredCampaignGroup:${rawGroup.id}`
        : rawGroup.id;
      
      const childCampaigns = processedCampaigns.filter((c: any) => {
        if (!c.campaignGroupUrn) return false;
        const campaignGroupId = extractIdFromUrn(c.campaignGroupUrn);
        return campaignGroupId === groupId || c.campaignGroupUrn === groupUrn;
      });

      const totalBudget = parseBudget(rawGroup.totalBudget) || 
        childCampaigns.reduce((sum: number, c: CampaignNode) => sum + c.dailyBudget, 0);

      return {
        id: groupId,
        name: rawGroup.name || `Campaign Group ${groupId}`,
        type: NodeType.GROUP,
        status: rawGroup.status || 'UNKNOWN',
        totalBudget,
        children: childCampaigns,
        derivedTargeting: aggregateTargeting(childCampaigns),
      };
    });

    const orphanCampaigns = processedCampaigns.filter((c: any) => !c.campaignGroupUrn);
    if (orphanCampaigns.length > 0) {
      processedGroups.push({
        id: 'ungrouped',
        name: 'Ungrouped Campaigns',
        type: NodeType.GROUP,
        status: 'ACTIVE',
        totalBudget: orphanCampaigns.reduce((sum, c) => sum + c.dailyBudget, 0),
        children: orphanCampaigns,
        derivedTargeting: aggregateTargeting(orphanCampaigns),
      });
    }

    const processedSegments = segments.map((seg: any) => {
      const segId = extractIdFromUrn(seg.id);
      let segType: 'WEBSITE' | 'COMPANY' | 'CONTACT' | 'LOOKALIKE' | 'OTHER' = 'OTHER';
      
      if (seg.type === 'RETARGETING_SEGMENT') segType = 'WEBSITE';
      else if (seg.type === 'COMPANY_SEGMENT') segType = 'COMPANY';
      else if (seg.type === 'CONTACT_SEGMENT') segType = 'CONTACT';
      else if (seg.type === 'LOOKALIKE_SEGMENT') segType = 'LOOKALIKE';
      
      return {
        id: segId,
        name: seg.name || `Segment ${segId}`,
        type: segType,
        status: seg.status || 'UNKNOWN',
        audienceCount: seg.approximateMemberCount || seg.audienceCount,
      };
    });

    return {
      id: accountId,
      name: `Account ${accountId}`,
      currency: 'USD',
      groups: processedGroups,
      segments: processedSegments,
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
