

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
  companyLists: string[];
  company: {
    names: string[];
    industries: string[];
    sizes: string[];
    followers: string[];
    growthRate: string[];
    category: string[];
  };
  demographics: {
    ages: string[];
    genders: string[];
  };
  education: {
    fieldsOfStudy: string[];
    degrees: string[];
    schools: string[];
  };
  jobExperience: {
    titles: string[];
    functions: string[];
    seniorities: string[];
    yearsOfExperience: string[];
    skills: string[];
  };
  interestsTraits: {
    memberInterests: string[];
    memberTraits: string[];
    memberGroups: string[];
  };
  exclusions: {
    geos: string[];
    audiences: string[];
    companyLists: string[];
    company: string[];
    demographics: string[];
    education: string[];
    jobExperience: string[];
    interestsTraits: string[];
    other: string[];
  };
}

export interface BaseNode {
  id: string;
  name: string;
  type: NodeType;
}

export interface CreativeContent {
  headline?: string;
  description?: string;
  callToAction?: string;
  destinationUrl?: string;
  landingPageUrl?: string;
  leadFormId?: string;
  leadFormName?: string;
  imageUrl?: string;
  videoUrl?: string;
}

export interface CreativeNode extends BaseNode {
  type: NodeType.CREATIVE;
  previewUrl?: string;
  format: string;
  status?: string;
  contentReference?: string;
  content?: CreativeContent;
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

export interface SegmentNode {
  id: string;
  name: string;
  type: 'WEBSITE' | 'VIDEO' | 'COMPANY' | 'CONTACT' | 'LOOKALIKE' | 'ENGAGED' | 'OTHER';
  status: string;
  audienceCount?: number;
  sourceCampaigns?: string[];
  engagementTrigger?: string;
}

export interface AccountStructure {
  id: string;
  name: string;
  currency: string;
  groups: GroupNode[];
  segments?: SegmentNode[];
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
  biddingStrategy?: string,
  campaignId?: string
) => void;

export interface MonthlyMetrics {
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  leads: number;
  videoViews: number;
  landingPageClicks: number;
}

export interface CampaignMetrics {
  campaignId: string;
  campaignName: string;
  currentMonth: MonthlyMetrics;
  previousMonth: MonthlyMetrics;
  currency: string;
}

export interface AccountMetrics {
  accountId: string;
  campaigns: CampaignMetrics[];
  currentMonthLabel: string;
  previousMonthLabel: string;
}
