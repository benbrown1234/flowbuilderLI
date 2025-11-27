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

export const getAdPreview = async (accountId: string, creativeId: string): Promise<any> => {
  const response = await api.get(`/linkedin/account/${accountId}/ad-preview/${creativeId}`);
  return response.data;
};

export const getCreativeDetails = async (accountId: string, creativeId: string): Promise<any> => {
  const response = await api.get(`/linkedin/account/${accountId}/creative/${creativeId}`);
  return response.data;
};

const FACET_CATEGORY_MAPPING: Record<string, { category: string; field: string }> = {
  'urn:li:adTargetingFacet:locations': { category: 'geos', field: '' },
  'urn:li:adTargetingFacet:geoLocations': { category: 'geos', field: '' },
  'urn:li:adTargetingFacet:industries': { category: 'company', field: 'industries' },
  'urn:li:adTargetingFacet:employerIndustries': { category: 'company', field: 'industries' },
  'urn:li:adTargetingFacet:companySize': { category: 'company', field: 'sizes' },
  'urn:li:adTargetingFacet:companySizes': { category: 'company', field: 'sizes' },
  'urn:li:adTargetingFacet:staffCountRanges': { category: 'company', field: 'sizes' },
  'urn:li:adTargetingFacet:employers': { category: 'company', field: 'names' },
  'urn:li:adTargetingFacet:companyNames': { category: 'company', field: 'names' },
  'urn:li:adTargetingFacet:companyFollowers': { category: 'company', field: 'followers' },
  'urn:li:adTargetingFacet:companyConnections': { category: 'company', field: 'followers' },
  'urn:li:adTargetingFacet:growthRate': { category: 'company', field: 'growthRate' },
  'urn:li:adTargetingFacet:companyCategory': { category: 'company', field: 'category' },
  'urn:li:adTargetingFacet:ageRanges': { category: 'demographics', field: 'ages' },
  'urn:li:adTargetingFacet:genders': { category: 'demographics', field: 'genders' },
  'urn:li:adTargetingFacet:fieldsOfStudy': { category: 'education', field: 'fieldsOfStudy' },
  'urn:li:adTargetingFacet:degrees': { category: 'education', field: 'degrees' },
  'urn:li:adTargetingFacet:schools': { category: 'education', field: 'schools' },
  'urn:li:adTargetingFacet:memberSchools': { category: 'education', field: 'schools' },
  'urn:li:adTargetingFacet:jobTitles': { category: 'jobExperience', field: 'titles' },
  'urn:li:adTargetingFacet:titles': { category: 'jobExperience', field: 'titles' },
  'urn:li:adTargetingFacet:functions': { category: 'jobExperience', field: 'functions' },
  'urn:li:adTargetingFacet:jobFunctions': { category: 'jobExperience', field: 'functions' },
  'urn:li:adTargetingFacet:seniorities': { category: 'jobExperience', field: 'seniorities' },
  'urn:li:adTargetingFacet:yearsOfExperience': { category: 'jobExperience', field: 'yearsOfExperience' },
  'urn:li:adTargetingFacet:skills': { category: 'jobExperience', field: 'skills' },
  'urn:li:adTargetingFacet:memberSkills': { category: 'jobExperience', field: 'skills' },
  'urn:li:adTargetingFacet:interests': { category: 'interestsTraits', field: 'memberInterests' },
  'urn:li:adTargetingFacet:memberInterests': { category: 'interestsTraits', field: 'memberInterests' },
  'urn:li:adTargetingFacet:memberBehaviors': { category: 'interestsTraits', field: 'memberTraits' },
  'urn:li:adTargetingFacet:memberTraits': { category: 'interestsTraits', field: 'memberTraits' },
  'urn:li:adTargetingFacet:memberGroups': { category: 'interestsTraits', field: 'memberGroups' },
  'urn:li:adTargetingFacet:groups': { category: 'interestsTraits', field: 'memberGroups' },
  'urn:li:adTargetingFacet:audienceMatchingSegments': { category: 'audiences', field: '' },
  'urn:li:adTargetingFacet:similarAudiences': { category: 'audiences', field: '' },
  'urn:li:adTargetingFacet:dynamicSegments': { category: 'audiences', field: '' },
};

const IGNORED_FACETS = [
  'urn:li:adTargetingFacet:interfaceLocales',
  'urn:li:adTargetingFacet:profileLocations',
];

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

