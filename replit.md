# LinkedIn Audience Visualizer

## Overview
The LinkedIn Audience Visualizer is a React-based tool designed to provide comprehensive insights into LinkedIn advertising account structures. It visualizes campaign hierarchies, targeting strategies, and remarketing flows using data from the LinkedIn Marketing API. The tool includes a CTR performance audit system with ad previews and a visual campaign planning canvas. Its primary purpose is to streamline the analysis and optimization of LinkedIn ad campaigns, offering a clear overview for strategic decision-making.

## User Preferences
N/A

## System Architecture
The application features a React 19 frontend with TypeScript and Vite, communicating with an Express.js backend, also in TypeScript. A PostgreSQL database (Neon) stores audit-related information and canvas data. The UI is styled with Tailwind CSS and uses Lucide React for icons.

**Core Features & Implementations:**

*   **Account Visualization**:
    *   **Structure Tree**: Hierarchical view of campaign groups, campaigns, and ads with an integrated, toggleable audit performance display. Nodes are color-coded (Red: Needs Attention, Amber: Mild Issues, Green: Performing Well) based on audit results, showing top issues or positive indicators.
    *   **Targeting Flow**: Visualizes audience composition.
    *   **Remarketing Flow**: Illustrates audience movement through a 3-column marketing funnel (Cold Campaigns → Remarketing Audiences → Remarketing Campaigns).
*   **Account Audit**:
    *   **Opt-In System**: Account-level opt-in for weekly performance tracking.
    *   **3-Tier Dashboard**: Displays campaigns categorized into "Needs Attention," "Monitor Closely," and "Strong Performance."
    *   **100-Point Scoring System**: Campaigns are scored across Engagement Quality (45 pts), Cost Efficiency (35 pts), and Audience Quality (20 pts), with thresholds for classification (0-49: needs_attention, 50-69: monitor_closely, 70-100: strong_performance). Includes false positive protections with minimum impression/click/conversion thresholds.
    *   **6-Level Causation Engine**: Enhanced diagnosis system with 6-level priority cascade:
        1. **Creative Layer** (highest priority): Ad fatigue, over-served weak ads, creative mix health
        2. **Auction Layer**: Bid pressure, suggested bid movement, bid strategy changes
        3. **Audience Layer**: Audience size changes, penetration, exhaustion
        4. **Seniority Layer**: Decision-maker percentage shifts, job title seniority changes
        5. **Delivery Layer**: Frequency fatigue, low delivery issues
        6. **Unclear** (fallback): When insufficient data for diagnosis
        
        Features enriched summary with:
        - **Confidence levels** (high/medium/low) based on data availability
        - **Confidence reasons** explaining data status
        - **Headlines** and supporting factors for quick understanding
        - **Contradiction resolution** (e.g., CTR↓ but Dwell↑ patterns)
        - **Creative rollup summaries** with ad statistics
        - **Actionable recommendations** per insight
    *   **Ad Diagnostic Flags**: Color-coded indicators for individual ad performance (Green, Grey, Red, Yellow, Blue, Purple).
    *   **10-Step Ad Scoring Engine**: On-demand relative scoring of ads within a campaign:
        1. Volume check (≥1000 impressions required)
        2. Age state classification (learning ≤13d, stable 14-59d, fatigue_risk ≥60d)
        3. Relative performance deltas vs campaign averages (CTR, dwell, CPC)
        4. Performance status (strong/neutral/weak for CTR/dwell, efficient/neutral/inefficient for CPC)
        5. Impression share distribution flags (over_served ≥70%, under_served <10%)
        6. Fatigue detection (old ads with declining metrics)
        7. Contribution tier assignment (high/neutral/weak/learning/low_volume)
        8. Conflict resolution (curiosity clicks, senior audience patterns, algorithm over-serving)
        9. Actionable recommendations with human-readable guidance
        10. Ranked output by contribution tier then impressions
    *   **"See Ads" Button**: Campaign cards include a button to load scored ads in the right panel.
    *   **Metrics & Comparisons**: Uses 4-week on 4-week comparisons for all metrics, including advanced metrics like Frequency, Audience Penetration, and Avg Dwell Time.
    *   **Special Flags**: Displays LAN, Expansion, and Maximize Delivery badges.
    *   **Data Sync**: Weekly sync for most campaigns; daily for campaigns with LAN/Expansion. Manual refresh available. Seniority data is synced daily alongside audit for scoring.
*   **Tracking Layer**:
    *   Captures daily settings snapshots (bid, budget, audience size) and versioned targeting changes to power the Causation Engine.
    *   Uses LinkedIn API for real-time audience counts and suggested bid ranges.
*   **Drilldown (Performance Analysis)**:
    *   Requires audit to be enabled.
    *   **Hourly Heatmap**: 7x24 grid showing performance by day/hour for the last 14 days, with selectable metrics, color-coded intensity, and delivery cutoff analysis.
    *   **Job Titles Analysis**: Shows targeted job titles with impressions, clicks, and CTR for the last 90 days, filterable by campaign.
    *   **Companies Breakdown**: Displays MEMBER_COMPANY data with impressions, clicks, and engagement rate for 7, 30, or 90 days, filterable by campaign, with clickable LinkedIn company URLs.
    *   Data is collected during audit sync via LinkedIn Analytics API and stored in the database.
*   **Ideate Canvas**:
    *   A visual, drag-and-drop campaign planning tool with auto-saving and version history.
    *   **Import**: One-click import of live LinkedIn campaign data, converting them into editable nodes with targeting data.
    *   **AI-Powered Generation**: Generates campaign structures from natural language prompts.
    *   **Hierarchy & Funnel**: Supports a default Awareness → Consideration → Activation funnel with enforced hierarchy.
    *   **Audience Flows**: Visualizes Remarketing (purple), BOF (orange), and TOF (blue) audience connections, including group-level targeting.
    *   **Ad Formats & TLAs**: Enforces single ad format per campaign; allows marking Thought Leader Ads.
    *   **Sharing & Collaboration**: Generates shareable public/private links and supports commenting.
    *   **Configuration**: Allows detailed configuration of campaign groups, campaigns, ads, and retargeting audiences via a sidebar, including campaign objectives and settings. Includes naming convention hints.
*   **Ad Previews**: Provides rich creative previews using live LinkedIn ad preview iframes.
*   **Dynamic Layouts**: Ensures proper spacing and non-overlapping elements in visualizations.
*   **Targeting Rules Panel**: Displays detailed targeting criteria for selected campaigns.
*   **Data Handling**: Processes and maps LinkedIn API data, including budget conversions and URN parsing, with full pagination support.

## External Dependencies
*   **LinkedIn Marketing API**: Used for fetching campaign, ad, targeting, and performance data, requiring OAuth 2.0 authentication (`r_ads_reporting` scope).
*   **PostgreSQL (Neon)**: Database for audit data and canvas persistence.
*   **Tailwind CSS**: Used for UI styling.
*   **Lucide React**: Provides icons for the application.