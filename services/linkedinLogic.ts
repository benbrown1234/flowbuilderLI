
import { 
  AccountStructure, 
  GroupNode, 
  CampaignNode, 
  CreativeNode, 
  NodeType, 
  TargetingSummary,
  MockRawCampaign,
  AccountSummary
} from '../types';
import { MOCK_ACCOUNTS_LIST, MOCK_DATA_STORE, MOCK_URN_RESOLVER, MOCK_SEGMENTS } from './mockData';

// --- Step 2: Parse the Facets (The Switch Statement) ---

const FACET_MAPPING: Record<string, keyof TargetingSummary> = {
  'urn:li:adTargetingFacet:locations': 'geos',
  'urn:li:adTargetingFacet:industries': 'industries',
  'urn:li:adTargetingFacet:jobTitles': 'jobTitles',
  'urn:li:adTargetingFacet:audienceMatchingSegments': 'audiences',
  'urn:li:adTargetingFacet:companySize': 'industries', // Simplified for demo
};

/**
 * Resolves a list of URNs into human readable names using the mock resolver.
 * In a real app, this would batch call /adTargetingEntities or /adSegments.
 */
const resolveUrns = (urns: string[]): string[] => {
  return urns.map(urn => MOCK_URN_RESOLVER[urn] || urn);
};

/**
 * Parses the raw LinkedIn targetingCriteria object into a clean summary.
 */
const parseTargeting = (criteria: MockRawCampaign['targetingCriteria']): TargetingSummary => {
  const summary: TargetingSummary = {
    geos: [],
    audiences: [],
    companyLists: [],
    industries: [],
    jobTitles: [],
    exclusions: {
      geos: [],
      audiences: [],
      companyLists: [],
      industries: [],
      jobTitles: [],
      other: []
    }
  };

  // Process INCLUDES (The "AND" logic)
  if (criteria.include?.and) {
    criteria.include.and.forEach((facetObj) => {
      Object.entries(facetObj).forEach(([facetKey, urns]) => {
        const targetKey = FACET_MAPPING[facetKey];
        if (targetKey && Array.isArray(urns) && targetKey !== 'exclusions') {
          const names = resolveUrns(urns);
          (summary[targetKey] as string[]).push(...names);
        }
      });
    });
  }

  // Process EXCLUDES (The "OR" logic) - categorize by facet type
  if (criteria.exclude?.or && Array.isArray(criteria.exclude.or)) {
    criteria.exclude.or.forEach((facetObj) => {
      Object.entries(facetObj).forEach(([facetKey, urns]) => {
        if (Array.isArray(urns)) {
          const names = resolveUrns(urns);
          const targetKey = FACET_MAPPING[facetKey];
          if (targetKey && targetKey !== 'exclusions' && summary.exclusions[targetKey as keyof typeof summary.exclusions]) {
            (summary.exclusions[targetKey as keyof typeof summary.exclusions] as string[]).push(...names);
          } else {
            summary.exclusions.other.push(...names);
          }
        }
      });
    });
  }

  return summary;
};

/**
 * Aggregates targeting from a list of campaigns into a single group summary.
 */
const aggregateTargeting = (campaigns: CampaignNode[]): TargetingSummary => {
  const allGeos = new Set<string>();
  const allAudiences = new Set<string>();
  const allCompanyLists = new Set<string>();
  const allIndustries = new Set<string>();
  const allJobTitles = new Set<string>();
  
  campaigns.forEach(camp => {
    camp.targetingResolved.geos.forEach(g => allGeos.add(g));
    camp.targetingResolved.audiences.forEach(a => allAudiences.add(a));
    camp.targetingResolved.companyLists?.forEach(c => allCompanyLists.add(c));
    camp.targetingResolved.industries.forEach(i => allIndustries.add(i));
    camp.targetingResolved.jobTitles.forEach(j => allJobTitles.add(j));
  });

  return {
    geos: Array.from(allGeos),
    audiences: Array.from(allAudiences),
    companyLists: Array.from(allCompanyLists),
    industries: Array.from(allIndustries),
    jobTitles: Array.from(allJobTitles),
    exclusions: { geos: [], audiences: [], companyLists: [], industries: [], jobTitles: [], other: [] }
  };
};

// --- Main Service Functions ---

