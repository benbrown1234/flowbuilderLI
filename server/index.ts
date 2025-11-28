import express from 'express';
import cors from 'cors';
import axios from 'axios';
import cookieParser from 'cookie-parser';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';

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

async function linkedinApiRequest(sessionId: string, endpoint: string, params: Record<string, any> = {}, rawQueryString?: string) {
  const session = getSession(sessionId);
  
  if (!session.accessToken) {
    throw new Error('Not authenticated');
  }
  
  if (session.expiresAt && Date.now() >= session.expiresAt) {
    throw new Error('Token expired');
  }
  
  let url = `https://api.linkedin.com/rest${endpoint}`;
  
  if (rawQueryString) {
    url += `?${rawQueryString}`;
  }
  
  const response = await axios.get(url, {
    headers: {
      'Authorization': `Bearer ${session.accessToken}`,
      'LinkedIn-Version': '202511',
      'X-Restli-Protocol-Version': '2.0.0',
    },
    params: rawQueryString ? undefined : params,
  });
  
  return response.data;
}

async function linkedinApiRequestPaginated(sessionId: string, endpoint: string, params: Record<string, any> = {}, rawQueryString?: string): Promise<any[]> {
  const allElements: any[] = [];
  let pageToken: string | undefined;
  const pageSize = 500;
  
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
    
    console.log(`\n=== Fetching hierarchy for account: ${accountId} (activeOnly: ${activeOnly}) ===`);
    
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
    
    if (campaigns.length > 0) {
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
    }
    
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
            let thumbnailUrn: string | undefined;
            let detectedMediaType: string = 'Image';
            
            // Detect author type for Thought Leader vs Company Ad
            const author = postData.author || '';
            const isThoughtLeader = author.includes('urn:li:person:') || author.includes('urn:li:member:');
            authorMap[creative.id] = isThoughtLeader;
            
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
