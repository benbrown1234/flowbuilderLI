import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,                       // Maximum connections in pool
  idleTimeoutMillis: 30000,      // Close idle connections after 30 seconds
  connectionTimeoutMillis: 5000, // Fail if can't connect within 5 seconds
});

export { pool };

export async function initDatabase() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE EXTENSION IF NOT EXISTS "pgcrypto";
      
      CREATE TABLE IF NOT EXISTS audit_snapshots (
        id SERIAL PRIMARY KEY,
        account_id VARCHAR(50) NOT NULL,
        account_name VARCHAR(255),
        snapshot_date TIMESTAMP DEFAULT NOW(),
        expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '30 days'),
        status VARCHAR(20) DEFAULT 'pending',
        UNIQUE(account_id)
      );

      CREATE TABLE IF NOT EXISTS audit_campaign_groups (
        id SERIAL PRIMARY KEY,
        snapshot_id INTEGER REFERENCES audit_snapshots(id) ON DELETE CASCADE,
        account_id VARCHAR(50) NOT NULL,
        group_id VARCHAR(50) NOT NULL,
        name VARCHAR(500),
        status VARCHAR(50),
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS audit_campaigns (
        id SERIAL PRIMARY KEY,
        snapshot_id INTEGER REFERENCES audit_snapshots(id) ON DELETE CASCADE,
        account_id VARCHAR(50) NOT NULL,
        campaign_id VARCHAR(50) NOT NULL,
        group_id VARCHAR(50),
        name VARCHAR(500),
        status VARCHAR(50),
        objective_type VARCHAR(100),
        cost_type VARCHAR(50),
        daily_budget DECIMAL(12,2),
        targeting_criteria JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS audit_creatives (
        id SERIAL PRIMARY KEY,
        snapshot_id INTEGER REFERENCES audit_snapshots(id) ON DELETE CASCADE,
        account_id VARCHAR(50) NOT NULL,
        creative_id VARCHAR(50) NOT NULL,
        campaign_id VARCHAR(50),
        name VARCHAR(500),
        status VARCHAR(50),
        format VARCHAR(100),
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS audit_metrics (
        id SERIAL PRIMARY KEY,
        snapshot_id INTEGER REFERENCES audit_snapshots(id) ON DELETE CASCADE,
        account_id VARCHAR(50) NOT NULL,
        campaign_id VARCHAR(50) NOT NULL,
        date_range VARCHAR(20) NOT NULL,
        impressions BIGINT DEFAULT 0,
        clicks BIGINT DEFAULT 0,
        spend DECIMAL(12,2) DEFAULT 0,
        conversions INTEGER DEFAULT 0,
        video_views BIGINT DEFAULT 0,
        leads INTEGER DEFAULT 0,
        ctr DECIMAL(8,4),
        cpc DECIMAL(10,4),
        cpm DECIMAL(10,4),
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS audit_recommendations (
        id SERIAL PRIMARY KEY,
        snapshot_id INTEGER REFERENCES audit_snapshots(id) ON DELETE CASCADE,
        account_id VARCHAR(50) NOT NULL,
        category VARCHAR(50) NOT NULL,
        severity VARCHAR(20) NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        affected_entity_type VARCHAR(50),
        affected_entity_id VARCHAR(50),
        affected_entity_name VARCHAR(500),
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_snapshots_account ON audit_snapshots(account_id);
      CREATE INDEX IF NOT EXISTS idx_campaigns_snapshot ON audit_campaigns(snapshot_id);
      CREATE INDEX IF NOT EXISTS idx_metrics_snapshot ON audit_metrics(snapshot_id);
      CREATE INDEX IF NOT EXISTS idx_recommendations_snapshot ON audit_recommendations(snapshot_id);

      -- Audit opt-in tracking
      CREATE TABLE IF NOT EXISTS audit_accounts (
        id SERIAL PRIMARY KEY,
        account_id VARCHAR(50) NOT NULL UNIQUE,
        account_name VARCHAR(255),
        opted_in_at TIMESTAMP DEFAULT NOW(),
        last_sync_at TIMESTAMP,
        sync_status VARCHAR(20) DEFAULT 'pending',
        sync_error TEXT,
        auto_sync_enabled BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW()
      );

      -- Daily analytics snapshots (one row per campaign per day)
      CREATE TABLE IF NOT EXISTS analytics_campaign_daily (
        id SERIAL PRIMARY KEY,
        account_id VARCHAR(50) NOT NULL,
        campaign_id VARCHAR(50) NOT NULL,
        campaign_name VARCHAR(500),
        campaign_group_id VARCHAR(50),
        campaign_status VARCHAR(50),
        metric_date DATE NOT NULL,
        impressions BIGINT DEFAULT 0,
        clicks BIGINT DEFAULT 0,
        spend DECIMAL(12,2) DEFAULT 0,
        conversions INTEGER DEFAULT 0,
        video_views BIGINT DEFAULT 0,
        leads INTEGER DEFAULT 0,
        ctr DECIMAL(8,4),
        cpc DECIMAL(10,4),
        cpm DECIMAL(10,4),
        approximate_member_reach BIGINT DEFAULT NULL,
        audience_penetration DECIMAL(10,6) DEFAULT NULL,
        average_dwell_time DECIMAL(10,4) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(account_id, campaign_id, metric_date)
      );
      
      -- Add columns if they don't exist (for migration)
      ALTER TABLE analytics_campaign_daily ADD COLUMN IF NOT EXISTS approximate_member_reach BIGINT DEFAULT NULL;
      ALTER TABLE analytics_campaign_daily ADD COLUMN IF NOT EXISTS audience_penetration DECIMAL(10,6) DEFAULT NULL;
      ALTER TABLE analytics_campaign_daily ADD COLUMN IF NOT EXISTS average_dwell_time DECIMAL(10,4) DEFAULT NULL;

      -- Daily analytics for ads/creatives
      CREATE TABLE IF NOT EXISTS analytics_creative_daily (
        id SERIAL PRIMARY KEY,
        account_id VARCHAR(50) NOT NULL,
        creative_id VARCHAR(50) NOT NULL,
        creative_name VARCHAR(500),
        campaign_id VARCHAR(50),
        creative_status VARCHAR(50),
        creative_type VARCHAR(100),
        preview_url TEXT,
        metric_date DATE NOT NULL,
        impressions BIGINT DEFAULT 0,
        clicks BIGINT DEFAULT 0,
        spend DECIMAL(12,2) DEFAULT 0,
        conversions INTEGER DEFAULT 0,
        video_views BIGINT DEFAULT 0,
        leads INTEGER DEFAULT 0,
        ctr DECIMAL(8,4),
        cpc DECIMAL(10,4),
        cpm DECIMAL(10,4),
        average_dwell_time DECIMAL(10,4) DEFAULT NULL,
        scoring_status VARCHAR(50),
        scoring_issues JSONB DEFAULT '[]',
        scoring_breakdown JSONB DEFAULT '[]',
        scoring_positive_signals JSONB DEFAULT '[]',
        scoring_metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(account_id, creative_id, metric_date)
      );
      
      -- Add scoring columns to creative_daily if they don't exist (for migration)
      ALTER TABLE analytics_creative_daily ADD COLUMN IF NOT EXISTS average_dwell_time DECIMAL(10,4) DEFAULT NULL;
      ALTER TABLE analytics_creative_daily ADD COLUMN IF NOT EXISTS scoring_status VARCHAR(50);
      ALTER TABLE analytics_creative_daily ADD COLUMN IF NOT EXISTS scoring_issues JSONB DEFAULT '[]';
      ALTER TABLE analytics_creative_daily ADD COLUMN IF NOT EXISTS scoring_breakdown JSONB DEFAULT '[]';
      ALTER TABLE analytics_creative_daily ADD COLUMN IF NOT EXISTS scoring_positive_signals JSONB DEFAULT '[]';
      ALTER TABLE analytics_creative_daily ADD COLUMN IF NOT EXISTS scoring_metadata JSONB DEFAULT '{}';

      CREATE INDEX IF NOT EXISTS idx_audit_accounts_account ON audit_accounts(account_id);
      CREATE INDEX IF NOT EXISTS idx_analytics_campaign_daily_account_date ON analytics_campaign_daily(account_id, metric_date DESC);
      CREATE INDEX IF NOT EXISTS idx_analytics_creative_daily_account_date ON analytics_creative_daily(account_id, metric_date DESC);
      CREATE INDEX IF NOT EXISTS idx_analytics_campaign_daily_campaign ON analytics_campaign_daily(campaign_id, metric_date DESC);
      CREATE INDEX IF NOT EXISTS idx_analytics_creative_daily_campaign ON analytics_creative_daily(campaign_id, metric_date DESC);

      -- Hourly analytics for drilldown view (one row per campaign per hour)
      CREATE TABLE IF NOT EXISTS analytics_campaign_hourly (
        id SERIAL PRIMARY KEY,
        account_id VARCHAR(50) NOT NULL,
        campaign_id VARCHAR(50) NOT NULL,
        campaign_name VARCHAR(500),
        metric_date DATE NOT NULL,
        metric_hour INTEGER NOT NULL CHECK (metric_hour >= 0 AND metric_hour <= 23),
        impressions BIGINT DEFAULT 0,
        clicks BIGINT DEFAULT 0,
        spend DECIMAL(12,2) DEFAULT 0,
        conversions INTEGER DEFAULT 0,
        ctr DECIMAL(8,4),
        cpc DECIMAL(10,4),
        cpm DECIMAL(10,4),
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(account_id, campaign_id, metric_date, metric_hour)
      );

      CREATE INDEX IF NOT EXISTS idx_analytics_hourly_account_date ON analytics_campaign_hourly(account_id, metric_date DESC, metric_hour);
      CREATE INDEX IF NOT EXISTS idx_analytics_hourly_campaign ON analytics_campaign_hourly(campaign_id, metric_date DESC, metric_hour);

      -- Ideate Canvas tables
      CREATE TABLE IF NOT EXISTS ideate_canvases (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        owner_user_id VARCHAR(100),
        account_id VARCHAR(50),
        title VARCHAR(255) NOT NULL DEFAULT 'Untitled Canvas',
        is_public BOOLEAN DEFAULT FALSE,
        share_token VARCHAR(64) UNIQUE,
        allow_public_comments BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS ideate_canvas_versions (
        id SERIAL PRIMARY KEY,
        canvas_id UUID REFERENCES ideate_canvases(id) ON DELETE CASCADE,
        version_number INTEGER NOT NULL DEFAULT 1,
        nodes JSONB NOT NULL DEFAULT '[]',
        connections JSONB NOT NULL DEFAULT '[]',
        settings JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW(),
        created_by VARCHAR(100)
      );

      CREATE TABLE IF NOT EXISTS ideate_canvas_comments (
        id SERIAL PRIMARY KEY,
        canvas_id UUID REFERENCES ideate_canvases(id) ON DELETE CASCADE,
        version_id INTEGER REFERENCES ideate_canvas_versions(id) ON DELETE SET NULL,
        node_id VARCHAR(100),
        author_user_id VARCHAR(100),
        author_name VARCHAR(255),
        content TEXT NOT NULL,
        is_resolved BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_canvases_owner ON ideate_canvases(owner_user_id);
      CREATE INDEX IF NOT EXISTS idx_canvases_account ON ideate_canvases(account_id);
      CREATE INDEX IF NOT EXISTS idx_canvases_share_token ON ideate_canvases(share_token);
      CREATE INDEX IF NOT EXISTS idx_canvas_versions_canvas ON ideate_canvas_versions(canvas_id);
      CREATE INDEX IF NOT EXISTS idx_canvas_comments_canvas ON ideate_canvas_comments(canvas_id);

      -- Database-backed sessions for persistence across restarts
      CREATE TABLE IF NOT EXISTS user_sessions (
        id VARCHAR(64) PRIMARY KEY,
        access_token TEXT,
        expires_at TIMESTAMP,
        state VARCHAR(64),
        user_id VARCHAR(100),
        user_name VARCHAR(255),
        csrf_token VARCHAR(64),
        authorized_accounts TEXT[] DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      -- Add csrf_token column if it doesn't exist (migration for existing tables)
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_sessions' AND column_name = 'csrf_token') THEN
          ALTER TABLE user_sessions ADD COLUMN csrf_token VARCHAR(64);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_sessions' AND column_name = 'authorized_accounts') THEN
          ALTER TABLE user_sessions ADD COLUMN authorized_accounts TEXT[] DEFAULT '{}';
        END IF;
      END $$;

      CREATE INDEX IF NOT EXISTS idx_sessions_expires ON user_sessions(expires_at);
    `);

    // Cleanup expired sessions
    await client.query(`
      DELETE FROM user_sessions WHERE expires_at < NOW() - INTERVAL '7 days'
    `);

    console.log('Database tables initialized');
  } finally {
    client.release();
  }
}

export async function getSnapshot(accountId: string) {
  const result = await pool.query(
    'SELECT * FROM audit_snapshots WHERE account_id = $1',
    [accountId]
  );
  return result.rows[0] || null;
}

export async function createSnapshot(accountId: string, accountName: string) {
  await pool.query(
    'DELETE FROM audit_snapshots WHERE account_id = $1',
    [accountId]
  );
  
  const result = await pool.query(
    `INSERT INTO audit_snapshots (account_id, account_name, status) 
     VALUES ($1, $2, 'syncing') 
     RETURNING *`,
    [accountId, accountName]
  );
  return result.rows[0];
}

export async function updateSnapshotStatus(snapshotId: number, status: string) {
  await pool.query(
    'UPDATE audit_snapshots SET status = $1 WHERE id = $2',
    [status, snapshotId]
  );
}

export async function saveCampaignGroups(snapshotId: number, accountId: string, groups: any[]) {
  for (const group of groups) {
    await pool.query(
      `INSERT INTO audit_campaign_groups (snapshot_id, account_id, group_id, name, status)
       VALUES ($1, $2, $3, $4, $5)`,
      [snapshotId, accountId, group.id, group.name, group.status]
    );
  }
}

export async function saveCampaigns(snapshotId: number, accountId: string, campaigns: any[]) {
  for (const campaign of campaigns) {
    await pool.query(
      `INSERT INTO audit_campaigns (snapshot_id, account_id, campaign_id, group_id, name, status, objective_type, cost_type, daily_budget, targeting_criteria)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        snapshotId, 
        accountId, 
        campaign.id, 
        campaign.groupId,
        campaign.name, 
        campaign.status,
        campaign.objectiveType,
        campaign.costType,
        campaign.dailyBudget,
        JSON.stringify(campaign.targetingCriteria || {})
      ]
    );
  }
}

export async function saveCreatives(snapshotId: number, accountId: string, creatives: any[]) {
  for (const creative of creatives) {
    await pool.query(
      `INSERT INTO audit_creatives (snapshot_id, account_id, creative_id, campaign_id, name, status, format)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [snapshotId, accountId, creative.id, creative.campaignId, creative.name, creative.status, creative.format]
    );
  }
}

export async function saveMetrics(snapshotId: number, accountId: string, metrics: any[]) {
  for (const metric of metrics) {
    const ctr = metric.impressions > 0 ? (metric.clicks / metric.impressions) * 100 : 0;
    const cpc = metric.clicks > 0 ? metric.spend / metric.clicks : 0;
    const cpm = metric.impressions > 0 ? (metric.spend / metric.impressions) * 1000 : 0;
    
    await pool.query(
      `INSERT INTO audit_metrics (snapshot_id, account_id, campaign_id, date_range, impressions, clicks, spend, conversions, video_views, leads, ctr, cpc, cpm)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        snapshotId, 
        accountId, 
        metric.campaignId, 
        metric.dateRange,
        metric.impressions || 0,
        metric.clicks || 0,
        metric.spend || 0,
        metric.conversions || 0,
        metric.videoViews || 0,
        metric.leads || 0,
        ctr,
        cpc,
        cpm
      ]
    );
  }
}

export async function saveRecommendations(snapshotId: number, accountId: string, recommendations: any[]) {
  for (const rec of recommendations) {
    await pool.query(
      `INSERT INTO audit_recommendations (snapshot_id, account_id, category, severity, title, description, affected_entity_type, affected_entity_id, affected_entity_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        snapshotId,
        accountId,
        rec.category,
        rec.severity,
        rec.title,
        rec.description,
        rec.affectedEntityType,
        rec.affectedEntityId,
        rec.affectedEntityName
      ]
    );
  }
}

export async function getAuditData(accountId: string) {
  const snapshot = await getSnapshot(accountId);
  if (!snapshot) return null;

  const [groups, campaigns, creatives, metrics, recommendations] = await Promise.all([
    pool.query('SELECT * FROM audit_campaign_groups WHERE snapshot_id = $1', [snapshot.id]),
    pool.query('SELECT * FROM audit_campaigns WHERE snapshot_id = $1', [snapshot.id]),
    pool.query('SELECT * FROM audit_creatives WHERE snapshot_id = $1', [snapshot.id]),
    pool.query('SELECT * FROM audit_metrics WHERE snapshot_id = $1', [snapshot.id]),
    pool.query('SELECT * FROM audit_recommendations WHERE snapshot_id = $1 ORDER BY severity DESC, category', [snapshot.id])
  ]);

  return {
    snapshot,
    groups: groups.rows,
    campaigns: campaigns.rows,
    creatives: creatives.rows,
    metrics: metrics.rows,
    recommendations: recommendations.rows
  };
}

export async function deleteAuditData(accountId: string) {
  await pool.query('DELETE FROM audit_snapshots WHERE account_id = $1', [accountId]);
}

export async function cleanupExpiredSnapshots() {
  await pool.query('DELETE FROM audit_snapshots WHERE expires_at < NOW()');
}

// Ideate Canvas functions
function generateShareToken(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let token = '';
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

export async function createCanvas(
  ownerUserId: string | null,
  accountId: string | null,
  title: string = 'Untitled Canvas'
) {
  const result = await pool.query(
    `INSERT INTO ideate_canvases (owner_user_id, account_id, title, share_token)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [ownerUserId, accountId, title, generateShareToken()]
  );
  return result.rows[0];
}

export async function getCanvas(canvasId: string) {
  const result = await pool.query(
    'SELECT * FROM ideate_canvases WHERE id = $1',
    [canvasId]
  );
  return result.rows[0] || null;
}

export async function getCanvasByShareToken(shareToken: string) {
  const result = await pool.query(
    'SELECT * FROM ideate_canvases WHERE share_token = $1',
    [shareToken]
  );
  return result.rows[0] || null;
}

export async function listCanvases(ownerUserId: string | null, accountId: string | null) {
  let query = 'SELECT c.*, v.version_number, v.created_at as last_saved FROM ideate_canvases c LEFT JOIN LATERAL (SELECT version_number, created_at FROM ideate_canvas_versions WHERE canvas_id = c.id ORDER BY version_number DESC LIMIT 1) v ON true WHERE 1=1';
  const params: any[] = [];
  
  if (ownerUserId) {
    params.push(ownerUserId);
    query += ` AND c.owner_user_id = $${params.length}`;
  }
  if (accountId) {
    params.push(accountId);
    query += ` AND c.account_id = $${params.length}`;
  }
  
  query += ' ORDER BY c.updated_at DESC';
  
  const result = await pool.query(query, params);
  return result.rows;
}

export async function updateCanvas(
  canvasId: string,
  updates: { title?: string; is_public?: boolean; allow_public_comments?: boolean }
) {
  const setClauses: string[] = ['updated_at = NOW()'];
  const params: any[] = [];
  
  if (updates.title !== undefined) {
    params.push(updates.title);
    setClauses.push(`title = $${params.length}`);
  }
  if (updates.is_public !== undefined) {
    params.push(updates.is_public);
    setClauses.push(`is_public = $${params.length}`);
  }
  if (updates.allow_public_comments !== undefined) {
    params.push(updates.allow_public_comments);
    setClauses.push(`allow_public_comments = $${params.length}`);
  }
  
  params.push(canvasId);
  const result = await pool.query(
    `UPDATE ideate_canvases SET ${setClauses.join(', ')} WHERE id = $${params.length} RETURNING *`,
    params
  );
  return result.rows[0] || null;
}

export async function deleteCanvas(canvasId: string) {
  await pool.query('DELETE FROM ideate_canvases WHERE id = $1', [canvasId]);
}

export async function regenerateShareToken(canvasId: string) {
  const newToken = generateShareToken();
  const result = await pool.query(
    'UPDATE ideate_canvases SET share_token = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
    [newToken, canvasId]
  );
  return result.rows[0] || null;
}

// Canvas Versions
export async function saveCanvasVersion(
  canvasId: string,
  nodes: any[],
  connections: any[],
  settings: any = {},
  createdBy: string | null = null
) {
  const versionResult = await pool.query(
    'SELECT COALESCE(MAX(version_number), 0) + 1 as next_version FROM ideate_canvas_versions WHERE canvas_id = $1',
    [canvasId]
  );
  const nextVersion = versionResult.rows[0].next_version;
  
  const result = await pool.query(
    `INSERT INTO ideate_canvas_versions (canvas_id, version_number, nodes, connections, settings, created_by)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [canvasId, nextVersion, JSON.stringify(nodes), JSON.stringify(connections), JSON.stringify(settings), createdBy]
  );
  
  await pool.query('UPDATE ideate_canvases SET updated_at = NOW() WHERE id = $1', [canvasId]);
  
  return result.rows[0];
}

export async function getLatestCanvasVersion(canvasId: string) {
  const result = await pool.query(
    `SELECT * FROM ideate_canvas_versions 
     WHERE canvas_id = $1 
     ORDER BY version_number DESC 
     LIMIT 1`,
    [canvasId]
  );
  return result.rows[0] || null;
}

export async function getCanvasVersions(canvasId: string, limit: number = 20) {
  const result = await pool.query(
    `SELECT id, canvas_id, version_number, created_at, created_by 
     FROM ideate_canvas_versions 
     WHERE canvas_id = $1 
     ORDER BY version_number DESC 
     LIMIT $2`,
    [canvasId, limit]
  );
  return result.rows;
}

export async function getCanvasVersion(versionId: number) {
  const result = await pool.query(
    'SELECT * FROM ideate_canvas_versions WHERE id = $1',
    [versionId]
  );
  return result.rows[0] || null;
}

// Canvas Comments
export async function addComment(
  canvasId: string,
  content: string,
  authorUserId: string | null,
  authorName: string,
  nodeId: string | null = null,
  versionId: number | null = null
) {
  const result = await pool.query(
    `INSERT INTO ideate_canvas_comments (canvas_id, version_id, node_id, author_user_id, author_name, content)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [canvasId, versionId, nodeId, authorUserId, authorName, content]
  );
  return result.rows[0];
}

export async function getComments(canvasId: string) {
  const result = await pool.query(
    `SELECT * FROM ideate_canvas_comments 
     WHERE canvas_id = $1 
     ORDER BY created_at DESC`,
    [canvasId]
  );
  return result.rows;
}

export async function resolveComment(commentId: number, resolved: boolean = true) {
  const result = await pool.query(
    'UPDATE ideate_canvas_comments SET is_resolved = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
    [resolved, commentId]
  );
  return result.rows[0] || null;
}

export async function deleteComment(commentId: number) {
  await pool.query('DELETE FROM ideate_canvas_comments WHERE id = $1', [commentId]);
}

// Audit Account Management
export async function getAuditAccount(accountId: string) {
  const result = await pool.query(
    'SELECT * FROM audit_accounts WHERE account_id = $1',
    [accountId]
  );
  return result.rows[0] || null;
}

export async function optInAuditAccount(accountId: string, accountName: string) {
  const result = await pool.query(
    `INSERT INTO audit_accounts (account_id, account_name, sync_status)
     VALUES ($1::text, $2::text, 'pending')
     ON CONFLICT (account_id) DO UPDATE SET
       account_name = EXCLUDED.account_name,
       sync_status = 'pending',
       sync_error = NULL
     RETURNING *`,
    [String(accountId), String(accountName)]
  );
  return result.rows[0];
}

export async function updateAuditAccountSyncStatus(
  accountId: string, 
  status: 'pending' | 'syncing' | 'completed' | 'error',
  error?: string
) {
  const result = await pool.query(
    `UPDATE audit_accounts 
     SET sync_status = $1::text, 
         sync_error = $2::text,
         last_sync_at = CASE WHEN $1::text = 'completed' THEN NOW() ELSE last_sync_at END
     WHERE account_id = $3::text
     RETURNING *`,
    [String(status), error || null, String(accountId)]
  );
  return result.rows[0] || null;
}

export async function getOptedInAccounts() {
  const result = await pool.query(
    'SELECT * FROM audit_accounts WHERE auto_sync_enabled = TRUE ORDER BY opted_in_at'
  );
  return result.rows;
}

export async function getStuckSyncs() {
  const result = await pool.query(
    `SELECT * FROM audit_accounts 
     WHERE sync_status IN ('pending', 'syncing')
     ORDER BY opted_in_at`
  );
  return result.rows;
}

export async function markStuckSyncsAsError() {
  const result = await pool.query(
    `UPDATE audit_accounts 
     SET sync_status = 'error', 
         sync_error = 'Sync was interrupted - click Refresh to retry'
     WHERE sync_status IN ('pending', 'syncing')
     RETURNING *`
  );
  return result.rows;
}

export async function removeAuditAccount(accountId: string) {
  await pool.query('DELETE FROM audit_accounts WHERE account_id = $1', [accountId]);
  await pool.query('DELETE FROM analytics_campaign_daily WHERE account_id = $1', [accountId]);
  await pool.query('DELETE FROM analytics_creative_daily WHERE account_id = $1', [accountId]);
}

// Daily Analytics Storage
export async function saveCampaignDailyMetrics(
  accountId: string,
  metrics: Array<{
    campaignId: string;
    campaignName?: string;
    campaignGroupId?: string;
    campaignStatus?: string;
    metricDate: Date;
    impressions: number;
    clicks: number;
    spend: number;
    conversions?: number;
    videoViews?: number;
    leads?: number;
    approximateMemberReach?: number | null;
    audiencePenetration?: number | null;
    averageDwellTime?: number | null;
  }>
) {
  const accId = String(accountId);
  
  for (const m of metrics) {
    const ctr = m.impressions > 0 ? (m.clicks / m.impressions) * 100 : 0;
    const cpc = m.clicks > 0 ? m.spend / m.clicks : 0;
    const cpm = m.impressions > 0 ? (m.spend / m.impressions) * 1000 : 0;
    
    const dateStr = m.metricDate.toISOString().split('T')[0];
    
    await pool.query(
      `INSERT INTO analytics_campaign_daily 
       (account_id, campaign_id, campaign_name, campaign_group_id, campaign_status, metric_date, impressions, clicks, spend, conversions, video_views, leads, ctr, cpc, cpm, approximate_member_reach, audience_penetration, average_dwell_time)
       VALUES ($1::text, $2::text, $3::text, $4::text, $5::text, $6::date, $7::bigint, $8::bigint, $9::numeric, $10::integer, $11::bigint, $12::integer, $13::numeric, $14::numeric, $15::numeric, $16::bigint, $17::numeric, $18::numeric)
       ON CONFLICT (account_id, campaign_id, metric_date) DO UPDATE SET
         campaign_name = EXCLUDED.campaign_name,
         campaign_group_id = EXCLUDED.campaign_group_id,
         campaign_status = EXCLUDED.campaign_status,
         impressions = EXCLUDED.impressions,
         clicks = EXCLUDED.clicks,
         spend = EXCLUDED.spend,
         conversions = EXCLUDED.conversions,
         video_views = EXCLUDED.video_views,
         leads = EXCLUDED.leads,
         ctr = EXCLUDED.ctr,
         cpc = EXCLUDED.cpc,
         cpm = EXCLUDED.cpm,
         approximate_member_reach = EXCLUDED.approximate_member_reach,
         audience_penetration = EXCLUDED.audience_penetration,
         average_dwell_time = EXCLUDED.average_dwell_time`,
      [
        accId,
        String(m.campaignId),
        m.campaignName || null,
        m.campaignGroupId ? String(m.campaignGroupId) : null,
        m.campaignStatus || null,
        dateStr,
        m.impressions || 0,
        m.clicks || 0,
        m.spend || 0,
        m.conversions || 0,
        m.videoViews || 0,
        m.leads || 0,
        ctr,
        cpc,
        cpm,
        m.approximateMemberReach || null,
        m.audiencePenetration || null,
        m.averageDwellTime || null
      ]
    );
  }
}

export async function saveCreativeDailyMetrics(
  accountId: string,
  metrics: Array<{
    creativeId: string;
    creativeName?: string;
    campaignId?: string;
    creativeStatus?: string;
    creativeType?: string;
    previewUrl?: string;
    metricDate: Date;
    impressions: number;
    clicks: number;
    spend: number;
    conversions?: number;
    videoViews?: number;
    leads?: number;
  }>
) {
  const accId = String(accountId);
  
  for (const m of metrics) {
    const ctr = m.impressions > 0 ? (m.clicks / m.impressions) * 100 : 0;
    const cpc = m.clicks > 0 ? m.spend / m.clicks : 0;
    const cpm = m.impressions > 0 ? (m.spend / m.impressions) * 1000 : 0;
    
    const dateStr = m.metricDate.toISOString().split('T')[0];
    
    await pool.query(
      `INSERT INTO analytics_creative_daily 
       (account_id, creative_id, creative_name, campaign_id, creative_status, creative_type, preview_url, metric_date, impressions, clicks, spend, conversions, video_views, leads, ctr, cpc, cpm)
       VALUES ($1::text, $2::text, $3::text, $4::text, $5::text, $6::text, $7::text, $8::date, $9::bigint, $10::bigint, $11::numeric, $12::integer, $13::bigint, $14::integer, $15::numeric, $16::numeric, $17::numeric)
       ON CONFLICT (account_id, creative_id, metric_date) DO UPDATE SET
         creative_name = EXCLUDED.creative_name,
         campaign_id = EXCLUDED.campaign_id,
         creative_status = EXCLUDED.creative_status,
         creative_type = EXCLUDED.creative_type,
         preview_url = EXCLUDED.preview_url,
         impressions = EXCLUDED.impressions,
         clicks = EXCLUDED.clicks,
         spend = EXCLUDED.spend,
         conversions = EXCLUDED.conversions,
         video_views = EXCLUDED.video_views,
         leads = EXCLUDED.leads,
         ctr = EXCLUDED.ctr,
         cpc = EXCLUDED.cpc,
         cpm = EXCLUDED.cpm`,
      [
        accId,
        String(m.creativeId),
        m.creativeName || null,
        m.campaignId ? String(m.campaignId) : null,
        m.creativeStatus || null,
        m.creativeType || null,
        m.previewUrl || null,
        dateStr,
        m.impressions || 0,
        m.clicks || 0,
        m.spend || 0,
        m.conversions || 0,
        m.videoViews || 0,
        m.leads || 0,
        ctr,
        cpc,
        cpm
      ]
    );
  }
}

export async function getCampaignDailyMetrics(
  accountId: string,
  startDate: Date,
  endDate: Date
) {
  const result = await pool.query(
    `SELECT * FROM analytics_campaign_daily 
     WHERE account_id = $1 AND metric_date >= $2 AND metric_date <= $3
     ORDER BY metric_date DESC, campaign_id`,
    [accountId, startDate, endDate]
  );
  return result.rows;
}

// Hourly Analytics Storage for Drilldown
export async function saveCampaignHourlyMetrics(
  accountId: string,
  metrics: Array<{
    campaignId: string;
    campaignName?: string;
    metricDate: Date;
    metricHour: number;
    impressions: number;
    clicks: number;
    spend: number;
    conversions?: number;
  }>
) {
  const accId = String(accountId);
  
  for (const m of metrics) {
    const ctr = m.impressions > 0 ? (m.clicks / m.impressions) * 100 : 0;
    const cpc = m.clicks > 0 ? m.spend / m.clicks : 0;
    const cpm = m.impressions > 0 ? (m.spend / m.impressions) * 1000 : 0;
    
    const dateStr = m.metricDate.toISOString().split('T')[0];
    
    await pool.query(
      `INSERT INTO analytics_campaign_hourly 
       (account_id, campaign_id, campaign_name, metric_date, metric_hour, impressions, clicks, spend, conversions, ctr, cpc, cpm)
       VALUES ($1::text, $2::text, $3::text, $4::date, $5::integer, $6::bigint, $7::bigint, $8::numeric, $9::integer, $10::numeric, $11::numeric, $12::numeric)
       ON CONFLICT (account_id, campaign_id, metric_date, metric_hour) DO UPDATE SET
         campaign_name = EXCLUDED.campaign_name,
         impressions = EXCLUDED.impressions,
         clicks = EXCLUDED.clicks,
         spend = EXCLUDED.spend,
         conversions = EXCLUDED.conversions,
         ctr = EXCLUDED.ctr,
         cpc = EXCLUDED.cpc,
         cpm = EXCLUDED.cpm`,
      [
        accId,
        String(m.campaignId),
        m.campaignName || null,
        dateStr,
        m.metricHour,
        m.impressions || 0,
        m.clicks || 0,
        m.spend || 0,
        m.conversions || 0,
        ctr,
        cpc,
        cpm
      ]
    );
  }
}

export async function getCampaignHourlyMetrics(
  accountId: string,
  startDate: Date,
  endDate: Date,
  campaignId?: string
) {
  let query = `SELECT * FROM analytics_campaign_hourly 
     WHERE account_id = $1 AND metric_date >= $2 AND metric_date <= $3`;
  const params: any[] = [accountId, startDate, endDate];
  
  if (campaignId) {
    query += ` AND campaign_id = $4`;
    params.push(campaignId);
  }
  
  query += ` ORDER BY metric_date DESC, metric_hour, campaign_id`;
  
  const result = await pool.query(query, params);
  return result.rows;
}

export async function getHourlyHeatmapData(
  accountId: string,
  campaignId?: string,
  metric: string = 'impressions'
) {
  // Default to last 14 days
  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - (14 * 24 * 60 * 60 * 1000));
  
  // Aggregate hourly data into day-of-week x hour matrix
  let query = `
    SELECT 
      EXTRACT(DOW FROM metric_date)::int as day_of_week,
      metric_hour,
      SUM(impressions) as total_impressions,
      SUM(clicks) as total_clicks,
      SUM(spend) as total_spend,
      SUM(conversions) as total_conversions,
      CASE WHEN SUM(impressions) > 0 THEN (SUM(clicks)::float / SUM(impressions)) * 100 ELSE 0 END as avg_ctr,
      CASE WHEN SUM(clicks) > 0 THEN SUM(spend) / SUM(clicks) ELSE 0 END as avg_cpc,
      CASE WHEN SUM(impressions) > 0 THEN (SUM(spend) / SUM(impressions)) * 1000 ELSE 0 END as avg_cpm,
      COUNT(DISTINCT metric_date) as days_with_data
    FROM analytics_campaign_hourly
    WHERE account_id = $1 AND metric_date >= $2 AND metric_date <= $3
  `;
  const params: any[] = [accountId, startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]];
  
  if (campaignId) {
    query += ` AND campaign_id = $4`;
    params.push(campaignId);
  }
  
  query += ` GROUP BY EXTRACT(DOW FROM metric_date)::int, metric_hour ORDER BY day_of_week, metric_hour`;
  
  const result = await pool.query(query, params);
  
  // Format into a 7x24 heatmap matrix
  const heatmap: any[][] = Array.from({ length: 7 }, () => Array(24).fill(null));
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  
  for (const row of result.rows) {
    const dow = parseInt(row.day_of_week);
    const hour = row.metric_hour;
    
    // Select the requested metric
    let value = 0;
    switch (metric) {
      case 'impressions':
        value = parseFloat(row.total_impressions) || 0;
        break;
      case 'clicks':
        value = parseFloat(row.total_clicks) || 0;
        break;
      case 'spend':
        value = parseFloat(row.total_spend) || 0;
        break;
      case 'ctr':
        value = parseFloat(row.avg_ctr) || 0;
        break;
      case 'cpc':
        value = parseFloat(row.avg_cpc) || 0;
        break;
      case 'cpm':
        value = parseFloat(row.avg_cpm) || 0;
        break;
      case 'conversions':
        value = parseFloat(row.total_conversions) || 0;
        break;
      default:
        value = parseFloat(row.total_impressions) || 0;
    }
    
    heatmap[dow][hour] = {
      value,
      impressions: parseFloat(row.total_impressions) || 0,
      clicks: parseFloat(row.total_clicks) || 0,
      spend: parseFloat(row.total_spend) || 0,
      conversions: parseFloat(row.total_conversions) || 0,
      ctr: parseFloat(row.avg_ctr) || 0,
      cpc: parseFloat(row.avg_cpc) || 0,
      cpm: parseFloat(row.avg_cpm) || 0,
      daysWithData: parseInt(row.days_with_data) || 0
    };
  }
  
  return {
    heatmap,
    dayNames,
    metric,
    dateRange: {
      start: startDate.toISOString().split('T')[0],
      end: endDate.toISOString().split('T')[0]
    }
  };
}

export async function getDeliveryCutoffByDay(
  accountId: string,
  campaignId?: string
) {
  // Default to last 14 days
  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - (14 * 24 * 60 * 60 * 1000));
  
  // Find the last hour with impressions for each day (delivery cutoff)
  let query = `
    SELECT 
      metric_date,
      EXTRACT(DOW FROM metric_date)::int as day_of_week,
      MAX(CASE WHEN impressions > 0 THEN metric_hour ELSE NULL END) as last_delivery_hour,
      MIN(CASE WHEN impressions > 0 THEN metric_hour ELSE NULL END) as first_delivery_hour,
      SUM(impressions) as total_impressions,
      SUM(spend) as total_spend
    FROM analytics_campaign_hourly
    WHERE account_id = $1 AND metric_date >= $2 AND metric_date <= $3
  `;
  const params: any[] = [accountId, startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]];
  
  if (campaignId) {
    query += ` AND campaign_id = $4`;
    params.push(campaignId);
  }
  
  query += ` GROUP BY metric_date ORDER BY metric_date DESC`;
  
  const result = await pool.query(query, params);
  
  // Analyze cutoff patterns
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const cutoffs = result.rows.map(row => ({
    date: row.metric_date,
    dayOfWeek: parseInt(row.day_of_week),
    dayName: dayNames[parseInt(row.day_of_week)],
    firstDeliveryHour: row.first_delivery_hour,
    lastDeliveryHour: row.last_delivery_hour,
    totalImpressions: parseFloat(row.total_impressions) || 0,
    totalSpend: parseFloat(row.total_spend) || 0,
    earlyBudgetExhaustion: row.last_delivery_hour !== null && row.last_delivery_hour < 20
  }));
  
  // Calculate average cutoff hour
  const validCutoffs = cutoffs.filter(c => c.lastDeliveryHour !== null);
  const avgCutoffHour = validCutoffs.length > 0
    ? validCutoffs.reduce((sum, c) => sum + c.lastDeliveryHour, 0) / validCutoffs.length
    : null;
  
  // Count days with early budget exhaustion (before 8pm)
  const earlyExhaustionDays = cutoffs.filter(c => c.earlyBudgetExhaustion).length;
  
  return {
    cutoffs,
    avgCutoffHour,
    earlyExhaustionDays,
    totalDaysAnalyzed: cutoffs.length,
    dateRange: {
      start: startDate.toISOString().split('T')[0],
      end: endDate.toISOString().split('T')[0]
    }
  };
}

