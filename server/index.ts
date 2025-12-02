import express from 'express';
import cors from 'cors';
import axios from 'axios';
import cookieParser from 'cookie-parser';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';
import { 
  initDatabase, 
  getSnapshot, 
  createSnapshot, 
  updateSnapshotStatus,
  saveCampaignGroups,
  saveCampaigns,
  saveCreatives,
  saveMetrics,
  saveRecommendations,
  getAuditData,
  deleteAuditData,
  createCanvas,
  getCanvas,
  getCanvasByShareToken,
  listCanvases,
  updateCanvas,
  deleteCanvas,
  regenerateShareToken,
  saveCanvasVersion,
  getLatestCanvasVersion,
  getCanvasVersions,
  getCanvasVersion,
  addComment,
  getComments,
  resolveComment,
  deleteComment,
  getAuditAccount,
  optInAuditAccount,
  updateAuditAccountSyncStatus,
  getOptedInAccounts,
  getStuckSyncs,
  markStuckSyncsAsError,
  removeAuditAccount,
  saveCampaignDailyMetrics,
  saveCreativeDailyMetrics,
  getCampaignDailyMetrics,
  getCreativeDailyMetrics,
  getLatestMetricsDate
} from './database.js';
import { runAuditRules, calculateAccountScore } from './auditRules.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

const URN_CACHE_FILE = path.join(__dirname, '../.urn-cache.json');
let urnCache: Record<string, string> = {};

const loadUrnCache = () => {
  try {
    if (fs.existsSync(URN_CACHE_FILE)) {
      const data = fs.readFileSync(URN_CACHE_FILE, 'utf-8');
      urnCache = JSON.parse(data);
      console.log(`Loaded ${Object.keys(urnCache).length} cached URN names`);
    }
  } catch (err) {
    console.warn('Could not load URN cache:', err);
    urnCache = {};
  }
};

const saveUrnCache = () => {
  try {
    fs.writeFileSync(URN_CACHE_FILE, JSON.stringify(urnCache, null, 2));
  } catch (err) {
    console.warn('Could not save URN cache:', err);
  }
};

loadUrnCache();

const COMMON_TITLES: Record<string, string> = {
  '1': 'Accountant', '2': 'Actor', '3': 'Actuary', '4': 'Administrator',
  '5': 'Director', '6': 'Advisor', '7': 'Agent', '8': 'Analyst',
  '9': 'Architect', '10': 'Artist', '11': 'Assistant', '12': 'Attorney',
  '16': 'Managing Director', '35': 'Founder', '103': 'Co-Founder',
  '729': 'Vice President', '4645': 'Group Managing Director',
  '39': 'CEO', '40': 'CFO', '41': 'CTO', '42': 'COO', '43': 'CMO',
  '44': 'CIO', '45': 'President', '46': 'Chairman', '47': 'Partner',
  '48': 'Principal', '49': 'Owner', '50': 'Consultant',
  '51': 'Manager', '52': 'Senior Manager', '53': 'General Manager',
  '54': 'Project Manager', '55': 'Product Manager', '56': 'Account Manager',
  '57': 'Sales Manager', '58': 'Marketing Manager', '59': 'Operations Manager',
  '60': 'HR Manager', '61': 'Finance Manager', '62': 'IT Manager',
  '63': 'Engineer', '64': 'Software Engineer', '65': 'Senior Engineer',
  '66': 'Lead Engineer', '67': 'Staff Engineer', '68': 'Principal Engineer',
  '69': 'Developer', '70': 'Senior Developer', '71': 'Full Stack Developer',
  '72': 'Frontend Developer', '73': 'Backend Developer', '74': 'Data Engineer',
  '75': 'DevOps Engineer', '76': 'QA Engineer', '77': 'Test Engineer',
  '78': 'Designer', '79': 'UX Designer', '80': 'UI Designer', '81': 'Graphic Designer',
  '82': 'Product Designer', '83': 'Creative Director', '84': 'Art Director',
  '85': 'Sales', '86': 'Sales Representative', '87': 'Account Executive',
  '88': 'Business Development', '89': 'Sales Director', '90': 'VP Sales',
  '91': 'Marketing', '92': 'Marketing Director', '93': 'VP Marketing',
  '94': 'Digital Marketing', '95': 'Content Marketing', '96': 'Brand Manager',
  '97': 'HR', '98': 'Recruiter', '99': 'Talent Acquisition', '100': 'HR Director',
  '7196': 'Head of Marketing', '393': 'Business Owner',
};

const COMMON_INDUSTRIES: Record<string, string> = {
  '1': 'Accounting', '2': 'Airlines/Aviation', '3': 'Alternative Dispute Resolution',
  '4': 'Alternative Medicine', '5': 'Animation', '6': 'Technology, Information and Internet',
  '7': 'Apparel & Fashion', '8': 'Architecture & Planning', '9': 'Arts and Crafts',
  '10': 'Automotive', '11': 'Business Consulting and Services', '12': 'Aviation & Aerospace',
  '41': 'Banking', '43': 'Financial Services', '44': 'Real Estate',
  '46': 'Investment Management', '80': 'Advertising Services',
  '98': 'Public Relations and Communications Services', '99': 'Design Services',
  '104': 'Staffing and Recruiting', '105': 'Professional Training and Coaching',
  '106': 'Venture Capital and Private Equity Principals', '113': 'Online Audio and Video Media',
  '124': 'Wellness and Fitness Services', '128': 'Leasing Non-residential Real Estate',
};

const COMMON_FUNCTIONS: Record<string, string> = {
  '1': 'Accounting', '2': 'Administrative', '3': 'Arts and Design',
  '4': 'Business Development', '5': 'Community and Social Services',
  '6': 'Consulting', '7': 'Education', '8': 'Engineering', '9': 'Entrepreneurship',
  '10': 'Finance', '11': 'Healthcare Services', '12': 'Human Resources',
  '13': 'Information Technology', '14': 'Legal', '15': 'Marketing',
  '16': 'Media and Communication', '17': 'Military and Protective Services',
  '18': 'Operations', '19': 'Product Management', '20': 'Program and Project Management',
  '21': 'Purchasing', '22': 'Quality Assurance', '23': 'Real Estate',
  '24': 'Research', '25': 'Sales', '26': 'Support',
};

const getFallbackName = (urn: string): string | null => {
  const parts = urn.split(':');
  if (parts.length < 4) return null;
  
  const entityType = parts[2];
  const entityId = parts[3];
  
  if (entityType === 'title' && COMMON_TITLES[entityId]) {
    return COMMON_TITLES[entityId];
  }
  if (entityType === 'industry' && COMMON_INDUSTRIES[entityId]) {
    return COMMON_INDUSTRIES[entityId];
  }
  if (entityType === 'function' && COMMON_FUNCTIONS[entityId]) {
    return COMMON_FUNCTIONS[entityId];
  }
  
  return null;
};
const isProduction = process.env.NODE_ENV === 'production';
const PORT = Number(process.env.PORT) || (isProduction ? 5000 : 3001);

app.use(cors({ credentials: true, origin: true }));
app.use(express.json());
app.use(cookieParser());

const LINKEDIN_CLIENT_ID = process.env.LINKEDIN_CLIENT_ID;
const LINKEDIN_CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET;

const getRedirectUri = (req: express.Request): string => {
  const forwardedHost = req.get('x-forwarded-host');
  const replitDomain = process.env.REPLIT_DEV_DOMAIN || process.env.REPLIT_DOMAINS;
  const host = forwardedHost || replitDomain || req.get('host') || 'localhost:5000';
  const protocol = replitDomain || forwardedHost ? 'https' : (req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http');
  return `${protocol}://${host}/api/auth/callback`;
};

interface Session {
  accessToken: string | null;
  expiresAt: number | null;
  state: string | null;
}

const sessions: Map<string, Session> = new Map();

const getSession = (sessionId: string): Session => {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, { accessToken: null, expiresAt: null, state: null });
  }
  return sessions.get(sessionId)!;
};

const generateSessionId = (): string => {
  return crypto.randomBytes(32).toString('hex');
};

const isSecure = (req: express.Request): boolean => {
  return req.secure || req.get('x-forwarded-proto') === 'https';
};

const ensureSession = (req: express.Request, res: express.Response): string => {
  let sessionId = req.cookies?.session_id;
  if (!sessionId || !sessions.has(sessionId)) {
    sessionId = generateSessionId();
    res.cookie('session_id', sessionId, { 
      httpOnly: true, 
      secure: isSecure(req),
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });
    sessions.set(sessionId, { accessToken: null, expiresAt: null, state: null });
  }
  return sessionId;
};

app.get('/api/auth/url', (req, res) => {
  const sessionId = ensureSession(req, res);
  const session = getSession(sessionId);
  
  const state = crypto.randomBytes(16).toString('hex');
  session.state = state;
  
  const scope = 'rw_ads r_ads_reporting r_basicprofile r_organization_social';
  const redirectUri = getRedirectUri(req);
  
  const authUrl = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${LINKEDIN_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}&scope=${encodeURIComponent(scope)}`;
  
  res.json({ authUrl, state });
});

app.get('/api/auth/callback', async (req, res) => {
  const sessionId = req.cookies?.session_id;
  const { code, state, error } = req.query;
  
  if (error) {
    return res.redirect(`/?error=${error}`);
  }
  
  if (!code) {
    return res.redirect('/?error=no_code');
  }
  
  if (!sessionId) {
    return res.redirect('/?error=no_session');
  }
  
  const session = getSession(sessionId);
  
  if (!state || state !== session.state) {
    console.error('State mismatch:', { received: state, expected: session.state });
    return res.redirect('/?error=state_mismatch');
  }
  
  session.state = null;
  
  try {
    const redirectUri = getRedirectUri(req);
    
    const tokenResponse = await axios.post(
      'https://www.linkedin.com/oauth/v2/accessToken',
      null,
      {
        params: {
          grant_type: 'authorization_code',
          code: code as string,
          redirect_uri: redirectUri,
          client_id: LINKEDIN_CLIENT_ID,
          client_secret: LINKEDIN_CLIENT_SECRET,
        },
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );
    
    session.accessToken = tokenResponse.data.access_token;
    session.expiresAt = Date.now() + (tokenResponse.data.expires_in * 1000);
    
    res.redirect('/?auth=success');
  } catch (err: any) {
    console.error('Token exchange error:', err.response?.data || err.message);
    res.redirect(`/?error=token_exchange_failed`);
  }
});

app.get('/api/auth/status', (req, res) => {
  const sessionId = req.cookies?.session_id;
  
  if (!sessionId) {
    return res.json({ isAuthenticated: false });
  }
  
  const session = getSession(sessionId);
  const isAuthenticated = session.accessToken !== null && 
    (session.expiresAt === null || Date.now() < session.expiresAt);
  
  res.json({ isAuthenticated });
});

app.post('/api/auth/logout', (req, res) => {
  const sessionId = req.cookies?.session_id;
  
  if (sessionId) {
    sessions.delete(sessionId);
  }
  
  res.clearCookie('session_id');
  res.json({ success: true });
});

// API request throttling to prevent LinkedIn rate limiting
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 150; // 150ms between requests

async function throttledDelay(): Promise<void> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    await new Promise(resolve => setTimeout(resolve, MIN_REQUEST_INTERVAL - timeSinceLastRequest));
  }
  lastRequestTime = Date.now();
}

async function linkedinApiRequest(sessionId: string, endpoint: string, params: Record<string, any> = {}, rawQueryString?: string) {
  const session = getSession(sessionId);
  
  if (!session.accessToken) {
    throw new Error('Not authenticated');
  }
  
  if (session.expiresAt && Date.now() >= session.expiresAt) {
    throw new Error('Token expired');
  }
  
  return linkedinApiRequestWithToken(session.accessToken, endpoint, params, rawQueryString);
}

// Direct token-based API request (for background tasks where session may be gone)
async function linkedinApiRequestWithToken(accessToken: string, endpoint: string, params: Record<string, any> = {}, rawQueryString?: string) {
  if (!accessToken) {
    throw new Error('Not authenticated');
  }
  
  // Apply throttling before each request
  await throttledDelay();
  
  let url = `https://api.linkedin.com/rest${endpoint}`;
  
  if (rawQueryString) {
    url += `?${rawQueryString}`;
  }
  
  try {
    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'LinkedIn-Version': '202411',
        'X-Restli-Protocol-Version': '2.0.0',
        'User-Agent': 'LinkedIn-Audience-Visualizer/1.0',
      },
      params: rawQueryString ? undefined : params,
    });
    
    return response.data;
  } catch (error: any) {
    console.error(`LinkedIn API error for ${endpoint}:`, error.response?.status, error.response?.data || error.message);
    throw error;
  }
}

async function linkedinApiRequestPaginated(sessionId: string, endpoint: string, params: Record<string, any> = {}, rawQueryString?: string): Promise<any[]> {
  const allElements: any[] = [];
  let pageToken: string | undefined;
  const pageSize = 100; // Reduced from 500 to prevent rate limiting
  
  do {
    const requestParams: Record<string, any> = {
      ...params,
      pageSize,
    };
    
    if (pageToken) {
      requestParams.pageToken = pageToken;
    }
    
    let queryStr = rawQueryString;
    if (queryStr) {
      queryStr += `&pageSize=${pageSize}`;
      if (pageToken) {
        queryStr += `&pageToken=${pageToken}`;
      }
    }
    
    const response = await linkedinApiRequest(sessionId, endpoint, rawQueryString ? {} : requestParams, queryStr);
    
    if (response.elements && Array.isArray(response.elements)) {
      allElements.push(...response.elements);
    }
    
    pageToken = response.metadata?.nextPageToken || response.paging?.nextPageToken;
    
    if (allElements.length > 5000) {
      console.warn(`Stopping pagination at ${allElements.length} elements to prevent excessive API calls`);
      break;
    }
  } while (pageToken);
  
  return allElements;
}

const requireAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const sessionId = req.cookies?.session_id;
  
  if (!sessionId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  const session = getSession(sessionId);
  
  if (!session.accessToken) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  if (session.expiresAt && Date.now() >= session.expiresAt) {
    return res.status(401).json({ error: 'Token expired' });
  }
  
  (req as any).sessionId = sessionId;
  next();
};