export const getAvailableAccounts = (): AccountSummary[] => {
  return MOCK_ACCOUNTS_LIST;
};

export const buildAccountHierarchy = (accountId?: string): AccountStructure | null => {
  const defaultAccount = MOCK_ACCOUNTS_LIST[0];
  const selectedId = accountId || defaultAccount.id;
  const accountInfo = MOCK_ACCOUNTS_LIST.find(a => a.id === selectedId) || defaultAccount;

  const rawData = MOCK_DATA_STORE[selectedId];
  
  if (!rawData) {
    console.warn(`No data found for account ${selectedId}`);
    return null;
  }

  // 1. Process Campaigns first to get their resolved targeting
  const processedCampaigns: CampaignNode[] = rawData.campaigns.map(raw => {
    // Find children
    const creatives: CreativeNode[] = rawData.creatives
      .filter(c => c.campaign === raw.id)
      .map(c => ({
        id: c.id,
        name: c.name,
        type: NodeType.CREATIVE,
        format: c.format
      }));
    
    // Resolve output audiences names
    const resolvedOutputs = raw.outputAudiences ? resolveUrns(raw.outputAudiences) : [];

    return {
      id: raw.id,
      name: raw.name,
      type: NodeType.CAMPAIGN,
      dailyBudget: raw.dailyBudget,
      status: raw.status,
      objective: raw.objective || 'Brand Awareness', // Map new field
      biddingStrategy: raw.biddingStrategy || 'Maximum Delivery', // Map new field
      targetingRaw: raw.targetingCriteria,
      targetingResolved: parseTargeting(raw.targetingCriteria),
      outputAudiences: resolvedOutputs,
      children: creatives
    };
  });

  // 2. Process Groups and attach campaigns
  const groups: GroupNode[] = rawData.groups.map(rawGroup => {
    const childCampaigns = processedCampaigns.filter(c => 
      rawData.campaigns.find(raw => raw.id === c.id)?.campaignGroup === rawGroup.id
    );

    const totalBudget = childCampaigns.reduce((sum, c) => sum + c.dailyBudget, 0);

    return {
      id: rawGroup.id,
      name: rawGroup.name,
      type: NodeType.GROUP,
      status: rawGroup.status,
      totalBudget,
      children: childCampaigns,
      derivedTargeting: aggregateTargeting(childCampaigns)
    };
  });

  const rawSegments = MOCK_SEGMENTS[selectedId] || [];
  const processedSegments = rawSegments.map((seg: any) => ({
    id: seg.id,
    name: seg.name,
    type: seg.type || 'OTHER',
    status: seg.status || 'ACTIVE',
    audienceCount: seg.audienceCount,
    sourceCampaigns: seg.sourceCampaigns,
    engagementTrigger: seg.engagementTrigger
  }));

  return {
    id: accountInfo.id,
    name: accountInfo.name,
    currency: 'USD',
    groups,
    segments: processedSegments
  };
};

// --- Helper for Flow Visualization ---

export interface FlowData {
  facets: {
    id: string; 
    type: 'GEO' | 'AUDIENCE' | 'INDUSTRY' | 'JOB' | 'EXCLUSION';
    label: string;
    count: number; // For clustering
    items?: string[]; // If clustered, list of items
  }[];
  campaigns: {
    id: string;
    name: string;
    groupId: string;
    groupName: string;
  }[];
  connections: {
    sourceId: string; // Facet Name (or Bundle Name)
    targetId: string; // Campaign ID
  }[];
}

