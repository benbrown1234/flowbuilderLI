import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function initDatabase() {
  const client = await pool.connect();
  try {
    await client.query(`
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

export default pool;