const parseTargeting = (targetingCriteria: any, segmentNameMap: Record<string, string> = {}): TargetingSummary => {
  const summary: TargetingSummary = {
    geos: [],
    audiences: [],
    companyLists: [],
    company: {
      names: [],
      industries: [],
      sizes: [],
      followers: [],
      growthRate: [],
      category: [],
    },
    demographics: {
      ages: [],
      genders: [],
    },
    education: {
      fieldsOfStudy: [],
      degrees: [],
      schools: [],
    },
    jobExperience: {
      titles: [],
      functions: [],
      seniorities: [],
      yearsOfExperience: [],
      skills: [],
    },
    interestsTraits: {
      memberInterests: [],
      memberTraits: [],
      memberGroups: [],
    },
    exclusions: {
      geos: [],
      audiences: [],
      companyLists: [],
      company: [],
      demographics: [],
      education: [],
      jobExperience: [],
      interestsTraits: [],
      other: []
    }
  };

  if (!targetingCriteria) {
    return summary;
  }

  const isLocaleUrn = (urn: string): boolean => {
    return urn.includes('urn:li:locale:') || urn.includes('urn:li:language:');
  };

  const isGeoUrn = (urn: string): boolean => {
    return urn.includes('urn:li:geo:') || urn.includes('urn:li:country:') || urn.includes('urn:li:region:');
  };

  const isAdSegment = (urn: string): boolean => {
    return urn.includes('urn:li:adSegment:');
  };

  const classifyAndAdd = (facetKey: string, urn: string, isExclusion: boolean = false) => {
    if (IGNORED_FACETS.includes(facetKey)) return;
    if (isLocaleUrn(urn)) return;
    
    let name: string;
    if (isAdSegment(urn) && segmentNameMap[urn]) {
      name = segmentNameMap[urn];
    } else {
      name = extractReadableName(urn);
    }
    
    if (!name) return;

    const mapping = FACET_CATEGORY_MAPPING[facetKey];
    
    if (isAdSegment(urn)) {
      const arr = isExclusion ? summary.exclusions.companyLists : summary.companyLists;
      if (!arr.includes(name)) arr.push(name);
    } else if (isGeoUrn(urn) || (mapping && mapping.category === 'geos')) {
      const arr = isExclusion ? summary.exclusions.geos : summary.geos;
      if (!arr.includes(name)) arr.push(name);
    } else if (mapping) {
      if (isExclusion) {
        const exclusionKey = mapping.category as keyof typeof summary.exclusions;
        if (exclusionKey in summary.exclusions) {
          const arr = summary.exclusions[exclusionKey] as string[];
          if (!arr.includes(name)) arr.push(name);
        }
      } else {
        if (mapping.category === 'audiences') {
          if (!summary.audiences.includes(name)) summary.audiences.push(name);
        } else if (mapping.category === 'company' && mapping.field) {
          const arr = summary.company[mapping.field as keyof typeof summary.company];
          if (!arr.includes(name)) arr.push(name);
        } else if (mapping.category === 'demographics' && mapping.field) {
          const arr = summary.demographics[mapping.field as keyof typeof summary.demographics];
          if (!arr.includes(name)) arr.push(name);
        } else if (mapping.category === 'education' && mapping.field) {
          const arr = summary.education[mapping.field as keyof typeof summary.education];
          if (!arr.includes(name)) arr.push(name);
        } else if (mapping.category === 'jobExperience' && mapping.field) {
          const arr = summary.jobExperience[mapping.field as keyof typeof summary.jobExperience];
          if (!arr.includes(name)) arr.push(name);
        } else if (mapping.category === 'interestsTraits' && mapping.field) {
          const arr = summary.interestsTraits[mapping.field as keyof typeof summary.interestsTraits];
          if (!arr.includes(name)) arr.push(name);
        }
      }
    } else if (facetKey.includes('adTargetingFacet')) {
      const arr = isExclusion ? summary.exclusions.other : summary.audiences;
      if (!arr.includes(name)) arr.push(name);
    } else {
      if (isExclusion) {
        if (!summary.exclusions.other.includes(name)) summary.exclusions.other.push(name);
      }
    }
  };

  const processFacetObject = (obj: any, isExclusion: boolean = false) => {
    if (!obj || typeof obj !== 'object') return;
    
    Object.entries(obj).forEach(([key, value]: [string, any]) => {
      if (key === 'or' && typeof value === 'object' && !Array.isArray(value)) {
        Object.entries(value).forEach(([facetKey, urns]: [string, any]) => {
          if (Array.isArray(urns)) {
            urns.forEach((urn: string) => classifyAndAdd(facetKey, urn, isExclusion));
          }
        });
      } else if (key.includes('adTargetingFacet') && Array.isArray(value)) {
        value.forEach((urn: string) => classifyAndAdd(key, urn, isExclusion));
      }
    });
  };

  if (targetingCriteria.include?.and && Array.isArray(targetingCriteria.include.and)) {
    targetingCriteria.include.and.forEach((andItem: any) => {
      processFacetObject(andItem, false);
    });
  }

  if (targetingCriteria.exclude?.or && typeof targetingCriteria.exclude.or === 'object') {
    if (Array.isArray(targetingCriteria.exclude.or)) {
      targetingCriteria.exclude.or.forEach((orItem: any) => {
        processFacetObject(orItem, true);
      });
    } else {
      Object.entries(targetingCriteria.exclude.or).forEach(([facetKey, urns]: [string, any]) => {
        if (Array.isArray(urns)) {
          urns.forEach((urn: string) => classifyAndAdd(facetKey, urn, true));
        }
      });
    }
  }

  if (targetingCriteria.exclude?.and && Array.isArray(targetingCriteria.exclude.and)) {
    targetingCriteria.exclude.and.forEach((andItem: any) => {
      processFacetObject(andItem, true);
    });
  }

  return summary;
};

