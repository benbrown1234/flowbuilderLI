# LinkedIn Audience Visualizer

## Overview
A React-based visualization tool for LinkedIn advertising account structures. Shows account hierarchies, targeting flows, and remarketing strategies through interactive visualizations. Supports both demo data and real LinkedIn Marketing API data via OAuth 2.0 authentication.

## Tech Stack
- **Frontend**: React 19 + TypeScript + Vite (port 5000)
- **Backend**: Express.js + TypeScript (port 3001)
- **UI**: Tailwind CSS (CDN), Lucide React icons
- **API**: LinkedIn Marketing API (OAuth 2.0)

## Project Structure
- `/components/` - React components (AudienceFlow, HierarchyNode, RemarketingFlow, StructureTree, TargetingInspector)
- `/services/` - Business logic
  - `linkedinLogic.ts` - Mock data logic
  - `mockData.ts` - Demo data
  - `linkedinApi.ts` - Frontend API client for LinkedIn
- `/server/` - Backend Express server
  - `index.ts` - OAuth endpoints and LinkedIn API proxy
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

## Running
- `npm run dev` - Starts both frontend (port 5000) and backend (port 3001)
- `npm run client` - Frontend only
- `npm run server` - Backend only

## Recent Changes
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