export const getAllTargetingConnections = (data: AccountStructure): FlowData => {
  const campaignsList: { id: string; name: string; groupId: string; groupName: string }[] = [];
  
  // 1. Collect all "Edges" (Targeting Facet -> Campaign ID)
  // We store them as: FacetName -> Set<CampaignID>
  // Also store the type for each facet
  const facetToCampaigns = new Map<string, Set<string>>();
  const facetTypes = new Map<string, 'GEO' | 'AUDIENCE' | 'INDUSTRY' | 'JOB' | 'EXCLUSION'>();

  data.groups.forEach(group => {
    group.children.forEach(camp => {
      campaignsList.push({ id: camp.id, name: camp.name, groupId: group.id, groupName: group.name });

      const register = (val: string, type: 'GEO' | 'AUDIENCE' | 'INDUSTRY' | 'JOB' | 'EXCLUSION') => {
         if (!facetToCampaigns.has(val)) facetToCampaigns.set(val, new Set());
         facetToCampaigns.get(val)!.add(camp.id);
         facetTypes.set(val, type);
      };

      camp.targetingResolved.geos.forEach(t => register(t, 'GEO'));
      camp.targetingResolved.audiences.forEach(t => register(t, 'AUDIENCE'));
      camp.targetingResolved.industries.forEach(t => register(t, 'INDUSTRY'));
      camp.targetingResolved.jobTitles.forEach(t => register(t, 'JOB'));
      camp.targetingResolved.exclusions.geos.forEach(t => register(t, 'EXCLUSION'));
      camp.targetingResolved.exclusions.audiences.forEach(t => register(t, 'EXCLUSION'));
      camp.targetingResolved.exclusions.companyLists.forEach(t => register(t, 'EXCLUSION'));
      camp.targetingResolved.exclusions.industries.forEach(t => register(t, 'EXCLUSION'));
      camp.targetingResolved.exclusions.jobTitles.forEach(t => register(t, 'EXCLUSION'));
      camp.targetingResolved.exclusions.other.forEach(t => register(t, 'EXCLUSION'));
    });
  });

  // 2. Perform "Bundling"
  // Invert the map: CampaignSet (signature) -> List of Facets
  // Key = Sorted Campaign IDs joined by comma
  const fingerprintToFacets = new Map<string, string[]>();

  facetToCampaigns.forEach((campaignSet, facetName) => {
     const signature = Array.from(campaignSet).sort().join('|');
     // Also append type to signature so we don't bundle Geos with Jobs
     const fullSignature = `${facetTypes.get(facetName)}::${signature}`;
     
     if (!fingerprintToFacets.has(fullSignature)) {
       fingerprintToFacets.set(fullSignature, []);
     }
     fingerprintToFacets.get(fullSignature)!.push(facetName);
  });

  // 3. Construct Final Nodes & Connections
  const finalFacets: FlowData['facets'] = [];
  const finalConnections: FlowData['connections'] = [];

  fingerprintToFacets.forEach((facets, signature) => {
     // Extract type from signature
     const type = signature.split('::')[0] as any;
     const campaignIds = signature.split('::')[1].split('|').filter(x => x);

     // Check if we should bundle
     // We bundle if there are > 2 items pointing to the exact same campaigns
     if (facets.length > 2) {
       // Create Bundle Node
       const primaryName = facets[0];
       const bundleLabel = `${primaryName} + ${facets.length - 1} others`;
       const bundleId = `bundle-${primaryName}`;
       
       finalFacets.push({
         id: bundleId,
         label: bundleLabel,
         type: type,
         count: facets.length,
         items: facets
       });

       // Create connections from Bundle -> Campaigns
       campaignIds.forEach(cId => {
         finalConnections.push({ sourceId: bundleId, targetId: cId });
       });

     } else {
       // Create Individual Nodes
       facets.forEach(facetName => {
         finalFacets.push({
           id: facetName,
           label: facetName,
           type: type,
           count: 1
         });
         
         campaignIds.forEach(cId => {
            finalConnections.push({ sourceId: facetName, targetId: cId });
         });
       });
     }
  });

  return { facets: finalFacets, campaigns: campaignsList, connections: finalConnections };
};

// --- Remarketing Graph Logic ---

export interface RemarketingNode {
  id: string;
  label: string;
  type: 'SOURCE' | 'CAMPAIGN_COLD' | 'AUDIENCE_POOL' | 'CAMPAIGN_RETARGETING';
  level: number;
}

export interface RemarketingLink {
  source: string;
  target: string;
}

export interface RemarketingGraph {
  nodes: RemarketingNode[];
  links: RemarketingLink[];
}