const aggregateTargeting = (campaigns: CampaignNode[]): TargetingSummary => {
  const allGeos = new Set<string>();
  const allAudiences = new Set<string>();
  const allCompanyLists = new Set<string>();
  const allCompanyNames = new Set<string>();
  const allCompanyIndustries = new Set<string>();
  const allCompanySizes = new Set<string>();
  const allCompanyFollowers = new Set<string>();
  const allCompanyGrowthRate = new Set<string>();
  const allCompanyCategory = new Set<string>();
  const allAges = new Set<string>();
  const allGenders = new Set<string>();
  const allFieldsOfStudy = new Set<string>();
  const allDegrees = new Set<string>();
  const allSchools = new Set<string>();
  const allJobTitles = new Set<string>();
  const allJobFunctions = new Set<string>();
  const allSeniorities = new Set<string>();
  const allYearsOfExperience = new Set<string>();
  const allSkills = new Set<string>();
  const allMemberInterests = new Set<string>();
  const allMemberTraits = new Set<string>();
  const allMemberGroups = new Set<string>();
  
  campaigns.forEach(camp => {
    camp.targetingResolved.geos.forEach(g => allGeos.add(g));
    camp.targetingResolved.audiences.forEach(a => allAudiences.add(a));
    camp.targetingResolved.companyLists?.forEach(c => allCompanyLists.add(c));
    camp.targetingResolved.company?.names?.forEach(n => allCompanyNames.add(n));
    camp.targetingResolved.company?.industries?.forEach(i => allCompanyIndustries.add(i));
    camp.targetingResolved.company?.sizes?.forEach(s => allCompanySizes.add(s));
    camp.targetingResolved.company?.followers?.forEach(f => allCompanyFollowers.add(f));
    camp.targetingResolved.company?.growthRate?.forEach(g => allCompanyGrowthRate.add(g));
    camp.targetingResolved.company?.category?.forEach(c => allCompanyCategory.add(c));
    camp.targetingResolved.demographics?.ages?.forEach(a => allAges.add(a));
    camp.targetingResolved.demographics?.genders?.forEach(g => allGenders.add(g));
    camp.targetingResolved.education?.fieldsOfStudy?.forEach(f => allFieldsOfStudy.add(f));
    camp.targetingResolved.education?.degrees?.forEach(d => allDegrees.add(d));
    camp.targetingResolved.education?.schools?.forEach(s => allSchools.add(s));
    camp.targetingResolved.jobExperience?.titles?.forEach(j => allJobTitles.add(j));
    camp.targetingResolved.jobExperience?.functions?.forEach(f => allJobFunctions.add(f));
    camp.targetingResolved.jobExperience?.seniorities?.forEach(s => allSeniorities.add(s));
    camp.targetingResolved.jobExperience?.yearsOfExperience?.forEach(y => allYearsOfExperience.add(y));
    camp.targetingResolved.jobExperience?.skills?.forEach(s => allSkills.add(s));
    camp.targetingResolved.interestsTraits?.memberInterests?.forEach(i => allMemberInterests.add(i));
    camp.targetingResolved.interestsTraits?.memberTraits?.forEach(t => allMemberTraits.add(t));
    camp.targetingResolved.interestsTraits?.memberGroups?.forEach(g => allMemberGroups.add(g));
  });

  return {
    geos: Array.from(allGeos),
    audiences: Array.from(allAudiences),
    companyLists: Array.from(allCompanyLists),
    company: {
      names: Array.from(allCompanyNames),
      industries: Array.from(allCompanyIndustries),
      sizes: Array.from(allCompanySizes),
      followers: Array.from(allCompanyFollowers),
      growthRate: Array.from(allCompanyGrowthRate),
      category: Array.from(allCompanyCategory),
    },
    demographics: {
      ages: Array.from(allAges),
      genders: Array.from(allGenders),
    },
    education: {
      fieldsOfStudy: Array.from(allFieldsOfStudy),
      degrees: Array.from(allDegrees),
      schools: Array.from(allSchools),
    },
    jobExperience: {
      titles: Array.from(allJobTitles),
      functions: Array.from(allJobFunctions),
      seniorities: Array.from(allSeniorities),
      yearsOfExperience: Array.from(allYearsOfExperience),
      skills: Array.from(allSkills),
    },
    interestsTraits: {
      memberInterests: Array.from(allMemberInterests),
      memberTraits: Array.from(allMemberTraits),
      memberGroups: Array.from(allMemberGroups),
    },
    exclusions: { geos: [], audiences: [], companyLists: [], company: [], demographics: [], education: [], jobExperience: [], interestsTraits: [], other: [] }
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

    const segmentNameMap: Record<string, string> = {};
    segments.forEach((seg: any) => {
      const segUrn = seg.id || seg.urn;
      if (segUrn && seg.name) {
        segmentNameMap[segUrn] = seg.name;
        const segId = extractIdFromUrn(segUrn);
        if (segId) {
          segmentNameMap[`urn:li:adSegment:${segId}`] = seg.name;
        }
      }
    });
    console.log(`Built segment name map with ${Object.keys(segmentNameMap).length} entries`);

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
        targetingResolved: parseTargeting(raw.targetingCriteria, segmentNameMap),
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

    const engagementRules = rawData.engagementRules || [];
    
    const segmentToSourceCampaigns: Record<string, string[]> = {};
    const segmentToTrigger: Record<string, string> = {};
    
    engagementRules.forEach((rule: any) => {
      const segmentUrn = rule.segment;
      const segmentId = extractIdFromUrn(segmentUrn);
      
      if (rule.engagementSources && Array.isArray(rule.engagementSources)) {
        const campaignIds = rule.engagementSources
          .filter((src: string) => src.includes('sponsoredCampaign'))
          .map((src: string) => extractIdFromUrn(src));
        
        if (campaignIds.length > 0) {
          if (!segmentToSourceCampaigns[segmentId]) {
            segmentToSourceCampaigns[segmentId] = [];
          }
          segmentToSourceCampaigns[segmentId].push(...campaignIds);
        }
      }
      
      if (rule.engagementTrigger) {
        const triggerMatch = rule.engagementTrigger.match(/,([A-Z_]+)\)/);
        if (triggerMatch) {
          segmentToTrigger[segmentId] = triggerMatch[1];
        }
      }
    });
    
    console.log(`Built source campaign map for ${Object.keys(segmentToSourceCampaigns).length} segments from ${engagementRules.length} engagement rules`);

    const processedSegments = segments.map((seg: any) => {
      const segId = extractIdFromUrn(seg.id);
      let segType: 'WEBSITE' | 'VIDEO' | 'COMPANY' | 'CONTACT' | 'LOOKALIKE' | 'ENGAGED' | 'OTHER' = 'OTHER';
      
      console.log(`Segment ${segId}: type=${seg.type}, sourceSegmentSubType=${seg.sourceSegmentSubType}, entityType=${seg.entityType}, name=${seg.name}`);
      
      if (seg.type === 'BULK') {
        if (seg.sourceSegmentSubType === 'COMPANY' || seg.entityType === 'COMPANY') {
          segType = 'COMPANY';
        } else if (seg.sourceSegmentSubType === 'USER' || seg.entityType === 'USER' || seg.entityType === 'MEMBER') {
          segType = 'CONTACT';
        } else {
          segType = 'COMPANY';
        }
      } else if (seg.type === 'RETARGETING') {
        segType = 'WEBSITE';
      } else if (seg.type === 'LOOKALIKE') {
        segType = 'LOOKALIKE';
      } else if (seg.type === 'RETARGETING_SEGMENT') {
        segType = 'WEBSITE';
      } else if (seg.type === 'COMPANY_SEGMENT') {
        segType = 'COMPANY';
      } else if (seg.type === 'CONTACT_SEGMENT') {
        segType = 'CONTACT';
      } else if (seg.type === 'LOOKALIKE_SEGMENT') {
        segType = 'LOOKALIKE';
      }
      
      const sourceCampaigns = segmentToSourceCampaigns[segId] || [];
      const engagementTrigger = segmentToTrigger[segId];
      
      if (sourceCampaigns.length > 0) {
        console.log(`Segment ${segId} (${seg.name}) has ${sourceCampaigns.length} source campaigns: ${sourceCampaigns.join(', ')}`);
      }
      
      return {
        id: segId,
        name: seg.name || `Segment ${segId}`,
        type: segType,
        status: seg.status || 'UNKNOWN',
        audienceCount: seg.approximateMemberCount || seg.audienceCount,
        sourceCampaigns: sourceCampaigns.length > 0 ? sourceCampaigns : undefined,
        engagementTrigger,
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