app.get('/api/linkedin/accounts', requireAuth, async (req, res) => {
  try {
    const data = await linkedinApiRequest((req as any).sessionId, '/adAccounts', {
      q: 'search',
    });
    console.log('Ad accounts response:', JSON.stringify(data, null, 2));
    res.json(data);
  } catch (err: any) {
    console.error('Ad accounts error:', err.response?.data || err.message);
    res.status(err.response?.status || 500).json({ 
      error: err.response?.data || err.message 
    });
  }
});

app.get('/api/linkedin/account/:accountId/campaigns', requireAuth, async (req, res) => {
  try {
    const { accountId } = req.params;
    const data = await linkedinApiRequest((req as any).sessionId, `/adAccounts/${accountId}/adCampaigns`, {
      q: 'search',
    });
    res.json(data);
  } catch (err: any) {
    console.error('Campaigns error:', err.response?.data || err.message);
    res.status(err.response?.status || 500).json({ 
      error: err.response?.data || err.message 
    });
  }
});

app.get('/api/linkedin/account/:accountId/groups', requireAuth, async (req, res) => {
  try {
    const { accountId } = req.params;
    const data = await linkedinApiRequest((req as any).sessionId, `/adAccounts/${accountId}/adCampaignGroups`, {
      q: 'search',
    });
    res.json(data);
  } catch (err: any) {
    console.error('Campaign groups error:', err.response?.data || err.message);
    res.status(err.response?.status || 500).json({ 
      error: err.response?.data || err.message 
    });
  }
});

app.get('/api/linkedin/account/:accountId/creatives', requireAuth, async (req, res) => {
  try {
    const { accountId } = req.params;
    const data = await linkedinApiRequest((req as any).sessionId, `/adAccounts/${accountId}/creatives`, {
      q: 'criteria',
    });
    res.json(data);
  } catch (err: any) {
    console.error('Creatives error:', err.response?.data || err.message);
    res.status(err.response?.status || 500).json({ 
      error: err.response?.data || err.message 
    });
  }
});

app.get('/api/linkedin/account/:accountId/segments', requireAuth, async (req, res) => {
  try {
    const { accountId } = req.params;
    const accountUrn = encodeURIComponent(`urn:li:sponsoredAccount:${accountId}`);
    const data = await linkedinApiRequest(
      (req as any).sessionId, 
      '/adSegments',
      {},
      `q=accounts&accounts=List(${accountUrn})`
    );
    res.json(data);
  } catch (err: any) {
    console.error('Segments error:', err.response?.data || err.message);
    res.status(err.response?.status || 500).json({ 
      error: err.response?.data || err.message 
    });
  }
});

app.get('/api/linkedin/account/:accountId/engagement-rules', requireAuth, async (req, res) => {
  try {
    const { accountId } = req.params;
    const accountUrn = encodeURIComponent(`urn:li:sponsoredAccount:${accountId}`);
    const data = await linkedinApiRequest(
      (req as any).sessionId, 
      '/dmpEngagementRules',
      {},
      `q=account&account=${accountUrn}`
    );
    console.log('Engagement rules response:', JSON.stringify(data, null, 2).substring(0, 1000));
    res.json(data);
  } catch (err: any) {
    console.error('Engagement rules error:', err.response?.data || err.message);
    res.status(err.response?.status || 500).json({ 
      error: err.response?.data || err.message 
    });
  }
});

app.get('/api/linkedin/account/:accountId/analytics', requireAuth, async (req, res) => {
  try {
    const { accountId } = req.params;
    const sessionId = (req as any).sessionId;
    
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    
    const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevYear = prevDate.getFullYear();
    const prevMonth = prevDate.getMonth() + 1;
    
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
    const startYear = threeMonthsAgo.getFullYear();
    const startMonth = threeMonthsAgo.getMonth() + 1;
    
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const endYear = nextMonth.getFullYear();
    const endMonth = nextMonth.getMonth() + 1;
    
    const accountUrn = `urn:li:sponsoredAccount:${accountId}`;
    const encodedAccountUrn = encodeURIComponent(accountUrn);
    
    const dateRangeQuery = `q=analytics&pivot=CAMPAIGN&dateRange=(start:(year:${startYear},month:${startMonth},day:1),end:(year:${endYear},month:${endMonth},day:1))&timeGranularity=MONTHLY&accounts=List(${encodedAccountUrn})&fields=impressions,clicks,costInLocalCurrency,externalWebsiteConversions,oneClickLeads,videoViews,pivotValues,dateRange`;
    
    console.log(`\n=== Fetching analytics for account ${accountId} ===`);
    console.log(`Date range: ${startMonth}/${startYear} to ${endMonth}/${endYear}`);
    console.log(`Account URN: ${accountUrn}`);
    console.log(`Query string length: ${dateRangeQuery.length} chars`);
    
    let analyticsData: any = { elements: [] };
    
    try {
      analyticsData = await linkedinApiRequest(sessionId, '/adAnalytics', {}, dateRangeQuery);
      console.log(`Analytics response: ${analyticsData.elements?.length || 0} rows`);
      if (analyticsData.elements?.length > 0) {
        console.log('Sample element:', JSON.stringify(analyticsData.elements[0], null, 2));
      } else {
        console.log('No analytics data returned - empty elements array');
      }
    } catch (err: any) {
      const errorDetails = err.response?.data || err.message;
      console.warn('Analytics API error:', JSON.stringify(errorDetails, null, 2));
      res.json({
        accountId,
        campaigns: [],
        currentMonthLabel: '',
        previousMonthLabel: '',
        error: typeof errorDetails === 'string' ? errorDetails : JSON.stringify(errorDetails)
      });
      return;
    }
    
    const parseMetrics = (element: any) => ({
      impressions: element.impressions || 0,
      clicks: element.clicks || 0,
      spend: element.costInLocalCurrency || 0,
      conversions: element.externalWebsiteConversions || 0,
      leads: element.oneClickLeads || element.leads || 0,
      videoViews: element.videoViews || 0,
      landingPageClicks: element.landingPageClicks || 0,
    });
    
    const getCampaignId = (element: any): string => {
      if (element.pivotValues && element.pivotValues.length > 0) {
        const campaignUrn = element.pivotValues[0];
        const id = campaignUrn.split(':').pop() || campaignUrn;
        return id;
      }
      return '';
    };
    
    const getElementMonth = (element: any): number => {
      if (element.dateRange?.start?.month) {
        return element.dateRange.start.month;
      }
      return 0;
    };
    
    const currentByC: Record<string, any> = {};
    const prevByC: Record<string, any> = {};
    
    (analyticsData.elements || []).forEach((el: any) => {
      const cId = getCampaignId(el);
      const elMonth = getElementMonth(el);
      
      if (cId) {
        console.log(`Campaign ${cId} - month ${elMonth}: impressions=${el.impressions || 0}, clicks=${el.clicks || 0}`);
        if (elMonth === currentMonth) {
          currentByC[cId] = parseMetrics(el);
        } else if (elMonth === prevMonth) {
          prevByC[cId] = parseMetrics(el);
        }
      }
    });
    
    console.log(`Current month (${currentMonth}) campaigns: ${Object.keys(currentByC).length}`);
    console.log(`Previous month (${prevMonth}) campaigns: ${Object.keys(prevByC).length}`);
    
    const emptyMetrics = {
      impressions: 0, clicks: 0, spend: 0, conversions: 0, leads: 0, videoViews: 0, landingPageClicks: 0
    };
    
    const allCampaignIds = [...new Set([...Object.keys(currentByC), ...Object.keys(prevByC)])];
    console.log(`All campaign IDs with data: ${allCampaignIds.join(', ')}`);
    
    const campaigns = allCampaignIds.map(cId => ({
      campaignId: cId,
      campaignName: `Campaign ${cId}`,
      currentMonth: currentByC[cId] || emptyMetrics,
      previousMonth: prevByC[cId] || emptyMetrics,
      currency: 'GBP',
    }));
    
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    res.json({
      accountId,
      campaigns,
      currentMonthLabel: `${monthNames[currentMonth - 1]} ${currentYear}`,
      previousMonthLabel: `${monthNames[prevMonth - 1]} ${prevYear}`,
    });
  } catch (err: any) {
    console.error('Analytics error:', err.response?.data || err.message);
    res.status(err.response?.status || 500).json({ 
      error: err.response?.data || err.message 
    });
  }
});

