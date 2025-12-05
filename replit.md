# LinkedIn Audience Visualizer

## Overview
This project is a React-based visualization tool for LinkedIn advertising account structures, designed to offer comprehensive insights into campaign hierarchies, targeting strategies, and remarketing flows. It uses LinkedIn Marketing API data via OAuth 2.0 (requires login). Key features include a CTR performance audit system with ad previews and a visual campaign planning canvas. The tool aims to streamline the analysis and optimization of LinkedIn ad campaigns, providing a clear overview of complex account structures and aiding in strategic decision-making.

## User Preferences
N/A

## System Architecture
The application is built with a React 19 frontend using TypeScript and Vite, communicating with an Express.js backend also in TypeScript. Data is persisted in a PostgreSQL database (Neon) for audit-related information. The UI is styled with Tailwind CSS and uses Lucide React icons.

**Core Features & Implementations:**
*   **Account Visualization**:
    *   **Structure Tree**: Hierarchical view of campaign groups, campaigns, and ads with integrated audit performance display.
        - **Audit View Toggle**: Switch between Audit View (color-coded by performance) and standard view.
        - **Color-Coded Nodes**: Red border = Needs Attention, Amber border = Mild Issues, Green border = Performing Well.
        - **Inline Issues**: Campaign cards show top 2 issues with truncated display and "+N more" indicator.
        - **Positive Signals**: Performing campaigns show their top positive indicator.
        - **Lightweight Loading**: Uses cached database data via `/api/audit/structure-summary` endpoint (no live API calls).
    *   **Targeting Flow**: Visualizes audience composition.
    *   **Remarketing Flow**: Illustrates campaign and audience flow through a 3-column marketing funnel (Cold Campaigns → Remarketing Audiences → Remarketing Campaigns), showing connections and audience movement.
*   **Account Audit**:
    *   **Opt-In System**: Audit is opt-in per account. Click "Start Audit" to enable weekly tracking.
    *   **3-Tier Dashboard**: Three color-coded sections - "Needs Attention" (red), "Mild Issues" (amber), and "Performing Well" (green).
    *   **Point-Based Scoring**: Campaigns scored across ~13 criteria with automatic classification:
        - CTR: -2 for >20% decline (4w), -2 for <0.3%, -1 for <0.4%; +1 for ≥20% improvement, +2 for ≥35% improvement
        - CPC: -2 for >25% increase (4w), -1 for >20% increase (WoW); vs Account: -2 for >30%, -1 for >15%, +1 for ≤-10%
        - CPM: -2 for >25% increase (4w), -1 for >20% increase (WoW)
        - Budget: -10 (hard failure) for <50% utilization, -1 for <80% utilization
        - Conversions: -2 for >25% decline, -2 for CPA up >25% (if ≥5 conversions)
        - CPA vs Account: +2 for ≤-25% (≥15 conv), +1 for ≤-15% (≥5 conv)
        - Frequency (impressions/reach): -2 for >6x, -1 for >4x, +1 for 1.5-3x with stable CTR
        - Audience Penetration: -2 for <10%, -1 for <20%, +1 for >60% with stable CTR
        - Avg Dwell Time: -1 for <1.5s, +1 for ≥4s (engagement quality)
        - Positive scoring capped at +2 per campaign, disabled on hard failures (budget <50%)
        - Negative scoring capped at -10
        - Score thresholds: ≤-3 = needs_attention, <0 = mild_issues, ≥0 = performing_well
    *   **4-Week Comparison**: Uses 4-week on 4-week (28-day) comparison for all metrics including advanced metrics.
    *   **Advanced Metrics with Trend Comparisons**:
        - **Frequency**: Shows impressions/reach with MoM comparison (28-day on 28-day)
        - **Audience Penetration**: Uses MAX value over 28-day period (cumulative metric) with MoM comparison
        - **Avg Dwell Time**: Shows both MoM (28-day) and WoW (7-day) comparisons for campaigns and ads
    *   **Special Flags**: LAN, Expansion, and Maximize Delivery shown as colored badges.
    *   **Scoring Filters**: Excludes paused campaigns, low volume (<1000 impressions, <$20 spend, <3 active days), and new campaigns (<7 days).
    *   **Ad-Level Scoring**: Tracks CTR decline >20% and CVR decline >20% (if ≥3 conversions).
    *   **Direct Links**: Each campaign and ad links directly to LinkedIn Campaign Manager.
    *   **LAN/Expansion Monitoring**: Campaigns with LinkedIn Audience Network or Audience Expansion enabled get daily syncs instead of weekly.
    *   **Weekly Sync**: Default sync frequency is weekly; campaigns with LAN/Expansion get daily syncs.
    *   **Manual Refresh**: "Refresh" button to pull latest data on-demand.
