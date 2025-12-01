# LinkedIn Audience Visualizer

## Overview
A React-based visualization tool for LinkedIn advertising account structures. Shows account hierarchies, targeting flows, and remarketing strategies through interactive visualizations. Supports both demo data and real LinkedIn Marketing API data via OAuth 2.0 authentication. Features an AI-powered auditor chatbot for campaign insights and a comprehensive account audit feature.

## Tech Stack
- **Frontend**: React 19 + TypeScript + Vite (port 5000)
- **Backend**: Express.js + TypeScript (port 3001)
- **Database**: PostgreSQL (Neon) for audit data storage
- **UI**: Tailwind CSS (CDN), Lucide React icons
- **API**: LinkedIn Marketing API (OAuth 2.0), OpenAI (via Replit AI Integrations)

## Project Structure
- `/components/` - React components (AudienceFlow, HierarchyNode, RemarketingFlow, StructureTree, TargetingInspector, AIAuditor, AuditPage, IdeateCanvas)
- `/services/` - Business logic
  - `linkedinLogic.ts` - Mock data logic
  - `mockData.ts` - Demo data
  - `linkedinApi.ts` - Frontend API client for LinkedIn
- `/server/` - Backend Express server
  - `index.ts` - OAuth endpoints and LinkedIn API proxy
  - `database.ts` - PostgreSQL database functions for audit data
  - `auditRules.ts` - Audit rules engine for generating recommendations
- `App.tsx` - Main application component
- `index.tsx` - React entry point
- `index.html` - HTML entry with Tailwind CDN
- `vite.config.ts` - Vite configuration with API proxy

## Setup
The app works with demo data by default. To connect real LinkedIn data:
1. Click "Connect LinkedIn" button
2. Authorize via LinkedIn OAuth
3. Toggle "Live Data" to switch between demo and real data

Required secrets for LinkedIn API:
- `LINKEDIN_CLIENT_ID`
- `LINKEDIN_CLIENT_SECRET`

## View Modes
1. Structure Tree - Hierarchical view of campaigns
2. Targeting Flow - Audience composition visualization
3. Remarketing - Campaign flow visualization
4. Audit - On-demand account audit with recommendations
5. Ideate - Campaign planning canvas with AI generation

## Account Audit
The Audit tab provides comprehensive account analysis with actionable recommendations. Features:
- **On-demand sync**: Data is only stored when you explicitly run an audit (not automatic)
- **Multi-tenant isolation**: Each account's data is stored separately with account_id scoping
- **Health score**: Overall account score (0-100) with letter grade (A-F)
- **Category breakdown**: Scores for Structure, Performance, Targeting, Creative, and Budget
- **Recommendations**: Prioritized issues with severity levels (High/Medium/Low)
- **Auto-expiry**: Audit data expires after 30 days, or can be deleted manually

Categories analyzed:
- **Structure**: Empty groups, campaigns with too few/many ads, organization
- **Performance**: CTR trends, CPC analysis, conversion tracking, delivery issues
- **Targeting**: Duplicate targeting across campaigns, missing criteria
- **Creative**: Format diversity (video, carousel, etc.)
- **Budget**: Daily budget levels, pacing, concentration risk

LinkedIn API compliance: Only aggregate campaign metrics are stored (not member-level data), compliant with LinkedIn's data storage requirements.

## Ideate Canvas
The Ideate tab provides a visual campaign planning canvas. Features:
- **Default funnel template**: Pre-built Awareness → Consideration → Activation structure with 3 ads each
- **Drag-and-drop**: Reposition nodes freely on the canvas
- **Manual creation**: Add campaign groups, campaigns, and ads via toolbar (enforces proper hierarchy)
- **AI generation**: Describe your campaign goals and AI generates a complete structure
- **Inline editing**: Double-click node names to edit
- **Export**: Copy structure as text brief to clipboard
- **Clear All**: Remove all nodes from canvas with one click

Hierarchy enforcement:
- Campaign Groups are always top-level
- Campaigns must belong to a Campaign Group
- Ads must belong to a Campaign

Right sidebar (click any node to open):
- **Campaign Groups**: Set funnel stage (Awareness/Consideration/Activation), select target industries from categorized LinkedIn industry list
- **Campaigns**: Choose campaign objective based on funnel stage:
  - Awareness: Brand Awareness, Engagement
  - Consideration: Website Visits, Video Views
  - Activation: Lead Generation, Website Conversions, Job Applicants
- **Ads**: Select ad format (Image, Video, Carousel, Document, Event, Message, Text, Spotlight, Follower)
- **Notes**: Add notes to any node for planning context