export const getRemarketingGraph = (data: AccountStructure): RemarketingGraph => {
  const nodes: RemarketingNode[] = [];
  const links: RemarketingLink[] = [];
  const nodeSet = new Set<string>();

  const addNode = (id: string, label: string, type: RemarketingNode['type'], level: number) => {
    if (!nodeSet.has(id)) {
      nodes.push({ id, label, type, level });
      nodeSet.add(id);
    }
  };

  const isRetargetingAudience = (name: string): boolean => {
    const lower = name.toLowerCase();
    // Logic: Lists are Cold, Website/Engagement are Retargeting
    if (lower.includes('list') || lower.includes('upload') || lower.includes('abm') || lower.includes('competitor')) return false;
    if (lower.includes('website') || lower.includes('visitor') || lower.includes('engaged') || lower.includes('retargeting') || lower.includes('leads')) return true;
    return false; // Default to cold if unsure
  };

  // 1. Identify "Pool" Audiences that are valid outputs or inputs
  // We don't pre-scan everything, we rely on campaign usage

  // 2. Identify Campaigns
  data.groups.forEach(group => {
    group.children.forEach(campaign => {
      // Analyze the targeting to decide if this campaign is Cold (Level 1) or Remarketing (Level 3)
      let isRemarketingCampaign = false;

      // Check included audiences
      campaign.targetingResolved.audiences.forEach(audName => {
        if (isRetargetingAudience(audName)) {
          isRemarketingCampaign = true;
        }
      });

      const campaignType = isRemarketingCampaign ? 'CAMPAIGN_RETARGETING' : 'CAMPAIGN_COLD';
      const campaignLevel = isRemarketingCampaign ? 3 : 1;
      
      addNode(campaign.id, campaign.name, campaignType, campaignLevel);

      // Add Links IN (Targeting)
      // If it's Remarketing, it consumes Retargeting Pools
      if (isRemarketingCampaign) {
        campaign.targetingResolved.audiences.forEach(aud => {
          if (isRetargetingAudience(aud)) {
             addNode(aud, aud, 'AUDIENCE_POOL', 2); // Level 2: The Pool
             links.push({ source: aud, target: campaign.id });
          } else {
             // It's a list being used in a remarketing campaign? 
             // Treat it as a helper source (Level 2 source? or just ignore for simple flow)
             // For strict funnel viz, we treat Lists as Level 0 always.
             addNode(aud, aud, 'SOURCE', 0);
             links.push({ source: aud, target: campaign.id });
          }
        });
        
        // Also targets standard attributes?
        [...campaign.targetingResolved.geos, ...campaign.targetingResolved.industries].forEach(attr => {
           addNode(attr, attr, 'SOURCE', 0);
           links.push({ source: attr, target: campaign.id });
        });

      } else {
        // Cold Campaign
        // Consumes Lists (Level 0) and Attributes (Level 0)
        [
           ...campaign.targetingResolved.geos, 
           ...campaign.targetingResolved.industries,
           ...campaign.targetingResolved.jobTitles,
           ...campaign.targetingResolved.audiences // These are Lists/Cold audiences
        ].forEach(attr => {
           addNode(attr, attr, 'SOURCE', 0); 
           links.push({ source: attr, target: campaign.id });
        });
      }

      // Add Links OUT (Data Collection)
      if (campaign.outputAudiences && campaign.outputAudiences.length > 0) {
        campaign.outputAudiences.forEach(outAud => {
           // Output audience is always a pool (Level 2)
           addNode(outAud, outAud, 'AUDIENCE_POOL', 2);
           links.push({ source: campaign.id, target: outAud });
        });
      }
    });
  });

  return { nodes, links };
};

// --- Hierarchy Tree Logic (Left-to-Right) ---

export interface TreeNode {
  id: string;
  type: NodeType;
  name: string;
  x: number;
  y: number;
  height: number; // Estimated height for proper positioning
  columnOffset?: number; // For 2-column ad layout
  data: any;
}

export interface TreeLink {
  source: string;
  target: string;
}

