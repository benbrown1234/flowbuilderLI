
import { MockRawCampaign } from '../types';

export const MOCK_ACCOUNTS_LIST = [
  { id: '502962649', name: "Ben's Ad Account" },
  { id: 'act_55123412', name: "Acme Corp Global" },
  { id: 'act_99999999', name: "Enterprise Scale Demo (Clustering)" },
];

// Data Store mapped by Account ID
export const MOCK_DATA_STORE: Record<string, {
  groups: any[],
  campaigns: MockRawCampaign[],
  creatives: any[]
}> = {
  // --- ACME CORP (Existing) ---
  'act_55123412': {
    groups: [
      { id: 'urn:li:sponsoredCampaignGroup:1001', name: 'Q3 Awareness Layer', status: 'ACTIVE' },
      { id: 'urn:li:sponsoredCampaignGroup:1002', name: 'Q3 Conversion - Bottom Funnel', status: 'ACTIVE' },
    ],
    campaigns: [
      {
        id: 'urn:li:sponsoredCampaign:2001',
        name: 'US - FinServices - Cold',
        campaignGroup: 'urn:li:sponsoredCampaignGroup:1001',
        dailyBudget: 150.00,
        status: 'ACTIVE',
        objective: 'Brand Awareness',
        biddingStrategy: 'Maximum Delivery',
        outputAudiences: ['urn:li:adSegment:5001'], // Feeds Website Visitors
        targetingCriteria: {
          include: {
            and: [
              { 'urn:li:adTargetingFacet:locations': ['urn:li:geo:102'] }, // US
              { 'urn:li:adTargetingFacet:industries': ['urn:li:industry:43'] }, // Financial Services
            ]
          },
          exclude: {
            or: [
              { 'urn:li:adTargetingFacet:audienceMatchingSegments': ['urn:li:adSegment:9001'] } // Exclude current customers
            ]
          }
        }
      },
      {
        id: 'urn:li:sponsoredCampaign:2002',
        name: 'UK/CA - Tech - Retargeting',
        campaignGroup: 'urn:li:sponsoredCampaignGroup:1001',
        dailyBudget: 100.00,
        status: 'ACTIVE',
        objective: 'Website Visits',
        biddingStrategy: 'Manual CPC',
        outputAudiences: ['urn:li:adSegment:9999'], // Feeds Converted Leads
        targetingCriteria: {
          include: {
            and: [
              { 'urn:li:adTargetingFacet:locations': ['urn:li:geo:101', 'urn:li:geo:100'] }, // UK, Canada
              { 'urn:li:adTargetingFacet:audienceMatchingSegments': ['urn:li:adSegment:5001'] } // Website Visitors
            ]
          }
        }
      },
      {
        id: 'urn:li:sponsoredCampaign:2003',
        name: 'Global - Job Titles - High Intent',
        campaignGroup: 'urn:li:sponsoredCampaignGroup:1002',
        dailyBudget: 300.00,
        status: 'ACTIVE',
        objective: 'Lead Generation',
        biddingStrategy: 'Cost Cap',
        outputAudiences: ['urn:li:adSegment:5001'],
        targetingCriteria: {
          include: {
            and: [
              { 'urn:li:adTargetingFacet:locations': ['urn:li:geo:102'] },
              { 'urn:li:adTargetingFacet:jobTitles': ['urn:li:jobTitle:10', 'urn:li:jobTitle:20'] } // CTO, VP Eng
            ]
          }
        }
      }
    ],
    creatives: [
      { id: '3001', campaign: 'urn:li:sponsoredCampaign:2001', name: 'Video_Hero_Asset_A', format: 'VIDEO' },
      { id: '3002', campaign: 'urn:li:sponsoredCampaign:2001', name: 'Video_Hero_Asset_B', format: 'VIDEO' },
      { id: '3003', campaign: 'urn:li:sponsoredCampaign:2002', name: 'Carousel_Features_Q3', format: 'CAROUSEL' },
      { id: '3004', campaign: 'urn:li:sponsoredCampaign:2003', name: 'Static_Testimonial_1', format: 'IMAGE' },
    ]
  },

  // --- BEN'S AD ACCOUNT (Updated per Request) ---
  '502962649': {
    groups: [
      { id: 'grp_ft_01', name: 'FT SaaS / Software - Marketing Senior', status: 'ACTIVE' },
      { id: 'grp_wl_01', name: 'WL SaaS / Software - Marketing Senior', status: 'ACTIVE' },
    ],
    campaigns: [
      // GROUP 1 CAMPAIGNS
      {
        id: 'cp_ft_01',
        name: "'SaaS' - 11-500 - Marketing & Founder - Engagement - TLA",
        campaignGroup: 'grp_ft_01',
        dailyBudget: 120.00,
        status: 'ACTIVE',
        objective: 'Engagement',
        biddingStrategy: 'Manual CPC',
        outputAudiences: ['urn:li:adSegment:5001'],
        targetingCriteria: {
          include: {
            and: [
               { 'urn:li:adTargetingFacet:industries': ['urn:li:industry:4'] }, // Software
               { 'urn:li:adTargetingFacet:jobTitles': ['urn:li:jobTitle:MKT_DIR', 'urn:li:jobTitle:FNDR'] },
               { 'urn:li:adTargetingFacet:locations': ['urn:li:geo:102'] } // US Default
            ]
          }
        }
      },
      {
        id: 'cp_ft_02',
        name: 'FT - SaaS & Software Dev (UK) - 11-5000 - Marketing Senior (TLA - Video)',
        campaignGroup: 'grp_ft_01',
        dailyBudget: 150.00,
        status: 'ACTIVE',
        objective: 'Video Views',
        biddingStrategy: 'Maximum Delivery',
        outputAudiences: [],
        targetingCriteria: {
          include: {
            and: [
               { 'urn:li:adTargetingFacet:locations': ['urn:li:geo:101'] }, // UK
               { 'urn:li:adTargetingFacet:industries': ['urn:li:industry:4'] },
               { 'urn:li:adTargetingFacet:jobTitles': ['urn:li:jobTitle:MKT_DIR'] }
            ]
          }
        }
      },
      {
         id: 'cp_ft_03',
         name: 'Testimonial - Carousel',
         campaignGroup: 'grp_ft_01',
         dailyBudget: 80.00,
         status: 'ACTIVE',
         objective: 'Brand Awareness',
         biddingStrategy: 'CPM',
         outputAudiences: [],
         targetingCriteria: {
           include: {
             and: [
               { 'urn:li:adTargetingFacet:audienceMatchingSegments': ['urn:li:adSegment:5001'] } // Retargeting likely for testimonial
             ]
           }
         }
      },
      {
        id: 'cp_ft_04',
        name: 'FT - SaaS & Software Dev (UK) - 11-5000 - Marketing Senior (Company - Static)',
        campaignGroup: 'grp_ft_01',
        dailyBudget: 100.00,
        status: 'ACTIVE',
        objective: 'Brand Awareness',
        biddingStrategy: 'CPM',
        outputAudiences: [],
        targetingCriteria: {
          include: {
            and: [
              { 'urn:li:adTargetingFacet:locations': ['urn:li:geo:101'] },
              { 'urn:li:adTargetingFacet:industries': ['urn:li:industry:4'] }
            ]
          }
        }
      },
      
      // GROUP 2 CAMPAIGNS
      {
        id: 'cp_wl_01',
        name: "WL SaaS' - 11-500 - Marketing & Founder - Lead Gen - In-main",
        campaignGroup: 'grp_wl_01',
        dailyBudget: 200.00,
        status: 'ACTIVE',
        objective: 'Lead Generation',
        biddingStrategy: 'Cost Cap',
        outputAudiences: ['urn:li:adSegment:9999'],
        targetingCriteria: {
          include: {
            and: [
               { 'urn:li:adTargetingFacet:industries': ['urn:li:industry:4'] },
               { 'urn:li:adTargetingFacet:jobTitles': ['urn:li:jobTitle:MKT_DIR', 'urn:li:jobTitle:FNDR'] }
            ]
          }
        }
      },
      {
        id: 'cp_wl_02',
        name: "WL SaaS' - 11-500 - Marketing & Founder - Engagement - TLA (Image)",
        campaignGroup: 'grp_wl_01',
        dailyBudget: 110.00,
        status: 'ACTIVE',
        objective: 'Engagement',
        biddingStrategy: 'Maximum Delivery',
        outputAudiences: [],
        targetingCriteria: {
          include: {
            and: [
               { 'urn:li:adTargetingFacet:industries': ['urn:li:industry:4'] }
            ]
          }
        }
      },
      {
        id: 'cp_wl_03',
        name: "WL SaaS' - 11-500 - Marketing & Founder - Engagement - TLA (VIDEO)",
        campaignGroup: 'grp_wl_01',
        dailyBudget: 130.00,
        status: 'ACTIVE',
        objective: 'Engagement',
        biddingStrategy: 'Maximum Delivery',
        outputAudiences: [],
        targetingCriteria: {
          include: {
            and: [
               { 'urn:li:adTargetingFacet:industries': ['urn:li:industry:4'] }
            ]
          }
        }
      },
      {
        id: 'cp_wl_04',
        name: "WL SaaS' - 11-500 - Marketing - Lead Gen - Video",
        campaignGroup: 'grp_wl_01',
        dailyBudget: 250.00,
        status: 'ACTIVE',
        objective: 'Lead Generation',
        biddingStrategy: 'Cost Cap',
        outputAudiences: ['urn:li:adSegment:9999'],
        targetingCriteria: {
          include: {
            and: [
               { 'urn:li:adTargetingFacet:jobTitles': ['urn:li:jobTitle:MKT_DIR'] }
            ]
          }
        }
      }
    ],
    creatives: [
      // FT Group Creatives
      { id: 'cr_ft_01_1', campaign: 'cp_ft_01', name: 'Ad 1', format: 'IMAGE' },
      { id: 'cr_ft_01_2', campaign: 'cp_ft_01', name: 'Ad 2', format: 'IMAGE' },
      { id: 'cr_ft_01_3', campaign: 'cp_ft_01', name: 'Ad 3', format: 'IMAGE' },

      { id: 'cr_ft_02_1', campaign: 'cp_ft_02', name: 'Ad 1', format: 'VIDEO' },
      { id: 'cr_ft_02_2', campaign: 'cp_ft_02', name: 'Ad 2', format: 'VIDEO' },
      { id: 'cr_ft_02_3', campaign: 'cp_ft_02', name: 'Ad 3', format: 'VIDEO' },

      { id: 'cr_ft_03_1', campaign: 'cp_ft_03', name: 'Ad 1', format: 'CAROUSEL' },
      { id: 'cr_ft_03_2', campaign: 'cp_ft_03', name: 'Ad 2', format: 'CAROUSEL' },
      { id: 'cr_ft_03_3', campaign: 'cp_ft_03', name: 'Ad 3', format: 'CAROUSEL' },

      { id: 'cr_ft_04_1', campaign: 'cp_ft_04', name: 'Ad 1', format: 'IMAGE' },
      { id: 'cr_ft_04_2', campaign: 'cp_ft_04', name: 'Ad 2', format: 'IMAGE' },
      { id: 'cr_ft_04_3', campaign: 'cp_ft_04', name: 'Ad 3', format: 'IMAGE' },

      // WL Group Creatives
      { id: 'cr_wl_01_1', campaign: 'cp_wl_01', name: 'Ad 1', format: 'IMAGE' },
      { id: 'cr_wl_01_2', campaign: 'cp_wl_01', name: 'Ad 2', format: 'IMAGE' },
      { id: 'cr_wl_01_3', campaign: 'cp_wl_01', name: 'Ad 3', format: 'IMAGE' },

      { id: 'cr_wl_02_1', campaign: 'cp_wl_02', name: 'Ad 1', format: 'IMAGE' },
      { id: 'cr_wl_02_2', campaign: 'cp_wl_02', name: 'Ad 2', format: 'IMAGE' },
      { id: 'cr_wl_02_3', campaign: 'cp_wl_02', name: 'Ad 3', format: 'IMAGE' },

      { id: 'cr_wl_03_1', campaign: 'cp_wl_03', name: 'Ad 1', format: 'VIDEO' },
      { id: 'cr_wl_03_2', campaign: 'cp_wl_03', name: 'Ad 2', format: 'VIDEO' },
      { id: 'cr_wl_03_3', campaign: 'cp_wl_03', name: 'Ad 3', format: 'VIDEO' },

      { id: 'cr_wl_04_1', campaign: 'cp_wl_04', name: 'Ad 1', format: 'VIDEO' },
      { id: 'cr_wl_04_2', campaign: 'cp_wl_04', name: 'Ad 2', format: 'VIDEO' },
      { id: 'cr_wl_04_3', campaign: 'cp_wl_04', name: 'Ad 3', format: 'VIDEO' },
    ]
  },

  // --- ENTERPRISE DEMO ---
  'act_99999999': {
    groups: [
      { id: 'grp_tech', name: 'Tech Hiring Initiative', status: 'ACTIVE' }
    ],
    campaigns: [
      {
        id: 'camp_eng_hiring',
        name: 'Senior Engineering Roles',
        campaignGroup: 'grp_tech',
        dailyBudget: 1000,
        status: 'ACTIVE',
        objective: 'Talent Leads',
        biddingStrategy: 'Cost Cap',
        outputAudiences: [],
        targetingCriteria: {
          include: {
            and: [
              { 'urn:li:adTargetingFacet:locations': ['urn:li:geo:102', 'urn:li:geo:101', 'urn:li:geo:100', 'urn:li:geo:103', 'urn:li:geo:104'] },
              { 'urn:li:adTargetingFacet:jobTitles': [
                  'urn:li:jobTitle:10', 'urn:li:jobTitle:20', 'urn:li:jobTitle:30', 
                  'urn:li:jobTitle:31', 'urn:li:jobTitle:32', 'urn:li:jobTitle:33', 
                  'urn:li:jobTitle:34', 'urn:li:jobTitle:35'
                ] 
              },
              { 'urn:li:adTargetingFacet:industries': ['urn:li:industry:96', 'urn:li:industry:4', 'urn:li:industry:99'] }
            ]
          }
        }
      }
    ],
    creatives: [
      { id: 'cr_1', campaign: 'camp_eng_hiring', name: 'We_Are_Hiring_Gen', format: 'IMAGE' }
    ]
  }
};


