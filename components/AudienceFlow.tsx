
import React, { useLayoutEffect, useRef, useState, useEffect } from 'react';
import { AccountStructure, NodeType, TargetingSummary, CreativeNode, OnSelectHandler } from '../types';
import { getAllTargetingConnections, FlowData } from '../services/linkedinLogic';
import { Globe, Users, Briefcase, Target, UserX, ArrowRight, MousePointerClick, Layers, ChevronDown, X } from 'lucide-react';

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
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [showGroupDropdown, setShowGroupDropdown] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  useEffect(() => {
    setFlowData(getAllTargetingConnections(data));
  }, [data]);

  const calculateLines = () => {
    if (!flowData || !containerRef.current) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const newLines: typeof lines = [];

    flowData.connections.forEach((conn) => {
      const sourceEl = itemRefs.current.get(conn.sourceId);
      const targetEl = itemRefs.current.get(conn.targetId);

      if (sourceEl && targetEl) {
        const sourceRect = sourceEl.getBoundingClientRect();
        const targetRect = targetEl.getBoundingClientRect();

        newLines.push({
          x1: sourceRect.right - containerRect.left,
          y1: sourceRect.top + sourceRect.height / 2 - containerRect.top,
          x2: targetRect.left - containerRect.left,
          y2: targetRect.top + targetRect.height / 2 - containerRect.top,
          key: `${conn.sourceId}-${conn.targetId}`,
          type: flowData.facets.find(f => f.id === conn.sourceId)?.type || 'UNKNOWN'
        });
      }
    });

    setLines(newLines);
  };

  useLayoutEffect(() => {
    calculateLines();
    window.addEventListener('resize', calculateLines);
    const timer = setTimeout(calculateLines, 100);
    return () => {
        window.removeEventListener('resize', calculateLines);
        clearTimeout(timer);
    };
  }, [flowData, selectedNode, selectedGroupId]);

  useEffect(() => {
    const timer = setTimeout(calculateLines, 50);
    return () => clearTimeout(timer);
  }, [selectedNode, selectedGroupId]);

  if (!flowData) return null;

  const campaignGroups = data.groups.map(g => ({ id: g.id, name: g.name }));

  const filteredCampaigns = selectedGroupId 
    ? flowData.campaigns.filter(camp => camp.groupId === selectedGroupId)
    : flowData.campaigns;

  const filteredCampaignIds = new Set(filteredCampaigns.map(c => c.id));
  
  const filteredConnections = selectedGroupId
    ? flowData.connections.filter(conn => filteredCampaignIds.has(conn.targetId))
    : flowData.connections;

  const connectedFacetIds = new Set(filteredConnections.map(c => c.sourceId));
  
  const filteredFacets = selectedGroupId
    ? flowData.facets.filter(f => connectedFacetIds.has(f.id))
    : flowData.facets;

  const getConnectedFacetIds = (nodeId: string): Set<string> => {
    const connected = new Set<string>();
    filteredConnections.forEach(conn => {
      if (conn.targetId === nodeId) {
        connected.add(conn.sourceId);
      }
      if (conn.sourceId === nodeId) {
        connected.add(conn.targetId);
      }
    });
    return connected;
  };

  const getConnectedCampaignIds = (facetId: string): Set<string> => {
    const connected = new Set<string>();
    filteredConnections.forEach(conn => {
      if (conn.sourceId === facetId) {
        connected.add(conn.targetId);
      }
    });
    return connected;
  };

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
    if (!selectedNode) {
      setHoveredNode(item.id);
    }
    
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
    if (!selectedNode) {
      setHoveredNode(null);
    }
    setTooltip(null);
  };

  const handleMouseEnterCampaign = (id: string) => {
    if (!selectedNode) {
      setHoveredNode(id);
    }
  };

  const handleMouseLeaveCampaign = () => {
    if (!selectedNode) {
      setHoveredNode(null);
    }
  };

  const clearSelection = () => {
    setSelectedNode(null);
    setHoveredNode(null);
  };

  const activeNode = selectedNode || hoveredNode;

  const includedFacets = filteredFacets.filter(f => f.type !== 'EXCLUSION');
  const excludedFacets = filteredFacets.filter(f => f.type === 'EXCLUSION');

  const getVisibleFacets = (facets: typeof flowData.facets) => {
    if (!activeNode) return facets;
    
    const isCampaignSelected = filteredCampaigns.some(c => c.id === activeNode);
    const isFacetSelected = filteredFacets.some(f => f.id === activeNode);
    
    if (isCampaignSelected) {
      const connectedIds = getConnectedFacetIds(activeNode);
      return facets.filter(f => connectedIds.has(f.id));
    }
    
    if (isFacetSelected) {
      return facets.filter(f => f.id === activeNode);
    }
    
    return facets;
  };

  const getVisibleCampaigns = () => {
    if (!activeNode) return filteredCampaigns;
    
    const isCampaignSelected = filteredCampaigns.some(c => c.id === activeNode);
    const isFacetSelected = filteredFacets.some(f => f.id === activeNode);
    
    if (isCampaignSelected) {
      return filteredCampaigns.filter(c => c.id === activeNode);
    }
    
    if (isFacetSelected) {
      const connectedIds = getConnectedCampaignIds(activeNode);
      return filteredCampaigns.filter(c => connectedIds.has(c.id));
    }
    
    return filteredCampaigns;
  };

  const visibleIncludedFacets = getVisibleFacets(includedFacets);
  const visibleExcludedFacets = getVisibleFacets(excludedFacets);
  const visibleCampaigns = getVisibleCampaigns();

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
      default: return '#9ca3af';
    }
  };

  const isHighlighted = (id: string) => {
    if (!activeNode) return true;
    if (activeNode === id) return true;
    
    const related = filteredConnections.some(conn => 
      (conn.sourceId === activeNode && conn.targetId === id) || 
      (conn.targetId === activeNode && conn.sourceId === id)
    );
    return related;
  };

  const isLineHighlighted = (source: string, target: string) => {
    if (!activeNode) return true;
    return activeNode === source || activeNode === target;
  };

  const isLineVisible = (sourceId: string, targetId: string) => {
    if (!activeNode) return true;
    
    const visibleFacetIds = new Set([...visibleIncludedFacets, ...visibleExcludedFacets].map(f => f.id));
    const visibleCampaignIds = new Set(visibleCampaigns.map(c => c.id));
    
    return visibleFacetIds.has(sourceId) && visibleCampaignIds.has(targetId);
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
           p-3 rounded-lg border cursor-pointer transition-all duration-300 flex items-center justify-between group mb-2
           ${getColor(item.type)}
           ${isSelected ? 'ring-2 ring-offset-2 ring-blue-500 shadow-lg' : ''}
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
         
         {isHighlighted(item.id) && hoveredNode === item.id && !isBundle && <ArrowRight size={14} className="animate-pulse"/>}
       </div>
     );
  }

  const selectedGroupName = selectedGroupId 
    ? campaignGroups.find(g => g.id === selectedGroupId)?.name 
    : null;

  return (
    <div className="w-full relative bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden min-h-[600px] p-6" ref={containerRef}>
      
      {/* Campaign Group Filter Dropdown - Top Right */}
      <div className="absolute top-4 right-4 z-30">
        <div className="relative">
          <button
            onClick={() => setShowGroupDropdown(!showGroupDropdown)}
            className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors min-w-[200px] justify-between"
          >
            <span className="truncate">
              {selectedGroupName || 'All Campaign Groups'}
            </span>
            <ChevronDown size={16} className={`transition-transform ${showGroupDropdown ? 'rotate-180' : ''}`} />
          </button>
          
          {showGroupDropdown && (
            <div className="absolute top-full right-0 mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-40 max-h-64 overflow-y-auto">
              <button
                onClick={() => {
                  setSelectedGroupId(null);
                  setShowGroupDropdown(false);
                  setSelectedNode(null);
                }}
                className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors ${!selectedGroupId ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'}`}
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
                  <span className="truncate block">{group.name}</span>
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
      <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
        {lines.map((line) => {
           const [sourceId, targetId] = line.key.split('-');
           
           if (!isLineVisible(sourceId, targetId)) return null;
           
           const highlighted = isLineHighlighted(sourceId, targetId);
           const opacity = highlighted ? 0.8 : 0.15;
           const width = highlighted ? 2.5 : 1;
           const stroke = getStrokeColor(line.type);
           
           return (
            <path
              key={line.key}
              d={`M ${line.x1} ${line.y1} C ${line.x1 + 80} ${line.y1}, ${line.x2 - 80} ${line.y2}, ${line.x2} ${line.y2}`}
              fill="none"
              stroke={stroke}
              strokeWidth={width}
              strokeOpacity={opacity}
              style={{ transition: 'all 0.3s ease' }}
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

      <div className="flex h-full relative z-20 justify-between pt-8">
        {/* Left Column: Facets */}
        <div className="w-[300px] flex flex-col pr-4 h-full gap-4 flex-shrink-0">
           
           {/* Inclusions */}
           <div className={`overflow-y-auto pr-2 transition-all duration-300 ${activeNode ? 'flex-shrink-0' : 'flex-1'}`}>
             <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4 border-b pb-2">
               Targeting Inclusions
               {activeNode && visibleIncludedFacets.length !== includedFacets.length && (
                 <span className="ml-2 text-blue-500">({visibleIncludedFacets.length} connected)</span>
               )}
             </h3>
             {visibleIncludedFacets.length > 0 ? visibleIncludedFacets.map(renderFacetItem) : (
                <div className="text-sm text-gray-300 italic text-center py-4">
                  {activeNode ? 'No connected inclusions' : 'No inclusions found'}
                </div>
             )}
           </div>

           {/* Exclusions */}
           <div className={`pt-4 border-t border-gray-100 overflow-y-auto pr-2 transition-all duration-300 ${activeNode ? 'flex-shrink-0' : 'flex-shrink-0 max-h-[40%]'}`}>
             <h3 className="text-xs font-bold uppercase tracking-wider text-red-400 mb-4 border-b pb-2">
               Exclusions
               {activeNode && visibleExcludedFacets.length !== excludedFacets.length && (
                 <span className="ml-2 text-red-300">({visibleExcludedFacets.length} connected)</span>
               )}
             </h3>
             {visibleExcludedFacets.length > 0 ? visibleExcludedFacets.map(renderFacetItem) : (
                <div className="text-sm text-gray-300 italic text-center py-4">
                  {activeNode ? 'No connected exclusions' : 'No exclusions found'}
                </div>
             )}
           </div>
        </div>

        {/* Right Column: Campaigns */}
        <div className="w-[300px] pl-4 border-l border-gray-100 overflow-y-auto flex-shrink-0">
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4 border-b pb-2">
            Destination Campaigns
            {activeNode && visibleCampaigns.length !== filteredCampaigns.length && (
              <span className="ml-2 text-orange-500">({visibleCampaigns.length} connected)</span>
            )}
          </h3>
          <div className="flex flex-col gap-3">
            {visibleCampaigns.length > 0 ? visibleCampaigns.map((camp) => {
              const isSelected = selectedNode === camp.id;
              
              return (
                <div
                  key={camp.id}
                  ref={el => { if (el) itemRefs.current.set(camp.id, el) }}
                  onMouseEnter={() => handleMouseEnterCampaign(camp.id)}
                  onMouseLeave={handleMouseLeaveCampaign}
                  onClick={() => handleCampaignClick(camp.id)}
                  className={`
                    p-2.5 rounded-lg border border-gray-200 bg-white shadow-sm hover:shadow-md transition-all cursor-pointer
                    group
                    ${isSelected ? 'ring-2 ring-offset-2 ring-orange-500 shadow-lg' : ''}
                    ${isHighlighted(camp.id) ? 'opacity-100' : 'opacity-30 grayscale'}
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
                {activeNode ? 'No connected campaigns' : 'No campaigns found'}
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