app.get('/api/linkedin/account/:accountId/hierarchy', requireAuth, async (req, res) => {
  try {
    const { accountId } = req.params;
    const sessionId = (req as any).sessionId;
    const activeOnly = req.query.activeOnly === 'true';
    const depth = req.query.depth as string || 'full'; // 'summary' = groups+campaigns only, 'full' = everything
    
    console.log(`\n=== Fetching hierarchy for account: ${accountId} (activeOnly: ${activeOnly}, depth: ${depth}) ===`);
    
    let groups: any[] = [];
    let campaigns: any[] = [];
    let creatives: any[] = [];
    let segments: any[] = [];
    let engagementRules: any[] = [];
    const errors: string[] = [];
    
    try {
      groups = await linkedinApiRequestPaginated(sessionId, `/adAccounts/${accountId}/adCampaignGroups`, {
        q: 'search',
      });
      if (activeOnly) {
        groups = groups.filter((g: any) => g.status === 'ACTIVE');
      }
      console.log(`Campaign groups fetched: ${groups.length} items`);
      if (groups.length > 0) {
        console.log(`First group sample: ${JSON.stringify(groups[0], null, 2).substring(0, 500)}`);
      }
    } catch (err: any) {
      const errorMsg = `Campaign groups error: ${JSON.stringify(err.response?.data || err.message)}`;
      console.error(errorMsg);
      errors.push(errorMsg);
    }
    
    try {
      campaigns = await linkedinApiRequestPaginated(sessionId, `/adAccounts/${accountId}/adCampaigns`, {
        q: 'search',
      });
      if (activeOnly) {
        campaigns = campaigns.filter((c: any) => c.status === 'ACTIVE');
      }
      console.log(`Campaigns fetched: ${campaigns.length} items`);
      if (campaigns.length > 0) {
        console.log(`First campaign sample: ${JSON.stringify(campaigns[0], null, 2).substring(0, 500)}`);
        // Log key format fields specifically
        console.log(`Campaign format fields: type=${campaigns[0].type}, format=${campaigns[0].format}, creativeSelection=${campaigns[0].creativeSelection}`);
      }
    } catch (err: any) {
      const errorMsg = `Campaigns error: ${JSON.stringify(err.response?.data || err.message)}`;
      console.error(errorMsg);
      errors.push(errorMsg);
    }
    
    // Only fetch creatives if depth is 'full'
    if (depth === 'full' && campaigns.length > 0) {
      try {
        const campaignUrns = campaigns.map((c: any) => {
          const id = typeof c.id === 'number' ? c.id : c.id;
          return `urn:li:sponsoredCampaign:${id}`;
        });
        
        const batchSize = 10;
        for (let i = 0; i < campaignUrns.length; i += batchSize) {
          const batch = campaignUrns.slice(i, i + batchSize);
          const campaignListEncoded = batch.map(u => encodeURIComponent(u)).join(',');
          const rawQuery = `q=criteria&campaigns=List(${campaignListEncoded})&pageSize=100`;
          
          const response = await linkedinApiRequest(sessionId, `/adAccounts/${accountId}/creatives`, {}, rawQuery);
          if (response.elements && Array.isArray(response.elements)) {
            creatives.push(...response.elements);
          }
        }
        
        if (activeOnly) {
          creatives = creatives.filter((c: any) => c.intendedStatus === 'ACTIVE');
        }
        console.log(`Creatives fetched: ${creatives.length} items`);
        if (creatives.length > 0) {
          console.log(`First creative sample: ${JSON.stringify(creatives[0], null, 2).substring(0, 500)}`);
          // Log key creative fields
          const c = creatives[0];
          console.log(`Creative fields: type=${c.type}, intendedStatus=${c.intendedStatus}, content.reference=${c.content?.reference}, variables=${JSON.stringify(Object.keys(c.variables || {}))}`);
        }
      } catch (err: any) {
        const errorMsg = `Creatives error: ${JSON.stringify(err.response?.data || err.message)}`;
        console.error(errorMsg);
        errors.push(errorMsg);
      }
    } else if (depth === 'summary') {
      console.log('Skipping creatives fetch (depth=summary)');
    }
    
    // Only fetch segments and engagement rules if depth is 'full'
    if (depth === 'full') {
      try {
        const accountUrn = encodeURIComponent(`urn:li:sponsoredAccount:${accountId}`);
        const segmentsResponse = await linkedinApiRequest(
          sessionId, 
          '/adSegments',
          {},
          `q=accounts&accounts=List(${accountUrn})`
        );
        segments = segmentsResponse.elements || [];
        console.log(`Segments fetched: ${segments.length} items`);
        if (segments.length > 0) {
          console.log(`First segment sample: ${JSON.stringify(segments[0], null, 2).substring(0, 500)}`);
        }
      } catch (err: any) {
        const errorMsg = `Segments error: ${JSON.stringify(err.response?.data || err.message)}`;
        console.error(errorMsg);
        errors.push(errorMsg);
      }
      
      try {
        const accountUrn = encodeURIComponent(`urn:li:sponsoredAccount:${accountId}`);
        const rulesResponse = await linkedinApiRequest(
          sessionId, 
          '/dmpEngagementRules',
          {},
          `q=account&account=${accountUrn}`
        );
        engagementRules = rulesResponse.elements || [];
        console.log(`Engagement rules fetched: ${engagementRules.length} items`);
        if (engagementRules.length > 0) {
          console.log(`First engagement rule sample: ${JSON.stringify(engagementRules[0], null, 2).substring(0, 800)}`);
        }
      } catch (err: any) {
        const errorMsg = `Engagement rules error: ${JSON.stringify(err.response?.data || err.message)}`;
        console.error(errorMsg);
        errors.push(errorMsg);
      }
    } else {
      console.log('Skipping segments and engagement rules fetch (depth=summary)');
    }
    
    console.log(`=== Summary: ${groups.length} groups, ${campaigns.length} campaigns, ${creatives.length} creatives, ${segments.length} segments, ${engagementRules.length} engagement rules ===\n`);
    
    // Fetch thumbnails and media types for post-based creatives
    const postReferenceCreatives = creatives.filter((c: any) => c.content?.reference);
    const imageUrlMap: Record<string, string> = {};
    const mediaTypeMap: Record<string, string> = {};
    const authorMap: Record<string, boolean> = {}; // true = Thought Leader, false = Company
    
    if (postReferenceCreatives.length > 0) {
      console.log(`Fetching thumbnails and media types for ${postReferenceCreatives.length} post-based creatives...`);
      
      // Batch fetch posts (limit to first 30 to avoid too many API calls)
      const creativesToFetch = postReferenceCreatives.slice(0, 30);
      
      await Promise.all(creativesToFetch.map(async (creative: any) => {
        const reference = creative.content.reference;
        try {
          let postData: any = null;
          if (reference.includes('urn:li:share:')) {
            const shareId = reference.replace('urn:li:share:', '');
            const response = await linkedinApiRequest(sessionId, `/posts/${shareId}`, {});
            postData = response;
          } else if (reference.includes('urn:li:ugcPost:')) {
            const postId = reference.replace('urn:li:ugcPost:', '');
            const response = await linkedinApiRequest(sessionId, `/ugcPosts/${postId}`, {});
            postData = response;
          }
          
          if (postData) {
            console.log(`\n=== Post data for creative ${creative.id} ===`);
            console.log(`Reference: ${reference}`);
            console.log(`Author: ${postData.author || 'NO AUTHOR'}`);
            console.log(`Content keys: ${Object.keys(postData.content || {}).join(', ') || 'NO CONTENT'}`);
            if (postData.content?.carousel) {
              console.log(`CAROUSEL DETECTED! Cards: ${postData.content.carousel.cards?.length || 0}`);
            }
            if (postData.content?.media) {
              console.log(`Media array length: ${postData.content.media.length}`);
            }
            if (postData.content?.multiImage) {
              console.log(`MultiImage detected: ${postData.content.multiImage.images?.length || 0} images`);
            }
            console.log(`Full content structure: ${JSON.stringify(postData.content, null, 2).substring(0, 1000)}`);
            
            let thumbnailUrn: string | undefined;
            let detectedMediaType: string = 'Image';
            
            // Detect author type for Thought Leader vs Company Ad
            const author = postData.author || '';
            const isThoughtLeader = author.includes('urn:li:person:') || author.includes('urn:li:member:');
            authorMap[creative.id] = isThoughtLeader;
            console.log(`Is Thought Leader: ${isThoughtLeader} (author: ${author})`);
            
            // Detect media type and extract thumbnail
            // Check for carousel structure first (LinkedIn API returns content.carousel for carousels)
            if (postData.content?.carousel) {
              detectedMediaType = 'Carousel';
              const cards = postData.content.carousel.cards;
              if (cards?.[0]?.media?.id) {
                thumbnailUrn = cards[0].media.id;
              }
            }
            else if (postData.content?.article) {
              detectedMediaType = 'Article';
              thumbnailUrn = postData.content.article.thumbnail;
            }
            else if (postData.content?.media) {
              const mediaArray = postData.content.media;
              if (Array.isArray(mediaArray) && mediaArray.length > 1) {
                detectedMediaType = 'Carousel';
                thumbnailUrn = mediaArray[0]?.id;
              } else if (mediaArray.length === 1) {
                const firstMedia = mediaArray[0];
                if (firstMedia.mediaType === 'VIDEO' || firstMedia.id?.includes('video')) {
                  detectedMediaType = 'Video';
                } else {
                  detectedMediaType = 'Image';
                }
                thumbnailUrn = firstMedia.id;
              }
            }
            else if (postData.content?.multiImage) {
              detectedMediaType = 'Carousel';
              const images = postData.content.multiImage.images;
              if (images?.[0]?.id) {
                thumbnailUrn = images[0].id;
              }
            }
            // Check ugcPost specificContent structure
            else if (postData.specificContent?.['com.linkedin.ugc.ShareContent']) {
              const shareContent = postData.specificContent['com.linkedin.ugc.ShareContent'];
              const media = shareContent.media;
              if (Array.isArray(media) && media.length > 1) {
                detectedMediaType = 'Carousel';
              } else if (media?.[0]) {
                const mediaType = media[0].mediaType || media[0]['com.linkedin.digitalmedia.mediaartifact.MediaArtifact']?.mediaType;
                if (mediaType === 'VIDEO') {
                  detectedMediaType = 'Video';
                } else {
                  detectedMediaType = 'Image';
                }
              }
              if (media?.[0]?.thumbnails?.[0]?.url) {
                imageUrlMap[creative.id] = media[0].thumbnails[0].url;
              }
            }
            
            mediaTypeMap[creative.id] = detectedMediaType;
            
            // Resolve image URN to URL if we have one
            if (thumbnailUrn && thumbnailUrn.startsWith('urn:li:image:')) {
              try {
                const imageId = thumbnailUrn.replace('urn:li:image:', '');
                const imageResponse = await linkedinApiRequest(sessionId, `/images/${imageId}`, {});
                if (imageResponse.downloadUrl) {
                  imageUrlMap[creative.id] = imageResponse.downloadUrl;
                }
              } catch (imgErr: any) {
                // Image resolution failed, skip
              }
            }
          }
        } catch (postErr: any) {
          // Post fetch failed, skip this creative
        }
      }));
      
      console.log(`Resolved ${Object.keys(imageUrlMap).length} thumbnail URLs and ${Object.keys(mediaTypeMap).length} media types`);
    }
    
    // Process creatives to extract image URLs and media types
    const processedCreatives = creatives.map((creative: any) => {
      let imageUrl: string | undefined;
      let mediaType: string | undefined;
      const content = creative.content;
      
      // First check if we resolved from post content
      if (imageUrlMap[creative.id]) {
        imageUrl = imageUrlMap[creative.id];
      }
      if (mediaTypeMap[creative.id]) {
        mediaType = mediaTypeMap[creative.id];
      }
      
      // Check for non-post creative types
      if (content) {
        if (content.textAd) {
          mediaType = 'Text';
          if (content.textAd.imageUrl) {
            imageUrl = content.textAd.imageUrl;
          }
        }
        else if (content.spotlight) {
          mediaType = 'Spotlight';
          imageUrl = content.spotlight.logo || content.spotlight.backgroundImage;
        }
        else if (content.carousel) {
          mediaType = 'Carousel';
        }
        else if (content.eventAd) {
          mediaType = 'Event';
        }
        // Note: Don't set a generic fallback here - let the frontend
        // detect from campaign type/format instead
      }
      
      // Get isThoughtLeader from authorMap (detected from post author)
      const isThoughtLeader = authorMap[creative.id] ?? false;
      
      return {
        ...creative,
        content: {
          ...(creative.content || {}),
          imageUrl,
          mediaType,
          isThoughtLeader
        }
      };
    });
    
    res.json({
      groups,
      campaigns,
      creatives: processedCreatives,
      segments,
      engagementRules,
      _debug: errors.length > 0 ? { errors } : undefined,
    });
  } catch (err: any) {
    console.error('Hierarchy error:', err.response?.data || err.message);
    res.status(err.response?.status || 500).json({ 
      error: err.response?.data || err.message 
    });
  }
});

app.post('/api/linkedin/resolve-targeting', requireAuth, async (req, res) => {
  try {
    const sessionId = (req as any).sessionId;
    const { urns } = req.body;
    
    if (!urns || !Array.isArray(urns) || urns.length === 0) {
      return res.json({ resolved: {} });
    }
    
    const resolved: Record<string, string> = {};
    const uniqueUrns = [...new Set(urns)] as string[];
    
    // First, check cache and fallbacks for all URNs
    const urnsToResolve: string[] = [];
    uniqueUrns.forEach(urn => {
      if (urnCache[urn]) {
        resolved[urn] = urnCache[urn];
      } else {
        const fallback = getFallbackName(urn);
        if (fallback) {
          resolved[urn] = fallback;
          urnCache[urn] = fallback;
        } else {
          urnsToResolve.push(urn);
        }
      }
    });
    
    // If all URNs were resolved from cache/fallbacks, return early
    if (urnsToResolve.length === 0) {
      console.log(`All ${uniqueUrns.length} URNs resolved from cache/fallbacks`);
      return res.json({ resolved });
    }
    
    console.log(`Resolving ${urnsToResolve.length} URNs from API (${uniqueUrns.length - urnsToResolve.length} from cache)`);
    
    // Group remaining URNs by facet type for more efficient resolution
    const facetGroups: Record<string, string[]> = {};
    urnsToResolve.forEach(urn => {
      // Extract facet type from URN like urn:li:title:123 -> titles
      const parts = urn.split(':');
      if (parts.length >= 3) {
        const entityType = parts[2]; // e.g., "title", "industry", "geo", etc.
        if (!facetGroups[entityType]) {
          facetGroups[entityType] = [];
        }
        facetGroups[entityType].push(urn);
      }
    });
    
    // Process each facet type - try to fetch by facet first, then fall back to URN lookup
    for (const [entityType, entityUrns] of Object.entries(facetGroups)) {
      // Map entity types to their adTargetingFacet URNs
      const facetMap: Record<string, string> = {
        'title': 'titles',
        'industry': 'industries',
        'geo': 'locations',
        'seniority': 'seniorities',
        'function': 'jobFunctions',
        'skill': 'skills',
        'degree': 'degrees',
        'fieldOfStudy': 'fieldsOfStudy',
        'organization': 'employers',
        'adSegment': 'audienceMatchingSegments',
      };
      
      const facetName = facetMap[entityType];
      
      if (facetName) {
        try {
          // Try to get all entities for this facet type
          const facetUrn = `urn:li:adTargetingFacet:${facetName}`;
          const response = await linkedinApiRequest(
            sessionId, 
            '/adTargetingEntities',
            {
              q: 'adTargetingFacet',
              queryVersion: 'QUERY_USES_URNS',
              facet: facetUrn,
              'locale': '(language:en,country:US)',
            }
          );
          
          if (response.elements && Array.isArray(response.elements)) {
            response.elements.forEach((entity: any) => {
              if (entity.urn && entity.name) {
                resolved[entity.urn] = entity.name;
              }
            });
          }
        } catch (facetErr: any) {
          console.warn(`Facet lookup failed for ${facetName}: ${facetErr.message}`);
        }
      }
    }
    
    // For any URNs not resolved by facet lookup, try direct URN resolution
    const unresolvedUrns = urnsToResolve.filter(urn => !resolved[urn]);
    
    if (unresolvedUrns.length > 0) {
      const batchSize = 20;
      for (let i = 0; i < unresolvedUrns.length; i += batchSize) {
        const batch = unresolvedUrns.slice(i, i + batchSize);
        // URNs inside List() should be comma-separated, each URN individually encoded
        const urnList = batch.map(u => encodeURIComponent(u)).join(',');
        
        try {
          const response = await linkedinApiRequest(
            sessionId, 
            '/adTargetingEntities',
            {},
            `q=urns&queryVersion=QUERY_USES_URNS&urns=List(${urnList})&locale=(language:en,country:US)`
          );
          
          // Response can be in 'results' (batch lookup) or 'elements' format
          if (response.results) {
            Object.entries(response.results).forEach(([urn, entity]: [string, any]) => {
              if (entity && entity.name) {
                resolved[urn] = entity.name;
              } else if (entity && entity.value) {
                resolved[urn] = entity.value;
              }
            });
          }
          if (response.elements && Array.isArray(response.elements)) {
            response.elements.forEach((entity: any) => {
              if (entity.urn && entity.name) {
                resolved[entity.urn] = entity.name;
              }
            });
          }
        } catch (batchErr: any) {
          console.warn(`URN batch resolution failed: ${batchErr.message}`);
        }
      }
    }
    
    // Save newly resolved URNs to cache
    let newCacheEntries = 0;
    Object.entries(resolved).forEach(([urn, name]) => {
      if (!urnCache[urn]) {
        urnCache[urn] = name;
        newCacheEntries++;
      }
    });
    
    if (newCacheEntries > 0) {
      saveUrnCache();
      console.log(`Saved ${newCacheEntries} new URN names to cache`);
    }
    
    console.log(`Resolved ${Object.keys(resolved).length} of ${uniqueUrns.length} targeting URNs`);
    res.json({ resolved });
  } catch (err: any) {
    console.error('Targeting resolution error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to resolve targeting' });
  }
});

app.get('/api/linkedin/account/:accountId/ad-preview/:creativeId', requireAuth, async (req, res) => {
  try {
    const sessionId = (req as any).sessionId;
    const { accountId, creativeId } = req.params;
    
    const accountUrn = encodeURIComponent(`urn:li:sponsoredAccount:${accountId}`);
    const creativeUrn = encodeURIComponent(`urn:li:sponsoredCreative:${creativeId}`);
    
    const response = await linkedinApiRequest(
      sessionId,
      '/adPreviews',
      {},
      `q=creative&creative=${creativeUrn}&account=${accountUrn}`
    );
    
    res.json(response);
  } catch (err: any) {
    console.error('Ad preview error:', err.response?.data || err.message);
    res.status(err.response?.status || 500).json({ 
      error: err.response?.data || err.message 
    });
  }
});