## AI Auditor
Click the sparkle button in the bottom right corner to open the AI Auditor chatbot. Features:
- Ask natural language questions about campaigns, targeting, and performance
- Tag specific entities using `/` followed by the name (autocomplete dropdown appears)
- Supports tagging: Campaign Groups, Campaigns, Ads, Audiences
- Streaming responses with context from your account data
- Works with both demo and live data modes

## Running
- `npm run dev` - Starts both frontend (port 5000) and backend (port 3001)
- `npm run client` - Frontend only
- `npm run server` - Backend only

## Recent Changes
- 2025-12-01: Added Ideate Canvas feature - new "Ideate" tab for visual campaign planning. Features: drag-and-drop canvas for creating campaign structures, default funnel template (Awareness → Consideration → Activation with 3 ads each), AI-powered structure generation from natural language prompts, inline editing of node names, hierarchy enforcement (groups → campaigns → ads), copy to clipboard export. Uses OpenAI via Replit AI Integrations.
- 2025-11-28: Added Account Audit feature - new "Audit" tab with on-demand account analysis. Features: PostgreSQL database for storing audit snapshots, multi-tenant isolation with account_id scoping, health score (0-100) with A-F grade, category breakdown (Structure, Performance, Targeting, Creative, Budget), prioritized recommendations with severity levels. Compliant with LinkedIn's data storage requirements (aggregate metrics only, 30-day auto-expiry).
- 2025-11-28: Enhanced ad format detection with creative-level content inspection. Detection priority: 1) creative.type field (SPONSORED_INMAILS→Message, TEXT_AD→Text, DYNAMIC→Spotlight), 2) content structure (content.carousel→Carousel, content.spotlight→Spotlight, content.eventAd→Event), 3) media URN patterns (urn:li:video:→Video, urn:li:image:→Image), 4) variables.data keys, 5) campaign-level fallback. Ad cards display format labels: Image Ad, Video Ad, Carousel Ad, Text Ad, Spotlight, Follower, Document, Event, Message, Jobs. Demo mode uses placeholder images from picsum.photos with content structures simulating LinkedIn API format.
- 2025-11-28: Added AI Auditor chatbot - floating chat widget in bottom right corner for natural language campaign insights. Features entity tagging with '/' autocomplete, streaming responses, and context-aware answers about targeting, performance, and audiences. Uses OpenAI via Replit AI Integrations.
- 2025-11-28: Added `r_ads_reporting` OAuth scope to enable LinkedIn adAnalytics API access for performance metrics
- 2025-11-27: Restructured TargetingSummary to support 8 organized categories: geos, audiences, companyLists, company (names/industries/sizes/followers/growthRate/category), demographics (ages/genders), education (fieldsOfStudy/degrees/schools), jobExperience (titles/functions/seniorities/yearsOfExperience/skills), interestsTraits (memberInterests/memberTraits/memberGroups). Updated TargetingInspector with collapsible CategoryBox components for organized display of targeting criteria.
- 2025-11-27: Fixed Remarketing Flow column categorization - company lists (BULK type segments) are now correctly placed in Cold Campaigns column. Only true remarketing segments (RETARGETING, LOOKALIKE, VIDEO, WEBSITE, ENGAGED) appear in the Remarketing Audiences middle column. Campaigns using only company lists are now categorized as cold, not remarketing.
- 2025-11-27: Added REAL source campaign connections from LinkedIn's `/dmpEngagementRules` API endpoint. Segments now show their actual `sourceCampaigns` (which campaigns are included in the engagement retargeting audience). Orange dashed lines in Remarketing Flow show these real connections. Demo mode includes mock sourceCampaigns for Video Viewers and Ad Engagers segments.
- 2025-11-27: Added click-to-filter behavior on Remarketing Flow - clicking any item filters the view to show only connected items across all three columns. Hovering highlights connections while clicking removes unrelated items entirely. Headers show filtered/total counts (e.g., "3/10") when selection is active.
- 2025-11-27: Fixed Remarketing Flow segment extraction to handle LinkedIn API's `dynamicSegments` facet (in addition to `audienceMatchingSegments`). Added fallback for legacy campaigns without raw targeting data. Filtered native targeting values (company sizes, etc.) from appearing in the middle column - only actual remarketing segments now appear.
- 2025-11-27: Redesigned Remarketing Flow as 3-column marketing funnel: Cold Campaigns (left) → Remarketing Audiences (middle) → Remarketing Campaigns (right). Cold campaigns use company lists/native targeting, remarketing campaigns target audience segments. Blue lines show which cold campaigns build audiences (via outputAudiences), green lines show which audiences are targeted by remarketing campaigns. Hover/click highlighting shows connections across all columns.
- 2025-11-27: Added mock segments (MOCK_SEGMENTS) to mockData.ts for demo mode - includes Website Visitors, Video Viewers, Ad Engagers, Converted Leads segment types
- 2025-11-27: Added 'ENGAGED' segment type to SegmentNode type for ad engagement audiences
- 2025-11-27: Dynamic layout with height estimation - campaign/group names wrap to show full text, proper spacing between campaigns (25px) and groups (50px), no overlapping, ads in 2-column grid to the right, flow lines connect to left-column ads only
- 2025-11-27: Added full-screen modal popup for ad preview - "View Full Preview" opens centered modal with full-size ad preview
- 2025-11-27: Added "Thought Leader Ad" label - automatically shown when ad name is "Creative" + number format
- 2025-11-27: Improved creative preview UI - scaled preview fits within panel, properly labeled sections (AD NAME, CREATIVE ID, DESCRIPTION, CALL TO ACTION, DESTINATION URL, LEAD FORM)
- 2025-11-27: Added rich creative preview panel - clicking on ads shows live LinkedIn ad preview iframe, ad type, headline, description, call-to-action, destination URL, and lead form info (requires live data)
- 2025-11-27: Added /adPreviews and /creatives/:id API endpoints for fetching ad preview iframes and creative content details
- 2025-11-27: Added categorized exclusions - exclusions now display by type (Locations, Company Lists, Audiences, Industries, Job Titles) instead of flat list
- 2025-11-27: Removed language/locale from Locations - interfaceLocales facet and locale URNs are now filtered out; only geographic locations show in Locations section
- 2025-11-27: Added human-readable names for company lists in targeting sidebar - uses segment name map from adSegments API
- 2025-11-27: Separated Company Lists from Audience Segments in Targeting Rules sidebar - company list IDs now show in dedicated "Company Lists" section with cyan styling
- 2025-11-27: Fixed geo/location detection - locations like "United Kingdom" now correctly appear under Locations instead of Audience Segments
- 2025-11-27: Separated Company Lists from Audience Segments in Remarketing view - now shows distinct sections for Company Lists, Contact Lists, Website Visitors, and Lookalike Audiences
- 2025-11-27: Fixed segment type detection for LinkedIn adSegments API - correctly identifies BULK (company/contact uploads), RETARGETING, and LOOKALIKE types
- 2025-11-26: Fixed remarketing segments API - now uses `/adSegments?q=accounts` endpoint (was `/dmpSegments`)
- 2025-11-26: Fixed targeting URN resolution - added `queryVersion=QUERY_USES_URNS` for LinkedIn API compatibility
- 2025-11-26: Fixed `collectTargetingUrns` to handle `exclude.or` as object instead of array (was causing resolution failures)
- 2025-11-26: Added targeting URN resolution via LinkedIn adTargetingEntities API for human-readable names
- 2025-11-26: Added targeting rules panel - click on campaigns in Structure view to see targeting criteria
- 2025-11-26: Fixed creatives API to correctly fetch ads using List() format with proper encoding
- 2025-11-26: Added "Active Only" toggle to filter campaigns/ads by ACTIVE status
- 2025-11-26: Added retargeting segments API endpoint (`/adSegments`) for remarketing visualization
- 2025-11-26: Fixed LinkedIn API endpoints to use new path-based account ID format (May 2024 API change)
- 2025-11-26: Added full pagination support for LinkedIn API (handles large accounts with 500+ items per page)
- 2025-11-26: Fixed budget parsing to handle LinkedIn's minor currency units (cents → dollars)
- 2025-11-26: Improved targeting criteria parsing with facet mappings (geos, industries, job titles, seniorities, skills)
- 2025-11-26: Fixed campaign-to-group linking using URN parsing
- 2025-11-26: Added account selection dropdown with localStorage persistence
- 2025-11-26: Added LinkedIn Marketing API integration with OAuth 2.0 authentication
- 2025-11-26: Initial import from GitHub, configured for Replit environment

## LinkedIn API Data Mapping Notes
- Campaign Groups: `name`, `status` fields from API; budget from `runSchedule.start/end`
- Campaigns: `name`, `status`, `costType`, `objectiveType`, `dailyBudget`; linked via `campaignGroup` URN
- Creatives: `name`, `type`, `status`; linked via `campaign` URN  
- Budgets: LinkedIn returns amounts in cents (minor units), converted to dollars in display
- IDs: Extracted from URN format (e.g., `urn:li:sponsoredCampaign:123456` → `123456`)
