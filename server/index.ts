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
  getLatestMetricsDate,
  updateCampaignScoring,
  updateCreativeScoring,
  getStructureScoringData
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

// Allowed error codes (sanitized whitelist to prevent XSS)
const ALLOWED_ERROR_CODES: Record<string, string> = {
  'user_cancelled_authorize': 'Authorization was cancelled.',
  'user_cancelled_login': 'Login was cancelled.',
  'access_denied': 'Access was denied.',
  'no_code': 'No authorization code received.',
  'no_session': 'Session not found. Please try again.',
  'state_mismatch': 'Security validation failed. Please try again.',
  'token_exchange_failed': 'Failed to complete authentication. Please try again.',
  'unknown_error': 'An unexpected error occurred. Please try again.'
};

// Helper to send auth result via postMessage and close popup/tab
const sendAuthResultHtml = (success: boolean, errorCode?: string) => {
  // Sanitize error code - only allow known error codes
  const safeErrorCode = errorCode && ALLOWED_ERROR_CODES[errorCode] ? errorCode : 'unknown_error';
  const safeErrorMessage = ALLOWED_ERROR_CODES[safeErrorCode];
  
  const message = success 
    ? { type: 'LINKEDIN_AUTH_SUCCESS' }
    : { type: 'LINKEDIN_AUTH_ERROR', error: safeErrorCode };
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Authentication ${success ? 'Complete' : 'Failed'}</title>
      <style>
        body { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          display: flex; 
          justify-content: center; 
          align-items: center; 
          height: 100vh;
          margin: 0;
          background: #f3f4f6;
        }
        .container {
          text-align: center;
          background: white;
          padding: 2rem 3rem;
          border-radius: 12px;
          box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }
        .icon { font-size: 48px; margin-bottom: 16px; }
        h1 { margin: 0 0 8px; color: #111827; font-size: 24px; }
        p { margin: 0; color: #6b7280; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="icon">${success ? '✓' : '✗'}</div>
        <h1>${success ? 'Connected!' : 'Connection Failed'}</h1>
        <p>${success ? 'You can close this tab and return to the app.' : safeErrorMessage}</p>
      </div>
      <script>
        // Send message to opener window (works for popup or new tab)
        if (window.opener) {
          window.opener.postMessage(${JSON.stringify(message)}, window.location.origin);
          setTimeout(function() { window.close(); }, 1500);
        } else {
          // If no opener (direct navigation), redirect to main app
          setTimeout(function() { window.location.href = '/${success ? '?auth=success' : '?error=' + safeErrorCode}'; }, 1500);
        }
      </script>
    </body>
    </html>
  `;
};

app.get('/api/auth/callback', async (req, res) => {
  const sessionId = req.cookies?.session_id;
  const { code, state, error } = req.query;
  
  if (error) {
    return res.send(sendAuthResultHtml(false, error as string));
  }
  
  if (!code) {
    return res.send(sendAuthResultHtml(false, 'no_code'));
  }
  
  if (!sessionId) {
    return res.send(sendAuthResultHtml(false, 'no_session'));
  }
  
  const session = getSession(sessionId);
  
  if (!state || state !== session.state) {
    console.error('State mismatch:', { received: state, expected: session.state });
    return res.send(sendAuthResultHtml(false, 'state_mismatch'));
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
    
    res.send(sendAuthResultHtml(true));
  } catch (err: any) {
    console.error('Token exchange error:', err.response?.data || err.message);
    res.send(sendAuthResultHtml(false, 'token_exchange_failed'));
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
        'LinkedIn-Version': '202511',
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
    const { comparisonMode } = req.query;
    const sessionId = (req as any).sessionId;
    const mode = (comparisonMode as string) || 'rolling28';
    
    const now = new Date();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    let currentPeriodLabel: string;
    let previousPeriodLabel: string;
    let startDate: Date;
    let endDate: Date;
    let useDaily = false;
    
    if (mode === 'fullMonth') {
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const twoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      currentPeriodLabel = `${monthNames[lastMonth.getMonth()]} ${lastMonth.getFullYear()}`;
      previousPeriodLabel = `${monthNames[twoMonthsAgo.getMonth()]} ${twoMonthsAgo.getFullYear()}`;
      startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
      endDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else {
      currentPeriodLabel = 'Last 28 days';
      previousPeriodLabel = 'Previous 28 days';
      startDate = new Date(now.getTime() - 56 * 24 * 60 * 60 * 1000);
      endDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      useDaily = true;
    }
    
    const startYear = startDate.getFullYear();
    const startMonth = startDate.getMonth() + 1;
    const startDay = startDate.getDate();
    const endYear = endDate.getFullYear();
    const endMonth = endDate.getMonth() + 1;
    const endDay = endDate.getDate();
    
    const accountUrn = `urn:li:sponsoredAccount:${accountId}`;
    const encodedAccountUrn = encodeURIComponent(accountUrn);
    
    const timeGranularity = useDaily ? 'DAILY' : 'MONTHLY';
    const dateRangeQuery = `q=analytics&pivot=CAMPAIGN&dateRange=(start:(year:${startYear},month:${startMonth},day:${startDay}),end:(year:${endYear},month:${endMonth},day:${endDay}))&timeGranularity=${timeGranularity}&accounts=List(${encodedAccountUrn})&fields=impressions,clicks,costInLocalCurrency,externalWebsiteConversions,oneClickLeads,videoViews,pivotValues,dateRange`;
    
    console.log(`\n=== Fetching analytics for account ${accountId} (mode: ${mode}) ===`);
    console.log(`Date range: ${startMonth}/${startDay}/${startYear} to ${endMonth}/${endDay}/${endYear}`);
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
    
    const getElementDate = (element: any): Date | null => {
      if (element.dateRange?.start) {
        const { year, month, day } = element.dateRange.start;
        return new Date(year, month - 1, day || 1);
      }
      return null;
    };
    
    const currentByC: Record<string, any> = {};
    const prevByC: Record<string, any> = {};
    
    const addMetrics = (target: Record<string, any>, cId: string, metrics: any) => {
      if (!target[cId]) {
        target[cId] = { impressions: 0, clicks: 0, spend: 0, conversions: 0, leads: 0, videoViews: 0, landingPageClicks: 0 };
      }
      target[cId].impressions += metrics.impressions;
      target[cId].clicks += metrics.clicks;
      target[cId].spend += metrics.spend;
      target[cId].conversions += metrics.conversions;
      target[cId].leads += metrics.leads;
      target[cId].videoViews += metrics.videoViews;
      target[cId].landingPageClicks += metrics.landingPageClicks;
    };
    
    if (mode === 'fullMonth') {
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const twoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      const targetCurrentMonth = lastMonth.getMonth() + 1;
      const targetPrevMonth = twoMonthsAgo.getMonth() + 1;
      
      (analyticsData.elements || []).forEach((el: any) => {
        const cId = getCampaignId(el);
        const elDate = getElementDate(el);
        if (cId && elDate) {
          const elMonth = elDate.getMonth() + 1;
          if (elMonth === targetCurrentMonth) {
            currentByC[cId] = parseMetrics(el);
          } else if (elMonth === targetPrevMonth) {
            prevByC[cId] = parseMetrics(el);
          }
        }
      });
    } else {
      const currentPeriodEnd = new Date(now);
      const currentPeriodStart = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);
      const previousPeriodEnd = new Date(currentPeriodStart.getTime() - 1);
      const previousPeriodStart = new Date(currentPeriodStart.getTime() - 28 * 24 * 60 * 60 * 1000);
      
      (analyticsData.elements || []).forEach((el: any) => {
        const cId = getCampaignId(el);
        const elDate = getElementDate(el);
        if (cId && elDate) {
          if (elDate >= currentPeriodStart && elDate <= currentPeriodEnd) {
            addMetrics(currentByC, cId, parseMetrics(el));
          } else if (elDate >= previousPeriodStart && elDate <= previousPeriodEnd) {
            addMetrics(prevByC, cId, parseMetrics(el));
          }
        }
      });
    }
    
    console.log(`Current period campaigns: ${Object.keys(currentByC).length}`);
    console.log(`Previous period campaigns: ${Object.keys(prevByC).length}`);
    
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
    
    res.json({
      accountId,
      campaigns,
      currentMonthLabel: currentPeriodLabel,
      previousMonthLabel: previousPeriodLabel,
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

// Helper function to compute and save scoring status for Structure view caching
async function computeAndSaveScoringStatus(accountId: string, campaignMetrics: any[], creativeMetrics: any[]) {
  const pctChange = (current: number, previous: number): number => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  };
  
  const now = new Date();
  const currentPeriodEnd = now;
  const currentPeriodStart = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);
  const previousPeriodEnd = new Date(currentPeriodStart.getTime() - 1);
  const previousPeriodStart = new Date(currentPeriodStart.getTime() - 28 * 24 * 60 * 60 * 1000);
  
  // Aggregate campaign metrics
  const currentPeriodCampaigns = new Map<string, any>();
  const previousPeriodCampaigns = new Map<string, any>();
  
  for (const m of campaignMetrics) {
    const metricDate = new Date(m.metricDate);
    const campaignId = m.campaignId;
    
    const initCampaign = () => ({
      impressions: 0,
      clicks: 0,
      spend: 0,
      conversions: 0,
      activeDays: new Set<string>()
    });
    
    if (metricDate >= currentPeriodStart && metricDate <= currentPeriodEnd) {
      if (!currentPeriodCampaigns.has(campaignId)) {
        currentPeriodCampaigns.set(campaignId, initCampaign());
      }
      const c = currentPeriodCampaigns.get(campaignId)!;
      c.impressions += m.impressions || 0;
      c.clicks += m.clicks || 0;
      c.spend += parseFloat(m.spend) || 0;
      c.conversions += m.conversions || 0;
      c.activeDays.add(metricDate.toISOString().split('T')[0]);
    }
    
    if (metricDate >= previousPeriodStart && metricDate <= previousPeriodEnd) {
      if (!previousPeriodCampaigns.has(campaignId)) {
        previousPeriodCampaigns.set(campaignId, initCampaign());
      }
      const c = previousPeriodCampaigns.get(campaignId)!;
      c.impressions += m.impressions || 0;
      c.clicks += m.clicks || 0;
      c.spend += parseFloat(m.spend) || 0;
      c.conversions += m.conversions || 0;
      c.activeDays.add(metricDate.toISOString().split('T')[0]);
    }
  }
  
  // Calculate account averages
  let accountTotalClicks = 0, accountTotalSpend = 0;
  for (const [, c] of currentPeriodCampaigns) {
    accountTotalClicks += c.clicks;
    accountTotalSpend += c.spend;
  }
  const accountAvgCpc = accountTotalClicks > 0 ? accountTotalSpend / accountTotalClicks : 0;
  
  // Score and save campaigns
  for (const [campaignId, c] of currentPeriodCampaigns) {
    const prev = previousPeriodCampaigns.get(campaignId);
    const issues: string[] = [];
    const positiveSignals: string[] = [];
    let negativeScore = 0;
    let positiveScore = 0;
    
    // Low volume filter
    if (c.impressions < 1000 || c.spend < 20 || c.activeDays.size < 3) {
      await updateCampaignScoring(accountId, campaignId, 'low_volume', [], []);
      continue;
    }
    
    const ctr = c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0;
    const prevCtr = prev && prev.impressions > 0 ? (prev.clicks / prev.impressions) * 100 : 0;
    const cpc = c.clicks > 0 ? c.spend / c.clicks : 0;
    const prevCpc = prev && prev.clicks > 0 ? prev.spend / prev.clicks : 0;
    
    // CTR scoring
    if (prev && prevCtr > 0) {
      const ctrChange = pctChange(ctr, prevCtr);
      if (ctrChange < -20) {
        negativeScore -= 2;
        issues.push(`CTR down ${Math.abs(ctrChange).toFixed(0)}%`);
      } else if (ctrChange >= 20) {
        positiveScore += 1;
        positiveSignals.push(`CTR up ${ctrChange.toFixed(0)}%`);
      }
    }
    
    if (ctr < 0.3) {
      negativeScore -= 2;
      issues.push(`Low CTR (${ctr.toFixed(2)}%)`);
    } else if (ctr < 0.4) {
      negativeScore -= 1;
      issues.push(`CTR below 0.4%`);
    }
    
    // CPC scoring
    if (accountAvgCpc > 0 && cpc > 0) {
      const cpcVsAccount = ((cpc - accountAvgCpc) / accountAvgCpc) * 100;
      if (cpcVsAccount > 30) {
        negativeScore -= 2;
        issues.push(`CPC ${cpcVsAccount.toFixed(0)}% above avg`);
      } else if (cpcVsAccount > 15) {
        negativeScore -= 1;
        issues.push(`CPC ${cpcVsAccount.toFixed(0)}% above avg`);
      } else if (cpcVsAccount <= -10) {
        positiveScore += 1;
        positiveSignals.push(`CPC ${Math.abs(cpcVsAccount).toFixed(0)}% below avg`);
      }
    }
    
    if (prev && prevCpc > 0) {
      const cpcChange = pctChange(cpc, prevCpc);
      if (cpcChange > 25) {
        negativeScore -= 2;
        issues.push(`CPC up ${cpcChange.toFixed(0)}%`);
      } else if (cpcChange > 20) {
        negativeScore -= 1;
        issues.push(`CPC up ${cpcChange.toFixed(0)}%`);
      }
    }
    
    // Determine status
    const effectivePositive = Math.min(positiveScore, 2);
    const finalScore = negativeScore + effectivePositive;
    
    let scoringStatus: string;
    if (finalScore <= -3) {
      scoringStatus = 'needs_attention';
    } else if (finalScore < 0) {
      scoringStatus = 'mild_issues';
    } else {
      scoringStatus = 'performing_well';
    }
    
    await updateCampaignScoring(accountId, campaignId, scoringStatus, issues, positiveSignals);
  }
  
  // Score and save creatives
  const currentPeriodAds = new Map<string, any>();
  const previousPeriodAds = new Map<string, any>();
  
  for (const m of creativeMetrics) {
    const metricDate = new Date(m.metricDate);
    const creativeId = m.creativeId;
    const campaignId = m.campaignId;
    
    const initAd = () => ({
      campaignId,
      impressions: 0,
      clicks: 0,
      conversions: 0
    });
    
    if (metricDate >= currentPeriodStart && metricDate <= currentPeriodEnd) {
      if (!currentPeriodAds.has(creativeId)) {
        currentPeriodAds.set(creativeId, initAd());
      }
      const a = currentPeriodAds.get(creativeId)!;
      a.impressions += m.impressions || 0;
      a.clicks += m.clicks || 0;
      a.conversions += m.conversions || 0;
    }
    
    if (metricDate >= previousPeriodStart && metricDate <= previousPeriodEnd) {
      if (!previousPeriodAds.has(creativeId)) {
        previousPeriodAds.set(creativeId, initAd());
      }
      const a = previousPeriodAds.get(creativeId)!;
      a.impressions += m.impressions || 0;
      a.clicks += m.clicks || 0;
      a.conversions += m.conversions || 0;
    }
  }
  
  for (const [adId, a] of currentPeriodAds) {
    const prev = previousPeriodAds.get(adId);
    const issues: string[] = [];
    
    if (a.impressions < 500 || a.clicks < 10 || !prev || prev.impressions < 100) {
      await updateCreativeScoring(accountId, adId, 'insufficient_data', []);
      continue;
    }
    
    const ctr = a.impressions > 0 ? (a.clicks / a.impressions) * 100 : 0;
    const prevCtr = prev.impressions > 0 ? (prev.clicks / prev.impressions) * 100 : 0;
    
    if (prevCtr > 0) {
      const ctrChange = pctChange(ctr, prevCtr);
      if (ctrChange < -20) {
        issues.push(`CTR down ${Math.abs(ctrChange).toFixed(0)}%`);
      }
    }
    
    const scoringStatus = issues.length > 0 ? 'needs_attention' : 'performing_well';
    await updateCreativeScoring(accountId, adId, scoringStatus, issues);
  }
  
  console.log(`Saved scoring for ${currentPeriodCampaigns.size} campaigns and ${currentPeriodAds.size} ads`);
}

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
    // Note: audiencePenetration requires date range <= 92 days
    console.log('Fetching analytics...');
    await delay(300);
    
    const now = new Date();
    // Use exactly 90 days back to stay within 92-day limit for audiencePenetration
    const ninetyDaysAgo = new Date(now.getTime() - (90 * 24 * 60 * 60 * 1000));
    
    const accountUrn = `urn:li:sponsoredAccount:${accountId}`;
    const encodedAccountUrn = encodeURIComponent(accountUrn);
    
    // Fetch campaign-level analytics with daily granularity
    // Include approximateMemberReach, audiencePenetration for frequency/penetration scoring
    const campaignAnalyticsQuery = `q=analytics&pivot=CAMPAIGN&dateRange=(start:(year:${ninetyDaysAgo.getFullYear()},month:${ninetyDaysAgo.getMonth() + 1},day:${ninetyDaysAgo.getDate()}),end:(year:${now.getFullYear()},month:${now.getMonth() + 1},day:${now.getDate()}))&timeGranularity=DAILY&accounts=List(${encodedAccountUrn})&fields=impressions,clicks,costInLocalCurrency,externalWebsiteConversions,oneClickLeads,videoViews,averageDwellTime,approximateMemberReach,audiencePenetration,dateRange,pivotValues`;
    
    let campaignAnalytics: any = { elements: [] };
    try {
      campaignAnalytics = await linkedinApiRequest(sessionId, '/adAnalytics', {}, campaignAnalyticsQuery);
      console.log(`Got ${campaignAnalytics.elements?.length || 0} campaign analytics rows`);
      // Debug: Log first element to check if new metrics are returned
      if (campaignAnalytics.elements?.length > 0) {
        const sample = campaignAnalytics.elements[0];
        console.log('Sample analytics element fields:', {
          impressions: sample.impressions,
          clicks: sample.clicks,
          approximateMemberReach: sample.approximateMemberReach,
          audiencePenetration: sample.audiencePenetration,
          averageDwellTime: sample.averageDwellTime,
          allKeys: Object.keys(sample)
        });
      }
    } catch (err: any) {
      console.warn('Campaign analytics fetch error:', err.message);
    }
    
    // Step 4: Fetch TOTAL granularity analytics for cumulative penetration (28-day periods)
    // This gives us the true cumulative penetration that matches LinkedIn's Campaign Manager UI
    const current28End = new Date(now);
    const current28Start = new Date(now.getTime() - (28 * 24 * 60 * 60 * 1000));
    const prev28End = new Date(current28Start.getTime() - (1 * 24 * 60 * 60 * 1000));
    const prev28Start = new Date(prev28End.getTime() - (28 * 24 * 60 * 60 * 1000));
    
    // Current 28-day period - ALL granularity for cumulative penetration (replaces deprecated TOTAL)
    await delay(300);
    const currentPeriodQuery = `q=analytics&pivot=CAMPAIGN&dateRange=(start:(year:${current28Start.getFullYear()},month:${current28Start.getMonth() + 1},day:${current28Start.getDate()}),end:(year:${current28End.getFullYear()},month:${current28End.getMonth() + 1},day:${current28End.getDate()}))&timeGranularity=ALL&accounts=List(${encodedAccountUrn})&fields=impressions,audiencePenetration,approximateMemberReach,pivotValues`;
    
    let currentPeriodPenetration = new Map<string, { penetration: number | null, reach: number | null }>();
    try {
      const response = await linkedinApiRequest(sessionId, '/adAnalytics', {}, currentPeriodQuery);
      console.log(`Got ${response.elements?.length || 0} current period TOTAL analytics rows`);
      for (const elem of (response.elements || [])) {
        const campaignId = elem.pivotValues?.[0] ? extractId(elem.pivotValues[0]) : null;
        if (campaignId) {
          currentPeriodPenetration.set(campaignId, {
            penetration: elem.audiencePenetration || null,
            reach: elem.approximateMemberReach || null
          });
          // Debug log for first few
          if (currentPeriodPenetration.size <= 3) {
            console.log(`Campaign ${campaignId} TOTAL penetration: ${elem.audiencePenetration}, reach: ${elem.approximateMemberReach}`);
          }
        }
      }
    } catch (err: any) {
      console.warn('Current period TOTAL analytics fetch error:', err.message);
    }
    
    // Previous 28-day period - ALL granularity for MoM comparison (replaces deprecated TOTAL)
    await delay(300);
    const prevPeriodQuery = `q=analytics&pivot=CAMPAIGN&dateRange=(start:(year:${prev28Start.getFullYear()},month:${prev28Start.getMonth() + 1},day:${prev28Start.getDate()}),end:(year:${prev28End.getFullYear()},month:${prev28End.getMonth() + 1},day:${prev28End.getDate()}))&timeGranularity=ALL&accounts=List(${encodedAccountUrn})&fields=impressions,audiencePenetration,approximateMemberReach,pivotValues`;
    
    let prevPeriodPenetration = new Map<string, { penetration: number | null, reach: number | null }>();
    try {
      const response = await linkedinApiRequest(sessionId, '/adAnalytics', {}, prevPeriodQuery);
      console.log(`Got ${response.elements?.length || 0} previous period TOTAL analytics rows`);
      for (const elem of (response.elements || [])) {
        const campaignId = elem.pivotValues?.[0] ? extractId(elem.pivotValues[0]) : null;
        if (campaignId) {
          prevPeriodPenetration.set(campaignId, {
            penetration: elem.audiencePenetration || null,
            reach: elem.approximateMemberReach || null
          });
        }
      }
    } catch (err: any) {
      console.warn('Previous period TOTAL analytics fetch error:', err.message);
    }
    
    // Step 5: Fetch creative-level analytics (with delay)
    await delay(300);
    const creativeAnalyticsQuery = `q=analytics&pivot=CREATIVE&dateRange=(start:(year:${ninetyDaysAgo.getFullYear()},month:${ninetyDaysAgo.getMonth() + 1},day:${ninetyDaysAgo.getDate()}),end:(year:${now.getFullYear()},month:${now.getMonth() + 1},day:${now.getDate()}))&timeGranularity=DAILY&accounts=List(${encodedAccountUrn})&fields=impressions,clicks,costInLocalCurrency,externalWebsiteConversions,oneClickLeads,videoViews,averageDwellTime,approximateMemberReach,audiencePenetration,dateRange,pivotValues`;
    
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
        hasLan: c.offsiteDeliveryEnabled === true,
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
        leads: elem.oneClickLeads || 0,
        approximateMemberReach: elem.approximateMemberReach || null,
        audiencePenetration: elem.audiencePenetration || null,
        averageDwellTime: elem.averageDwellTime || null
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
    
    // Compute and save scoring status for Structure view caching
    console.log('Computing and saving scoring status...');
    await computeAndSaveScoringStatus(accountId, campaignMetrics, creativeMetrics);
    
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
    // Note: audiencePenetration requires date range <= 92 days
    console.log('Fetching analytics...');
    await delay(300);
    
    const now = new Date();
    // Use exactly 90 days back to stay within 92-day limit for audiencePenetration
    const ninetyDaysAgo = new Date(now.getTime() - (90 * 24 * 60 * 60 * 1000));
    
    const accountUrn = `urn:li:sponsoredAccount:${accountId}`;
    const encodedAccountUrn = encodeURIComponent(accountUrn);
    
    // Fetch campaign-level analytics with daily granularity
    // Include approximateMemberReach, audiencePenetration for frequency/penetration scoring
    const campaignAnalyticsQuery = `q=analytics&pivot=CAMPAIGN&dateRange=(start:(year:${ninetyDaysAgo.getFullYear()},month:${ninetyDaysAgo.getMonth() + 1},day:${ninetyDaysAgo.getDate()}),end:(year:${now.getFullYear()},month:${now.getMonth() + 1},day:${now.getDate()}))&timeGranularity=DAILY&accounts=List(${encodedAccountUrn})&fields=impressions,clicks,costInLocalCurrency,externalWebsiteConversions,oneClickLeads,videoViews,averageDwellTime,approximateMemberReach,audiencePenetration,dateRange,pivotValues`;
    
    let campaignAnalytics: any = { elements: [] };
    try {
      campaignAnalytics = await linkedinApiRequestWithToken(accessToken, '/adAnalytics', {}, campaignAnalyticsQuery);
      console.log(`Got ${campaignAnalytics.elements?.length || 0} campaign analytics rows`);
      // Debug: Log first element to check if new metrics are returned
      if (campaignAnalytics.elements?.length > 0) {
        const sample = campaignAnalytics.elements[0];
        console.log('DEBUG Sample analytics element:', {
          impressions: sample.impressions,
          clicks: sample.clicks,
          approximateMemberReach: sample.approximateMemberReach,
          audiencePenetration: sample.audiencePenetration,
          averageDwellTime: sample.averageDwellTime,
          allKeys: Object.keys(sample)
        });
      }
    } catch (err: any) {
      console.warn('Campaign analytics fetch error:', err.message);
    }
    
    // Step 4: Fetch creative-level analytics (with delay)
    await delay(300);
    const creativeAnalyticsQuery = `q=analytics&pivot=CREATIVE&dateRange=(start:(year:${ninetyDaysAgo.getFullYear()},month:${ninetyDaysAgo.getMonth() + 1},day:${ninetyDaysAgo.getDate()}),end:(year:${now.getFullYear()},month:${now.getMonth() + 1},day:${now.getDate()}))&timeGranularity=DAILY&accounts=List(${encodedAccountUrn})&fields=impressions,clicks,costInLocalCurrency,externalWebsiteConversions,oneClickLeads,videoViews,averageDwellTime,approximateMemberReach,audiencePenetration,dateRange,pivotValues`;
    
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
        hasLan: c.offsiteDeliveryEnabled === true,
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
        leads: elem.oneClickLeads || 0,
        approximateMemberReach: elem.approximateMemberReach || null,
        audiencePenetration: elem.audiencePenetration || null,
        averageDwellTime: elem.averageDwellTime || null
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
    
    // Compute and save scoring status for Structure view caching
    console.log('Computing and saving scoring status...');
    await computeAndSaveScoringStatus(accountId, campaignMetrics, creativeMetrics);
    
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
  // Helper to extract numeric ID from URN
  const extractId = (urn: any): string => {
    if (urn === null || urn === undefined) return '';
    const urnStr = String(urn);
    const match = urnStr.match(/:(\d+)$/);
    return match ? match[1] : urnStr;
  };
  
  try {
    const sessionId = (req as any).sessionId;
    const { accountId } = req.params;
    const { startDate, endDate, comparisonMode } = req.query;
    
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
    
    // Determine comparison periods based on mode
    const mode = (comparisonMode as string) || 'rolling28';
    const now = new Date();
    
    let currentPeriodStart: Date;
    let currentPeriodEnd: Date;
    let previousPeriodStart: Date;
    let previousPeriodEnd: Date;
    
    if (mode === 'fullMonth') {
      // Full month comparison: last complete month vs month before
      // Last complete month
      currentPeriodEnd = new Date(now.getFullYear(), now.getMonth(), 0); // Last day of previous month
      currentPeriodStart = new Date(now.getFullYear(), now.getMonth() - 1, 1); // First day of previous month
      // Month before that
      previousPeriodEnd = new Date(now.getFullYear(), now.getMonth() - 1, 0); // Last day of 2 months ago
      previousPeriodStart = new Date(now.getFullYear(), now.getMonth() - 2, 1); // First day of 2 months ago
    } else {
      // Rolling 28 days (default): last 28 days vs previous 28 days
      currentPeriodEnd = new Date(now);
      currentPeriodStart = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);
      previousPeriodEnd = new Date(currentPeriodStart.getTime() - 1); // Day before current period
      previousPeriodStart = new Date(currentPeriodStart.getTime() - 28 * 24 * 60 * 60 * 1000);
    }
    
    // Calculate current and previous week's spend for each campaign (for budget alerts)
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
    const currentWeekStart = new Date(windowEnd.getTime() - 7 * 24 * 60 * 60 * 1000);
    const previousWeekStart = new Date(windowEnd.getTime() - 14 * 24 * 60 * 60 * 1000);
    // WoW metrics by campaign
    const currentWeekByCampaign = new Map<string, { spend: number; impressions: number; clicks: number; conversions: number; days: Set<string>; dwellTimeSum: number; dwellTimeCount: number }>();
    const previousWeekByCampaign = new Map<string, { spend: number; impressions: number; clicks: number; conversions: number; days: Set<string>; dwellTimeSum: number; dwellTimeCount: number }>();
    
    const initWeekMetrics = () => ({ spend: 0, impressions: 0, clicks: 0, conversions: 0, days: new Set<string>(), dwellTimeSum: 0, dwellTimeCount: 0 });
    
    for (const m of campaignMetrics) {
      const metricDate = new Date(m.metric_date);
      const dateKey = metricDate.toISOString().split('T')[0];
      const spend = parseFloat(m.spend) || 0;
      const impressions = parseInt(m.impressions) || 0;
      const clicks = parseInt(m.clicks) || 0;
      const conversions = parseInt(m.conversions) || 0;
      // Normalize campaign ID to numeric string (extract from URN if needed)
      const weekCampaignKey = extractId(m.campaign_id);
      
      // Current week (last 7 days)
      if (metricDate >= currentWeekStart && metricDate <= windowEnd) {
        if (!currentWeekByCampaign.has(weekCampaignKey)) {
          currentWeekByCampaign.set(weekCampaignKey, initWeekMetrics());
        }
        const curr = currentWeekByCampaign.get(weekCampaignKey)!;
        curr.spend += spend;
        curr.impressions += impressions;
        curr.clicks += clicks;
        curr.conversions += conversions;
        curr.days.add(dateKey);
        // Track dwell time for WoW
        if (m.average_dwell_time !== null && m.average_dwell_time !== undefined && impressions > 0) {
          curr.dwellTimeSum += (parseFloat(m.average_dwell_time) || 0) * impressions;
          curr.dwellTimeCount += impressions;
        }
      }
      // Previous week (8-14 days ago)
      if (metricDate >= previousWeekStart && metricDate < currentWeekStart) {
        if (!previousWeekByCampaign.has(weekCampaignKey)) {
          previousWeekByCampaign.set(weekCampaignKey, initWeekMetrics());
        }
        const prev = previousWeekByCampaign.get(weekCampaignKey)!;
        prev.spend += spend;
        prev.impressions += impressions;
        prev.clicks += clicks;
        prev.conversions += conversions;
        prev.days.add(dateKey);
        // Track dwell time for WoW
        if (m.average_dwell_time !== null && m.average_dwell_time !== undefined && impressions > 0) {
          prev.dwellTimeSum += (parseFloat(m.average_dwell_time) || 0) * impressions;
          prev.dwellTimeCount += impressions;
        }
      }
    }
    
    // For backward compatibility
    const currentWeekSpendByCampaign = new Map<string, number>();
    const previousWeekSpendByCampaign = new Map<string, number>();
    const currentWeekDaysByCampaign = new Map<string, Set<string>>();
    const previousWeekDaysByCampaign = new Map<string, Set<string>>();
    
    for (const [cid, data] of currentWeekByCampaign) {
      currentWeekSpendByCampaign.set(cid, data.spend);
      currentWeekDaysByCampaign.set(cid, data.days);
    }
    for (const [cid, data] of previousWeekByCampaign) {
      previousWeekSpendByCampaign.set(cid, data.spend);
      previousWeekDaysByCampaign.set(cid, data.days);
    }
    
    // Keep old variable for backward compatibility
    const weeklySpendByCampaign = currentWeekSpendByCampaign;
    
    // Fetch live campaign settings for LAN/Expansion flags, budget, and reach data
    let liveCampaignSettings = new Map<string, any>();
    try {
      const campaignsResponse = await linkedinApiRequest(
        sessionId, 
        `/adAccounts/${accountId}/adCampaigns`, 
        {}, 
        'q=search&search=(status:(values:List(ACTIVE,PAUSED)))'
      );
      for (const c of (campaignsResponse.elements || [])) {
        // c.id might be a number or URN string - handle both cases
        const idStr = String(c.id || '');
        const id = idStr.match(/:(\d+)$/)?.[1] || idStr;
        const rawBudget = c.dailyBudget?.amount;
        const dailyBudget = rawBudget ? parseFloat(rawBudget) / 100 : null;
        // Debug: Log raw budget from API
        if (rawBudget) {
          console.log(`[Budget API] Campaign ${id}: rawAmount=${rawBudget}, parsed=${dailyBudget}`);
        }
        liveCampaignSettings.set(id, {
          dailyBudget,
          hasLan: c.offsiteDeliveryEnabled === true,
          hasExpansion: c.audienceExpansionEnabled === true,
          hasMaximizeDelivery: c.pacingStrategy === 'ACCELERATED',
          status: c.status,
          runSchedule: c.runSchedule,
          // New fields for advanced metrics
          audiencePenetration: c.audiencePenetration || null,
          approximateMemberReach: c.approximateMemberReach || null
        });
      }
    } catch (err: any) {
      console.warn('Could not fetch live campaign settings:', err.message);
    }
    
    // Fetch TOTAL granularity analytics for cumulative penetration (matches LinkedIn Campaign Manager)
    const accountUrn = `urn:li:sponsoredAccount:${accountId}`;
    const encodedAccountUrn = encodeURIComponent(accountUrn);
    
    // Maps to store cumulative penetration from TOTAL granularity API calls
    let currentPeriodPenetration = new Map<string, { penetration: number | null, reach: number | null }>();
    let prevPeriodPenetration = new Map<string, { penetration: number | null, reach: number | null }>();
    
    try {
      // Current 28-day period - ALL granularity for cumulative penetration (replaces deprecated TOTAL)
      const currentPeriodQuery = `q=analytics&pivot=CAMPAIGN&dateRange=(start:(year:${currentPeriodStart.getFullYear()},month:${currentPeriodStart.getMonth() + 1},day:${currentPeriodStart.getDate()}),end:(year:${currentPeriodEnd.getFullYear()},month:${currentPeriodEnd.getMonth() + 1},day:${currentPeriodEnd.getDate()}))&timeGranularity=ALL&accounts=List(${encodedAccountUrn})&fields=impressions,audiencePenetration,approximateMemberReach,pivotValues`;
      
      console.log(`[Audit] ALL query current period:`, currentPeriodQuery);
      console.log(`[Audit] Date range: ${currentPeriodStart.toISOString()} to ${currentPeriodEnd.toISOString()}`);
      
      const response = await linkedinApiRequest(sessionId, '/adAnalytics', {}, currentPeriodQuery);
      console.log(`[Audit] Got ${response.elements?.length || 0} current period TOTAL analytics rows`);
      
      // Log raw first element to see exact field names
      if (response.elements?.[0]) {
        console.log(`[Audit] Raw TOTAL element sample:`, JSON.stringify(response.elements[0], null, 2));
      }
      
      for (const elem of (response.elements || [])) {
        const campaignId = elem.pivotValues?.[0] ? extractId(elem.pivotValues[0]) : null;
        if (campaignId) {
          // Use explicit null checks instead of falsy || operator (0 is valid)
          const penetrationValue = elem.audiencePenetration !== null && elem.audiencePenetration !== undefined 
            ? elem.audiencePenetration : null;
          const reachValue = elem.approximateMemberReach !== null && elem.approximateMemberReach !== undefined 
            ? elem.approximateMemberReach : null;
          
          currentPeriodPenetration.set(campaignId, {
            penetration: penetrationValue,
            reach: reachValue
          });
          // Debug log for first few
          if (currentPeriodPenetration.size <= 3) {
            console.log(`[Audit] Campaign ${campaignId} TOTAL penetration: ${penetrationValue}, reach: ${reachValue}`);
          }
        }
      }
      
      // Previous 28-day period - ALL granularity for MoM comparison (replaces deprecated TOTAL)
      const prevPeriodQuery = `q=analytics&pivot=CAMPAIGN&dateRange=(start:(year:${previousPeriodStart.getFullYear()},month:${previousPeriodStart.getMonth() + 1},day:${previousPeriodStart.getDate()}),end:(year:${previousPeriodEnd.getFullYear()},month:${previousPeriodEnd.getMonth() + 1},day:${previousPeriodEnd.getDate()}))&timeGranularity=ALL&accounts=List(${encodedAccountUrn})&fields=impressions,audiencePenetration,approximateMemberReach,pivotValues`;
      
      const prevResponse = await linkedinApiRequest(sessionId, '/adAnalytics', {}, prevPeriodQuery);
      console.log(`[Audit] Got ${prevResponse.elements?.length || 0} previous period TOTAL analytics rows`);
      for (const elem of (prevResponse.elements || [])) {
        const campaignId = elem.pivotValues?.[0] ? extractId(elem.pivotValues[0]) : null;
        if (campaignId) {
          // Use explicit null checks instead of falsy || operator
          const penetrationValue = elem.audiencePenetration !== null && elem.audiencePenetration !== undefined 
            ? elem.audiencePenetration : null;
          const reachValue = elem.approximateMemberReach !== null && elem.approximateMemberReach !== undefined 
            ? elem.approximateMemberReach : null;
          
          prevPeriodPenetration.set(campaignId, {
            penetration: penetrationValue,
            reach: reachValue
          });
        }
      }
      
      // Log map sizes and sample keys for debugging
      console.log(`[Audit] Penetration maps populated: current=${currentPeriodPenetration.size}, prev=${prevPeriodPenetration.size}`);
      if (currentPeriodPenetration.size > 0) {
        const sampleKeys = Array.from(currentPeriodPenetration.keys()).slice(0, 3);
        console.log(`[Audit] Sample penetration map keys: ${sampleKeys.join(', ')}`);
      }
    } catch (err: any) {
      console.warn('[Audit] Could not fetch TOTAL granularity penetration:', err.message);
      if (err.response?.data) {
        console.warn('[Audit] TOTAL API error details:', JSON.stringify(err.response.data, null, 2));
      }
    }
    
    // Calculate account-level averages for cost efficiency comparison
    let accountAvgCpc = 0;
    let accountAvgCpm = 0;
    let accountAvgCpa = 0;
    let accountTotalClicks = 0;
    let accountTotalImpressions = 0;
    let accountTotalSpend = 0;
    let accountTotalConversions = 0;
    
    // Aggregate metrics by campaign for current and previous periods
    const currentPeriodCampaigns = new Map<string, any>();
    const previousPeriodCampaigns = new Map<string, any>();
    const currentPeriodCreatives = new Map<string, any>();
    const previousPeriodCreatives = new Map<string, any>();
    
    for (const m of campaignMetrics) {
      const metricDate = new Date(m.metric_date);
      
      // Determine which period this metric belongs to
      let targetMap: Map<string, any> | null = null;
      if (metricDate >= currentPeriodStart && metricDate <= currentPeriodEnd) {
        targetMap = currentPeriodCampaigns;
      } else if (metricDate >= previousPeriodStart && metricDate <= previousPeriodEnd) {
        targetMap = previousPeriodCampaigns;
      }
      
      if (!targetMap) continue;
      
      // Normalize campaign ID to numeric string (extract from URN if needed)
      const campaignIdKey = extractId(m.campaign_id);
      if (!targetMap.has(campaignIdKey)) {
        targetMap.set(campaignIdKey, {
          campaignId: campaignIdKey,
          campaignName: m.campaign_name,
          campaignGroupId: m.campaign_group_id,
          campaignStatus: m.campaign_status,
          impressions: 0,
          clicks: 0,
          spend: 0,
          conversions: 0,
          videoViews: 0,
          leads: 0,
          approximateMemberReach: 0,
          audiencePenetrationMax: 0,
          averageDwellTimeSum: 0,
          averageDwellTimeCount: 0,
          activeDays: 0
        });
      }
      
      const agg = targetMap.get(campaignIdKey)!;
      agg.impressions += parseInt(m.impressions) || 0;
      agg.clicks += parseInt(m.clicks) || 0;
      agg.spend += parseFloat(m.spend) || 0;
      agg.conversions += parseInt(m.conversions) || 0;
      agg.videoViews += parseInt(m.video_views) || 0;
      agg.leads += parseInt(m.leads) || 0;
      agg.activeDays += 1;
      
      // Track reach for frequency calculation (sum unique members)
      if (m.approximate_member_reach) {
        agg.approximateMemberReach += parseInt(m.approximate_member_reach) || 0;
      }
      // Track audience penetration (take MAX value - it's cumulative)
      if (m.audience_penetration !== null && m.audience_penetration !== undefined) {
        const penetrationValue = parseFloat(m.audience_penetration) || 0;
        if (penetrationValue > agg.audiencePenetrationMax) {
          agg.audiencePenetrationMax = penetrationValue;
        }
      }
      // Track average dwell time (weighted by impressions)
      if (m.average_dwell_time !== null && m.average_dwell_time !== undefined && m.impressions > 0) {
        agg.averageDwellTimeSum += (parseFloat(m.average_dwell_time) || 0) * (parseInt(m.impressions) || 0);
        agg.averageDwellTimeCount += parseInt(m.impressions) || 0;
      }
    }
    
    for (const m of creativeMetrics) {
      const metricDate = new Date(m.metric_date);
      
      // Determine which period this metric belongs to
      let targetMap: Map<string, any> | null = null;
      if (metricDate >= currentPeriodStart && metricDate <= currentPeriodEnd) {
        targetMap = currentPeriodCreatives;
      } else if (metricDate >= previousPeriodStart && metricDate <= previousPeriodEnd) {
        targetMap = previousPeriodCreatives;
      }
      
      if (!targetMap) continue;
      
      if (!targetMap.has(m.creative_id)) {
        targetMap.set(m.creative_id, {
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
          leads: 0,
          averageDwellTimeSum: 0,
          averageDwellTimeCount: 0
        });
      }
      
      const agg = targetMap.get(m.creative_id)!;
      agg.impressions += parseInt(m.impressions) || 0;
      agg.clicks += parseInt(m.clicks) || 0;
      agg.spend += parseFloat(m.spend) || 0;
      agg.conversions += parseInt(m.conversions) || 0;
      agg.videoViews += parseInt(m.video_views) || 0;
      agg.leads += parseInt(m.leads) || 0;
      
      // Track average dwell time for ads (weighted by impressions)
      if (m.average_dwell_time !== null && m.average_dwell_time !== undefined && m.impressions > 0) {
        agg.averageDwellTimeSum += (parseFloat(m.average_dwell_time) || 0) * (parseInt(m.impressions) || 0);
        agg.averageDwellTimeCount += parseInt(m.impressions) || 0;
      }
    }
    
    // Check if we have data for both periods
    const hasCurrentPeriod = currentPeriodCampaigns.size > 0;
    const hasPreviousPeriod = previousPeriodCampaigns.size > 0;
    
    // Calculate account-level averages for cost efficiency comparison
    if (hasCurrentPeriod) {
      for (const [, campData] of currentPeriodCampaigns) {
        accountTotalClicks += campData.clicks;
        accountTotalImpressions += campData.impressions;
        accountTotalSpend += campData.spend;
        accountTotalConversions += campData.conversions;
      }
      accountAvgCpc = accountTotalClicks > 0 ? accountTotalSpend / accountTotalClicks : 0;
      accountAvgCpm = accountTotalImpressions > 0 ? (accountTotalSpend / accountTotalImpressions) * 1000 : 0;
      accountAvgCpa = accountTotalConversions > 0 ? accountTotalSpend / accountTotalConversions : 0;
    }
    
    // Build campaign name lookup
    const campaignNameLookup = new Map<string, string>();
    if (hasCurrentPeriod) {
      for (const [campId, campData] of currentPeriodCampaigns) {
        campaignNameLookup.set(campId, campData.campaignName || `Campaign ${campId}`);
      }
    }
    
    // Build alerts array
    const alerts: { type: 'budget' | 'penetration' | 'lan_expansion'; message: string; campaignId?: string; campaignName?: string; }[] = [];
    
    // Determine if any campaigns have LAN/Expansion (affects sync frequency)
    let hasLanOrExpansion = false;
    
    // Scoring function
    const pctChange = (newVal: number, oldVal: number): number => {
      if (oldVal === 0) return 0;
      return ((newVal - oldVal) / oldVal) * 100;
    };
    
    // Build campaigns in the expected format (CampaignItem)
    const campaigns = hasCurrentPeriod ? Array.from(currentPeriodCampaigns.values()).map(c => {
      const prev = hasPreviousPeriod ? previousPeriodCampaigns.get(c.campaignId) : null;
      
      // 4-week metrics
      const ctr4w = c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0;
      const prevCtr4w = prev && prev.impressions > 0 ? (prev.clicks / prev.impressions) * 100 : 0;
      const cpc4w = c.clicks > 0 ? c.spend / c.clicks : 0;
      const prevCpc4w = prev && prev.clicks > 0 ? prev.spend / prev.clicks : 0;
      const cpm4w = c.impressions > 0 ? (c.spend / c.impressions) * 1000 : 0;
      const prevCpm4w = prev && prev.impressions > 0 ? (prev.spend / prev.impressions) * 1000 : 0;
      const cpa4w = c.conversions > 0 ? c.spend / c.conversions : 0;
      const prevCpa4w = prev && prev.conversions > 0 ? prev.spend / prev.conversions : 0;
      
      // Get live settings
      const liveSettings = liveCampaignSettings.get(c.campaignId) || {};
      const dailyBudget = liveSettings.dailyBudget;
      const campaignStatus = liveSettings.status || c.campaignStatus;
      
      // Get WoW metrics
      const currWeek = currentWeekByCampaign.get(c.campaignId) || initWeekMetrics();
      const prevWeek = previousWeekByCampaign.get(c.campaignId) || initWeekMetrics();
      const currentWeekDays = currWeek.days.size;
      const previousWeekDays = prevWeek.days.size;
      
      // WoW derived metrics
      const ctrWoWCurr = currWeek.impressions > 0 ? (currWeek.clicks / currWeek.impressions) * 100 : 0;
      const ctrWoWPrev = prevWeek.impressions > 0 ? (prevWeek.clicks / prevWeek.impressions) * 100 : 0;
      const cpcWoWCurr = currWeek.clicks > 0 ? currWeek.spend / currWeek.clicks : 0;
      const cpcWoWPrev = prevWeek.clicks > 0 ? prevWeek.spend / prevWeek.clicks : 0;
      const cpmWoWCurr = currWeek.impressions > 0 ? (currWeek.spend / currWeek.impressions) * 1000 : 0;
      const cpmWoWPrev = prevWeek.impressions > 0 ? (prevWeek.spend / prevWeek.impressions) * 1000 : 0;
      
      // WoW dwell time
      const dwellTimeWoWCurr = currWeek.dwellTimeCount > 0 ? currWeek.dwellTimeSum / currWeek.dwellTimeCount : null;
      const dwellTimeWoWPrev = prevWeek.dwellTimeCount > 0 ? prevWeek.dwellTimeSum / prevWeek.dwellTimeCount : null;
      const dwellTimeChangeWoW = dwellTimeWoWCurr !== null && dwellTimeWoWPrev !== null && dwellTimeWoWPrev > 0
        ? pctChange(dwellTimeWoWCurr, dwellTimeWoWPrev)
        : null;
      
      // Calculate average daily spend
      const avgDailySpend = currentWeekDays > 0 ? currWeek.spend / currentWeekDays : 0;
      const prevAvgDailySpend = previousWeekDays > 0 ? prevWeek.spend / previousWeekDays : 0;
      
      // Budget utilization (pro-rated based on days running)
      // Calculate if campaign has a daily budget and ran at least 1 day
      const budgetUtilization = dailyBudget && dailyBudget > 0 && currentWeekDays >= 1 
        ? (avgDailySpend / dailyBudget) * 100 
        : undefined;
      
      // Debug: Log budget calculation for all campaigns with budget
      if (dailyBudget && dailyBudget > 0) {
        console.log(`[Budget] Campaign ${c.campaignId}: weekSpend=${currWeek.spend}, days=${currentWeekDays}, avgDaily=${avgDailySpend.toFixed(2)}, dailyBudget=${dailyBudget}, util=${budgetUtilization?.toFixed(0)}%`);
      }
      
      const hasLan = liveSettings.hasLan || false;
      const hasExpansion = liveSettings.hasExpansion || false;
      const hasMaximizeDelivery = liveSettings.hasMaximizeDelivery || false;
      
      // Calculate new metrics from aggregated analytics data
      // Audience Penetration: Use TOTAL granularity values (cumulative over the period)
      // This matches what LinkedIn Campaign Manager shows
      // Fallback: If TOTAL API failed, use the MAX daily penetration from database
      // c.campaignId is already normalized to numeric ID via extractId
      const totalPenetrationData = currentPeriodPenetration.get(c.campaignId);
      const prevTotalPenetrationData = prevPeriodPenetration.get(c.campaignId);
      
      // Use TOTAL API value if available, otherwise fallback to daily MAX from aggregation
      const audiencePenetration = totalPenetrationData?.penetration ?? 
        (c.audiencePenetrationMax > 0 ? c.audiencePenetrationMax : null);
      const prevAudiencePenetration = prevTotalPenetrationData?.penetration ?? 
        (prev && prev.audiencePenetrationMax > 0 ? prev.audiencePenetrationMax : null);
      const audiencePenetrationChange = audiencePenetration !== null && prevAudiencePenetration !== null && prevAudiencePenetration > 0
        ? pctChange(audiencePenetration, prevAudiencePenetration)
        : null;
      
      // Frequency: impressions / unique reach
      // IMPORTANT: Use cumulative reach from ALL granularity API (not summed daily values)
      // Summing daily reach double-counts users who saw ads on multiple days
      const cumulativeReach = totalPenetrationData?.reach;
      const prevCumulativeReach = prevTotalPenetrationData?.reach;
      
      // Log when cumulative reach is missing (helps track ALL API coverage)
      if (!cumulativeReach && c.impressions > 1000) {
        console.log(`[Audit] Campaign ${c.campaignId} has ${c.impressions} impressions but no cumulative reach from ALL API`);
      }
      
      const frequency = cumulativeReach && cumulativeReach > 0 
        ? c.impressions / cumulativeReach 
        : null;
      const prevFrequency = prevCumulativeReach && prevCumulativeReach > 0 && prev
        ? prev.impressions / prevCumulativeReach 
        : null;
      const frequencyChange = frequency !== null && prevFrequency !== null && prevFrequency > 0
        ? pctChange(frequency, prevFrequency)
        : null;
      
      // Average Dwell Time: weighted by impressions (in seconds)
      const averageDwellTime = c.averageDwellTimeCount > 0 
        ? c.averageDwellTimeSum / c.averageDwellTimeCount 
        : null;
      const prevAverageDwellTime = prev && prev.averageDwellTimeCount > 0 
        ? prev.averageDwellTimeSum / prev.averageDwellTimeCount 
        : null;
      const dwellTimeChange = averageDwellTime !== null && prevAverageDwellTime !== null && prevAverageDwellTime > 0
        ? pctChange(averageDwellTime, prevAverageDwellTime)
        : null;
      
      // Calculate cost efficiency vs account average
      const cpcVsAccount = accountAvgCpc > 0 ? ((cpc4w - accountAvgCpc) / accountAvgCpc) * 100 : null;
      const cpmVsAccount = accountAvgCpm > 0 ? ((cpm4w - accountAvgCpm) / accountAvgCpm) * 100 : null;
      const cpaVsAccount = accountAvgCpa > 0 && cpa4w > 0 ? ((cpa4w - accountAvgCpa) / accountAvgCpa) * 100 : null;
      
      if (hasLan || hasExpansion) hasLanOrExpansion = true;
      
      // ===== SCORING LOGIC =====
      let negativeScore = 0;
      let positiveScore = 0;
      const issues: string[] = [];
      const positiveSignals: string[] = [];
      const flags: string[] = [];
      let scoringStatus: 'needs_attention' | 'mild_issues' | 'performing_well' | 'paused' | 'low_volume' | 'new_campaign' = 'performing_well';
      let hasHardFailure = false; // Disables positive bonuses
      
      // Track per-metric contributions for UI display
      interface MetricContribution {
        metric: string;
        value: number | string | null;
        contribution: number;
        threshold: string;
        applied: boolean;
      }
      const scoringBreakdown: MetricContribution[] = [];
      
      // Check if paused
      if (campaignStatus === 'PAUSED') {
        scoringStatus = 'paused';
      }
      // Check for low volume
      else if (c.impressions < 1000 || c.spend < 20 || currentWeekDays < 3) {
        scoringStatus = 'low_volume';
        issues.push('Low volume — trends unreliable');
      }
      else {
        const ctrChange4w = pctChange(ctr4w, prevCtr4w);
        
        // === CTR ABSOLUTE ===
        if (ctr4w < 0.3) {
          negativeScore -= 2;
          issues.push(`CTR ${ctr4w.toFixed(2)}% (below 0.3%)`);
          scoringBreakdown.push({ metric: 'CTR Absolute', value: `${ctr4w.toFixed(2)}%`, contribution: -2, threshold: '<0.3% = -2', applied: true });
        } else if (ctr4w < 0.4) {
          negativeScore -= 1;
          issues.push(`CTR ${ctr4w.toFixed(2)}% (below 0.4%)`);
          scoringBreakdown.push({ metric: 'CTR Absolute', value: `${ctr4w.toFixed(2)}%`, contribution: -1, threshold: '<0.4% = -1', applied: true });
        } else {
          scoringBreakdown.push({ metric: 'CTR Absolute', value: `${ctr4w.toFixed(2)}%`, contribution: 0, threshold: '≥0.4% = 0', applied: false });
        }
        
        // === CTR 4W CHANGE (NEGATIVE) ===
        if (ctrChange4w < -20) {
          negativeScore -= 2;
          issues.push(`CTR down ${Math.abs(ctrChange4w).toFixed(0)}% (4w)`);
          scoringBreakdown.push({ metric: 'CTR Change (4w)', value: `${ctrChange4w.toFixed(1)}%`, contribution: -2, threshold: '<-20% = -2', applied: true });
        } else {
          scoringBreakdown.push({ metric: 'CTR Change (4w)', value: `${ctrChange4w.toFixed(1)}%`, contribution: 0, threshold: '≥-20% = 0', applied: false });
        }
        
        // === CTR WoW CHANGE ===
        const ctrWoWChange = pctChange(ctrWoWCurr, ctrWoWPrev);
        if (currentWeekDays >= 3 && previousWeekDays >= 3 && ctrWoWChange < -15) {
          negativeScore -= 1;
          issues.push(`CTR down ${Math.abs(ctrWoWChange).toFixed(0)}% (WoW)`);
          scoringBreakdown.push({ metric: 'CTR Change (WoW)', value: `${ctrWoWChange.toFixed(1)}%`, contribution: -1, threshold: '<-15% = -1', applied: true });
        } else if (currentWeekDays >= 3 && previousWeekDays >= 3) {
          scoringBreakdown.push({ metric: 'CTR Change (WoW)', value: `${ctrWoWChange.toFixed(1)}%`, contribution: 0, threshold: '≥-15% = 0', applied: false });
        } else {
          scoringBreakdown.push({ metric: 'CTR Change (WoW)', value: 'N/A', contribution: 0, threshold: 'Need ≥3 days', applied: false });
        }
        
        // === CTR POSITIVE ===
        let ctrPositiveContrib = 0;
        if (prevCtr4w > 0 && ctrChange4w >= 20 && c.impressions >= 1000) {
          if (ctrChange4w >= 35 && c.conversions >= 10) {
            ctrPositiveContrib = 2;
            positiveScore += 2;
            positiveSignals.push(`CTR up ${ctrChange4w.toFixed(0)}% with strong conversions`);
          } else {
            ctrPositiveContrib = 1;
            positiveScore += 1;
            positiveSignals.push(`CTR up ${ctrChange4w.toFixed(0)}%`);
          }
        }
        scoringBreakdown.push({ metric: 'CTR Improvement Bonus', value: `${ctrChange4w.toFixed(1)}%`, contribution: ctrPositiveContrib, threshold: '≥20% = +1, ≥35% & conv = +2', applied: ctrPositiveContrib > 0 });
        
        // === CPC 4W CHANGE ===
        const cpcChange4w = pctChange(cpc4w, prevCpc4w);
        if (prevCpc4w > 0 && cpcChange4w > 25) {
          negativeScore -= 2;
          issues.push(`CPC up ${cpcChange4w.toFixed(0)}% (4w)`);
          scoringBreakdown.push({ metric: 'CPC Change (4w)', value: `${cpcChange4w.toFixed(1)}%`, contribution: -2, threshold: '>25% = -2', applied: true });
        } else {
          scoringBreakdown.push({ metric: 'CPC Change (4w)', value: `${cpcChange4w.toFixed(1)}%`, contribution: 0, threshold: '≤25% = 0', applied: false });
        }
        
        // === CPC WoW CHANGE ===
        const cpcWoWChange = pctChange(cpcWoWCurr, cpcWoWPrev);
        if (currentWeekDays >= 3 && previousWeekDays >= 3 && cpcWoWPrev > 0 && cpcWoWChange > 20) {
          negativeScore -= 1;
          issues.push(`CPC up ${cpcWoWChange.toFixed(0)}% (WoW)`);
          scoringBreakdown.push({ metric: 'CPC Change (WoW)', value: `${cpcWoWChange.toFixed(1)}%`, contribution: -1, threshold: '>20% = -1', applied: true });
        } else if (currentWeekDays >= 3 && previousWeekDays >= 3) {
          scoringBreakdown.push({ metric: 'CPC Change (WoW)', value: `${cpcWoWChange.toFixed(1)}%`, contribution: 0, threshold: '≤20% = 0', applied: false });
        } else {
          scoringBreakdown.push({ metric: 'CPC Change (WoW)', value: 'N/A', contribution: 0, threshold: 'Need ≥3 days', applied: false });
        }
        
        // === CPM 4W CHANGE ===
        const cpmChange4w = pctChange(cpm4w, prevCpm4w);
        if (prevCpm4w > 0 && cpmChange4w > 25) {
          negativeScore -= 2;
          issues.push(`CPM up ${cpmChange4w.toFixed(0)}% (4w)`);
          scoringBreakdown.push({ metric: 'CPM Change (4w)', value: `${cpmChange4w.toFixed(1)}%`, contribution: -2, threshold: '>25% = -2', applied: true });
        } else {
          scoringBreakdown.push({ metric: 'CPM Change (4w)', value: `${cpmChange4w.toFixed(1)}%`, contribution: 0, threshold: '≤25% = 0', applied: false });
        }
        
        // === CPM WoW CHANGE ===
        const cpmWoWChange = pctChange(cpmWoWCurr, cpmWoWPrev);
        if (currentWeekDays >= 3 && previousWeekDays >= 3 && cpmWoWPrev > 0 && cpmWoWChange > 20) {
          negativeScore -= 1;
          issues.push(`CPM up ${cpmWoWChange.toFixed(0)}% (WoW)`);
          scoringBreakdown.push({ metric: 'CPM Change (WoW)', value: `${cpmWoWChange.toFixed(1)}%`, contribution: -1, threshold: '>20% = -1', applied: true });
        } else if (currentWeekDays >= 3 && previousWeekDays >= 3) {
          scoringBreakdown.push({ metric: 'CPM Change (WoW)', value: `${cpmWoWChange.toFixed(1)}%`, contribution: 0, threshold: '≤20% = 0', applied: false });
        } else {
          scoringBreakdown.push({ metric: 'CPM Change (WoW)', value: 'N/A', contribution: 0, threshold: 'Need ≥3 days', applied: false });
        }
        
        // === CPC VS ACCOUNT AVERAGE ===
        let cpcVsAccountContrib = 0;
        if (cpcVsAccount !== null) {
          if (cpcVsAccount > 30) {
            const conversionLift = prev && prev.conversions > 0 ? pctChange(c.conversions, prev.conversions) : 0;
            if (conversionLift <= 0) {
              cpcVsAccountContrib = -2;
              negativeScore -= 2;
              issues.push(`CPC ${cpcVsAccount.toFixed(0)}% above account avg`);
            }
          } else if (cpcVsAccount > 15) {
            cpcVsAccountContrib = -1;
            negativeScore -= 1;
            issues.push(`CPC ${cpcVsAccount.toFixed(0)}% above account avg`);
          } else if (cpcVsAccount <= -10) {
            cpcVsAccountContrib = 1;
            positiveScore += 1;
            positiveSignals.push(`CPC ${Math.abs(cpcVsAccount).toFixed(0)}% below account avg`);
          }
          scoringBreakdown.push({ metric: 'CPC vs Account Avg', value: `${cpcVsAccount.toFixed(0)}%`, contribution: cpcVsAccountContrib, threshold: '>30% = -2, >15% = -1, ≤-10% = +1', applied: cpcVsAccountContrib !== 0 });
        } else {
          scoringBreakdown.push({ metric: 'CPC vs Account Avg', value: 'N/A', contribution: 0, threshold: 'No account avg', applied: false });
        }
        
        // === CPA VS ACCOUNT AVERAGE ===
        let cpaVsAccountContrib = 0;
        if (c.conversions >= 5 && cpaVsAccount !== null && cpaVsAccount <= -15) {
          if (cpaVsAccount <= -25 && c.conversions >= 15) {
            cpaVsAccountContrib = 2;
            positiveScore += 2;
            positiveSignals.push(`CPA ${Math.abs(cpaVsAccount).toFixed(0)}% below account avg (${c.conversions} conv)`);
          } else {
            cpaVsAccountContrib = 1;
            positiveScore += 1;
            positiveSignals.push(`CPA ${Math.abs(cpaVsAccount).toFixed(0)}% below account avg`);
          }
          scoringBreakdown.push({ metric: 'CPA vs Account Avg', value: `${cpaVsAccount.toFixed(0)}%`, contribution: cpaVsAccountContrib, threshold: '≤-25% & ≥15 conv = +2, ≤-15% = +1', applied: true });
        } else if (cpaVsAccount !== null) {
          scoringBreakdown.push({ metric: 'CPA vs Account Avg', value: `${cpaVsAccount.toFixed(0)}%`, contribution: 0, threshold: 'Need ≥5 conv & ≤-15%', applied: false });
        } else {
          scoringBreakdown.push({ metric: 'CPA vs Account Avg', value: 'N/A', contribution: 0, threshold: 'No data', applied: false });
        }
        
        // === FREQUENCY ===
        let frequencyContrib = 0;
        if (frequency !== null) {
          if (frequency > 6) {
            frequencyContrib = -2;
            negativeScore -= 2;
            issues.push(`High frequency (${frequency.toFixed(1)}x) - audience fatigue risk`);
          } else if (frequency > 4) {
            frequencyContrib = -1;
            negativeScore -= 1;
            issues.push(`Elevated frequency (${frequency.toFixed(1)}x)`);
          } else if (frequency >= 1.5 && frequency <= 3 && ctrChange4w >= 0) {
            frequencyContrib = 1;
            positiveScore += 1;
            positiveSignals.push(`Healthy frequency (${frequency.toFixed(1)}x)`);
          }
          scoringBreakdown.push({ metric: 'Frequency', value: `${frequency.toFixed(1)}x`, contribution: frequencyContrib, threshold: '>6x = -2, >4x = -1, 1.5-3x = +1', applied: frequencyContrib !== 0 });
        } else {
          scoringBreakdown.push({ metric: 'Frequency', value: 'N/A', contribution: 0, threshold: 'No reach data', applied: false });
        }
        
        // === AUDIENCE PENETRATION ===
        let penetrationContrib = 0;
        if (audiencePenetration !== null) {
          const penetrationPct = audiencePenetration * 100;
          if (penetrationPct < 10) {
            penetrationContrib = -2;
            negativeScore -= 2;
            issues.push(`Low penetration (${penetrationPct.toFixed(0)}%) - consider broader targeting`);
          } else if (penetrationPct < 20) {
            penetrationContrib = -1;
            negativeScore -= 1;
            issues.push(`Moderate penetration (${penetrationPct.toFixed(0)}%)`);
          } else if (penetrationPct > 60 && Math.abs(ctrChange4w) < 5) {
            penetrationContrib = 1;
            positiveScore += 1;
            positiveSignals.push(`Strong penetration (${penetrationPct.toFixed(0)}%) with stable CTR`);
          }
          scoringBreakdown.push({ metric: 'Audience Penetration', value: `${penetrationPct.toFixed(0)}%`, contribution: penetrationContrib, threshold: '<10% = -2, <20% = -1, >60% = +1', applied: penetrationContrib !== 0 });
        } else {
          scoringBreakdown.push({ metric: 'Audience Penetration', value: 'N/A', contribution: 0, threshold: 'No data', applied: false });
        }
        
        // === AVERAGE DWELL TIME ===
        let dwellTimeContrib = 0;
        if (averageDwellTime !== null) {
          // Dwell time is in seconds. Good engagement: >3s, Poor: <1.5s
          if (averageDwellTime < 1.5) {
            dwellTimeContrib = -1;
            negativeScore -= 1;
            issues.push(`Low dwell time (${averageDwellTime.toFixed(1)}s) - ads may not be engaging`);
          } else if (averageDwellTime >= 4) {
            dwellTimeContrib = 1;
            positiveScore += 1;
            positiveSignals.push(`High dwell time (${averageDwellTime.toFixed(1)}s) - strong engagement`);
          }
          scoringBreakdown.push({ metric: 'Avg Dwell Time', value: `${averageDwellTime.toFixed(1)}s`, contribution: dwellTimeContrib, threshold: '<1.5s = -1, ≥4s = +1', applied: dwellTimeContrib !== 0 });
        } else {
          scoringBreakdown.push({ metric: 'Avg Dwell Time', value: 'N/A', contribution: 0, threshold: 'No data', applied: false });
        }
        
        // === Budget ===
        let budgetContrib = 0;
        if (budgetUtilization !== undefined && budgetUtilization < 50) {
          budgetContrib = -10;
          negativeScore -= 10;
          hasHardFailure = true;
          issues.push(`Severely under budget ($${avgDailySpend.toFixed(0)} vs $${dailyBudget!.toFixed(0)}) - check bidding`);
          alerts.push({ type: 'budget', message: `${c.campaignName} severely under budget ($${avgDailySpend.toFixed(0)} vs $${dailyBudget!.toFixed(0)} daily) - check bidding`, campaignId: c.campaignId, campaignName: c.campaignName });
          scoringBreakdown.push({ metric: 'Budget Utilization', value: `${budgetUtilization.toFixed(0)}%`, contribution: -10, threshold: '<50% = -10 (HARD FAIL)', applied: true });
        } else if (budgetUtilization !== undefined && budgetUtilization < 80) {
          budgetContrib = -1;
          negativeScore -= 1;
          issues.push(`Under budget ($${avgDailySpend.toFixed(0)} vs $${dailyBudget!.toFixed(0)})`);
          alerts.push({ type: 'budget', message: `${c.campaignName} under budget ($${avgDailySpend.toFixed(0)} vs $${dailyBudget!.toFixed(0)} daily, ${budgetUtilization.toFixed(0)}%)`, campaignId: c.campaignId, campaignName: c.campaignName });
          scoringBreakdown.push({ metric: 'Budget Utilization', value: `${budgetUtilization.toFixed(0)}%`, contribution: -1, threshold: '<80% = -1', applied: true });
        } else if (budgetUtilization !== undefined) {
          scoringBreakdown.push({ metric: 'Budget Utilization', value: `${budgetUtilization.toFixed(0)}%`, contribution: 0, threshold: '≥80% = 0', applied: false });
        } else {
          scoringBreakdown.push({ metric: 'Budget Utilization', value: 'N/A', contribution: 0, threshold: 'No budget data', applied: false });
        }
        
        // === Conversions (only if enough data) ===
        let convDeclineContrib = 0;
        let cpaIncreaseContrib = 0;
        if (c.conversions >= 5) {
          const convChange = prev && prev.conversions > 0 ? pctChange(c.conversions, prev.conversions) : 0;
          if (prev && prev.conversions > 0 && convChange < -25) {
            convDeclineContrib = -2;
            negativeScore -= 2;
            issues.push(`Conversions down ${Math.abs(convChange).toFixed(0)}%`);
          }
          scoringBreakdown.push({ metric: 'Conversion Decline', value: `${convChange.toFixed(0)}%`, contribution: convDeclineContrib, threshold: '<-25% = -2', applied: convDeclineContrib !== 0 });
          
          const cpaChange = pctChange(cpa4w, prevCpa4w);
          if (prevCpa4w > 0 && cpaChange > 25) {
            cpaIncreaseContrib = -2;
            negativeScore -= 2;
            issues.push(`CPA up ${cpaChange.toFixed(0)}%`);
          }
          scoringBreakdown.push({ metric: 'CPA Increase', value: `${cpaChange.toFixed(0)}%`, contribution: cpaIncreaseContrib, threshold: '>25% = -2', applied: cpaIncreaseContrib !== 0 });
        } else {
          scoringBreakdown.push({ metric: 'Conversion Decline', value: `${c.conversions} conv`, contribution: 0, threshold: 'Need ≥5 conversions', applied: false });
          scoringBreakdown.push({ metric: 'CPA Increase', value: `${c.conversions} conv`, contribution: 0, threshold: 'Need ≥5 conversions', applied: false });
        }
        
        // === APPLY SCORING CAPS AND GUARDRAILS ===
        // Cap negative at -10 to prevent runaway penalties
        const rawNegativeScore = negativeScore;
        negativeScore = Math.max(negativeScore, -10);
        
        // Cap positive at +2 per campaign (disable if hard failure)
        const rawPositiveScore = positiveScore;
        const effectivePositive = hasHardFailure ? 0 : Math.min(positiveScore, 2);
        
        // Calculate final score
        const finalScore = negativeScore + effectivePositive;
        
        // Add guardrail summary
        scoringBreakdown.push({ 
          metric: 'Negative Cap Applied', 
          value: rawNegativeScore < -10 ? `${rawNegativeScore} → -10` : 'No', 
          contribution: rawNegativeScore < -10 ? (rawNegativeScore + 10) : 0, 
          threshold: 'Cap at -10', 
          applied: rawNegativeScore < -10 
        });
        scoringBreakdown.push({ 
          metric: 'Positive Cap Applied', 
          value: hasHardFailure ? `+${rawPositiveScore} → 0 (hard fail)` : (rawPositiveScore > 2 ? `+${rawPositiveScore} → +2` : 'No'), 
          contribution: hasHardFailure ? -rawPositiveScore : (rawPositiveScore > 2 ? -(rawPositiveScore - 2) : 0), 
          threshold: hasHardFailure ? 'Disabled on hard failure' : 'Cap at +2', 
          applied: hasHardFailure || rawPositiveScore > 2 
        });
        
        // Determine result tier (hard failures always needs_attention regardless of positives)
        if (hasHardFailure || finalScore <= -3) {
          scoringStatus = 'needs_attention';
        } else if (finalScore < 0) {
          scoringStatus = 'mild_issues';
        } else {
          scoringStatus = 'performing_well';
        }
      }
      
      // Calculate final score for display
      const rawPositiveForDisplay = positiveScore;
      const effectivePositiveScore = hasHardFailure ? 0 : Math.min(positiveScore, 2);
      const score = Math.max(negativeScore, -10) + effectivePositiveScore;
      
      // === Special flags (always shown as warnings) ===
      if (hasLan) flags.push('LAN enabled');
      if (hasExpansion) flags.push('Expansion enabled');
      if (hasMaximizeDelivery) flags.push('Maximize Delivery enabled');
      
      if (hasLan || hasExpansion || hasMaximizeDelivery) {
        alerts.push({ 
          type: 'lan_expansion', 
          message: `${c.campaignName} has ${[hasLan && 'LAN', hasExpansion && 'Expansion', hasMaximizeDelivery && 'Maximize Delivery'].filter(Boolean).join(', ')} enabled`, 
          campaignId: c.campaignId, 
          campaignName: c.campaignName 
        });
      }
      
      return {
        id: c.campaignId,
        name: c.campaignName,
        ctr: ctr4w,
        ctrChange: pctChange(ctr4w, prevCtr4w),
        cpc: cpc4w,
        cpcChange: pctChange(cpc4w, prevCpc4w),
        cpm: cpm4w,
        cpmChange: pctChange(cpm4w, prevCpm4w),
        conversions: c.conversions,
        conversionsChange: prev ? pctChange(c.conversions, prev.conversions) : 0,
        cpa: cpa4w,
        cpaChange: pctChange(cpa4w, prevCpa4w),
        impressions: c.impressions,
        clicks: c.clicks,
        spend: c.spend,
        dailyBudget,
        avgDailySpend,
        budgetUtilization,
        currentWeekSpend: currWeek.spend,
        previousWeekSpend: prevWeek.spend,
        currentWeekDays,
        previousWeekDays,
        hasLan,
        hasExpansion,
        hasMaximizeDelivery,
        // New metrics with MoM comparisons
        frequency,
        frequencyChange,
        audiencePenetration: audiencePenetration !== null ? audiencePenetration * 100 : null,
        audiencePenetrationChange,
        averageDwellTime,
        dwellTimeChange,
        dwellTimeChangeWoW,
        cpcVsAccount,
        cpaVsAccount,
        // Scoring breakdown with actual applied contributions
        score,
        negativeScore,
        positiveScore: effectivePositiveScore,
        rawPositiveScore: rawPositiveForDisplay,
        hasHardFailure,
        scoringBreakdown,
        scoringStatus,
        isPerformingWell: scoringStatus === 'performing_well',
        issues,
        positiveSignals,
        flags
      };
    }) : [];
    
    // Build a lookup map for campaign data to inherit into ads
    const campaignDataMap = new Map<string, { issues: string[], scoringStatus: string, negativeScore: number }>();
    for (const campaign of campaigns) {
      campaignDataMap.set(campaign.id, {
        issues: campaign.issues || [],
        scoringStatus: campaign.scoringStatus,
        negativeScore: campaign.negativeScore || 0
      });
    }
    
    // Build ads in the expected format (AdItem)
    const ads = hasCurrentPeriod ? Array.from(currentPeriodCreatives.values()).map(c => {
      const prev = hasPreviousPeriod ? previousPeriodCreatives.get(c.creativeId) : null;
      const currentCtr = c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0;
      const prevCtr = prev && prev.impressions > 0 ? (prev.clicks / prev.impressions) * 100 : 0;
      const hasPreviousData = prev && prev.impressions >= 100;
      const ctrChange = hasPreviousData && prevCtr > 0 ? pctChange(currentCtr, prevCtr) : null;
      
      // Get parent campaign data
      const parentCampaign = campaignDataMap.get(c.campaignId);
      
      // Average Dwell Time for ads (weighted by impressions)
      const averageDwellTime = c.averageDwellTimeCount > 0 
        ? c.averageDwellTimeSum / c.averageDwellTimeCount 
        : null;
      const prevAverageDwellTime = prev && prev.averageDwellTimeCount > 0 
        ? prev.averageDwellTimeSum / prev.averageDwellTimeCount 
        : null;
      const dwellTimeChange = averageDwellTime !== null && prevAverageDwellTime !== null && prevAverageDwellTime > 0
        ? pctChange(averageDwellTime, prevAverageDwellTime)
        : null;
      
      // Calculate conversion rate
      const currentCvr = c.clicks > 0 ? (c.conversions / c.clicks) * 100 : 0;
      const prevCvr = prev && prev.clicks > 0 ? (prev.conversions / prev.clicks) * 100 : 0;
      const prevConversions = prev?.conversions || 0;
      const hasPrevConversions = prevConversions >= 3;
      const cvrChange = hasPrevConversions && prevCvr > 0 ? pctChange(currentCvr, prevCvr) : null;
      
      // Determine scoring status and issues
      const issues: string[] = [];
      let scoringStatus: 'needs_attention' | 'performing_well' | 'insufficient_data' = 'performing_well';
      
      // Low volume filter - not enough data to score
      if (c.impressions < 500 || c.clicks < 10) {
        scoringStatus = 'insufficient_data';
      } 
      // No previous data to compare against
      else if (!hasPreviousData) {
        scoringStatus = 'insufficient_data';
      }
      else {
        // CTR decline > 20%
        if (ctrChange !== null && ctrChange < -20) {
          issues.push(`CTR down ${Math.abs(ctrChange).toFixed(0)}%`);
        }
        
        // Conversion rate decline > 20% (if ≥3 conversions in both periods)
        if (c.conversions >= 3 && hasPrevConversions && cvrChange !== null && cvrChange < -20) {
          issues.push(`CVR down ${Math.abs(cvrChange).toFixed(0)}%`);
        }
        
        // Set status based on issues
        scoringStatus = issues.length > 0 ? 'needs_attention' : 'performing_well';
      }
      
      const isPerformingWell = scoringStatus === 'performing_well';
      
      // Inherit campaign issues for context (but keep ad's own status separate)
      const campaignIssues = parentCampaign?.issues || [];
      const campaignScoringStatus = parentCampaign?.scoringStatus || 'performing_well';
      
      return {
        id: c.creativeId,
        name: c.creativeName || `Ad ${c.creativeId}`,
        campaignId: c.campaignId,
        campaignName: campaignNameLookup.get(c.campaignId) || `Campaign ${c.campaignId}`,
        ctr: currentCtr,
        ctrChange,
        prevCtr: hasPreviousData ? prevCtr : null,
        conversions: c.conversions,
        prevConversions: prev?.conversions || 0,
        cvr: currentCvr,
        cvrChange,
        prevCvr: hasPrevConversions ? prevCvr : null,
        impressions: c.impressions,
        prevImpressions: prev?.impressions || 0,
        clicks: c.clicks,
        prevClicks: prev?.clicks || 0,
        spend: c.spend,
        prevSpend: prev?.spend || 0,
        averageDwellTime,
        dwellTimeChange,
        scoringStatus,
        isPerformingWell,
        issues,
        // Inherited campaign context
        campaignIssues,
        campaignScoringStatus,
        hasCampaignIssues: campaignIssues.length > 0
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

// Lightweight audit summary for Structure view - returns scoring status without heavy processing
app.get('/api/audit/structure-summary/:accountId', requireAuth, async (req, res) => {
  try {
    const { accountId } = req.params;
    
    // Check if account is opted into audit
    const auditAccount = await getAuditAccount(accountId);
    if (!auditAccount) {
      return res.json({ 
        hasAuditData: false,
        campaigns: {},
        ads: {},
        lastSyncAt: null
      });
    }
    
    // Get precomputed scoring data from database (lightweight, no recomputation)
    const scoringData = await getStructureScoringData(accountId);
    
    // If no scoring data, return empty (audit hasn't run yet)
    if (!scoringData.campaigns.length && !scoringData.creatives.length) {
      return res.json({
        hasAuditData: true,
        campaigns: {},
        ads: {},
        lastSyncAt: auditAccount.last_sync_at,
        noMetrics: true
      });
    }
    
    // Build lightweight summary from precomputed data
    const campaignsMap: Record<string, { scoringStatus: string; issues: string[]; positiveSignals: string[] }> = {};
    const adsMap: Record<string, { scoringStatus: string; issues: string[]; campaignId: string }> = {};
    
    for (const c of scoringData.campaigns) {
      // Ensure arrays are properly parsed (handle both string JSON and already-parsed arrays)
      let issues = c.scoring_issues;
      let positiveSignals = c.scoring_positive_signals;
      
      if (typeof issues === 'string') {
        try { issues = JSON.parse(issues); } catch { issues = []; }
      }
      if (typeof positiveSignals === 'string') {
        try { positiveSignals = JSON.parse(positiveSignals); } catch { positiveSignals = []; }
      }
      
      campaignsMap[c.campaign_id] = {
        scoringStatus: c.scoring_status,
        issues: Array.isArray(issues) ? issues : [],
        positiveSignals: Array.isArray(positiveSignals) ? positiveSignals : []
      };
    }
    
    for (const a of scoringData.creatives) {
      // Ensure arrays are properly parsed
      let issues = a.scoring_issues;
      if (typeof issues === 'string') {
        try { issues = JSON.parse(issues); } catch { issues = []; }
      }
      
      adsMap[a.creative_id] = {
        scoringStatus: a.scoring_status,
        issues: Array.isArray(issues) ? issues : [],
        campaignId: a.campaign_id
      };
    }
    
    return res.json({
      hasAuditData: true,
      campaigns: campaignsMap,
      ads: adsMap,
      lastSyncAt: auditAccount.last_sync_at
    });
    
  } catch (err: any) {
    console.error('Audit structure-summary error:', err.message);
    res.status(500).json({ error: 'Failed to get audit summary' });
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
