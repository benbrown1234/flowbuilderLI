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
- 2025-11-26: Added LinkedIn Marketing API integration with OAuth 2.0 authentication
- 2025-11-26: Initial import from GitHub, configured for Replit environment