*   **Tracking Layer (for Causation Engine)**:
    *   **Daily Settings Snapshots**: Captures bid, budget, audience size, and suggested bid data for each active campaign during audit sync.
    *   **Database Tables**:
        - `campaign_settings_history`: Daily snapshots of campaign settings (bid value, bid strategy, budget, audience expansion, LAN, suggested bid ranges, audience size estimates)
        - `targeting_changes`: Versioned diffs of targeting criteria changes with timestamps
        - `creative_lifecycle`: Tracks creative status changes and first active dates
    *   **LinkedIn API Integration**:
        - `/audienceCounts` API for real-time audience size estimates (total and active members)
        - `/adBudgetPricing` API for suggested bid ranges (min, max, default) and bid limits
    *   **Change Detection**: Compares current targeting criteria with previous snapshot to detect and log changes
    *   **Test Endpoints**:
        - `GET /api/test/audience-count/:accountId/:campaignId`: Test audience count and budget pricing API
        - `GET /api/test/tracking/:accountId/:campaignId`: View tracking data summary for a campaign
        - `POST /api/test/snapshot/:accountId/:campaignId`: Manually create a settings snapshot
    *   **Future Use**: Data accumulated by tracking layer will power the 3-layer Causation Engine (Creative fatigue, Bidding changes, Targeting shifts) to diagnose performance changes
*   **Drilldown (Performance Analysis)**:
    *   **Audit Prerequisite**: Drilldown requires audit to be enabled first. Data collection begins when audit is activated.
    *   **Navigation Dropdown**: Switch between Hourly, Job Titles, and Companies views using the dropdown in the main menu.
    *   **Hourly Heatmap**: Visual 7x24 grid showing performance by day of week and hour of day (last 14 days).
    *   **Selectable Metrics**: Toggle between Impressions, Clicks, Spend, CTR, CPC, CPM, and Conversions.
    *   **Color-Coded Intensity**: Darker cells indicate higher activity/performance.
    *   **Hover Tooltips**: Full metric breakdown on hover (impressions, clicks, spend, CTR, CPC, CPM).
    *   **Delivery Cutoff Analysis**: Shows when ad delivery stops each day, indicating budget exhaustion patterns.
    *   **Budget Exhaustion Alerts**: Highlights days where ads stopped delivering before 8pm (early cutoff).
    *   **Per-Campaign Breakdown**: Filter to individual campaigns with 7+ days of hourly data.
    *   **Daily Delivery Window Visualization**: Bar chart showing first and last delivery hours per day.
    *   **Data Collection**: Hourly data fetched during audit sync (last 14 days via LinkedIn Analytics API with HOURLY granularity).
    *   **Database Storage**: `analytics_campaign_hourly` table stores hourly metrics per campaign per day.
    *   **Job Titles Analysis**:
        - Shows targeted job titles with impressions, clicks, and CTR data (last 90 days).
        - Per-campaign filtering: Campaign dropdown to view job titles for specific campaigns.
        - Sorted by impressions descending to show highest-volume job titles first.
        - Data fetched per-campaign during audit sync with 500ms delays for rate limiting.
        - Database storage: `analytics_job_titles` table with campaign_id for per-campaign data.
    *   **Companies Breakdown**:
        - Shows MEMBER_COMPANY data with impressions, clicks, and engagement rate (CTR).
        - Date range filters: 7, 30, or 90 days for flexible analysis periods.
        - Per-campaign filtering: Campaign dropdown to view companies for specific campaigns.
        - Clickable company URLs linking directly to LinkedIn company pages.
        - Company URN resolution with caching mechanism (API → cache → "Company ID" fallback).
        - Sorted by impressions descending to show highest-volume companies first.
        - Database storage: `analytics_companies` table with period support and company_url field.