// Ad Budget Pricing endpoint - fetches bid limits and suggested bids
app.get('/api/linkedin/account/:accountId/campaign/:campaignId/budget-pricing', requireAuth, async (req, res) => {
  try {
    const sessionId = (req as any).sessionId;
    const { accountId, campaignId } = req.params;
    
    console.log(`Fetching budget pricing for campaign ${campaignId} in account ${accountId}`);
    
    // First, get the campaign details to extract targeting criteria and other parameters
    const campaignUrn = `urn:li:sponsoredCampaign:${campaignId}`;
    const encodedCampaignUrn = encodeURIComponent(campaignUrn);
    
    const campaignResponse = await linkedinApiRequest(
      sessionId,
      `/adAccounts/${accountId}/adCampaigns/${encodedCampaignUrn}`,
      {}
    );
    
    if (!campaignResponse) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    
    console.log(`Campaign details: costType=${campaignResponse.costType}, objectiveType=${campaignResponse.objectiveType}`);
    
    // Map costType to bidType
    const bidTypeMap: Record<string, string> = {
      'CPM': 'CPM',
      'CPC': 'CPC',
      'CPV': 'CPV',
    };
    const bidType = bidTypeMap[campaignResponse.costType] || 'CPM';
    
    // Map campaign type
    let campaignType = 'SPONSORED_UPDATES'; // Default for most campaigns
    if (campaignResponse.type === 'TEXT_AD') {
      campaignType = 'TEXT_AD';
    } else if (campaignResponse.type === 'SPONSORED_INMAILS' || campaignResponse.offsiteDeliveryEnabled) {
      campaignType = 'SPONSORED_INMAILS';
    }
    
    // Build the budget pricing request
    const accountUrn = encodeURIComponent(`urn:li:sponsoredAccount:${accountId}`);
    const objectiveType = campaignResponse.objectiveType || 'BRAND_AWARENESS';
    const optimizationTargetType = campaignResponse.optimizationTargetType || 'NONE';
    
    // Build targeting criteria query parameter
    let targetingParam = '';
    if (campaignResponse.targetingCriteria) {
      // Encode the targeting criteria for the query
      const tc = campaignResponse.targetingCriteria;
      if (tc.include && tc.include.and) {
        // Build the RESTLI 2.0 format targeting criteria
        const andList = tc.include.and.map((orGroup: any) => {
          const orEntries = Object.entries(orGroup.or || {}).map(([facet, values]: [string, any]) => {
            const encodedFacet = encodeURIComponent(facet);
            const encodedValues = (values as string[]).map(v => encodeURIComponent(v)).join(',');
            return `(${encodedFacet}:List(${encodedValues}))`;
          }).join(',');
          return `(or:(${orEntries}))`;
        }).join(',');
        targetingParam = `&targetingCriteria=(include:(and:List(${andList})))`;
      }
    }
    
    // Make the budget pricing API call
    try {
      const pricingResponse = await linkedinApiRequest(
        sessionId,
        '/adBudgetPricing',
        {},
        `q=criteriaV2&account=${accountUrn}&bidType=${bidType}&campaignType=${campaignType}&objectiveType=${objectiveType}&optimizationTargetType=${optimizationTargetType}&matchType=EXACT${targetingParam}`
      );
      
      console.log(`Budget pricing response:`, JSON.stringify(pricingResponse, null, 2).substring(0, 1000));
      
      if (pricingResponse.elements && pricingResponse.elements.length > 0) {
        const pricing = pricingResponse.elements[0];
        res.json({
          bidLimits: pricing.bidLimits,
          suggestedBid: pricing.suggestedBid,
          dailyBudgetLimits: pricing.dailyBudgetLimits,
          currency: pricing.bidLimits?.max?.currencyCode || 'USD'
        });
      } else {
        res.json({ error: 'No pricing data available' });
      }
    } catch (pricingErr: any) {
      console.error('Budget pricing API error:', pricingErr.response?.data || pricingErr.message);
      // Return empty result rather than error - pricing may not be available for all campaigns
      res.json({ error: 'Pricing data not available for this campaign' });
    }
  } catch (err: any) {
    console.error('Budget pricing error:', err.response?.data || err.message);
    res.status(err.response?.status || 500).json({ 
      error: err.response?.data || err.message 
    });
  }
});

app.get('/api/linkedin/account/:accountId/creative/:creativeId', requireAuth, async (req, res) => {
  try {
    const sessionId = (req as any).sessionId;
    const { accountId, creativeId } = req.params;
    
    const creativeUrn = `urn:li:sponsoredCreative:${creativeId}`;
    const encodedUrn = encodeURIComponent(creativeUrn);
    
    console.log(`Fetching creative details for: ${creativeUrn}`);
    
    const response = await linkedinApiRequest(
      sessionId,
      `/adAccounts/${accountId}/creatives/${encodedUrn}`,
      {}
    );
    
    console.log(`Creative response:`, JSON.stringify(response, null, 2).substring(0, 1000));
    
    let contentDetails: any = {};
    
    if (response.content) {
      const content = response.content;
      console.log(`Content type: reference=${content.reference}, textAd=${!!content.textAd}, spotlight=${!!content.spotlight}`);
      
      if (content.reference) {
        const refParts = content.reference.split(':');
        const refType = refParts[2];
        
        if (refType === 'share' || refType === 'ugcPost') {
          try {
            const postsResponse = await linkedinApiRequest(
              sessionId,
              `/posts/${encodeURIComponent(content.reference)}`,
              {}
            );
            
            console.log(`Posts response:`, JSON.stringify(postsResponse, null, 2).substring(0, 1000));
            
            if (postsResponse) {
              const postContent = postsResponse.content || postsResponse.specificContent?.['com.linkedin.ugc.ShareContent'];
              const commentary = postsResponse.commentary || postsResponse.text?.text;
              
              contentDetails.headline = postContent?.title || postContent?.shareMediaCategory;
              contentDetails.description = commentary;
              contentDetails.callToAction = postContent?.shareMediaCallToAction?.callToAction?.localizedLabel;
              contentDetails.landingPageUrl = postContent?.shareMediaCallToAction?.callToAction?.url || postContent?.landingPageUrl;
              contentDetails.imageUrl = postContent?.media?.[0]?.originalUrl || postContent?.shareMedia?.[0]?.thumbnails?.[0]?.url;
              contentDetails.videoUrl = postContent?.media?.[0]?.originalUrl;
            }
          } catch (postErr: any) {
            console.warn('Failed to fetch post content:', postErr.response?.data || postErr.message);
          }
        }
      }
      
      if (content.textAd) {
        contentDetails.headline = content.textAd.headline;
        contentDetails.description = content.textAd.text;
        contentDetails.destinationUrl = content.textAd.destinationUrl;
        contentDetails.imageUrl = content.textAd.imageUrl;
      }
      
      if (content.spotlight) {
        contentDetails.headline = content.spotlight.headline;
        contentDetails.description = content.spotlight.description;
        contentDetails.callToAction = content.spotlight.callToAction;
        contentDetails.destinationUrl = content.spotlight.ctaLink;
        contentDetails.imageUrl = content.spotlight.logo || content.spotlight.backgroundImage;
      }
    }
    
    if (response.leadgenCallToAction) {
      contentDetails.callToAction = contentDetails.callToAction || response.leadgenCallToAction.buttonLabel;
      contentDetails.leadFormId = response.leadgenCallToAction.leadgenCreativeFormId;
      contentDetails.destinationUrl = contentDetails.destinationUrl || response.leadgenCallToAction.destinationUrl;
    }
    
    const result = {
      id: response.id,
      name: response.name,
      intendedStatus: response.intendedStatus,
      campaign: response.campaign,
      content: response.content,
      leadgenCallToAction: response.leadgenCallToAction,
      parsedContent: Object.keys(contentDetails).length > 0 ? contentDetails : null
    };
    
    console.log(`Returning creative result:`, JSON.stringify(result, null, 2));
    
    res.json(result);
  } catch (err: any) {
    console.error('Creative detail error:', err.response?.data || err.message);
    res.status(err.response?.status || 500).json({ 
      error: err.response?.data || err.message 
    });
  }
});

const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
});

app.post('/api/ai/audit', async (req, res) => {
  try {
    const { message, taggedEntities, accountId, isLiveData, accountData: clientAccountData, conversationHistory } = req.body;
    const sessionId = req.cookies.linkedinSession;
    
    let accountData: any = clientAccountData || null;
    
    if (!accountData && isLiveData && sessionId && sessions[sessionId]?.accessToken) {
      try {
        const hierarchyResponse = await axios.get(
          `http://localhost:${PORT}/api/linkedin/account/${accountId}/hierarchy?activeOnly=false`,
          { headers: { Cookie: `linkedinSession=${sessionId}` } }
        );
        accountData = hierarchyResponse.data;
      } catch (err: any) {
        console.warn('Failed to fetch account data for AI:', err.message);
      }
    }
    
    const formatCampaignDetails = (campaign: any, indent: string = '  ') => {
      let details = '';
      details += `${indent}Status: ${campaign.status}\n`;
      details += `${indent}Objective: ${campaign.objective || 'Not set'}\n`;
      details += `${indent}Daily Budget: ${campaign.dailyBudget || 'Not set'}\n`;
      details += `${indent}Bidding Strategy: ${campaign.biddingStrategy || 'Not set'}\n`;
      details += `${indent}Cost Type: ${campaign.costType || 'Not set'}\n`;
      
      if (campaign.targetingResolved) {
        const t = campaign.targetingResolved;
        details += `${indent}Targeting:\n`;
        if (t.geos?.length) details += `${indent}  Locations: ${t.geos.join(', ')}\n`;
        if (t.company?.industries?.length) details += `${indent}  Industries: ${t.company.industries.join(', ')}\n`;
        if (t.company?.sizes?.length) details += `${indent}  Company Sizes: ${t.company.sizes.join(', ')}\n`;
        if (t.company?.names?.length) details += `${indent}  Company Names: ${t.company.names.slice(0, 10).join(', ')}${t.company.names.length > 10 ? ` (+${t.company.names.length - 10} more)` : ''}\n`;
        if (t.jobExperience?.titles?.length) details += `${indent}  Job Titles: ${t.jobExperience.titles.slice(0, 10).join(', ')}${t.jobExperience.titles.length > 10 ? ` (+${t.jobExperience.titles.length - 10} more)` : ''}\n`;
        if (t.jobExperience?.functions?.length) details += `${indent}  Job Functions: ${t.jobExperience.functions.join(', ')}\n`;
        if (t.jobExperience?.seniorities?.length) details += `${indent}  Seniorities: ${t.jobExperience.seniorities.join(', ')}\n`;
        if (t.jobExperience?.skills?.length) details += `${indent}  Skills: ${t.jobExperience.skills.slice(0, 10).join(', ')}${t.jobExperience.skills.length > 10 ? ` (+${t.jobExperience.skills.length - 10} more)` : ''}\n`;
        if (t.demographics?.ages?.length) details += `${indent}  Age Ranges: ${t.demographics.ages.join(', ')}\n`;
        if (t.demographics?.genders?.length) details += `${indent}  Genders: ${t.demographics.genders.join(', ')}\n`;
        if (t.education?.degrees?.length) details += `${indent}  Degrees: ${t.education.degrees.join(', ')}\n`;
        if (t.education?.fieldsOfStudy?.length) details += `${indent}  Fields of Study: ${t.education.fieldsOfStudy.slice(0, 5).join(', ')}${t.education.fieldsOfStudy.length > 5 ? '...' : ''}\n`;
        if (t.audiences?.length) details += `${indent}  Audiences/Segments: ${t.audiences.join(', ')}\n`;
        if (t.companyLists?.length) details += `${indent}  Company Lists: ${t.companyLists.join(', ')}\n`;
        if (t.interestsTraits?.memberInterests?.length) details += `${indent}  Member Interests: ${t.interestsTraits.memberInterests.slice(0, 5).join(', ')}${t.interestsTraits.memberInterests.length > 5 ? '...' : ''}\n`;
      }
      
      if (campaign.children?.length > 0) {
        details += `${indent}Ads (${campaign.children.length}):\n`;
        campaign.children.forEach((ad: any) => {
          details += `${indent}  - "${ad.name || 'Unnamed Ad'}" (ID: ${ad.id}): Status=${ad.status}, Type=${ad.type || 'Unknown'}\n`;
        });
      }
      
      return details;
    };
    
    let entityContext = '';
    if (taggedEntities && taggedEntities.length > 0 && accountData) {
      entityContext = '\n\n=== TAGGED ENTITIES (User is asking specifically about these) ===\n';
      for (const entity of taggedEntities) {
        if (entity.type === 'group') {
          const group = accountData.groups?.find((g: any) => g.id === entity.id || g.name === entity.name);
          if (group) {
            entityContext += `\n### Campaign Group: "${group.name}" (ID: ${group.id})\n`;
            entityContext += `Status: ${group.status}\n`;
            entityContext += `Total Campaigns: ${group.children?.length || 0}\n`;
            
            if (group.children && group.children.length > 0) {
              entityContext += `\n--- All Campaigns in this Group ---\n`;
              group.children.forEach((campaign: any, idx: number) => {
                entityContext += `\n[Campaign ${idx + 1}] "${campaign.name}" (ID: ${campaign.id}):\n`;
                entityContext += formatCampaignDetails(campaign, '  ');
              });
            }
          }
        } else if (entity.type === 'campaign') {
          for (const group of accountData.groups || []) {
            const campaign = group.children?.find((c: any) => c.id === entity.id || c.name === entity.name);
            if (campaign) {
              entityContext += `\n### Campaign: "${campaign.name}" (ID: ${campaign.id})\n`;
              entityContext += `Part of Group: "${group.name}"\n`;
              entityContext += formatCampaignDetails(campaign, '');
              break;
            }
          }
        } else if (entity.type === 'creative') {
          for (const group of accountData.groups || []) {
            for (const campaign of group.children || []) {
              const ad = campaign.children?.find((a: any) => a.id === entity.id || a.name === entity.name);
              if (ad) {
                entityContext += `\n### Ad/Creative: "${ad.name || 'Unnamed'}" (ID: ${ad.id})\n`;
                entityContext += `Part of Campaign: "${campaign.name}" > Group: "${group.name}"\n`;
                entityContext += `Status: ${ad.status}\n`;
                entityContext += `Type: ${ad.type || 'Unknown'}\n`;
                break;
              }
            }
          }
        } else if (entity.type === 'audience') {
          const segment = accountData.segments?.find((s: any) => s.id === entity.id || s.name === entity.name);
          if (segment) {
            entityContext += `\n### Audience Segment: "${segment.name}" (ID: ${segment.id})\n`;
            entityContext += `Type: ${segment.type}\n`;
            entityContext += `Status: ${segment.status}\n`;
            if (segment.audienceCount) entityContext += `Size: ${segment.audienceCount.toLocaleString()} members\n`;
            if (segment.sourceCampaigns?.length) {
              entityContext += `Source Campaigns (building this audience): ${segment.sourceCampaigns.map((c: any) => c.name || c.id).join(', ')}\n`;
            }
          }
        }
      }
      entityContext += '\n=== END TAGGED ENTITIES ===\n';
    }
    
    let accountSummary = '';
    if (accountData) {
      const totalCampaigns = accountData.groups?.reduce((sum: number, g: any) => sum + (g.children?.length || 0), 0) || 0;
      const totalAds = accountData.groups?.reduce((sum: number, g: any) => 
        sum + (g.children?.reduce((s: number, c: any) => s + (c.children?.length || 0), 0) || 0), 0) || 0;
      const activeCampaigns = accountData.groups?.reduce((sum: number, g: any) => 
        sum + (g.children?.filter((c: any) => c.status === 'ACTIVE')?.length || 0), 0) || 0;
      
      accountSummary = `
Account Overview:
- Account ID: ${accountId}
- Currency: ${accountData.currency || 'Unknown'}
- Campaign Groups: ${accountData.groups?.length || 0}
- Total Campaigns: ${totalCampaigns} (${activeCampaigns} active)
- Total Ads: ${totalAds}
- Audience Segments: ${accountData.segments?.length || 0}

Campaign Groups:
${accountData.groups?.map((g: any) => `- ${g.name}: ${g.children?.length || 0} campaigns, Status: ${g.status}`).join('\n') || 'None'}
`;
    }
    
    const systemPrompt = `You are an AI Auditor for LinkedIn advertising campaigns. You help advertisers understand their campaign performance, targeting, and audiences.

${isLiveData ? 'You have access to LIVE data from the user\'s actual LinkedIn Ads account.' : 'The user is viewing DEMO data, not their actual account.'}

${accountSummary}
${entityContext}

Guidelines:
- Be concise and actionable in your responses
- When discussing metrics, provide context (e.g., "this CTR is above/below industry average")
- Suggest optimizations when you see opportunities
- If you don't have specific data, say so and suggest what the user could check
- Format your responses with clear headings and bullet points when appropriate
- Reference specific campaigns, groups, or audiences by name when relevant`;

    const messages: any[] = [
      { role: 'system', content: systemPrompt }
    ];
    
    if (conversationHistory && conversationHistory.length > 0) {
      messages.push(...conversationHistory);
    }
    
    messages.push({ role: 'user', content: message });
    
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    
    const stream = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      stream: true,
      max_tokens: 1000,
    });
    
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        res.write(content);
      }
    }
    
    res.end();
  } catch (err: any) {
    console.error('AI audit error:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Unable to process your request. Please try again.' });
    } else {
      res.end();
    }
  }
});

