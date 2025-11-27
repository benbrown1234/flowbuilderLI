
import React, { useLayoutEffect, useRef, useState, useEffect } from 'react';
import { AccountStructure, NodeType, TargetingSummary, CreativeNode, OnSelectHandler } from '../types';
import { getAllTargetingConnections, FlowData } from '../services/linkedinLogic';
import { Globe, Users, Briefcase, Target, UserX, ArrowRight, Layers, ChevronDown, X } from 'lucide-react';

interface AudienceFlowProps {
  data: AccountStructure;
  onSelect: OnSelectHandler;
}

interface TooltipState {
  id: string;
  x: number;
  y: number;
  items: string[];
}

export const AudienceFlow: React.FC<AudienceFlowProps> = ({ data, onSelect }) => {
  const [flowData, setFlowData] = useState<FlowData | null>(null);
  const [lines, setLines] = useState<{ x1: number, y1: number, x2: number, y2: number, key: string, type: string }[]>([]);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('all');
  const [showGroupDropdown, setShowGroupDropdown] = useState(false);
  const [lineRecalcKey, setLineRecalcKey] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  useEffect(() => {
    const fd = getAllTargetingConnections(data);
    setFlowData(fd);
  }, [data]);

  const campaignGroups = data.groups.map(g => ({ id: g.id, name: g.name }));

  const getFilteredData = () => {
    if (!flowData) return { campaigns: [], facets: [], connections: [] };
    
    let campaigns = flowData.campaigns;
    let connections = flowData.connections;
    let facets = flowData.facets;
    
    if (selectedGroupId !== 'all') {
      campaigns = flowData.campaigns.filter(c => c.groupId === selectedGroupId);
      const campaignIds = new Set(campaigns.map(c => c.id));
      connections = flowData.connections.filter(conn => campaignIds.has(conn.targetId));
      const connectedFacetIds = new Set(connections.map(c => c.sourceId));
      facets = flowData.facets.filter(f => connectedFacetIds.has(f.id));
    }
    
    if (selectedNode) {
      const isCampaign = campaigns.some(c => c.id === selectedNode);
      const isFacet = facets.some(f => f.id === selectedNode);
      
      if (isCampaign) {
        const connectedFacetIds = new Set(
          connections.filter(c => c.targetId === selectedNode).map(c => c.sourceId)
        );
        facets = facets.filter(f => connectedFacetIds.has(f.id));
        campaigns = campaigns.filter(c => c.id === selectedNode);
        connections = connections.filter(c => c.targetId === selectedNode);
      } else if (isFacet) {
        const connectedCampaignIds = new Set(
          connections.filter(c => c.sourceId === selectedNode).map(c => c.targetId)
        );
        campaigns = campaigns.filter(c => connectedCampaignIds.has(c.id));
        facets = facets.filter(f => f.id === selectedNode);
        connections = connections.filter(c => c.sourceId === selectedNode);
      }
    }
    
    return { campaigns, facets, connections };
  };

  const { campaigns: filteredCampaigns, facets: filteredFacets, connections: filteredConnections } = getFilteredData();

  const includedFacets = filteredFacets.filter(f => f.type !== 'EXCLUSION');
  const excludedFacets = filteredFacets.filter(f => f.type === 'EXCLUSION');

  const calculateLines = () => {
    if (!containerRef.current) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const newLines: typeof lines = [];

    filteredConnections.forEach((conn) => {
      const sourceEl = itemRefs.current.get(conn.sourceId);
      const targetEl = itemRefs.current.get(conn.targetId);

      if (sourceEl && targetEl) {
        const sourceRect = sourceEl.getBoundingClientRect();
        const targetRect = targetEl.getBoundingClientRect();

        const x1 = sourceRect.right - containerRect.left;
        const y1 = sourceRect.top + sourceRect.height / 2 - containerRect.top;
        const x2 = targetRect.left - containerRect.left;
        const y2 = targetRect.top + targetRect.height / 2 - containerRect.top;

        if (x1 > 0 && y1 > 0 && x2 > 0 && y2 > 0) {
          const facet = filteredFacets.find(f => f.id === conn.sourceId);
          newLines.push({
            x1, y1, x2, y2,
            key: `${conn.sourceId}-${conn.targetId}`,
            type: facet?.type || 'UNKNOWN'
          });
        }
      }
    });

    setLines(newLines);
  };

  useLayoutEffect(() => {
    itemRefs.current.clear();
  }, [selectedGroupId, selectedNode]);

  useLayoutEffect(() => {
    const timer = setTimeout(calculateLines, 150);
    return () => clearTimeout(timer);
  }, [filteredConnections, lineRecalcKey]);

  useEffect(() => {
    const handleResize = () => {
      setLineRecalcKey(k => k + 1);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    setLineRecalcKey(k => k + 1);
  }, [selectedGroupId, selectedNode]);

  if (!flowData) return null;

  const handleCampaignClick = (id: string) => {
    if (selectedNode === id) {
      setSelectedNode(null);
    } else {
      setSelectedNode(id);
    }
    
    for (const group of data.groups) {
      const campaign = group.children.find(c => c.id === id);
      if (campaign) {
        onSelect(
          NodeType.CAMPAIGN, 
          campaign.name, 
          campaign.targetingResolved, 
          campaign.children, 
          undefined, 
          campaign.objective, 
          campaign.biddingStrategy
        );
        return;
      }
    }
  };

  const handleFacetClick = (id: string) => {
    if (selectedNode === id) {
      setSelectedNode(null);
    } else {
      setSelectedNode(id);
    }
  };

  const handleMouseEnterFacet = (item: typeof flowData.facets[0], e: React.MouseEvent) => {
    if (item.count > 1 && item.items) {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      setTooltip({
        id: item.id,
        x: rect.right + 10,
        y: rect.top,
        items: item.items
      });
    }
  };

  const handleMouseLeaveFacet = () => {
    setTooltip(null);
  };

  const clearSelection = () => {
    setSelectedNode(null);
  };

  const getIcon = (type: string) => {
    switch(type) {
      case 'GEO': return <Globe size={14} />;
      case 'AUDIENCE': return <Users size={14} />;
      case 'JOB': return <Target size={14} />;
      case 'INDUSTRY': return <Briefcase size={14} />;
      case 'EXCLUSION': return <UserX size={14} />;
      default: return <Users size={14} />;
    }
  };

  const getColor = (type: string) => {
    switch(type) {
      case 'GEO': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'AUDIENCE': return 'text-purple-600 bg-purple-50 border-purple-200';
      case 'JOB': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'INDUSTRY': return 'text-indigo-600 bg-indigo-50 border-indigo-200';
      case 'EXCLUSION': return 'text-red-600 bg-red-50 border-red-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getStrokeColor = (type: string) => {
    switch(type) {
      case 'GEO': return '#2563eb';
      case 'AUDIENCE': return '#9333ea';
      case 'JOB': return '#ea580c';
      case 'INDUSTRY': return '#4f46e5';
      case 'EXCLUSION': return '#dc2626';
      default: return '#6b7280';
    }
  };

  const renderFacetItem = (item: typeof flowData.facets[0]) => {
     const isBundle = item.count > 1;
     const isSelected = selectedNode === item.id;
     
     return (
       <div
         key={item.id}
         ref={el => { if (el) itemRefs.current.set(item.id, el) }}
         onMouseEnter={(e) => handleMouseEnterFacet(item, e)}
         onMouseLeave={handleMouseLeaveFacet}
         onClick={() => handleFacetClick(item.id)}
         className={`
           relative
           p-3 rounded-lg border cursor-pointer transition-all duration-200 flex items-center justify-between group mb-2
           ${getColor(item.type)}
           ${isSelected ? 'ring-2 ring-offset-1 ring-blue-500 shadow-lg scale-105' : 'hover:shadow-md'}
           ${isBundle ? 'border-b-4 border-r-4' : ''}
         `}
       >
         <span className="flex items-center gap-2 text-xs font-semibold">
            {isBundle ? <Layers size={14} /> : getIcon(item.type)}
            <span className="truncate max-w-[180px]" title={item.label}>
              {item.label}
            </span>
         </span>
         {isBundle && (
            <span className="bg-white bg-opacity-50 text-[10px] px-1.5 rounded font-bold">
              {item.count}
            </span>
         )}
       </div>
     );
  }

  const selectedGroupName = selectedGroupId !== 'all'
    ? campaignGroups.find(g => g.id === selectedGroupId)?.name 
    : null;

  return (
    <div className="w-full relative bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden min-h-[600px] p-6" ref={containerRef}>
      
      {/* Campaign Group Filter Dropdown - Top Right */}
      <div className="absolute top-4 right-4 z-30">
        <div className="relative">
          <button
            onClick={() => setShowGroupDropdown(!showGroupDropdown)}
            className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors min-w-[220px] justify-between"
          >
            <span className="truncate text-left flex-1">
              {selectedGroupName || 'All Campaign Groups'}
            </span>
            <ChevronDown size={16} className={`flex-shrink-0 transition-transform ${showGroupDropdown ? 'rotate-180' : ''}`} />
          </button>
          
          {showGroupDropdown && (
            <div className="absolute top-full right-0 mt-1 w-72 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
              <button
                onClick={() => {
                  setSelectedGroupId('all');
                  setShowGroupDropdown(false);
                  setSelectedNode(null);
                }}
                className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors ${selectedGroupId === 'all' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'}`}
              >
                All Campaign Groups
              </button>
              {campaignGroups.map(group => (
                <button
                  key={group.id}
                  onClick={() => {
                    setSelectedGroupId(group.id);
                    setShowGroupDropdown(false);
                    setSelectedNode(null);
                  }}
                  className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors border-t border-gray-100 ${selectedGroupId === group.id ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'}`}
                >
                  <span className="block truncate">{group.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Clear Selection Button */}
      {selectedNode && (
        <button
          onClick={clearSelection}
          className="absolute top-4 left-4 z-30 flex items-center gap-2 px-3 py-2 bg-gray-800 text-white rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors shadow-lg"
        >
          <X size={14} />
          Clear Selection
        </button>
      )}

      {/* SVG Layer for Connections */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 5 }}>
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        {lines.map((line) => {
           const stroke = getStrokeColor(line.type);
           const midX = (line.x1 + line.x2) / 2;
           
           return (
            <path
              key={line.key}
              d={`M ${line.x1} ${line.y1} C ${midX} ${line.y1}, ${midX} ${line.y2}, ${line.x2} ${line.y2}`}
              fill="none"
              stroke={stroke}
              strokeWidth={2}
              strokeOpacity={0.7}
              filter="url(#glow)"
            />
          );
        })}
      </svg>

      {/* Portal Tooltip */}
      {tooltip && (
        <div 
          className="fixed z-50 bg-gray-800 text-white text-xs rounded p-3 w-56 shadow-xl pointer-events-none"
          style={{ top: tooltip.y, left: tooltip.x }}
        >
           <div className="font-bold mb-2 border-b border-gray-600 pb-1 text-gray-300 uppercase tracking-wider text-[10px]">
             Bundled Items
           </div>
           <ul className="list-disc pl-3 space-y-1">
             {tooltip.items.slice(0, 10).map((sub, i) => (
               <li key={i}>{sub}</li>
             ))}
             {tooltip.items.length > 10 && <li className="italic text-gray-400">...and {tooltip.items.length - 10} more</li>}
           </ul>
        </div>
      )}

      <div className="flex h-full relative z-10 justify-between pt-12">
        {/* Left Column: Facets */}
        <div className="w-[300px] flex flex-col pr-4 h-full gap-6 flex-shrink-0">
           
           {/* Inclusions */}
           <div className="overflow-y-auto pr-2 flex-1">
             <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4 border-b pb-2 flex items-center justify-between">
               <span>Targeting Inclusions</span>
               <span className="text-gray-300">{includedFacets.length}</span>
             </h3>
             {includedFacets.length > 0 ? includedFacets.map(renderFacetItem) : (
                <div className="text-sm text-gray-300 italic text-center py-4">
                  No inclusions found
                </div>
             )}
           </div>

           {/* Exclusions */}
           <div className="pt-4 border-t border-gray-200 overflow-y-auto pr-2 max-h-[35%]">
             <h3 className="text-xs font-bold uppercase tracking-wider text-red-400 mb-4 border-b border-red-100 pb-2 flex items-center justify-between">
               <span>Exclusions</span>
               <span className="text-red-300">{excludedFacets.length}</span>
             </h3>
             {excludedFacets.length > 0 ? excludedFacets.map(renderFacetItem) : (
                <div className="text-sm text-gray-300 italic text-center py-4">
                  No exclusions found
                </div>
             )}
           </div>
        </div>

        {/* Right Column: Campaigns */}
        <div className="w-[300px] pl-4 border-l border-gray-100 overflow-y-auto flex-shrink-0">
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4 border-b pb-2 flex items-center justify-between">
            <span>Destination Campaigns</span>
            <span className="text-gray-300">{filteredCampaigns.length}</span>
          </h3>
          <div className="flex flex-col gap-3">
            {filteredCampaigns.length > 0 ? filteredCampaigns.map((camp) => {
              const isSelected = selectedNode === camp.id;
              
              return (
                <div
                  key={camp.id}
                  ref={el => { if (el) itemRefs.current.set(camp.id, el) }}
                  onClick={() => handleCampaignClick(camp.id)}
                  className={`
                    p-3 rounded-lg border border-gray-200 bg-white shadow-sm hover:shadow-md transition-all cursor-pointer
                    ${isSelected ? 'ring-2 ring-offset-1 ring-orange-500 shadow-lg scale-105' : ''}
                  `}
                >
                  <div className="flex items-center justify-between mb-1">
                     <span className="text-[9px] font-bold text-gray-400 uppercase truncate pr-1">{camp.groupName}</span>
                  </div>
                  <div className="font-semibold text-gray-800 text-xs leading-tight">{camp.name}</div>
                </div>
              );
            }) : (
              <div className="text-sm text-gray-300 italic text-center py-4">
                No campaigns found
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Click outside to close dropdown */}
      {showGroupDropdown && (
        <div 
          className="fixed inset-0 z-20" 
          onClick={() => setShowGroupDropdown(false)}
        />
      )}
    </div>
  );
};
