

export enum NodeType {
  ACCOUNT = 'ACCOUNT',
  GROUP = 'GROUP',
  CAMPAIGN = 'CAMPAIGN',
  CREATIVE = 'CREATIVE'
}

export interface TargetingFacet {
  urn: string;
  name: string; // Resolved name
  type: 'LOCATION' | 'INDUSTRY' | 'JOB_TITLE' | 'AUDIENCE' | 'COMPANY_SIZE' | 'UNKNOWN';
}

export interface TargetingSummary {
  geos: string[];
  audiences: string[];
  industries: string[];
  jobTitles: string[];
  exclusions: string[];
}

export interface BaseNode {
  id: string;
  name: string;
  type: NodeType;
}

export interface CreativeNode extends BaseNode {
  type: NodeType.CREATIVE;
  previewUrl?: string;
  format: string;
}

export interface CampaignNode extends BaseNode {
  type: NodeType.CAMPAIGN;
  dailyBudget: number;
  status: string;
  objective: string;
  biddingStrategy: string;
  targetingRaw: any;
  targetingResolved: TargetingSummary;
  outputAudiences: string[];
  children: CreativeNode[];
  campaignGroupUrn?: string;
}

export interface GroupNode extends BaseNode {
  type: NodeType.GROUP;
  totalBudget: number; // Aggregated
  status: string;
  derivedTargeting: TargetingSummary; // Aggregated from children
  children: CampaignNode[];
}

export interface AccountStructure {
  id: string;
  name: string;
  currency: string;
  groups: GroupNode[];
}

export interface AccountSummary {
  id: string;
  name: string;
}

// Interfaces for the "Raw" mock data to simulate API responses
export interface MockRawCampaign {
  id: string;
  name: string;
  campaignGroup: string;
  dailyBudget: number;
  status: string;
  objective?: string;       // NEW
  biddingStrategy?: string; // NEW
  outputAudiences?: string[]; // NEW field for mock data
  targetingCriteria: {
    include: {
      and: Array<Record<string, string[]>>;
    };
    exclude?: {
      or: Array<Record<string, string[]>>;
    };
  };
}

export type OnSelectHandler = (
  type: NodeType,
  name: string,
  targeting?: TargetingSummary,
  creatives?: CreativeNode[],
  singleCreative?: CreativeNode,
  objective?: string,
  biddingStrategy?: string
) => void;
