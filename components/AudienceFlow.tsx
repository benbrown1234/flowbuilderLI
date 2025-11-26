
import React, { useLayoutEffect, useRef, useState, useEffect } from 'react';
import { AccountStructure, NodeType, TargetingSummary, CreativeNode, OnSelectHandler } from '../types';
import { getAllTargetingConnections, FlowData } from '../services/linkedinLogic';
import { Globe, Users, Briefcase, Target, UserX, ArrowRight, MousePointerClick, Layers } from 'lucide-react';

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
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

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

        // Calculate relative coordinates within the container
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

  // Recalculate lines on mount and resize
  useLayoutEffect(() => {
    calculateLines();
    window.addEventListener('resize', calculateLines);
    // Add a small timeout to ensure DOM is settled
    const timer = setTimeout(calculateLines, 100);
    return () => {
        window.removeEventListener('resize', calculateLines);
        clearTimeout(timer);
    };
  }, [flowData]);

  // If data isn't ready
  if (!flowData) return null;

  const handleCampaignClick = (id: string) => {
    // Find the full campaign object within the hierarchical data
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

  const handleMouseEnterFacet = (item: typeof flowData.facets[0], e: React.MouseEvent) => {
    setHoveredNode(item.id);
    
    // Only show tooltip for bundles
    if (item.count > 1 && item.items) {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      setTooltip({
        id: item.id,
        x: rect.right + 10, // 10px to the right of the element
        y: rect.top,
        items: item.items
      });
    }
  };

  const handleMouseLeaveFacet = () => {
    setHoveredNode(null);
    setTooltip(null);
  };

  // Group Facets by Type for cleaner layout
  const includedFacets = flowData.facets.filter(f => f.type !== 'EXCLUSION');
  const excludedFacets = flowData.facets.filter(f => f.type === 'EXCLUSION');

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
      case 'GEO': return '#2563eb'; // blue-600
      case 'AUDIENCE': return '#9333ea'; // purple-600
      case 'JOB': return '#ea580c'; // orange-600
      case 'INDUSTRY': return '#4f46e5'; // indigo-600
      case 'EXCLUSION': return '#dc2626'; // red-600
      default: return '#9ca3af';
    }
  };

  const isHighlighted = (id: string) => {
    if (!hoveredNode) return true; // No hover, show all
    if (hoveredNode === id) return true; // Self
    
    // Check connections
    const related = flowData.connections.some(conn => 
      (conn.sourceId === hoveredNode && conn.targetId === id) || 
      (conn.targetId === hoveredNode && conn.sourceId === id)
    );
    return related;
  };

  const isLineHighlighted = (source: string, target: string) => {
    if (!hoveredNode) return true;
    return hoveredNode === source || hoveredNode === target;
  };

  const renderFacetItem = (item: typeof flowData.facets[0]) => {
     const isBundle = item.count > 1;
     
     return (
       <div
         key={item.id}
         ref={el => { if (el) itemRefs.current.set(item.id, el) }}
         onMouseEnter={(e) => handleMouseEnterFacet(item, e)}
         onMouseLeave={handleMouseLeaveFacet}
         className={`
           relative
           p-3 rounded-lg border cursor-pointer transition-all duration-300 flex items-center justify-between group mb-2
           ${getColor(item.type)}
           ${isHighlighted(item.id) ? 'opacity-100 scale-100' : 'opacity-30 scale-95 grayscale'}
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

  return (
    <div className="w-full relative bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden min-h-[600px] p-6" ref={containerRef}>
      
      {/* SVG Layer for Connections */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
        {lines.map((line) => {
           const opacity = isLineHighlighted(line.key.split('-')[0], line.key.split('-')[1]) ? 0.6 : 0.05;
           const width = isLineHighlighted(line.key.split('-')[0], line.key.split('-')[1]) ? 2 : 1;
           const stroke = getStrokeColor(line.type);
           
           return (
            <path
              key={line.key}
              d={`M ${line.x1} ${line.y1} C ${line.x1 + 100} ${line.y1}, ${line.x2 - 100} ${line.y2}, ${line.x2} ${line.y2}`}
              fill="none"
              stroke={stroke}
              strokeWidth={width}
              strokeOpacity={opacity}
              style={{ transition: 'all 0.3s ease' }}
            />
          );
        })}
      </svg>

      {/* Portal Tooltip - Fixed Position to avoid clipping */}
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

      <div className="flex h-full relative z-20 justify-between">
        {/* Left Column: Facets */}
        <div className="w-[300px] flex flex-col pr-4 h-full gap-8 flex-shrink-0">
           
           {/* Inclusions */}
           <div className="flex-1 overflow-y-auto pr-2">
             <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4 border-b pb-2">Targeting Inclusions</h3>
             {includedFacets.length > 0 ? includedFacets.map(renderFacetItem) : (
                <div className="text-sm text-gray-300 italic text-center py-4">No inclusions found</div>
             )}
           </div>

           {/* Exclusions */}
           <div className="flex-shrink-0 pt-4 border-t border-gray-100 max-h-[40%] overflow-y-auto pr-2">
             <h3 className="text-xs font-bold uppercase tracking-wider text-red-400 mb-4 border-b pb-2">Exclusions</h3>
             {excludedFacets.length > 0 ? excludedFacets.map(renderFacetItem) : (
                <div className="text-sm text-gray-300 italic text-center py-4">No exclusions found</div>
             )}
           </div>
        </div>

        {/* Right Column: Campaigns - Expanded to 300px and renamed */}
        <div className="w-[300px] pl-4 border-l border-gray-100 overflow-y-auto flex-shrink-0">
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4 border-b pb-2">Destination Campaigns</h3>
          <div className="flex flex-col gap-3">
            {flowData.campaigns.map((camp) => (
              <div
                key={camp.id}
                ref={el => { if (el) itemRefs.current.set(camp.id, el) }}
                onMouseEnter={() => setHoveredNode(camp.id)}
                onMouseLeave={() => setHoveredNode(null)}
                onClick={() => handleCampaignClick(camp.id)}
                className={`
                  p-2.5 rounded-lg border border-gray-200 bg-white shadow-sm hover:shadow-md transition-all cursor-pointer
                  group
                  ${isHighlighted(camp.id) ? 'opacity-100 ring-2 ring-orange-100' : 'opacity-30 grayscale'}
                `}
              >
                <div className="flex items-center justify-between mb-1">
                   <span className="text-[9px] font-bold text-gray-400 uppercase truncate pr-1">{camp.groupName}</span>
                </div>
                <div className="font-semibold text-gray-800 text-xs leading-tight">{camp.name}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