export async function getCampaignsWithHourlyData(accountId: string) {
  const result = await pool.query(
    `SELECT DISTINCT campaign_id, campaign_name, 
            MIN(metric_date) as first_date, 
            MAX(metric_date) as last_date,
            COUNT(DISTINCT metric_date) as days_with_data
     FROM analytics_campaign_hourly 
     WHERE account_id = $1
     GROUP BY campaign_id, campaign_name
     HAVING COUNT(DISTINCT metric_date) >= 7
     ORDER BY last_date DESC`,
    [accountId]
  );
  return result.rows;
}

export async function getCreativeDailyMetrics(
  accountId: string,
  startDate: Date,
  endDate: Date
) {
  const result = await pool.query(
    `SELECT * FROM analytics_creative_daily 
     WHERE account_id = $1 AND metric_date >= $2 AND metric_date <= $3
     ORDER BY metric_date DESC, creative_id`,
    [accountId, startDate, endDate]
  );
  return result.rows;
}

export async function getLatestMetricsDate(accountId: string): Promise<Date | null> {
  const result = await pool.query(
    `SELECT MAX(metric_date) as latest_date FROM analytics_campaign_daily WHERE account_id = $1`,
    [accountId]
  );
  return result.rows[0]?.latest_date || null;
}

// Update scoring status for campaigns
export async function updateCampaignScoring(
  accountId: string,
  campaignId: string,
  scoringStatus: string,
  issues: string[],
  positiveSignals: string[]
) {
  // Update the most recent row for this campaign in analytics_campaign_daily
  await pool.query(
    `UPDATE analytics_campaign_daily 
     SET scoring_status = $1, scoring_issues = $2, scoring_positive_signals = $3
     WHERE account_id = $4 AND campaign_id = $5 
     AND metric_date = (
       SELECT MAX(metric_date) FROM analytics_campaign_daily 
       WHERE account_id = $4 AND campaign_id = $5
     )`,
    [scoringStatus, JSON.stringify(issues), JSON.stringify(positiveSignals), accountId, campaignId]
  );
}