// 4. Lookup Data (Simulating the Resolution Endpoints)
export const MOCK_URN_RESOLVER: Record<string, string> = {
  'urn:li:geo:102': 'United States',
  'urn:li:geo:101': 'United Kingdom',
  'urn:li:geo:100': 'Canada',
  'urn:li:geo:103': 'Germany',
  'urn:li:geo:104': 'Australia',
  
  'urn:li:industry:43': 'Financial Services',
  'urn:li:industry:96': 'Information Technology',
  'urn:li:industry:4': 'Computer Software',
  'urn:li:industry:99': 'Internet',

  'urn:li:jobTitle:10': 'Chief Technology Officer',
  'urn:li:jobTitle:20': 'VP of Engineering',
  'urn:li:jobTitle:99': 'Intern',
  'urn:li:jobTitle:30': 'Software Engineer',
  'urn:li:jobTitle:31': 'Senior Software Engineer',
  'urn:li:jobTitle:32': 'Frontend Developer',
  'urn:li:jobTitle:33': 'Backend Developer',
  'urn:li:jobTitle:34': 'DevOps Engineer',
  'urn:li:jobTitle:35': 'Site Reliability Engineer',
  'urn:li:jobTitle:MKT_DIR': 'Marketing Director',
  'urn:li:jobTitle:FNDR': 'Founder',

  'urn:li:adSegment:5001': 'Website Visitors (30D)',
  'urn:li:adSegment:9001': 'Competitor List',
  'urn:li:adSegment:7777': 'ABM - Tier 1 Accounts',
  'urn:li:adSegment:9999': 'Converted Leads',
};