app.get('/api/linkedin/audit/status/:accountId', requireAuth, async (req, res) => {
  try {
    const { accountId } = req.params;
    const snapshot = await getSnapshot(accountId);
    
    if (!snapshot) {
      return res.json({ hasAudit: false });
    }
    
    res.json({
      hasAudit: true,
      status: snapshot.status,
      snapshotDate: snapshot.snapshot_date,
      expiresAt: snapshot.expires_at
    });
  } catch (err: any) {
    console.error('Audit status error:', err.message);
    res.status(500).json({ error: 'Failed to get audit status' });
  }
});

app.post('/api/linkedin/audit/run/:accountId', requireAuth, async (req, res) => {
  const sessionId = (req as any).sessionId;
  const { accountId } = req.params;
  const { accountName } = req.body;
  
  try {
    console.log(`Starting audit for account ${accountId} (${accountName})`);
    
    const snapshot = await createSnapshot(accountId, accountName || `Account ${accountId}`);
    
    res.json({ status: 'started', snapshotId: snapshot.id });
    
    (async () => {
      try {
        const accountUrn = `urn:li:sponsoredAccount:${accountId}`;
        
        const [groupsResponse, campaignsResponse, creativesResponse] = await Promise.all([
          linkedinApiRequest(sessionId, `/adAccounts/${accountId}/adCampaignGroups`, {}, 'q=search&search=(status:(values:List(ACTIVE,PAUSED,ARCHIVED,CANCELED,DRAFT,PENDING_DELETION,REMOVED)))'),
          linkedinApiRequest(sessionId, `/adAccounts/${accountId}/adCampaigns`, {}, 'q=search&search=(status:(values:List(ACTIVE,PAUSED,ARCHIVED,CANCELED,DRAFT,PENDING_DELETION,REMOVED)))'),
          linkedinApiRequest(sessionId, `/adAccounts/${accountId}/creatives`, {}, 'q=search')
        ]);
        
        const groups = groupsResponse.elements || [];
        const campaigns = campaignsResponse.elements || [];
        const creatives = creativesResponse.elements || [];
        
        console.log(`Audit data: ${groups.length} groups, ${campaigns.length} campaigns, ${creatives.length} creatives`);
        
        const extractId = (urn: string) => {
          const match = urn?.match(/:(\d+)$/);
          return match ? match[1] : urn;
        };
        
        const processedGroups = groups.map((g: any) => ({
          id: extractId(g.id),
          name: g.name || 'Unnamed Group',
          status: g.status || 'UNKNOWN'
        }));
        
        const processedCampaigns = campaigns.map((c: any) => ({
          id: extractId(c.id),
          groupId: extractId(c.campaignGroup),
          name: c.name || 'Unnamed Campaign',
          status: c.status || 'UNKNOWN',
          objectiveType: c.objectiveType,
          costType: c.costType,
          dailyBudget: c.dailyBudget?.amount ? parseFloat(c.dailyBudget.amount) / 100 : undefined,
          targetingCriteria: c.targetingCriteria
        }));
        
        const processedCreatives = creatives.map((c: any) => ({
          id: extractId(c.id),
          campaignId: extractId(c.campaign),
          name: c.name || `Creative ${extractId(c.id)}`,
          status: c.status || 'UNKNOWN',
          format: c.type || 'SPONSORED_UPDATE'
        }));
        
        await saveCampaignGroups(snapshot.id, accountId, processedGroups);
        await saveCampaigns(snapshot.id, accountId, processedCampaigns);
        await saveCreatives(snapshot.id, accountId, processedCreatives);
        
        const now = new Date();
        const currentStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const currentEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        const previousStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const previousEnd = new Date(now.getFullYear(), now.getMonth(), 0);
        
        const formatDate = (d: Date) => d.toISOString().split('T')[0];
        
        const activeCampaignIds = campaigns
          .filter((c: any) => c.status === 'ACTIVE')
          .map((c: any) => c.id)
          .slice(0, 20);
        
        if (activeCampaignIds.length > 0) {
          try {
            const campaignUrns = activeCampaignIds.map((id: string) => `urn:li:sponsoredCampaign:${extractId(id)}`);
            const campaignParam = encodeURIComponent(`List(${campaignUrns.join(',')})`);
            
            const [currentAnalytics, previousAnalytics] = await Promise.all([
              linkedinApiRequest(
                sessionId, 
                '/adAnalytics', 
                {}, 
                `q=analytics&pivot=CAMPAIGN&dateRange=(start:(year:${currentStart.getFullYear()},month:${currentStart.getMonth() + 1},day:1),end:(year:${currentEnd.getFullYear()},month:${currentEnd.getMonth() + 1},day:${currentEnd.getDate()}))&timeGranularity=ALL&campaigns=${campaignParam}`
              ).catch(() => ({ elements: [] })),
              linkedinApiRequest(
                sessionId, 
                '/adAnalytics', 
                {}, 
                `q=analytics&pivot=CAMPAIGN&dateRange=(start:(year:${previousStart.getFullYear()},month:${previousStart.getMonth() + 1},day:1),end:(year:${previousEnd.getFullYear()},month:${previousEnd.getMonth() + 1},day:${previousEnd.getDate()}))&timeGranularity=ALL&campaigns=${campaignParam}`
              ).catch(() => ({ elements: [] }))
            ]);
            
            const metricsToSave: any[] = [];
            
            for (const elem of (currentAnalytics.elements || [])) {
              const campaignUrn = elem.pivotValue || elem.campaign;
              const campaignId = extractId(campaignUrn);
              metricsToSave.push({
                campaignId,
                dateRange: 'current',
                impressions: elem.impressions || 0,
                clicks: elem.clicks || 0,
                spend: parseFloat(elem.costInLocalCurrency || elem.spend || '0'),
                conversions: elem.externalWebsiteConversions || 0,
                videoViews: elem.videoViews || 0,
                leads: elem.oneClickLeads || 0
              });
            }
            
            for (const elem of (previousAnalytics.elements || [])) {
              const campaignUrn = elem.pivotValue || elem.campaign;
              const campaignId = extractId(campaignUrn);
              metricsToSave.push({
                campaignId,
                dateRange: 'previous',
                impressions: elem.impressions || 0,
                clicks: elem.clicks || 0,
                spend: parseFloat(elem.costInLocalCurrency || elem.spend || '0'),
                conversions: elem.externalWebsiteConversions || 0,
                videoViews: elem.videoViews || 0,
                leads: elem.oneClickLeads || 0
              });
            }
            
            await saveMetrics(snapshot.id, accountId, metricsToSave);
            console.log(`Saved ${metricsToSave.length} metric records`);
          } catch (analyticsErr: any) {
            console.error('Analytics fetch error:', analyticsErr.message);
          }
        }
        
        const auditData = await getAuditData(accountId);
        if (auditData) {
          const recommendations = runAuditRules(
            auditData.groups,
            auditData.campaigns,
            auditData.creatives,
            auditData.metrics
          );
          
          await saveRecommendations(snapshot.id, accountId, recommendations);
          console.log(`Generated ${recommendations.length} recommendations`);
        }
        
        await updateSnapshotStatus(snapshot.id, 'complete');
        console.log(`Audit complete for account ${accountId}`);
        
      } catch (auditErr: any) {
        console.error('Audit processing error:', auditErr.message);
        await updateSnapshotStatus(snapshot.id, 'error');
      }
    })();
    
  } catch (err: any) {
    console.error('Audit start error:', err.message);
    res.status(500).json({ error: 'Failed to start audit' });
  }
});

app.get('/api/linkedin/audit/results/:accountId', requireAuth, async (req, res) => {
  try {
    const { accountId } = req.params;
    const auditData = await getAuditData(accountId);
    
    if (!auditData) {
      return res.status(404).json({ error: 'No audit data found' });
    }
    
    const score = calculateAccountScore(auditData.recommendations);
    
    res.json({
      snapshot: auditData.snapshot,
      groups: auditData.groups,
      campaigns: auditData.campaigns,
      creatives: auditData.creatives,
      metrics: auditData.metrics,
      recommendations: auditData.recommendations,
      score
    });
  } catch (err: any) {
    console.error('Audit results error:', err.message);
    res.status(500).json({ error: 'Failed to get audit results' });
  }
});

app.delete('/api/linkedin/audit/:accountId', requireAuth, async (req, res) => {
  try {
    const { accountId } = req.params;
    await deleteAuditData(accountId);
    res.json({ success: true });
  } catch (err: any) {
    console.error('Audit delete error:', err.message);
    res.status(500).json({ error: 'Failed to delete audit data' });
  }
});

// ========== NEW AUDIT SYNC ENDPOINTS ==========

// Check if account is opted into audit
app.get('/api/audit/account/:accountId', requireAuth, async (req, res) => {
  try {
    const { accountId } = req.params;
    const auditAccount = await getAuditAccount(accountId);
    
    if (!auditAccount) {
      return res.json({ optedIn: false });
    }
    
    const latestDate = await getLatestMetricsDate(accountId);
    
    res.json({
      optedIn: true,
      accountId: auditAccount.account_id,
      accountName: auditAccount.account_name,
      optedInAt: auditAccount.opted_in_at,
      lastSyncAt: auditAccount.last_sync_at,
      syncStatus: auditAccount.sync_status,
      syncError: auditAccount.sync_error,
      autoSyncEnabled: auditAccount.auto_sync_enabled,
      latestDataDate: latestDate
    });
  } catch (err: any) {
    console.error('Audit account status error:', err.message);
    res.status(500).json({ error: 'Failed to get audit account status' });
  }
});