// Update scoring status for creatives
export async function updateCreativeScoring(
  accountId: string,
  creativeId: string,
  scoringStatus: string,
  issues: string[],
  breakdown: { metric: string; value: string; threshold: string; contribution: number; applied: boolean }[] = [],
  positiveSignals: string[] = [],
  metadata: { score?: number; negativeScore?: number; positiveScore?: number; rawPositiveScore?: number; peerCount?: number } = {}
) {
  // Update the most recent row for this creative in analytics_creative_daily
  await pool.query(
    `UPDATE analytics_creative_daily 
     SET scoring_status = $1, scoring_issues = $2, scoring_breakdown = $3, scoring_positive_signals = $4, scoring_metadata = $5
     WHERE account_id = $6 AND creative_id = $7
     AND metric_date = (
       SELECT MAX(metric_date) FROM analytics_creative_daily 
       WHERE account_id = $6 AND creative_id = $7
     )`,
    [scoringStatus, JSON.stringify(issues), JSON.stringify(breakdown), JSON.stringify(positiveSignals), JSON.stringify(metadata), accountId, creativeId]
  );
}

// Get precomputed scoring data for structure view
export async function getStructureScoringData(accountId: string) {
  const [campaigns, creatives] = await Promise.all([
    // Get latest scoring per campaign from analytics_campaign_daily
    pool.query(
      `SELECT DISTINCT ON (campaign_id) 
              campaign_id, scoring_status, 
              COALESCE(scoring_issues, '[]'::jsonb) as scoring_issues, 
              COALESCE(scoring_positive_signals, '[]'::jsonb) as scoring_positive_signals 
       FROM analytics_campaign_daily 
       WHERE account_id = $1 AND scoring_status IS NOT NULL
       ORDER BY campaign_id, metric_date DESC`,
      [accountId]
    ),
    // Get latest scoring per creative from analytics_creative_daily
    pool.query(
      `SELECT DISTINCT ON (creative_id) 
              creative_id, campaign_id, scoring_status, 
              COALESCE(scoring_issues, '[]'::jsonb) as scoring_issues,
              COALESCE(scoring_breakdown, '[]'::jsonb) as scoring_breakdown,
              COALESCE(scoring_positive_signals, '[]'::jsonb) as scoring_positive_signals,
              COALESCE(scoring_metadata, '{}'::jsonb) as scoring_metadata
       FROM analytics_creative_daily 
       WHERE account_id = $1 AND scoring_status IS NOT NULL
       ORDER BY creative_id, metric_date DESC`,
      [accountId]
    )
  ]);
  
  return {
    campaigns: campaigns.rows,
    creatives: creatives.rows
  };
}

