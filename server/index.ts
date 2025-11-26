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

async function linkedinApiRequestPaginated(sessionId: string, endpoint: string, params: Record<string, any> = {}): Promise<any[]> {
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
    
    const response = await linkedinApiRequest(sessionId, endpoint, requestParams);
    
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
    const data = await linkedinApiRequest((req as any).sessionId, `/adAccounts/${accountId}/dmpSegments`, {
      q: 'criteria',
    });
    res.json(data);
  } catch (err: any) {
    console.error('Segments error:', err.response?.data || err.message);
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
        }
      } catch (err: any) {
        const errorMsg = `Creatives error: ${JSON.stringify(err.response?.data || err.message)}`;
        console.error(errorMsg);
        errors.push(errorMsg);
      }
    }
    
    try {
      segments = await linkedinApiRequestPaginated(sessionId, `/adAccounts/${accountId}/dmpSegments`, {
        q: 'criteria',
        account: `urn:li:sponsoredAccount:${accountId}`,
      });
      console.log(`Segments fetched: ${segments.length} items`);
      if (segments.length > 0) {
        console.log(`First segment sample: ${JSON.stringify(segments[0], null, 2).substring(0, 500)}`);
      }
    } catch (err: any) {
      const errorMsg = `Segments error: ${JSON.stringify(err.response?.data || err.message)}`;
      console.error(errorMsg);
      errors.push(errorMsg);
    }
    
    console.log(`=== Summary: ${groups.length} groups, ${campaigns.length} campaigns, ${creatives.length} creatives, ${segments.length} segments ===\n`);
    
    res.json({
      groups,
      campaigns,
      creatives,
      segments,
      _debug: errors.length > 0 ? { errors } : undefined,
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

const HOST = '0.0.0.0';
app.listen(PORT, HOST, () => {
  console.log(`LinkedIn API server running on http://${HOST}:${PORT}`);
});
