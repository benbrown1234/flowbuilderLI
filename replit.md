# LinkedIn Audience Visualizer

## Overview
A React-based visualization tool for LinkedIn advertising account structures. Shows account hierarchies, targeting flows, and remarketing strategies through interactive visualizations.

## Tech Stack
- **Frontend**: React 19 + TypeScript + Vite
- **UI**: Tailwind CSS (CDN), Lucide React icons
- **Port**: 5000 (frontend dev server)

## Project Structure
- `/components/` - React components (AudienceFlow, HierarchyNode, RemarketingFlow, StructureTree, TargetingInspector)
- `/services/` - Business logic (linkedinLogic, mockData)
- `App.tsx` - Main application component
- `index.tsx` - React entry point
- `index.html` - HTML entry with Tailwind CDN and import maps
- `vite.config.ts` - Vite configuration

## Setup
The app uses mock data and does not require API keys. It visualizes LinkedIn campaign structures with three view modes:
1. Structure Tree - Hierarchical view
2. Targeting Flow - Audience composition view
3. Remarketing - Campaign flow visualization

## Recent Changes
- 2025-11-26: Initial import from GitHub, configured for Replit environment