// Session management functions
export interface DbSession {
  id: string;
  access_token: string | null;
  expires_at: Date | null;
  state: string | null;
  user_id: string | null;
  user_name: string | null;
  csrf_token: string | null;
  authorized_accounts: string[];
  created_at: Date;
  updated_at: Date;
}

export async function getDbSession(sessionId: string): Promise<DbSession | null> {
  const result = await pool.query(
    'SELECT * FROM user_sessions WHERE id = $1',
    [sessionId]
  );
  return result.rows[0] || null;
}

export async function createDbSession(sessionId: string, csrfToken?: string): Promise<DbSession> {
  const result = await pool.query(
    `INSERT INTO user_sessions (id, csrf_token) VALUES ($1, $2)
     ON CONFLICT (id) DO UPDATE SET updated_at = NOW(), csrf_token = COALESCE($2, user_sessions.csrf_token)
     RETURNING *`,
    [sessionId, csrfToken || null]
  );
  return result.rows[0];
}

export async function updateDbSession(
  sessionId: string, 
  updates: { 
    access_token?: string | null; 
    expires_at?: Date | null; 
    state?: string | null;
    user_id?: string | null;
    user_name?: string | null;
    authorized_accounts?: string[];
  }
): Promise<DbSession | null> {
  const setClauses: string[] = ['updated_at = NOW()'];
  const params: any[] = [];
  
  if (updates.access_token !== undefined) {
    params.push(updates.access_token);
    setClauses.push(`access_token = $${params.length}`);
  }
  if (updates.expires_at !== undefined) {
    params.push(updates.expires_at);
    setClauses.push(`expires_at = $${params.length}`);
  }
  if (updates.state !== undefined) {
    params.push(updates.state);
    setClauses.push(`state = $${params.length}`);
  }
  if (updates.user_id !== undefined) {
    params.push(updates.user_id);
    setClauses.push(`user_id = $${params.length}`);
  }
  if (updates.user_name !== undefined) {
    params.push(updates.user_name);
    setClauses.push(`user_name = $${params.length}`);
  }
  if (updates.authorized_accounts !== undefined) {
    params.push(updates.authorized_accounts);
    setClauses.push(`authorized_accounts = $${params.length}`);
  }
  
  params.push(sessionId);
  
  const result = await pool.query(
    `UPDATE user_sessions SET ${setClauses.join(', ')} WHERE id = $${params.length} RETURNING *`,
    params
  );
  return result.rows[0] || null;
}

export async function deleteDbSession(sessionId: string): Promise<void> {
  await pool.query('DELETE FROM user_sessions WHERE id = $1', [sessionId]);
}

export async function cleanupExpiredSessions(): Promise<number> {
  const result = await pool.query(
    `DELETE FROM user_sessions WHERE expires_at < NOW() - INTERVAL '7 days' RETURNING id`
  );
  return result.rowCount || 0;
}

// Get canvas with ownership check
export async function getCanvasWithOwnership(canvasId: string, userId: string): Promise<any | null> {
  const result = await pool.query(
    'SELECT * FROM ideate_canvases WHERE id = $1 AND owner_user_id = $2',
    [canvasId, userId]
  );
  return result.rows[0] || null;
}

export default pool;
