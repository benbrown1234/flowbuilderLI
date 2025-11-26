import express from 'express';
import cors from 'cors';
import axios from 'axios';
import cookieParser from 'cookie-parser';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
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
  
  const scope = 'rw_ads r_basicprofile r_organization_social';
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

async function linkedinApiRequest(sessionId: string, endpoint: string, params: Record<string, any> = {}) {
  const session = getSession(sessionId);
  
  if (!session.accessToken) {
    throw new Error('Not authenticated');
  }
  
  if (session.expiresAt && Date.now() >= session.expiresAt) {
    throw new Error('Token expired');
  }
  
  const response = await axios.get(`https://api.linkedin.com/rest${endpoint}`, {
    headers: {
      'Authorization': `Bearer ${session.accessToken}`,
      'LinkedIn-Version': '202411',
      'X-Restli-Protocol-Version': '2.0.0',
    },
    params,
  });
  
  return response.data;
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
    const data = await linkedinApiRequest((req as any).sessionId, '/adCampaigns', {
      q: 'search',
      search: `(account:(values:List(urn:li:sponsoredAccount:${accountId})))`,
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
    const data = await linkedinApiRequest((req as any).sessionId, '/adCampaignGroups', {
      q: 'search',
      search: `(account:(values:List(urn:li:sponsoredAccount:${accountId})))`,
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
    const data = await linkedinApiRequest((req as any).sessionId, '/adCreatives', {
      q: 'search',
      search: `(account:(values:List(urn:li:sponsoredAccount:${accountId})))`,
    });
    res.json(data);
  } catch (err: any) {
    console.error('Creatives error:', err.response?.data || err.message);
    res.status(err.response?.status || 500).json({ 
      error: err.response?.data || err.message 
    });
  }
});

app.get('/api/linkedin/account/:accountId/hierarchy', requireAuth, async (req, res) => {
  try {
    const { accountId } = req.params;
    const sessionId = (req as any).sessionId;
    
    console.log(`Fetching hierarchy for account: ${accountId}`);
    
    // Fetch each endpoint separately to identify which one fails
    let groupsData, campaignsData, creativesData;
    
    try {
      groupsData = await linkedinApiRequest(sessionId, '/adCampaignGroups', {
        q: 'search',
        search: `(account:(values:List(urn:li:sponsoredAccount:${accountId})))`,
      });
      console.log(`Campaign groups fetched: ${groupsData.elements?.length || 0} items`);
    } catch (err: any) {
      console.error('Failed to fetch campaign groups:', err.response?.data || err.message);
      groupsData = { elements: [] };
    }
    
    try {
      campaignsData = await linkedinApiRequest(sessionId, '/adCampaigns', {
        q: 'search',
        search: `(account:(values:List(urn:li:sponsoredAccount:${accountId})))`,
      });
      console.log(`Campaigns fetched: ${campaignsData.elements?.length || 0} items`);
    } catch (err: any) {
      console.error('Failed to fetch campaigns:', err.response?.data || err.message);
      campaignsData = { elements: [] };
    }
    
    try {
      creativesData = await linkedinApiRequest(sessionId, '/adCreatives', {
        q: 'search',
        search: `(account:(values:List(urn:li:sponsoredAccount:${accountId})))`,
      });
      console.log(`Creatives fetched: ${creativesData.elements?.length || 0} items`);
    } catch (err: any) {
      console.error('Failed to fetch creatives:', err.response?.data || err.message);
      creativesData = { elements: [] };
    }
    
    res.json({
      groups: groupsData.elements || [],
      campaigns: campaignsData.elements || [],
      creatives: creativesData.elements || [],
    });
  } catch (err: any) {
    console.error('Hierarchy error:', err.response?.data || err.message);
    res.status(err.response?.status || 500).json({ 
      error: err.response?.data || err.message 
    });
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

const HOST = isProduction ? '0.0.0.0' : 'localhost';
app.listen(PORT, HOST, () => {
  console.log(`LinkedIn API server running on http://${HOST}:${PORT}`);
});
