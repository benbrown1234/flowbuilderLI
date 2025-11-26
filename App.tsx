
import React, { useEffect, useState } from 'react';
import { AccountStructure, NodeType, TargetingSummary, CreativeNode, AccountSummary } from './types';
import { buildAccountHierarchy, getAvailableAccounts } from './services/linkedinLogic';
import { StructureTree } from './components/StructureTree';
import { AudienceFlow } from './components/AudienceFlow';
import { RemarketingFlow } from './components/RemarketingFlow';
import { TargetingInspector } from './components/TargetingInspector';
import { Linkedin, Network, ListTree, ChevronDown, RefreshCw } from 'lucide-react';

const App: React.FC = () => {
  const [data, setData] = useState<AccountStructure | null>(null);
  const [viewMode, setViewMode] = useState<'TREE' | 'FLOW' | 'REMARKETING'>('TREE');
  const [accounts, setAccounts] = useState<AccountSummary[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  
  // State to hold the details of the currently selected node for the inspector
  const [selectedNode, setSelectedNode] = useState<{
    type: NodeType;
    name: string;
    targeting?: TargetingSummary;
    creatives?: CreativeNode[]; // For Campaigns
    singleCreative?: CreativeNode; // For Creative Nodes
    objective?: string;
    biddingStrategy?: string;
  } | null>(null);

  // Initial Load of Accounts
  useEffect(() => {
    const available = getAvailableAccounts();
    setAccounts(available);
    if (available.length > 0) {
      setSelectedAccountId(available[0].id);
    }
  }, []);

  // Fetch Data when Account Changes
  useEffect(() => {
    if (selectedAccountId) {
      // Simulate API Fetch
      const result = buildAccountHierarchy(selectedAccountId);
      setData(result);
      setSelectedNode(null); // Clear inspector when account changes
    }
  }, [selectedAccountId]);

  const handleNodeSelect = (
    type: NodeType, 
    name: string, 
    targeting?: TargetingSummary, 
    creatives?: CreativeNode[],
    singleCreative?: CreativeNode,
    objective?: string,
    biddingStrategy?: string
  ) => {
    setSelectedNode({ 
      type, 
      name, 
      targeting, 
      creatives,
      singleCreative,
      objective,
      biddingStrategy
    });
  };

  const handleCloseInspector = () => {
    setSelectedNode(null);
  };

  const handleAccountChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedAccountId(e.target.value);
  };

  if (!data) return <div className="flex h-screen items-center justify-center text-gray-500">Loading hierarchy...</div>;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Linkedin className="w-8 h-8 text-[#0077b5]" />
            <div className="flex flex-col">
              <h1 className="text-xl font-bold text-gray-900 tracking-tight leading-none">Audience Visualizer</h1>
              
              {/* Account Switcher */}
              <div className="relative mt-1">
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
            </div>
          </div>
          
          <div className="flex items-center gap-4">
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
               <span className="block text-sm font-medium text-gray-900">{data.groups.length} Active</span>
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
        </div>

      </main>
      
      {/* Side Panel */}
      <TargetingInspector 
        node={selectedNode} 
        onClose={handleCloseInspector} 
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
