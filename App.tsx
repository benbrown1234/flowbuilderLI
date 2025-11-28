
import React, { useEffect, useState } from 'react';
import { AccountStructure, NodeType, TargetingSummary, CreativeNode, AccountSummary } from './types';
import { buildAccountHierarchy, getAvailableAccounts } from './services/linkedinLogic';
import { getAuthStatus, getAuthUrl, logout, getAvailableAccountsFromApi, buildAccountHierarchyFromApi } from './services/linkedinApi';
import { StructureTree } from './components/StructureTree';
import { AudienceFlow } from './components/AudienceFlow';
import { RemarketingFlow } from './components/RemarketingFlow';
import { TargetingInspector } from './components/TargetingInspector';
import { Linkedin, Network, ListTree, ChevronDown, RefreshCw, LogIn, LogOut, Database } from 'lucide-react';

const App: React.FC = () => {
  const [data, setData] = useState<AccountStructure | null>(null);
  const [viewMode, setViewMode] = useState<'TREE' | 'FLOW' | 'REMARKETING'>('TREE');
  const [accounts, setAccounts] = useState<AccountSummary[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>(() => {
    // Load saved account from localStorage
    return localStorage.getItem('selectedAccountId') || '';
  });
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [useRealData, setUseRealData] = useState<boolean>(false);
  const [activeOnly, setActiveOnly] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
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
        
        if (authError) {
          setError(`Authentication failed: ${authError}`);
          window.history.replaceState({}, '', '/');
        }
        
        if (authSuccess) {
          window.history.replaceState({}, '', '/');
        }
        
        const status = await getAuthStatus();
        setIsAuthenticated(status.isAuthenticated);
        
        if (status.isAuthenticated) {
          setUseRealData(true);
        }
      } catch (err) {
        console.error('Auth check failed:', err);
      } finally {
        setIsLoading(false);
      }
    };
    
    checkAuth();
  }, []);

  // Load accounts based on data source
  useEffect(() => {
    const loadAccounts = async () => {
      if (useRealData && isAuthenticated) {
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
      } else {
        const available = getAvailableAccounts();
        setAccounts(available);
        // Use saved account if it exists in demo list, otherwise use first
        const savedAccountId = localStorage.getItem('selectedAccountId');
        const savedAccountExists = savedAccountId && available.some(a => a.id === savedAccountId);
        if (savedAccountExists) {
          setSelectedAccountId(savedAccountId);
        } else if (available.length > 0 && !selectedAccountId) {
          setSelectedAccountId(available[0].id);
        }
      }
    };
    
    loadAccounts();
  }, [useRealData, isAuthenticated]);

  // Fetch Data when Account Changes
  useEffect(() => {
    const loadData = async () => {
      if (!selectedAccountId) return;
      
      setIsLoading(true);
      try {
        let result: AccountStructure | null;
        
        if (useRealData && isAuthenticated) {
          result = await buildAccountHierarchyFromApi(selectedAccountId, activeOnly);
        } else {
          result = buildAccountHierarchy(selectedAccountId);
        }
        
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
  }, [selectedAccountId, useRealData, isAuthenticated, activeOnly]);

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
      setUseRealData(false);
      setError(null);
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  const toggleDataSource = () => {
    if (!isAuthenticated && !useRealData) {
      handleLogin();
    } else {
      setUseRealData(!useRealData);
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

      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Linkedin className="w-8 h-8 text-[#0077b5]" />
            <div className="flex flex-col">
              <h1 className="text-xl font-bold text-gray-900 tracking-tight leading-none">Audience Visualizer</h1>
              
              {/* Account Switcher */}
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
                 <ChevronDown className="absolute right-12 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
                 
                 {/* Data Source Badge */}
                 <span className={`text-xs px-2 py-0.5 rounded-full ${useRealData ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                   {useRealData ? 'Live' : 'Demo'}
                 </span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
             {/* Data Source Toggle */}
             <button
               onClick={toggleDataSource}
               className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all border ${
                 useRealData 
                   ? 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100' 
                   : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
               }`}
               title={useRealData ? 'Switch to demo data' : 'Connect LinkedIn to use real data'}
             >
               <Database size={16} />
               {useRealData ? 'Live Data' : 'Demo Data'}
             </button>

             {/* Active Only Toggle - only show when using real data */}
             {useRealData && isAuthenticated && (
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
                 Connect LinkedIn
               </button>
             )}
             
             {/* View Toggle */}
             <div className="bg-gray-100 p-1 rounded-lg flex items-center">
                <button 
                  onClick={() => setViewMode('TREE')}
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
             </div>

             <div className="text-right hidden sm:block border-l pl-4 ml-2">
               <span className="block text-xs text-gray-400 uppercase font-bold">Total Groups</span>
               <span className="block text-sm font-medium text-gray-900">{data?.groups?.length || 0} Active</span>
             </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 overflow-hidden flex flex-col">
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

        <div className="flex-1 min-h-0 relative">
          {!data ? (
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
        isLiveData={useRealData}
      />

      {/* Overlay for side panel on mobile */}
      {selectedNode && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-25 z-40 md:hidden"
          onClick={handleCloseInspector}
        />
      )}
    </div>
  );
};

export default App;
