
import React, { useState, useEffect, useRef } from 'react';
import { AccountStructure, NodeType, TargetingSummary, CreativeNode, CampaignNode, GroupNode } from '../types';
import { getTreeGraph, TreeNode } from '../services/linkedinLogic';
import { Folder, LayoutGrid, FileImage, FileVideo, Globe, Briefcase, Plus, Minus, Maximize, Move, Lightbulb, Loader2 } from 'lucide-react';
import { AdPreviewCard } from './AdPreviewCard';

interface Props {
  data: AccountStructure;
  onSelect: (type: NodeType, name: string, targeting?: TargetingSummary, creatives?: CreativeNode[], singleCreative?: CreativeNode, objective?: string, biddingStrategy?: string, campaignId?: string) => void;
  onImportToIdeate?: (data: AccountStructure) => Promise<void>;
}

export const StructureTree: React.FC<Props> = ({ data, onSelect, onImportToIdeate }) => {
  const [graph, setGraph] = useState<ReturnType<typeof getTreeGraph> | null>(null);
  const [transform, setTransform] = useState({ x: 50, y: 50, scale: 1 });
  const [isDragging, setIsDragging] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [isImporting, setIsImporting] = useState(false);
  const [hoveredAdId, setHoveredAdId] = useState<string | null>(null);
  const [hoverPosition, setHoverPosition] = useState<{ x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const handleImportToIdeate = async () => {
    if (!onImportToIdeate || isImporting) return;
    setIsImporting(true);
    try {
      await onImportToIdeate(data);
    } finally {
      setIsImporting(false);
    }
  };
  
  // Calculate graph on data change
  useEffect(() => {
    if (data) {
      setGraph(getTreeGraph(data));
      // Reset transform on data load
      setTransform({ x: 50, y: 50, scale: 0.9 });
    }
  }, [data]);

  const handleNodeClick = (node: TreeNode) => {
    if (node.type === NodeType.GROUP) {
      const g = node.data as GroupNode;
      // Do not pass derivedTargeting to restrict view to budget/status only
      onSelect(NodeType.GROUP, g.name, undefined); 
    } else if (node.type === NodeType.CAMPAIGN) {
      const c = node.data as CampaignNode;
      onSelect(NodeType.CAMPAIGN, c.name, c.targetingResolved, c.children, undefined, c.objective, c.biddingStrategy, c.id);
    } else if (node.type === NodeType.CREATIVE) {
      const c = node.data as CreativeNode;
      onSelect(NodeType.CREATIVE, c.name, undefined, undefined, c);
    }
  };

  // Zoom/Pan Handlers
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      // Pinch zoom behavior substitution
      e.preventDefault();
      const zoomSensitivity = 0.001;
      const newScale = Math.min(Math.max(0.1, transform.scale - e.deltaY * zoomSensitivity), 3);
      setTransform(t => ({ ...t, scale: newScale }));
    } else {
       // Panning via wheel
       setTransform(t => ({ ...t, x: t.x - e.deltaX, y: t.y - e.deltaY }));
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only pan with left mouse button
    setIsDragging(true);
    setStartPos({ x: e.clientX - transform.x, y: e.clientY - transform.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setTransform(t => ({
      ...t,
      x: e.clientX - startPos.x,
      y: e.clientY - startPos.y
    }));
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const zoomIn = () => setTransform(t => ({ ...t, scale: Math.min(t.scale + 0.2, 3) }));
  const zoomOut = () => setTransform(t => ({ ...t, scale: Math.max(t.scale - 0.2, 0.1) }));
  const resetZoom = () => setTransform({ x: 50, y: 50, scale: 0.9 });

  if (!graph) return null;

  return (
    <div className="w-full h-full relative bg-[#f0f2f5] overflow-hidden rounded-xl shadow-inner border border-gray-200">
      
      {/* Controls */}
      <div className="absolute bottom-6 right-6 z-40 flex flex-col gap-2 bg-white rounded-lg shadow-lg border border-gray-200 p-1">
        <button onClick={zoomIn} className="p-2 hover:bg-gray-100 rounded text-gray-600" title="Zoom In"><Plus size={18} /></button>
        <button onClick={zoomOut} className="p-2 hover:bg-gray-100 rounded text-gray-600" title="Zoom Out"><Minus size={18} /></button>
        <div className="h-px bg-gray-200 my-0.5 w-full"></div>
        <button onClick={resetZoom} className="p-2 hover:bg-gray-100 rounded text-gray-600" title="Reset View"><Maximize size={18} /></button>
      </div>

      {/* Legend */}
      <div className="absolute top-6 left-6 z-40 flex flex-col gap-2 text-[10px] font-semibold text-gray-500 bg-white/90 p-3 rounded-lg backdrop-blur-sm border shadow-sm">
          <div className="flex items-center gap-2 pointer-events-none"><span className="w-2 h-2 rounded-full bg-blue-500"></span> Account</div>
          <div className="flex items-center gap-2 pointer-events-none"><span className="w-2 h-2 rounded-full bg-gray-500"></span> Campaign Group</div>
          <div className="flex items-center gap-2 pointer-events-none"><span className="w-2 h-2 rounded-full bg-orange-500"></span> Campaign</div>
          <div className="flex items-center gap-2 pointer-events-none"><span className="w-2 h-2 rounded-full bg-green-500"></span> Ad</div>
          <div className="mt-2 pt-2 border-t border-gray-100 flex items-center gap-1 text-gray-400 pointer-events-none">
            <Move size={10} /> Drag to Pan
          </div>
          {onImportToIdeate && (
            <button
              onClick={handleImportToIdeate}
              disabled={isImporting}
              className="mt-2 pt-2 border-t border-gray-100 flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-lg text-xs font-semibold hover:from-purple-600 hover:to-indigo-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              {isImporting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Lightbulb size={14} />
                  Import to Ideate
                </>
              )}
            </button>
          )}
      </div>

      {/* Canvas Area */}
      <div 
        ref={containerRef}
        className={`w-full h-full ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        <div 
          className="relative transition-transform duration-75 origin-top-left will-change-transform"
          style={{ 
            transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
            width: Math.max(1200, graph.width + 200), 
            height: Math.max(800, graph.height + 100),
          }}
        >
          {/* Dot Grid Background */}
          <div className="absolute inset-0 pointer-events-none" 
            style={{ 
              backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)',
              backgroundSize: '20px 20px',
              opacity: 0.8
            }} 
          />

          <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
            {graph.links.map(link => {
              const source = graph.nodes.find(n => n.id === link.source);
              const target = graph.nodes.find(n => n.id === link.target);
              if (!source || !target) return null;

              // Different widths for different node types
              const sourceWidth = source.type === NodeType.CREATIVE ? 130 : 280;
              
              // Apply columnOffset for creative nodes
              const targetColumnOffset = target.columnOffset || 0;
              
              // Use node.y as center point for links
              const startX = source.x + sourceWidth;
              const startY = source.y; // Center Y of source
              const endX = target.x + targetColumnOffset;
              const endY = target.y; // Center Y of target

              const cp1x = (startX + endX) / 2;
              const cp1y = startY;
              const cp2x = (startX + endX) / 2;
              const cp2y = endY;

              return (
                <path
                  key={`${link.source}-${link.target}`}
                  d={`M ${startX} ${startY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${endX} ${endY}`}
                  fill="none"
                  stroke="#94a3b8"
                  strokeWidth="1.5"
                  strokeOpacity="0.4"
                />
              );
            })}
          </svg>

          {graph.nodes.map(node => {
            // Apply columnOffset for creative nodes
            const actualLeft = node.x + (node.columnOffset || 0);
            // Position from center (y is center, so top = y - height/2)
            // Default height to 70 if undefined to avoid NaN
            const nodeHeight = node.height || 70;
            const actualTop = node.y - (nodeHeight / 2);
            
            return (
            <div
              key={node.id}
              onClick={() => node.type !== NodeType.ACCOUNT && handleNodeClick(node)}
              onMouseEnter={(e) => {
                if (node.type === NodeType.CREATIVE) {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const creativeId = (node.data as CreativeNode).id;
                  console.log('Hover on creative:', creativeId, 'at position:', rect.right, rect.top);
                  setHoveredAdId(creativeId);
                  setHoverPosition({
                    x: rect.right + 8,
                    y: rect.top - 40
                  });
                }
              }}
              onMouseLeave={() => {
                if (node.type === NodeType.CREATIVE) {
                  setHoveredAdId(null);
                  setHoverPosition(null);
                }
              }}
              className={`
                absolute transition-all duration-200 hover:z-20 shadow-sm hover:shadow-xl
                rounded-lg border flex flex-col justify-center z-10
                ${node.type === NodeType.CREATIVE ? 'w-[130px] px-2 py-1.5' : 'w-[280px] px-4 py-3'}
                ${node.type !== NodeType.ACCOUNT ? 'cursor-pointer hover:scale-105' : 'cursor-default'}
                ${node.type === NodeType.ACCOUNT ? 'bg-blue-600 border-blue-700 text-white min-h-[60px]' : ''}
                ${node.type === NodeType.GROUP ? 'bg-white border-gray-300 min-h-[50px]' : ''}
                ${node.type === NodeType.CAMPAIGN ? 'bg-white border-orange-200 border-l-4 border-l-orange-500' : ''}
                ${node.type === NodeType.CREATIVE ? 'bg-white border-green-200 border-l-2 border-l-green-500 min-h-[42px]' : ''}
              `}
              style={{ 
                left: actualLeft, 
                top: actualTop,
              }}
            >
              <div className={`flex items-center gap-1.5 ${node.type === NodeType.CREATIVE ? 'mb-0.5' : 'mb-1'}`}>
                {node.type === NodeType.ACCOUNT && <Globe className="w-4 h-4 text-blue-200" />}
                {node.type === NodeType.GROUP && <Briefcase className="w-4 h-4 text-gray-400" />}
                {node.type === NodeType.CAMPAIGN && <LayoutGrid className="w-4 h-4 text-orange-500" />}
                {node.type === NodeType.CREATIVE && (
                  (node.data as CreativeNode).content?.mediaType === 'Video'
                    ? <FileVideo className="w-3 h-3 text-green-500" /> 
                    : <FileImage className="w-3 h-3 text-green-500" />
                )}
                
                <span className={`font-bold uppercase tracking-wider
                  ${node.type === NodeType.CREATIVE ? 'text-[7px]' : 'text-[9px]'}
                  ${node.type === NodeType.ACCOUNT ? 'text-blue-100' : 'text-gray-400'}
                `}>
                  {node.type === NodeType.GROUP ? 'Campaign Group' : 
                   node.type === NodeType.CAMPAIGN ? 'Campaign' : 
                   node.type === NodeType.CREATIVE ? (() => {
                     const mediaType = (node.data as CreativeNode).content?.mediaType || 'Image';
                     return `${mediaType} Ad`;
                   })() : 'Account'}
                </span>
              </div>
              
              {/* Thumbnail for Creative nodes */}
              {node.type === NodeType.CREATIVE && (node.data as CreativeNode).content?.imageUrl && (
                <div className="w-full h-16 mb-1 rounded overflow-hidden bg-gray-100 relative">
                  <img 
                    src={(node.data as CreativeNode).content?.imageUrl} 
                    alt="Ad preview"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
              )}
              
              <div 
                className={`font-semibold leading-tight
                  ${node.type === NodeType.CREATIVE ? 'text-xs truncate' : 'text-sm'}
                  ${node.type === NodeType.ACCOUNT ? 'text-white' : 'text-gray-900'}
                `} 
                title={node.name}
              >
                {node.name}
              </div>

              {/* Thought Leader or Company Ad tag */}
              {node.type === NodeType.CREATIVE && (
                (node.data as CreativeNode).content?.isThoughtLeader ? (
                  <span className="mt-0.5 text-[6px] font-bold uppercase tracking-wide px-1 py-0.5 rounded bg-purple-100 text-purple-700 border border-purple-200 self-start">
                    Thought Leader
                  </span>
                ) : (
                  <span className="mt-0.5 text-[6px] font-bold uppercase tracking-wide px-1 py-0.5 rounded bg-blue-100 text-blue-700 border border-blue-200 self-start">
                    Company Ad
                  </span>
                )
              )}

              {/* Optional Metadata - only for campaigns */}
              {node.type === NodeType.CAMPAIGN && (
                <div className="text-[10px] text-gray-500 mt-1.5 flex justify-between">
                  <span>${(node.data as CampaignNode).dailyBudget}/day</span>
                  <span className={`px-1.5 rounded-full text-[8px] ${(node.data as any).status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100'}`}>
                    {(node.data as any).status}
                  </span>
                </div>
              )}
            </div>
            );
          })}
        </div>
      </div>

      {/* Ad Preview Card Popup - Rendered outside zoomed container for proper screen-space positioning */}
      {hoveredAdId && hoverPosition && (() => {
        console.log('Rendering popup for:', hoveredAdId, 'at position:', hoverPosition);
        const hoveredNode = graph.nodes.find(n => 
          n.type === NodeType.CREATIVE && n.id === hoveredAdId
        );
        console.log('Found node:', hoveredNode ? 'yes' : 'no', hoveredNode?.id);
        if (!hoveredNode) return null;
        const creative = hoveredNode.data as CreativeNode;
        console.log('Creative data:', creative);
        
        return (
          <div 
            className="fixed z-50 pointer-events-none"
            style={{
              left: Math.min(hoverPosition.x, window.innerWidth - 310),
              top: Math.max(10, Math.min(hoverPosition.y, window.innerHeight - 420)),
              transition: 'opacity 0.15s ease-in-out',
            }}
          >
            <AdPreviewCard
              imageUrl={creative.content?.imageUrl}
              videoUrl={creative.content?.videoUrl}
              headline={creative.content?.headline}
              description={creative.content?.description}
              callToAction={creative.content?.callToAction}
              destinationUrl={creative.content?.destinationUrl || creative.content?.landingPageUrl}
              mediaType={creative.content?.mediaType}
              isThoughtLeader={creative.content?.isThoughtLeader}
              authorName={creative.name}
            />
          </div>
        );
      })()}
    </div>
  );
};