// Staggered sync function - processes API calls with delays
async function runAuditSync(sessionId: string, accountId: string, accountName: string) {
  console.log(`\n=== Starting audit sync for account ${accountId} (${accountName}) ===`);
  
  await updateAuditAccountSyncStatus(accountId, 'syncing');
  
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  const extractId = (urn: any): string => {
    if (urn === null || urn === undefined) return '';
    const urnStr = String(urn);
    const match = urnStr.match(/:(\d+)$/);
    return match ? match[1] : urnStr;
  };
  
  try {
    // Step 1: Fetch campaigns (with delay before)
    console.log('Fetching campaigns...');
    await delay(200);
    const campaignsResponse = await linkedinApiRequest(
      sessionId, 
      `/adAccounts/${accountId}/adCampaigns`, 
      {}, 
      'q=search&search=(status:(values:List(ACTIVE,PAUSED,ARCHIVED,CANCELED,DRAFT)))'
    );
    const campaigns = campaignsResponse.elements || [];
    console.log(`Found ${campaigns.length} campaigns`);
    
    // Step 2: Fetch creatives (with delay) - using q=criteria approach for reliability
    console.log('Fetching creatives...');
    await delay(300);
    
    let creatives: any[] = [];
    
    // Fetch creatives in batches by campaign (more reliable than q=search)
    if (campaigns.length > 0) {
      // Ensure we have proper URN format for each campaign
      const campaignUrns = campaigns.map((c: any) => {
        const campaignId = c.id;
        // If it's already a URN, use it; otherwise construct one
        if (typeof campaignId === 'string' && campaignId.startsWith('urn:li:sponsoredCampaign:')) {
          return campaignId;
        }
        return `urn:li:sponsoredCampaign:${extractId(campaignId)}`;
      });
      const batchSize = 10;
      
      for (let i = 0; i < campaignUrns.length; i += batchSize) {
        const batch = campaignUrns.slice(i, i + batchSize);
        const campaignListEncoded = batch.map((urn: string) => encodeURIComponent(urn)).join(',');
        const rawQuery = `q=criteria&campaigns=List(${campaignListEncoded})&pageSize=100`;
        
        try {
          await delay(200);
          const response = await linkedinApiRequest(sessionId, `/adAccounts/${accountId}/creatives`, {}, rawQuery);
          if (response.elements && Array.isArray(response.elements)) {
            creatives.push(...response.elements);
          }
        } catch (err: any) {
          console.warn(`Creatives batch ${i}-${i + batchSize} fetch error:`, err.message);
        }
      }
    }
    
    console.log(`Found ${creatives.length} creatives`);
    
    // Step 3: Fetch analytics for the last 90 days (with delay)
    console.log('Fetching analytics...');
    await delay(300);
    
    const now = new Date();
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
    
    const accountUrn = `urn:li:sponsoredAccount:${accountId}`;
    const encodedAccountUrn = encodeURIComponent(accountUrn);
    
    // Fetch campaign-level analytics with daily granularity
    const campaignAnalyticsQuery = `q=analytics&pivot=CAMPAIGN&dateRange=(start:(year:${threeMonthsAgo.getFullYear()},month:${threeMonthsAgo.getMonth() + 1},day:1),end:(year:${now.getFullYear()},month:${now.getMonth() + 1},day:${now.getDate()}))&timeGranularity=DAILY&accounts=List(${encodedAccountUrn})&fields=impressions,clicks,costInLocalCurrency,externalWebsiteConversions,oneClickLeads,videoViews,averageDwellTime,dateRange,pivotValues`;
    
    let campaignAnalytics: any = { elements: [] };
    try {
      campaignAnalytics = await linkedinApiRequest(sessionId, '/adAnalytics', {}, campaignAnalyticsQuery);
      console.log(`Got ${campaignAnalytics.elements?.length || 0} campaign analytics rows`);
    } catch (err: any) {
      console.warn('Campaign analytics fetch error:', err.message);
    }
    
    // Step 4: Fetch creative-level analytics (with delay)
    await delay(300);
    const creativeAnalyticsQuery = `q=analytics&pivot=CREATIVE&dateRange=(start:(year:${threeMonthsAgo.getFullYear()},month:${threeMonthsAgo.getMonth() + 1},day:1),end:(year:${now.getFullYear()},month:${now.getMonth() + 1},day:${now.getDate()}))&timeGranularity=DAILY&accounts=List(${encodedAccountUrn})&fields=impressions,clicks,costInLocalCurrency,externalWebsiteConversions,oneClickLeads,videoViews,averageDwellTime,dateRange,pivotValues`;
    
    let creativeAnalytics: any = { elements: [] };
    try {
      creativeAnalytics = await linkedinApiRequest(sessionId, '/adAnalytics', {}, creativeAnalyticsQuery);
      console.log(`Got ${creativeAnalytics.elements?.length || 0} creative analytics rows`);
    } catch (err: any) {
      console.warn('Creative analytics fetch error:', err.message);
    }
    
    // Build campaign lookup map with settings
    const campaignMap = new Map<string, any>();
    for (const c of campaigns) {
      const id = extractId(c.id);
      const dailyBudget = c.dailyBudget?.amount ? parseFloat(c.dailyBudget.amount) / 100 : null;
      campaignMap.set(id, {
        name: c.name || `Campaign ${id}`,
        groupId: extractId(c.campaignGroup),
        status: c.status,
        dailyBudget,
        hasLan: c.audienceExpansionEnabled === true || c.offsiteDeliveryEnabled === true,
        hasExpansion: c.audienceExpansionEnabled === true
      });
    }
    
    // Build creative lookup map
    const creativeMap = new Map<string, any>();
    for (const c of creatives) {
      const id = extractId(c.id);
      creativeMap.set(id, {
        name: c.name || `Creative ${id}`,
        campaignId: extractId(c.campaign),
        status: c.status,
        type: c.type || 'SPONSORED_UPDATE'
      });
    }
    
    // Process and save campaign daily metrics
    const campaignMetrics: any[] = [];
    for (const elem of (campaignAnalytics.elements || [])) {
      const campaignId = elem.pivotValues?.[0] ? extractId(elem.pivotValues[0]) : null;
      if (!campaignId) continue;
      
      const dateRange = elem.dateRange?.start;
      if (!dateRange) continue;
      
      const metricDate = new Date(dateRange.year, dateRange.month - 1, dateRange.day);
      const campaignInfo = campaignMap.get(campaignId) || {};
      
      campaignMetrics.push({
        campaignId,
        campaignName: campaignInfo.name,
        campaignGroupId: campaignInfo.groupId,
        campaignStatus: campaignInfo.status,
        metricDate,
        impressions: elem.impressions || 0,
        clicks: elem.clicks || 0,
        spend: parseFloat(elem.costInLocalCurrency || '0'),
        conversions: elem.externalWebsiteConversions || 0,
        videoViews: elem.videoViews || 0,
        leads: elem.oneClickLeads || 0
      });
    }
    
    if (campaignMetrics.length > 0) {
      console.log(`Saving ${campaignMetrics.length} campaign daily metrics...`);
      await saveCampaignDailyMetrics(accountId, campaignMetrics);
    }
    
    // Process and save creative daily metrics
    const creativeMetrics: any[] = [];
    for (const elem of (creativeAnalytics.elements || [])) {
      const creativeId = elem.pivotValues?.[0] ? extractId(elem.pivotValues[0]) : null;
      if (!creativeId) continue;
      
      const dateRange = elem.dateRange?.start;
      if (!dateRange) continue;
      
      const metricDate = new Date(dateRange.year, dateRange.month - 1, dateRange.day);
      const creativeInfo = creativeMap.get(creativeId) || {};
      
      creativeMetrics.push({
        creativeId,
        creativeName: creativeInfo.name,
        campaignId: creativeInfo.campaignId,
        creativeStatus: creativeInfo.status,
        creativeType: creativeInfo.type,
        metricDate,
        impressions: elem.impressions || 0,
        clicks: elem.clicks || 0,
        spend: parseFloat(elem.costInLocalCurrency || '0'),
        conversions: elem.externalWebsiteConversions || 0,
        videoViews: elem.videoViews || 0,
        leads: elem.oneClickLeads || 0
      });
    }
    
    if (creativeMetrics.length > 0) {
      console.log(`Saving ${creativeMetrics.length} creative daily metrics...`);
      await saveCreativeDailyMetrics(accountId, creativeMetrics);
    }
    
    await updateAuditAccountSyncStatus(accountId, 'completed');
    console.log(`=== Audit sync completed for account ${accountId} ===\n`);
    
    return { success: true, campaignMetrics: campaignMetrics.length, creativeMetrics: creativeMetrics.length };
    
  } catch (err: any) {
    console.error(`Audit sync error for account ${accountId}:`, err.message);
    
    let errorMessage = err.message;
    if (err.message?.includes('Not authenticated') || err.message?.includes('401') || err.response?.status === 401) {
      errorMessage = 'LinkedIn connection expired - please reconnect your account';
    } else if (err.message?.includes('429') || err.response?.status === 429) {
      errorMessage = 'LinkedIn rate limit reached - please try again later';
    } else if (err.message?.includes('403') || err.response?.status === 403) {
      errorMessage = 'Access denied - check account permissions';
    }
    
    await updateAuditAccountSyncStatus(accountId, 'error', errorMessage);
    throw err;
  }
}

// Token-based version for background sync (session may be gone after response is sent)
async function runAuditSyncWithToken(accessToken: string, accountId: string, accountName: string) {
  console.log(`\n=== Starting audit sync for account ${accountId} (${accountName}) ===`);
  
  await updateAuditAccountSyncStatus(accountId, 'syncing');
  
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  const extractId = (urn: any): string => {
    if (urn === null || urn === undefined) return '';
    const urnStr = String(urn);
    const match = urnStr.match(/:(\d+)$/);
    return match ? match[1] : urnStr;
  };
  
  try {
    // Step 1: Fetch campaigns (with delay before)
    console.log('Fetching campaigns...');
    await delay(200);
    const campaignsResponse = await linkedinApiRequestWithToken(
      accessToken, 
      `/adAccounts/${accountId}/adCampaigns`, 
      {}, 
      'q=search&search=(status:(values:List(ACTIVE,PAUSED,ARCHIVED,CANCELED,DRAFT)))'
    );
    const campaigns = campaignsResponse.elements || [];
    console.log(`Found ${campaigns.length} campaigns`);
    
    // Step 2: Fetch creatives (with delay) - using q=criteria approach for reliability
    console.log('Fetching creatives...');
    await delay(300);
    
    let creatives: any[] = [];
    
    // Fetch creatives in batches by campaign (more reliable than q=search)
    if (campaigns.length > 0) {
      // Ensure we have proper URN format for each campaign
      const campaignUrns = campaigns.map((c: any) => {
        const campaignId = c.id;
        // If it's already a URN, use it; otherwise construct one
        if (typeof campaignId === 'string' && campaignId.startsWith('urn:li:sponsoredCampaign:')) {
          return campaignId;
        }
        return `urn:li:sponsoredCampaign:${extractId(campaignId)}`;
      });
      const batchSize = 10;
      
      for (let i = 0; i < campaignUrns.length; i += batchSize) {
        const batch = campaignUrns.slice(i, i + batchSize);
        const campaignListEncoded = batch.map((urn: string) => encodeURIComponent(urn)).join(',');
        const rawQuery = `q=criteria&campaigns=List(${campaignListEncoded})&pageSize=100`;
        
        try {
          await delay(200);
          const response = await linkedinApiRequestWithToken(accessToken, `/adAccounts/${accountId}/creatives`, {}, rawQuery);
          if (response.elements && Array.isArray(response.elements)) {
            creatives.push(...response.elements);
          }
        } catch (err: any) {
          console.warn(`Creatives batch ${i}-${i + batchSize} fetch error:`, err.message);
        }
      }
    }
    
    console.log(`Found ${creatives.length} creatives`);
    
    // Step 3: Fetch analytics for the last 90 days (with delay)
    console.log('Fetching analytics...');
    await delay(300);
    
    const now = new Date();
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
    
    const accountUrn = `urn:li:sponsoredAccount:${accountId}`;
    const encodedAccountUrn = encodeURIComponent(accountUrn);
    
    // Fetch campaign-level analytics with daily granularity
    const campaignAnalyticsQuery = `q=analytics&pivot=CAMPAIGN&dateRange=(start:(year:${threeMonthsAgo.getFullYear()},month:${threeMonthsAgo.getMonth() + 1},day:1),end:(year:${now.getFullYear()},month:${now.getMonth() + 1},day:${now.getDate()}))&timeGranularity=DAILY&accounts=List(${encodedAccountUrn})&fields=impressions,clicks,costInLocalCurrency,externalWebsiteConversions,oneClickLeads,videoViews,averageDwellTime,dateRange,pivotValues`;
    
    let campaignAnalytics: any = { elements: [] };
    try {
      campaignAnalytics = await linkedinApiRequestWithToken(accessToken, '/adAnalytics', {}, campaignAnalyticsQuery);
      console.log(`Got ${campaignAnalytics.elements?.length || 0} campaign analytics rows`);
    } catch (err: any) {
      console.warn('Campaign analytics fetch error:', err.message);
    }
    
    // Step 4: Fetch creative-level analytics (with delay)
    await delay(300);
    const creativeAnalyticsQuery = `q=analytics&pivot=CREATIVE&dateRange=(start:(year:${threeMonthsAgo.getFullYear()},month:${threeMonthsAgo.getMonth() + 1},day:1),end:(year:${now.getFullYear()},month:${now.getMonth() + 1},day:${now.getDate()}))&timeGranularity=DAILY&accounts=List(${encodedAccountUrn})&fields=impressions,clicks,costInLocalCurrency,externalWebsiteConversions,oneClickLeads,videoViews,averageDwellTime,dateRange,pivotValues`;
    
    let creativeAnalytics: any = { elements: [] };
    try {
      creativeAnalytics = await linkedinApiRequestWithToken(accessToken, '/adAnalytics', {}, creativeAnalyticsQuery);
      console.log(`Got ${creativeAnalytics.elements?.length || 0} creative analytics rows`);
    } catch (err: any) {
      console.warn('Creative analytics fetch error:', err.message);
    }
    
    // Build campaign lookup map with settings
    const campaignMap = new Map<string, any>();
    for (const c of campaigns) {
      const id = extractId(c.id);
      const dailyBudget = c.dailyBudget?.amount ? parseFloat(c.dailyBudget.amount) / 100 : null;
      campaignMap.set(id, {
        name: c.name || `Campaign ${id}`,
        groupId: extractId(c.campaignGroup),
        status: c.status,
        dailyBudget,
        hasLan: c.audienceExpansionEnabled === true || c.offsiteDeliveryEnabled === true,
        hasExpansion: c.audienceExpansionEnabled === true
      });
    }
    
    // Build creative lookup map
    const creativeMap = new Map<string, any>();
    for (const c of creatives) {
      const id = extractId(c.id);
      creativeMap.set(id, {
        name: c.name || `Creative ${id}`,
        campaignId: extractId(c.campaign),
        status: c.status,
        type: c.type || 'SPONSORED_UPDATE'
      });
    }
    
    // Process and save campaign daily metrics
    const campaignMetrics: any[] = [];
    for (const elem of (campaignAnalytics.elements || [])) {
      const campaignId = elem.pivotValues?.[0] ? extractId(elem.pivotValues[0]) : null;
      if (!campaignId) continue;
      
      const dateRange = elem.dateRange?.start;
      if (!dateRange) continue;
      
      const metricDate = new Date(dateRange.year, dateRange.month - 1, dateRange.day);
      const campaignInfo = campaignMap.get(campaignId) || {};
      
      campaignMetrics.push({
        campaignId,
        campaignName: campaignInfo.name,
        campaignGroupId: campaignInfo.groupId,
        campaignStatus: campaignInfo.status,
        metricDate,
        impressions: elem.impressions || 0,
        clicks: elem.clicks || 0,
        spend: parseFloat(elem.costInLocalCurrency || '0'),
        conversions: elem.externalWebsiteConversions || 0,
        videoViews: elem.videoViews || 0,
        leads: elem.oneClickLeads || 0
      });
    }
    
    if (campaignMetrics.length > 0) {
      console.log(`Saving ${campaignMetrics.length} campaign daily metrics...`);
      await saveCampaignDailyMetrics(accountId, campaignMetrics);
    }
    
    // Process and save creative daily metrics
    const creativeMetrics: any[] = [];
    for (const elem of (creativeAnalytics.elements || [])) {
      const creativeId = elem.pivotValues?.[0] ? extractId(elem.pivotValues[0]) : null;
      if (!creativeId) continue;
      
      const dateRange = elem.dateRange?.start;
      if (!dateRange) continue;
      
      const metricDate = new Date(dateRange.year, dateRange.month - 1, dateRange.day);
      const creativeInfo = creativeMap.get(creativeId) || {};
      
      creativeMetrics.push({
        creativeId,
        creativeName: creativeInfo.name,
        campaignId: creativeInfo.campaignId,
        creativeStatus: creativeInfo.status,
        creativeType: creativeInfo.type,
        metricDate,
        impressions: elem.impressions || 0,
        clicks: elem.clicks || 0,
        spend: parseFloat(elem.costInLocalCurrency || '0'),
        conversions: elem.externalWebsiteConversions || 0,
        videoViews: elem.videoViews || 0,
        leads: elem.oneClickLeads || 0
      });
    }
    
    if (creativeMetrics.length > 0) {
      console.log(`Saving ${creativeMetrics.length} creative daily metrics...`);
      await saveCreativeDailyMetrics(accountId, creativeMetrics);
    }
    
    await updateAuditAccountSyncStatus(accountId, 'completed');
    console.log(`=== Audit sync completed for account ${accountId} ===\n`);
    
    return { success: true, campaignMetrics: campaignMetrics.length, creativeMetrics: creativeMetrics.length };
    
  } catch (err: any) {
    console.error(`Audit sync error for account ${accountId}:`, err.message);
    
    let errorMessage = err.message;
    if (err.message?.includes('Not authenticated') || err.message?.includes('401') || err.response?.status === 401) {
      errorMessage = 'LinkedIn connection expired - please reconnect your account';
    } else if (err.message?.includes('429') || err.response?.status === 429) {
      errorMessage = 'LinkedIn rate limit reached - please try again later';
    } else if (err.message?.includes('403') || err.response?.status === 403) {
      errorMessage = 'Access denied - check account permissions';
    }
    
    await updateAuditAccountSyncStatus(accountId, 'error', errorMessage);
    throw err;
  }
}

