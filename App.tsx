
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { AccountStructure, NodeType, TargetingSummary, CreativeNode, AccountSummary } from './types';
import { getAuthStatus, getAuthUrl, logout, getAvailableAccountsFromApi, buildAccountHierarchyFromApi } from './services/linkedinApi';
import { transformAccountToIdeateNodes, createTofAudiencesFromTargeting } from './services/ideateTransformer';
import { StructureTree } from './components/StructureTree';
import { AudienceFlow } from './components/AudienceFlow';
import { RemarketingFlow } from './components/RemarketingFlow';
import { TargetingInspector } from './components/TargetingInspector';
import { AIAuditor } from './components/AIAuditor';
import AuditPage from './components/AuditPage';
import { IdeateCanvas } from './components/IdeateCanvas';
import { Linkedin, Network, ListTree, ChevronDown, RefreshCw, LogIn, LogOut, ClipboardCheck, Lightbulb } from 'lucide-react';

const App: React.FC = () => {
  const [data, setData] = useState<AccountStructure | null>(null);
  const [viewMode, setViewMode] = useState<'TREE' | 'FLOW' | 'REMARKETING' | 'AUDIT' | 'IDEATE'>('TREE');
  const [accounts, setAccounts] = useState<AccountSummary[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>(() => {
    // Load saved account from localStorage
    return localStorage.getItem('selectedAccountId') || '';
  });
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeOnly, setActiveOnly] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [sharedCanvasToken, setSharedCanvasToken] = useState<string | null>(null);
  const [importedCanvasId, setImportedCanvasId] = useState<string | null>(null);
  
  // State to hold the details of the currently selected node for the inspector
  const [selectedNode, setSelectedNode] = useState<{
    type: NodeType;
    name: string;
    targeting?: TargetingSummary;
    creatives?: CreativeNode[]; // For Campaigns
    singleCreative?: CreativeNode; // For Creative Nodes
    objective?: string;
    biddingStrategy?: string;
    campaignId?: string;
  } | null>(null);

  // Check authentication status and URL params on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const authSuccess = urlParams.get('auth') === 'success';
        const authError = urlParams.get('error');
        const shareToken = urlParams.get('share');
        
        // Handle shared canvas links - switch to Ideate view
        if (shareToken) {
          setSharedCanvasToken(shareToken);
          setViewMode('IDEATE');
          // Don't clear URL so the share token stays visible
        }
        
        if (authError) {
          setError(`Authentication failed: ${authError}`);
          window.history.replaceState({}, '', '/');
        }
        
        if (authSuccess) {
          window.history.replaceState({}, '', '/');
        }
        
        const status = await getAuthStatus();
        setIsAuthenticated(status.isAuthenticated);
      } catch (err) {
        console.error('Auth check failed:', err);
      } finally {
        setIsLoading(false);
      }
    };
    
    checkAuth();
  }, []);

  // Load accounts when authenticated
  useEffect(() => {
    const loadAccounts = async () => {
      if (!isAuthenticated) {
        setAccounts([]);
        setIsLoading(false);
        return;
      }
      
      try {
        setIsLoading(true);
        const apiAccounts = await getAvailableAccountsFromApi();
        if (apiAccounts.length > 0) {
          setAccounts(apiAccounts);
          // Use saved account if it exists in the list, otherwise use first
          const savedAccountId = localStorage.getItem('selectedAccountId');
          const savedAccountExists = savedAccountId && apiAccounts.some(a => a.id === savedAccountId);
          if (savedAccountExists) {
            setSelectedAccountId(savedAccountId);
          } else if (!selectedAccountId) {
            setSelectedAccountId(apiAccounts[0].id);
            localStorage.setItem('selectedAccountId', apiAccounts[0].id);
          }
        } else {
          setError('No ad accounts found. Make sure your LinkedIn app has access to your ad accounts.');
          setAccounts([]);
        }
      } catch (err: any) {
        console.error('Failed to load accounts:', err);
        setError('Failed to load accounts from LinkedIn API');
      } finally {
        setIsLoading(false);
      }
    };
    
    loadAccounts();
  }, [isAuthenticated]);

  // Fetch Data when Account Changes
  useEffect(() => {
    const loadData = async () => {
      if (!selectedAccountId || !isAuthenticated) {
        setData(null);
        return;
      }
      
      setIsLoading(true);
      try {
        const result = await buildAccountHierarchyFromApi(selectedAccountId, activeOnly);
        setData(result);
        setSelectedNode(null);
        setError(null);
      } catch (err: any) {
        console.error('Failed to load data:', err);
        setError('Failed to load account data');
      } finally {
        setIsLoading(false);
      }
    };
    
    loadData();
  }, [selectedAccountId, isAuthenticated, activeOnly]);

  const handleLogin = async () => {
    try {
      const { authUrl } = await getAuthUrl();
      window.location.href = authUrl;
    } catch (err) {
      console.error('Login failed:', err);
      setError('Failed to initiate login');
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      setIsAuthenticated(false);
      setData(null);
      setAccounts([]);
      setError(null);
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  const handleNodeSelect = (
    type: NodeType, 
    name: string, 
    targeting?: TargetingSummary, 
    creatives?: CreativeNode[],
    singleCreative?: CreativeNode,
    objective?: string,
    biddingStrategy?: string,
    campaignId?: string
  ) => {
    setSelectedNode({ 
      type, 
      name, 
      targeting, 
      creatives,
      singleCreative,
      objective,
      biddingStrategy,
      campaignId
    });
  };

  const handleCloseInspector = () => {
    setSelectedNode(null);
  };

  const handleImportToIdeate = async (accountData: AccountStructure) => {
    try {
      const baseNodes = transformAccountToIdeateNodes(accountData);
      const audienceNodes = createTofAudiencesFromTargeting(baseNodes);
      const allNodes = [...baseNodes, ...audienceNodes];
      
      const canvasResponse = await axios.post('/api/canvas', { 
        title: `Import: ${accountData.name}` 
      });
      const newCanvasId = canvasResponse.data.id;
      
      await axios.post(`/api/canvas/${newCanvasId}/save`, {
        nodes: allNodes,
        connections: [],
        settings: { transform: { x: 50, y: 30, scale: 0.85 } }
      });
      
      setImportedCanvasId(newCanvasId);
      setViewMode('IDEATE');
    } catch (err) {
      console.error('Failed to import to Ideate:', err);
      alert('Failed to import campaign structure. Please try again.');
    }
  };

  const handleAccountChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newAccountId = e.target.value;
    setSelectedAccountId(newAccountId);
    // Save to localStorage so it persists across refreshes
    localStorage.setItem('selectedAccountId', newAccountId);
  };

  if (isLoading && !data) {
    return (
      <div className="flex h-screen items-center justify-center text-gray-500">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 animate-spin text-[#0077b5]" />
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      {/* Error Banner */}
      {error && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-3">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <p className="text-sm text-red-700">{error}</p>
            <button 
              onClick={() => setError(null)}
              className="text-red-500 hover:text-red-700"
            >
              &times;
            </button>
          </div>
        </div>
      )}

      {/* Header - Hidden for shared canvas view */}
      {!sharedCanvasToken && (
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Linkedin className="w-8 h-8 text-[#0077b5]" />
            <div className="flex flex-col">
              <h1 className="text-xl font-bold text-gray-900 tracking-tight leading-none">Audience Visualizer</h1>
              
              {/* Account Switcher - only show when authenticated */}
              {isAuthenticated && accounts.length > 0 && (
              <div className="relative mt-1 flex items-center gap-2">
                 <select 
                   value={selectedAccountId} 
                   onChange={handleAccountChange}
                   className="appearance-none bg-transparent text-xs text-gray-600 font-medium pr-6 py-0 focus:outline-none cursor-pointer hover:text-gray-900"
                 >
                   {accounts.map(account => (
                     <option key={account.id} value={account.id}>
                       {account.name} ({account.id})
                     </option>
                   ))}
                 </select>
                 <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
              </div>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-4">
             {/* Active Only Toggle - only show when authenticated */}
             {isAuthenticated && (
               <button
                 onClick={() => setActiveOnly(!activeOnly)}
                 className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all border ${
                   activeOnly 
                     ? 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100' 
                     : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                 }`}
                 title={activeOnly ? 'Show all campaigns' : 'Show only active campaigns'}
               >
                 {activeOnly ? 'Active Only' : 'All Status'}
               </button>
             )}

             {/* Auth Button */}
             {isAuthenticated ? (
               <button
                 onClick={handleLogout}
                 className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all"
               >
                 <LogOut size={16} />
                 Logout
               </button>
             ) : (
               <button
                 onClick={handleLogin}
                 className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium bg-[#0077b5] text-white hover:bg-[#005f8e] transition-all"
               >
                 <LogIn size={16} />
                 Login
               </button>
             )}
             
             {/* View Toggle */}
             <div className="bg-gray-100 p-1 rounded-lg flex items-center">
                <button 
                  onClick={() => { setViewMode('TREE'); setImportedCanvasId(null); }}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'TREE' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  <ListTree size={16} />
                  Structure
                </button>
                <button 
                  onClick={() => setViewMode('FLOW')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'FLOW' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  <Network size={16} />
                  Targeting Flow
                </button>
                <button 
                  onClick={() => setViewMode('REMARKETING')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'REMARKETING' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  <RefreshCw size={16} />
                  Remarketing
                </button>
                <button 
                  onClick={() => setViewMode('AUDIT')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'AUDIT' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  <ClipboardCheck size={16} />
                  Audit
                </button>
                <button 
                  onClick={() => setViewMode('IDEATE')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'IDEATE' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  <Lightbulb size={16} />
                  Ideate
                </button>
             </div>

             <div className="text-right hidden sm:block border-l pl-4 ml-2">
               <span className="block text-xs text-gray-400 uppercase font-bold">Total Groups</span>
               <span className="block text-sm font-medium text-gray-900">{data?.groups?.length || 0} Active</span>
             </div>
          </div>
        </div>
      </header>
      )}

      {/* Main Content */}
      <main className={`flex-1 overflow-hidden flex flex-col ${sharedCanvasToken ? 'p-0' : 'max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8'}`}>
        {viewMode !== 'AUDIT' && viewMode !== 'IDEATE' && (
          <div className="mb-6 flex-shrink-0">
            <h2 className="text-lg font-semibold text-gray-800 mb-1">
              {viewMode === 'TREE' ? 'Account Hierarchy' : 
               viewMode === 'FLOW' ? 'Targeting Composition' : 'Remarketing Strategy Loop'}
            </h2>
            <p className="text-sm text-gray-500">
               {viewMode === 'TREE' 
                 ? 'Navigate the structural parent-child relationships from Groups down to Creatives.' 
                 : viewMode === 'FLOW'
                 ? 'Visualize how specific audiences, locations, and segments are shared across multiple campaigns.'
                 : 'Visualize the journey from Cold Traffic sources -> Campaign -> Retargeting Pool -> Remarketing Campaign.'
               }
            </p>
          </div>
        )}
        
        {viewMode === 'IDEATE' && !sharedCanvasToken && (
          <div className="mb-6 flex-shrink-0">
            <h2 className="text-lg font-semibold text-gray-800 mb-1">Campaign Ideation Canvas</h2>
            <p className="text-sm text-gray-500">
              Plan and visualize your campaign structure. Use AI to generate ideas or manually create your funnel.
            </p>
          </div>
        )}

        <div className="flex-1 min-h-0 relative">
          {viewMode === 'IDEATE' ? (
            <IdeateCanvas 
              shareToken={sharedCanvasToken || undefined} 
              canvasId={importedCanvasId || undefined}
              key={importedCanvasId || 'default'}
            />
          ) : viewMode === 'AUDIT' ? (
            <AuditPage 
              accountId={selectedAccountId}
              accountName={accounts.find(a => a.id === selectedAccountId)?.name || `Account ${selectedAccountId}`}
              isLiveData={isAuthenticated}
              onNavigateToCampaign={(campaignId) => {
                setViewMode('TREE');
              }}
            />
          ) : !data ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              <div className="text-center">
                <p className="mb-4">No data available</p>
                {!isAuthenticated && (
                  <button
                    onClick={handleLogin}
                    className="px-4 py-2 bg-[#0077b5] text-white rounded-md hover:bg-[#005f8e] transition-all"
                  >
                    Connect LinkedIn to view real data
                  </button>
                )}
              </div>
            </div>
          ) : (
            <>
              {viewMode === 'TREE' && (
                <StructureTree 
                  data={data}
                  onSelect={handleNodeSelect}
                  onImportToIdeate={handleImportToIdeate}
                />
              )}

              {viewMode === 'FLOW' && (
                <AudienceFlow 
                  data={data} 
                  onSelect={handleNodeSelect}
                />
              )}

              {viewMode === 'REMARKETING' && (
                 <RemarketingFlow
                   data={data}
                   onSelect={handleNodeSelect}
                 />
              )}
            </>
          )}
        </div>

      </main>
      
      {/* Side Panel */}
      <TargetingInspector 
        node={selectedNode} 
        onClose={handleCloseInspector}
        accountId={selectedAccountId}
        isLiveData={isAuthenticated}
      />

      {/* Overlay for side panel on mobile */}
      {selectedNode && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-25 z-40 md:hidden"
          onClick={handleCloseInspector}
        />
      )}

      {/* AI Auditor Chat Widget */}
      <AIAuditor
        data={data}
        accountId={selectedAccountId}
        isLiveData={isAuthenticated}
      />
    </div>
  );
};

export default App;
