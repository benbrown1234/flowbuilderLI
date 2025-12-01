# LinkedIn Audience Visualizer

## Overview
This project is a React-based visualization tool for LinkedIn advertising account structures, designed to offer comprehensive insights into campaign hierarchies, targeting strategies, and remarketing flows. It supports both demo data and real LinkedIn Marketing API data via OAuth 2.0. Key features include an AI-powered chatbot for campaign insights, an extensive account auditing system, and a visual campaign planning canvas. The tool aims to streamline the analysis and optimization of LinkedIn ad campaigns, providing a clear overview of complex account structures and aiding in strategic decision-making.

## User Preferences
N/A

## System Architecture
The application is built with a React 19 frontend using TypeScript and Vite, communicating with an Express.js backend also in TypeScript. Data is persisted in a PostgreSQL database (Neon) for audit-related information. The UI is styled with Tailwind CSS and uses Lucide React icons.

**Core Features & Implementations:**
*   **Account Visualization**:
    *   **Structure Tree**: Hierarchical view of campaign groups, campaigns, and ads.
    *   **Targeting Flow**: Visualizes audience composition.
    *   **Remarketing Flow**: Illustrates campaign and audience flow through a 3-column marketing funnel (Cold Campaigns → Remarketing Audiences → Remarketing Campaigns), showing connections and audience movement.
*   **Account Audit**:
    *   Provides on-demand account analysis with a health score (0-100, A-F grade) and categorized recommendations (Structure, Performance, Targeting, Creative, Budget).
    *   Stores audit snapshots in PostgreSQL, ensuring multi-tenant isolation and 30-day auto-expiry for compliance.
    *   Analyzes various aspects like empty groups, ad diversity, CTR trends, duplicate targeting, and budget pacing.
*   **Ideate Canvas**:
    *   A visual planning tool for campaigns, featuring a drag-and-drop interface.
    *   Includes a default funnel template (Awareness → Consideration → Activation) with hierarchy enforcement (Campaign Groups → Campaigns → Ads).
    *   Offers AI-powered generation of campaign structures based on natural language prompts.
    *   Allows inline editing, export as text brief, and detailed configuration of campaign groups, campaigns, ads, and retargeting audiences via a sidebar.
*   **AI Auditor**:
    *   A chatbot for natural language queries about campaigns, targeting, and performance.
    *   Supports entity tagging (Campaign Groups, Campaigns, Ads, Audiences) with autocomplete for context-aware responses.
*   **Ad Previews**: Provides rich creative previews with live LinkedIn ad preview iframes, displaying ad type, headline, description, call-to-action, destination URL, and lead form information.
*   **Dynamic Layouts**: Ensures proper spacing and non-overlapping elements for complex visualizations, with campaign/group names wrapping and ads arranged in a 2-column grid.
*   **Targeting Rules Panel**: Displays detailed targeting criteria for selected campaigns, organized by categories like geos, audiences, company lists, demographics, and job experience.
*   **Data Handling**: LinkedIn API data is mapped and processed, including budget conversions from minor units (cents) to dollars and URN parsing for ID extraction. Full pagination support is implemented for large accounts.

## External Dependencies
*   **LinkedIn Marketing API**: Used for fetching real campaign, ad, targeting, and performance data. Requires OAuth 2.0 authentication with `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET` secrets and `r_ads_reporting` scope.
*   **OpenAI**: Integrated via Replit AI Integrations for the AI Auditor chatbot and AI generation features in the Ideate Canvas.
*   **PostgreSQL (Neon)**: Serves as the database for storing audit data and recommendations.
*   **Tailwind CSS**: Utilized via CDN for styling the user interface.
*   **Lucide React**: Provides icons for the application UI.