// Start audit (opt-in and sync)
app.post('/api/audit/start/:accountId', requireAuth, async (req, res) => {
  const sessionId = (req as any).sessionId;
  const { accountId } = req.params;
  const { accountName } = req.body;
  
  // Capture access token BEFORE sending response (session may be cleaned up after response)
  const session = getSession(sessionId);
  const accessToken = session.accessToken;
  
  if (!accessToken) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  try {
    console.log(`[Audit] Start request for account ${accountId} (${accountName})`);
    
    // Opt in the account
    await optInAuditAccount(accountId, accountName || `Account ${accountId}`);
    console.log(`[Audit] Account ${accountId} opted in successfully`);
    
    // Send response immediately
    res.json({ status: 'started', message: 'Audit sync started' });
    
  } catch (err: any) {
    console.error('[Audit] Start error:', err.message);
    return res.status(500).json({ error: 'Failed to start audit' });
  }
  
  // Run sync after response - use captured accessToken
  console.log(`[Audit] Queuing background sync for account ${accountId}...`);
  process.nextTick(async () => {
    try {
      console.log(`[Audit] Background sync starting for ${accountId}...`);
      await runAuditSyncWithToken(accessToken, accountId, accountName || `Account ${accountId}`);
      console.log(`[Audit] Background sync completed for ${accountId}`);
    } catch (err: any) {
      console.error(`[Audit] Background sync error for ${accountId}:`, err.message);
    }
  });
});

// Refresh/resync audit data
app.post('/api/audit/refresh/:accountId', requireAuth, async (req, res) => {
  const sessionId = (req as any).sessionId;
  const { accountId } = req.params;
  
  // Capture access token BEFORE sending response
  const session = getSession(sessionId);
  const accessToken = session.accessToken;
  
  if (!accessToken) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  let accountName = '';
  try {
    const auditAccount = await getAuditAccount(accountId);
    if (!auditAccount) {
      return res.status(400).json({ error: 'Account not opted into audit' });
    }
    accountName = auditAccount.account_name;
    
    // Update status to syncing
    await updateAuditAccountSyncStatus(accountId, 'syncing');
    
    res.json({ status: 'started', message: 'Audit refresh started' });
      
  } catch (err: any) {
    console.error('[Audit] Refresh error:', err.message);
    return res.status(500).json({ error: 'Failed to refresh audit' });
  }
  
  // Run sync after response - use captured accessToken
  console.log(`[Audit] Queuing refresh sync for account ${accountId}...`);
  process.nextTick(async () => {
    try {
      console.log(`[Audit] Refresh sync starting for ${accountId}...`);
      await runAuditSyncWithToken(accessToken, accountId, accountName);
      console.log(`[Audit] Refresh sync completed for ${accountId}`);
    } catch (err: any) {
      console.error(`[Audit] Refresh sync error for ${accountId}:`, err.message);
    }
  });
});

// Get stored audit analytics data
app.get('/api/audit/data/:accountId', requireAuth, async (req, res) => {
  try {
    const sessionId = (req as any).sessionId;
    const { accountId } = req.params;
    const { startDate, endDate } = req.query;
    
    const auditAccount = await getAuditAccount(accountId);
    if (!auditAccount) {
      return res.status(404).json({ error: 'Account not opted into audit' });
    }
    
    // Default to last 90 days
    const end = endDate ? new Date(endDate as string) : new Date();
    const start = startDate ? new Date(startDate as string) : new Date(end.getFullYear(), end.getMonth() - 3, 1);
    
    const [campaignMetrics, creativeMetrics] = await Promise.all([
      getCampaignDailyMetrics(accountId, start, end),
      getCreativeDailyMetrics(accountId, start, end)
    ]);
    
    // Calculate previous week's spend for each campaign (last 7 days based on latest metric date)
    // Find the latest metric date in the dataset to anchor the 7-day window
    let latestMetricDate = new Date(0);
    for (const m of campaignMetrics) {
      const metricDate = new Date(m.metric_date);
      if (metricDate > latestMetricDate) {
        latestMetricDate = metricDate;
      }
    }
    
    // Use latest metric date as end of window (or today if no metrics)
    const windowEnd = latestMetricDate.getTime() > 0 ? latestMetricDate : new Date();
    const windowStart = new Date(windowEnd.getTime() - 7 * 24 * 60 * 60 * 1000);
    const weeklySpendByCampaign = new Map<string, number>();
    
    for (const m of campaignMetrics) {
      const metricDate = new Date(m.metric_date);
      if (metricDate >= windowStart && metricDate <= windowEnd) {
        const currentSpend = weeklySpendByCampaign.get(m.campaign_id) || 0;
        weeklySpendByCampaign.set(m.campaign_id, currentSpend + (parseFloat(m.spend) || 0));
      }
    }
    
    // Fetch live campaign settings for LAN/Expansion flags and budget
    let liveCampaignSettings = new Map<string, any>();
    try {
      const campaignsResponse = await linkedinApiRequest(
        sessionId, 
        `/adAccounts/${accountId}/adCampaigns`, 
        {}, 
        'q=search&search=(status:(values:List(ACTIVE,PAUSED)))'
      );
      for (const c of (campaignsResponse.elements || [])) {
        const id = c.id?.match(/:(\d+)$/)?.[1] || c.id;
        const dailyBudget = c.dailyBudget?.amount ? parseFloat(c.dailyBudget.amount) / 100 : null;
        liveCampaignSettings.set(id, {
          dailyBudget,
          hasLan: c.offsiteDeliveryEnabled === true,
          hasExpansion: c.audienceExpansionEnabled === true
        });
      }
    } catch (err: any) {
      console.warn('Could not fetch live campaign settings:', err.message);
    }
    
    // Aggregate metrics by campaign and month for the dashboard
    const campaignsByMonth = new Map<string, Map<string, any>>();
    const creativesByMonth = new Map<string, Map<string, any>>();
    
    for (const m of campaignMetrics) {
      const monthKey = `${m.metric_date.getFullYear()}-${String(m.metric_date.getMonth() + 1).padStart(2, '0')}`;
      if (!campaignsByMonth.has(monthKey)) {
        campaignsByMonth.set(monthKey, new Map());
      }
      const monthMap = campaignsByMonth.get(monthKey)!;
      
      if (!monthMap.has(m.campaign_id)) {
        monthMap.set(m.campaign_id, {
          campaignId: m.campaign_id,
          campaignName: m.campaign_name,
          campaignGroupId: m.campaign_group_id,
          campaignStatus: m.campaign_status,
          impressions: 0,
          clicks: 0,
          spend: 0,
          conversions: 0,
          videoViews: 0,
          leads: 0
        });
      }
      
      const agg = monthMap.get(m.campaign_id)!;
      agg.impressions += parseInt(m.impressions) || 0;
      agg.clicks += parseInt(m.clicks) || 0;
      agg.spend += parseFloat(m.spend) || 0;
      agg.conversions += parseInt(m.conversions) || 0;
      agg.videoViews += parseInt(m.video_views) || 0;
      agg.leads += parseInt(m.leads) || 0;
    }
    
    for (const m of creativeMetrics) {
      const monthKey = `${m.metric_date.getFullYear()}-${String(m.metric_date.getMonth() + 1).padStart(2, '0')}`;
      if (!creativesByMonth.has(monthKey)) {
        creativesByMonth.set(monthKey, new Map());
      }
      const monthMap = creativesByMonth.get(monthKey)!;
      
      if (!monthMap.has(m.creative_id)) {
        monthMap.set(m.creative_id, {
          creativeId: m.creative_id,
          creativeName: m.creative_name,
          campaignId: m.campaign_id,
          creativeStatus: m.creative_status,
          creativeType: m.creative_type,
          previewUrl: m.preview_url,
          impressions: 0,
          clicks: 0,
          spend: 0,
          conversions: 0,
          videoViews: 0,
          leads: 0
        });
      }
      
      const agg = monthMap.get(m.creative_id)!;
      agg.impressions += parseInt(m.impressions) || 0;
      agg.clicks += parseInt(m.clicks) || 0;
      agg.spend += parseFloat(m.spend) || 0;
      agg.conversions += parseInt(m.conversions) || 0;
      agg.videoViews += parseInt(m.video_views) || 0;
      agg.leads += parseInt(m.leads) || 0;
    }
    
    // Convert to response format
    const months = Array.from(campaignsByMonth.keys()).sort().reverse();
    const currentMonth = months[0];
    const previousMonth = months[1];
    
    // Build campaign name lookup
    const campaignNameLookup = new Map<string, string>();
    if (currentMonth) {
      for (const [campId, campData] of campaignsByMonth.get(currentMonth)!) {
        campaignNameLookup.set(campId, campData.campaignName || `Campaign ${campId}`);
      }
    }
    
    // Build alerts array
    const alerts: { type: 'budget' | 'penetration' | 'lan_expansion'; message: string; campaignId?: string; campaignName?: string; }[] = [];
    
    // Determine if any campaigns have LAN/Expansion (affects sync frequency)
    let hasLanOrExpansion = false;
    
    // Build campaigns in the expected format (CampaignItem)
    const campaigns = currentMonth ? Array.from(campaignsByMonth.get(currentMonth)!.values()).map(c => {
      const prev = previousMonth ? campaignsByMonth.get(previousMonth)?.get(c.campaignId) : null;
      const currentCtr = c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0;
      const prevCtr = prev && prev.impressions > 0 ? (prev.clicks / prev.impressions) * 100 : 0;
      const ctrChange = prevCtr > 0 ? ((currentCtr - prevCtr) / prevCtr) * 100 : 0;
      
      // Get live settings
      const liveSettings = liveCampaignSettings.get(c.campaignId) || {};
      const dailyBudget = liveSettings.dailyBudget;
      // Calculate budget utilization: actual previous week's spend vs daily budget × 7
      const weeklyBudget = dailyBudget && dailyBudget > 0 ? dailyBudget * 7 : 0;
      const actualWeeklySpend = weeklySpendByCampaign.get(c.campaignId) || 0;
      const budgetUtilization = weeklyBudget > 0 ? (actualWeeklySpend / weeklyBudget) * 100 : undefined;
      const hasLan = liveSettings.hasLan || false;
      const hasExpansion = liveSettings.hasExpansion || false;
      
      if (hasLan || hasExpansion) hasLanOrExpansion = true;
      
      // Determine issues
      const issues: string[] = [];
      if (ctrChange < -20) issues.push('CTR declined significantly');
      // Flag campaigns spending less than 80% of daily budget (not within 20% of target)
      if (budgetUtilization !== undefined && budgetUtilization < 80) {
        issues.push(`Low budget utilization (${budgetUtilization.toFixed(0)}% of budget) - bid may be too low, audience too small, or low relevancy`);
        alerts.push({ type: 'budget', message: `${c.campaignName} spending only ${budgetUtilization.toFixed(0)}% of budget - not reaching daily budget target`, campaignId: c.campaignId, campaignName: c.campaignName });
      }
      if (hasLan || hasExpansion) {
        alerts.push({ type: 'lan_expansion', message: `${c.campaignName} has ${hasLan ? 'LAN' : ''}${hasLan && hasExpansion ? ' and ' : ''}${hasExpansion ? 'Expansion' : ''} enabled`, campaignId: c.campaignId, campaignName: c.campaignName });
      }
      
      // Is performing well if CTR improved or stable with no major issues
      const isPerformingWell = ctrChange >= 0 && issues.length === 0;
      
      return {
        id: c.campaignId,
        name: c.campaignName,
        ctr: currentCtr,
        ctrChange,
        impressions: c.impressions,
        clicks: c.clicks,
        spend: c.spend,
        dailyBudget,
        budgetUtilization,
        hasLan,
        hasExpansion,
        isPerformingWell,
        issues
      };
    }) : [];
    
    // Build ads in the expected format (AdItem)
    const ads = currentMonth ? Array.from(creativesByMonth.get(currentMonth)!.values()).map(c => {
      const prev = previousMonth ? creativesByMonth.get(previousMonth)?.get(c.creativeId) : null;
      const currentCtr = c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0;
      const prevCtr = prev && prev.impressions > 0 ? (prev.clicks / prev.impressions) * 100 : 0;
      const ctrChange = prevCtr > 0 ? ((currentCtr - prevCtr) / prevCtr) * 100 : 0;
      
      // Determine issues
      const issues: string[] = [];
      if (currentCtr < 0.4) issues.push('CTR below 0.4%');
      if (ctrChange < -20) issues.push('CTR declined significantly');
      
      const isPerformingWell = ctrChange >= 0 && currentCtr >= 0.4;
      
      return {
        id: c.creativeId,
        name: c.creativeName || `Ad ${c.creativeId}`,
        campaignId: c.campaignId,
        campaignName: campaignNameLookup.get(c.campaignId) || `Campaign ${c.campaignId}`,
        ctr: currentCtr,
        ctrChange,
        impressions: c.impressions,
        clicks: c.clicks,
        isPerformingWell,
        issues
      };
    }) : [];
    
    // Determine sync frequency based on LAN/Expansion
    const syncFrequency = hasLanOrExpansion ? 'daily' : 'weekly';
    
    res.json({
      campaigns,
      ads,
      alerts,
      lastSyncAt: auditAccount.last_sync_at,
      syncFrequency
    });
    
  } catch (err: any) {
    console.error('Audit data error:', err.message);
    res.status(500).json({ error: 'Failed to get audit data' });
  }
});