export const getTreeGraph = (account: AccountStructure) => {
  const nodes: TreeNode[] = [];
  const links: TreeLink[] = [];
  
  const X_SPACING = 320;
  const AD_WIDTH = 130; // Half width for 2-column layout
  const AD_HEIGHT = 50; // Compact ad height
  const AD_GAP = 8; // Gap between ads
  const CAMPAIGN_GAP = 25; // Gap between campaigns
  const GROUP_GAP = 50; // Gap between campaign groups
  
  // Estimate node height based on name length and type
  const estimateHeight = (name: string, type: NodeType): number => {
    if (type === NodeType.CREATIVE) return AD_HEIGHT;
    // Estimate lines based on character count (280px width, ~28 chars per line)
    const charsPerLine = 28;
    const lines = Math.ceil(name.length / charsPerLine);
    const baseHeight = 70; // Base height for header + padding
    const lineHeight = 22; // Height per line of text
    return baseHeight + (lines * lineHeight);
  };
  
  // Use a mutable cursor to track vertical position in pixels
  let currentY = 0;

  // Recursive traversal to assign Y coordinates based on leaf nodes (or stacking)
  const traverse = (node: any, type: NodeType, level: number): number => {
    // If it's a leaf node (Creative) OR a container with no children
    const children = node.children || node.groups || []; // Handle Account -> Groups mismatch
    const hasChildren = children.length > 0;

    if (!hasChildren) {
      // Estimate height based on name length
      const nodeHeight = estimateHeight(node.name, type);
      
      const y = currentY + (nodeHeight / 2);
      currentY += nodeHeight;
      
      nodes.push({
        id: node.id,
        type,
        name: node.name,
        x: level * X_SPACING,
        y,
        height: nodeHeight,
        data: node
      });
      return y;
    } 
    
    // Process children first (Post-Order Traversal for layout)
    // Account -> Groups -> Campaigns -> Creatives
    let childType: NodeType;
    if (type === NodeType.ACCOUNT) childType = NodeType.GROUP;
    else if (type === NodeType.GROUP) childType = NodeType.CAMPAIGN;
    else childType = NodeType.CREATIVE;

    const childYs: number[] = [];
    
    // Special handling for creatives - 2 column layout
    if (childType === NodeType.CREATIVE && children.length > 0) {
      // First, calculate how tall the campaign box will be
      const campaignHeight = estimateHeight(node.name, type);
      const startY = currentY + (campaignHeight / 2); // Start ads from campaign center
      const numRows = Math.ceil(children.length / 2);
      const adsHeight = (numRows * AD_HEIGHT) + ((numRows - 1) * AD_GAP);
      
      // Calculate vertical offset to center ads with campaign
      const adsStartY = currentY + Math.max(campaignHeight, adsHeight) / 2 - adsHeight / 2;
      
      children.forEach((child: any, index: number) => {
        const row = Math.floor(index / 2);
        const col = index % 2;
        
        // Creatives are at level+1 (one level to the right of their parent campaign)
        const x = (level + 1) * X_SPACING;
        const columnOffset = col * (AD_WIDTH + AD_GAP);
        const y = adsStartY + (row * (AD_HEIGHT + AD_GAP)) + (AD_HEIGHT / 2);
        
        nodes.push({
          id: child.id,
          type: NodeType.CREATIVE,
          name: child.name,
          x,
          y,
          height: AD_HEIGHT,
          columnOffset,
          data: child
        });
        
        childYs.push(y);
        // Only draw link to left-column ads (col 0) for cleaner flow
        if (col === 0) {
          links.push({ source: node.id, target: child.id });
        }
      });
      
      // The campaign node is centered in its slot
      const slotHeight = Math.max(campaignHeight, adsHeight);
      const campaignY = currentY + slotHeight / 2;
      
      nodes.push({
        id: node.id,
        type,
        name: node.name,
        x: level * X_SPACING,
        y: campaignY,
        height: campaignHeight,
        data: node
      });
      
      // Advance currentY by the slot height plus gap
      currentY += slotHeight + CAMPAIGN_GAP;
      
      return campaignY;
    } else {
      children.forEach((child: any, index: number) => {
         // Add visual separation between siblings (gap comes AFTER each node)
         const cy = traverse(child, childType, level + 1);
         childYs.push(cy);
         links.push({ source: node.id, target: child.id });
         
         // Add gap after each child (except implicitly handled by traverse for campaigns)
         if (childType === NodeType.GROUP && index < children.length - 1) {
            currentY += GROUP_GAP; // Larger gap between campaign groups
         }
      });
    }

    // Center parent based on children
    const minY = Math.min(...childYs);
    const maxY = Math.max(...childYs);
    const y = (minY + maxY) / 2;
    
    const nodeHeight = estimateHeight(node.name, type);

    nodes.push({
      id: node.id,
      type,
      name: node.name,
      x: level * X_SPACING,
      y,
      height: nodeHeight,
      data: node
    });

    return y;
  };

  traverse(account, NodeType.ACCOUNT, 0);

  return { nodes, links, width: 4 * X_SPACING, height: currentY + 100 };
};