*   **Ideate Canvas**:
    *   A visual planning tool for campaigns, featuring a drag-and-drop interface.
    *   **Import from Structure**: One-click import of live LinkedIn campaign data into Ideate canvas. Transforms campaign groups, campaigns, and ads into editable nodes with full targeting data preserved. Auto-generates TOF audience nodes from targeting criteria (industries, company sizes, seniorities).
    *   Includes a default funnel template (Awareness → Consideration → Activation) with hierarchy enforcement (Campaign Groups → Campaigns → Ads).
    *   Offers AI-powered generation of campaign structures based on natural language prompts.
    *   Allows inline editing, export as text brief, and detailed configuration of campaign groups, campaigns, ads, and retargeting audiences via a sidebar.
    *   **Canvas Persistence**: Auto-saves canvases to PostgreSQL with debounced 2-second saves. Supports multiple canvases per user with version history.
    *   **Sharing**: Generate shareable links for public canvases. Toggle public/private visibility. Regenerate share tokens for security.
    *   **Comments**: Reviewers can leave comments on the canvas or specific nodes. Comments can be marked as resolved. Comments panel slides in from the right.
    *   **Ad Format Enforcement**: All ads within a single campaign must use the same ad format type. New ads automatically inherit the format from existing ads. Changing format prompts to update all ads in the campaign.
    *   **Thought Leader Ads**: Toggle in ad sidebar marks ads as Thought Leader Ads (TLA), showing a TLA badge on the ad node.
    *   **Audience Flows**: Three categories with different connection rules:
        - **Remarketing** (purple): Video Views, Lead Form Opens, Ad Engagers, Event Attendees - has Source AND Target campaign/group
        - **BOF (Website)** (orange): Website Visitors, Company Page Visitors, High Company Engagers - Target campaign/group only
        - **TOF** (blue): Saved Audience, ABM Lists - Can target a specific campaign OR an entire campaign group
    *   **Group-Level Audience Targeting**: All audience types (Remarketing, BOF, TOF) can be applied to a campaign group, automatically targeting all campaigns within that group. Visual connection lines show the flow from audience to group to campaigns. Groups with audience targeting display category badges (purple for Remarketing, orange for BOF, blue for TOF). Campaigns show inherited audiences from their parent group.
    *   **Saved Audience Targeting**: TOF "Saved Audience" nodes include Industry, Company Size, and Seniority targeting options.
    *   **Campaign Objectives**: Full LinkedIn objective list organized by category (Awareness: Brand Awareness; Consideration: Website Visits, Engagement, Video Views; Conversions: Lead Generation, Talent Leads, Website Conversions, Job Applicants) with recommendations based on funnel stage.
    *   **Campaign Settings**: TOF audience association, bidding type (Manual/Maximize Delivery), Enhanced Audience checkbox, LinkedIn Audience Network checkbox
    *   **Naming Conventions**: Sidebar displays naming format hints - Groups: `[Objective] – [Audience] – [Industry] – [Location]`, Campaigns: `[Group Acronym] – [Objective] – [Creative Format] – [Subsegment]`, Ads: `[Creative Type] – [Angle/Message] – [Version]`.
*   **Ad Previews**: Provides rich creative previews with live LinkedIn ad preview iframes, displaying ad type, headline, description, call-to-action, destination URL, and lead form information.
*   **Dynamic Layouts**: Ensures proper spacing and non-overlapping elements for complex visualizations, with campaign/group names wrapping and ads arranged in a 2-column grid.
*   **Targeting Rules Panel**: Displays detailed targeting criteria for selected campaigns, organized by categories like geos, audiences, company lists, demographics, and job experience.
*   **Data Handling**: LinkedIn API data is mapped and processed, including budget conversions from minor units (cents) to dollars and URN parsing for ID extraction. Full pagination support is implemented for large accounts.

## External Dependencies
*   **LinkedIn Marketing API**: Used for fetching real campaign, ad, targeting, and performance data. Requires OAuth 2.0 authentication with `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET` secrets and `r_ads_reporting` scope.
*   **PostgreSQL (Neon)**: Serves as the database for storing audit data and canvas persistence.
*   **Tailwind CSS**: Utilized via CDN for styling the user interface.
*   **Lucide React**: Provides icons for the application UI.