// Remove account from audit
app.delete('/api/audit/account/:accountId', requireAuth, async (req, res) => {
  try {
    const { accountId } = req.params;
    await removeAuditAccount(accountId);
    res.json({ success: true });
  } catch (err: any) {
    console.error('Audit remove error:', err.message);
    res.status(500).json({ error: 'Failed to remove audit account' });
  }
});

// Nightly sync job for all opted-in accounts
async function runNightlyAuditSync() {
  console.log('\n=== Running nightly audit sync ===');
  
  const accounts = await getOptedInAccounts();
  console.log(`Found ${accounts.length} opted-in accounts`);
  
  for (const account of accounts) {
    // We need a valid session to make API calls
    // For nightly sync, we'd need to store refresh tokens or use a service account
    // For now, this is a placeholder - nightly sync would require stored credentials
    console.log(`Would sync account ${account.account_id} (${account.account_name})`);
    
    // Add 2 second delay between accounts
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log('=== Nightly sync complete ===\n');
}

// ========== END AUDIT SYNC ENDPOINTS ==========

app.post('/api/linkedin/ideate', async (req, res) => {
  try {
    const { prompt } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const systemPrompt = `You are a LinkedIn Ads campaign structure expert. Generate a campaign structure based on the user's request.

IMPORTANT: You must respond with ONLY valid JSON, no markdown formatting, no code blocks, just the raw JSON object.

The structure should follow LinkedIn's hierarchy:
- Campaign Groups (containers for campaigns)
- Campaigns (with objectives like Brand Awareness, Website Visits, Lead Generation, etc.)
- Ads (with formats like Image Ad, Video Ad, Carousel Ad, Document Ad, Lead Gen Form, Message Ad, etc.)

Default funnel structure (use unless user specifies otherwise):
1. Awareness stage - Brand Awareness or Engagement objective, Video/Image ads
2. Consideration stage - Website Visits objective, Carousel/Document ads
3. Activation stage - Lead Generation objective, Lead Gen Form/Message ads

Each campaign should have at least 3 ads.

Respond with a JSON object containing a "nodes" array. Each node should have:
- id: unique string
- type: "group" | "campaign" | "ad"
- name: descriptive name
- x: x position (groups at x=100, campaigns at x=450, ads at x=800)
- y: y position (spread vertically, ~280px between groups, ~70px between ads)
- parentId: parent node id (campaigns point to groups, ads point to campaigns)
- objective: (for campaigns) e.g., "Brand Awareness", "Website Visits", "Lead Generation"
- adFormat: (for ads) e.g., "Video Ad", "Image Ad", "Carousel Ad", "Lead Gen Form"

Example structure:
{
  "nodes": [
    {"id": "g1", "type": "group", "name": "Awareness Campaign Group", "x": 100, "y": 80, "objective": "Brand Awareness"},
    {"id": "c1", "type": "campaign", "name": "Awareness - Video", "x": 450, "y": 80, "parentId": "g1", "objective": "Brand Awareness"},
    {"id": "a1", "type": "ad", "name": "Ad 1", "x": 800, "y": 20, "parentId": "c1", "adFormat": "Video Ad"},
    {"id": "a2", "type": "ad", "name": "Ad 2", "x": 800, "y": 90, "parentId": "c1", "adFormat": "Image Ad"},
    {"id": "a3", "type": "ad", "name": "Ad 3", "x": 800, "y": 160, "parentId": "c1", "adFormat": "Carousel Ad"}
  ]
}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 2000,
    });

    const content = response.choices[0]?.message?.content || '';
    
    let parsed;
    try {
      const cleanedContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsed = JSON.parse(cleanedContent);
    } catch (parseErr) {
      console.error('Failed to parse AI response:', content);
      return res.status(500).json({ error: 'Failed to parse AI response', raw: content });
    }

    res.json(parsed);
  } catch (err: any) {
    console.error('Ideate error:', err.message);
    res.status(500).json({ error: 'Failed to generate campaign structure' });
  }
});

// Canvas CRUD endpoints
app.post('/api/canvas', async (req, res) => {
  try {
    const { title, accountId } = req.body;
    const session = (req as any).session;
    const ownerUserId = session?.userId || null;
    
    const canvas = await createCanvas(ownerUserId, accountId || null, title || 'Untitled Canvas');
    res.json(canvas);
  } catch (err: any) {
    console.error('Create canvas error:', err.message);
    res.status(500).json({ error: 'Failed to create canvas' });
  }
});

app.get('/api/canvas', async (req, res) => {
  try {
    const session = (req as any).session;
    const ownerUserId = session?.userId || null;
    const accountId = req.query.accountId as string | undefined;
    
    const canvases = await listCanvases(ownerUserId, accountId || null);
    res.json(canvases);
  } catch (err: any) {
    console.error('List canvases error:', err.message);
    res.status(500).json({ error: 'Failed to list canvases' });
  }
});

// IMPORTANT: This route must come BEFORE /api/canvas/:canvasId to avoid matching "share" as a canvasId
app.get('/api/canvas/share/:shareToken', async (req, res) => {
  try {
    const { shareToken } = req.params;
    const canvas = await getCanvasByShareToken(shareToken);
    
    if (!canvas) {
      return res.status(404).json({ error: 'Canvas not found' });
    }
    
    if (!canvas.is_public) {
      return res.status(403).json({ error: 'This canvas is not publicly shared' });
    }
    
    const latestVersion = await getLatestCanvasVersion(canvas.id);
    res.json({ 
      ...canvas, 
      nodes: latestVersion?.nodes || [],
      connections: latestVersion?.connections || [],
      settings: latestVersion?.settings || {},
      versionNumber: latestVersion?.version_number || 0,
      isSharedView: true
    });
  } catch (err: any) {
    console.error('Get shared canvas error:', err.message);
    res.status(500).json({ error: 'Failed to get shared canvas' });
  }
});

app.get('/api/canvas/:canvasId', async (req, res) => {
  try {
    const { canvasId } = req.params;
    const canvas = await getCanvas(canvasId);
    
    if (!canvas) {
      return res.status(404).json({ error: 'Canvas not found' });
    }
    
    const latestVersion = await getLatestCanvasVersion(canvasId);
    res.json({ 
      ...canvas, 
      nodes: latestVersion?.nodes || [],
      connections: latestVersion?.connections || [],
      settings: latestVersion?.settings || {},
      versionNumber: latestVersion?.version_number || 0
    });
  } catch (err: any) {
    console.error('Get canvas error:', err.message);
    res.status(500).json({ error: 'Failed to get canvas' });
  }
});

app.put('/api/canvas/:canvasId', async (req, res) => {
  try {
    const { canvasId } = req.params;
    const { title, is_public, allow_public_comments } = req.body;
    
    const canvas = await updateCanvas(canvasId, { title, is_public, allow_public_comments });
    
    if (!canvas) {
      return res.status(404).json({ error: 'Canvas not found' });
    }
    
    res.json(canvas);
  } catch (err: any) {
    console.error('Update canvas error:', err.message);
    res.status(500).json({ error: 'Failed to update canvas' });
  }
});

app.delete('/api/canvas/:canvasId', async (req, res) => {
  try {
    const { canvasId } = req.params;
    await deleteCanvas(canvasId);
    res.json({ success: true });
  } catch (err: any) {
    console.error('Delete canvas error:', err.message);
    res.status(500).json({ error: 'Failed to delete canvas' });
  }
});

app.post('/api/canvas/:canvasId/regenerate-token', async (req, res) => {
  try {
    const { canvasId } = req.params;
    const canvas = await regenerateShareToken(canvasId);
    
    if (!canvas) {
      return res.status(404).json({ error: 'Canvas not found' });
    }
    
    res.json(canvas);
  } catch (err: any) {
    console.error('Regenerate token error:', err.message);
    res.status(500).json({ error: 'Failed to regenerate share token' });
  }
});

// Canvas version endpoints
app.post('/api/canvas/:canvasId/save', async (req, res) => {
  try {
    const { canvasId } = req.params;
    const { nodes, connections, settings } = req.body;
    const session = (req as any).session;
    const userId = session?.userId || null;
    
    const version = await saveCanvasVersion(canvasId, nodes || [], connections || [], settings || {}, userId);
    res.json(version);
  } catch (err: any) {
    console.error('Save canvas version error:', err.message);
    res.status(500).json({ error: 'Failed to save canvas' });
  }
});

app.get('/api/canvas/:canvasId/versions', async (req, res) => {
  try {
    const { canvasId } = req.params;
    const limit = parseInt(req.query.limit as string) || 20;
    
    const versions = await getCanvasVersions(canvasId, limit);
    res.json(versions);
  } catch (err: any) {
    console.error('Get canvas versions error:', err.message);
    res.status(500).json({ error: 'Failed to get versions' });
  }
});

app.get('/api/canvas/:canvasId/version/:versionId', async (req, res) => {
  try {
    const { versionId } = req.params;
    const version = await getCanvasVersion(parseInt(versionId));
    
    if (!version) {
      return res.status(404).json({ error: 'Version not found' });
    }
    
    res.json(version);
  } catch (err: any) {
    console.error('Get canvas version error:', err.message);
    res.status(500).json({ error: 'Failed to get version' });
  }
});

// Canvas comment endpoints
app.post('/api/canvas/:canvasId/comments', async (req, res) => {
  try {
    const { canvasId } = req.params;
    const { content, nodeId, authorName } = req.body;
    const session = (req as any).session;
    const authorUserId = session?.userId || null;
    
    if (!content) {
      return res.status(400).json({ error: 'Comment content is required' });
    }
    
    const latestVersion = await getLatestCanvasVersion(canvasId);
    const comment = await addComment(
      canvasId,
      content,
      authorUserId,
      authorName || 'Anonymous',
      nodeId || null,
      latestVersion?.id || null
    );
    
    res.json(comment);
  } catch (err: any) {
    console.error('Add comment error:', err.message);
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

app.get('/api/canvas/:canvasId/comments', async (req, res) => {
  try {
    const { canvasId } = req.params;
    const comments = await getComments(canvasId);
    res.json(comments);
  } catch (err: any) {
    console.error('Get comments error:', err.message);
    res.status(500).json({ error: 'Failed to get comments' });
  }
});

app.put('/api/canvas/comments/:commentId/resolve', async (req, res) => {
  try {
    const { commentId } = req.params;
    const { resolved } = req.body;
    
    const comment = await resolveComment(parseInt(commentId), resolved !== false);
    
    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }
    
    res.json(comment);
  } catch (err: any) {
    console.error('Resolve comment error:', err.message);
    res.status(500).json({ error: 'Failed to resolve comment' });
  }
});

app.delete('/api/canvas/comments/:commentId', async (req, res) => {
  try {
    const { commentId } = req.params;
    await deleteComment(parseInt(commentId));
    res.json({ success: true });
  } catch (err: any) {
    console.error('Delete comment error:', err.message);
    res.status(500).json({ error: 'Failed to delete comment' });
  }
});

initDatabase()
  .then(async () => {
    const stuckSyncs = await markStuckSyncsAsError();
    if (stuckSyncs.length > 0) {
      console.log(`Marked ${stuckSyncs.length} stuck sync(s) as error - they can be retried via Refresh`);
    }
  })
  .catch(err => {
    console.error('Failed to initialize database:', err.message);
  });

if (isProduction) {
  const distPath = path.join(__dirname, '..', 'dist');
  app.use(express.static(distPath));
  
  app.get('/{*path}', (req, res) => {
    if (!req.path.startsWith('/api/')) {
      res.sendFile(path.join(distPath, 'index.html'));
    }
  });
}

const HOST = '0.0.0.0';
app.listen(PORT, HOST, () => {
  console.log(`LinkedIn API server running on http://${HOST}:${PORT}`);
});
