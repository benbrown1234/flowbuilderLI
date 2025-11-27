
import React, { useState, useEffect, useRef } from 'react';
import { AccountStructure, NodeType, TargetingSummary, CreativeNode, CampaignNode, GroupNode } from '../types';
import { getTreeGraph, TreeNode } from '../services/linkedinLogic';
import { Folder, LayoutGrid, FileImage, FileVideo, Globe, Briefcase, Plus, Minus, Maximize, Move } from 'lucide-react';

interface Props {
  data: AccountStructure;
  onSelect: (type: NodeType, name: string, targeting?: TargetingSummary, creatives?: CreativeNode[], singleCreative?: CreativeNode, objective?: string, biddingStrategy?: string) => void;
}

export const StructureTree: React.FC<Props> = ({ data, onSelect }) => {
  const [graph, setGraph] = useState<ReturnType<typeof getTreeGraph> | null>(null);
  const [transform, setTransform] = useState({ x: 50, y: 50, scale: 1 });
  const [isDragging, setIsDragging] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  
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
      onSelect(NodeType.CAMPAIGN, c.name, c.targetingResolved, c.children, undefined, c.objective, c.biddingStrategy);
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
      <div className="absolute top-6 left-6 z-40 flex flex-col gap-2 text-[10px] font-semibold text-gray-500 bg-white/90 p-3 rounded-lg backdrop-blur-sm border shadow-sm pointer-events-none">
          <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-blue-500"></span> Account</div>
          <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-gray-500"></span> Campaign Group</div>
          <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-orange-500"></span> Campaign</div>
          <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-green-500"></span> Ad</div>
          <div className="mt-2 pt-2 border-t border-gray-100 flex items-center gap-1 text-gray-400">
            <Move size={10} /> Drag to Pan
          </div>
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
              const targetHeight = target.type === NodeType.CREATIVE ? 21 : 30;
              
              const startX = source.x + sourceWidth;
              const startY = source.y + 30;
              const endX = target.x;
              const endY = target.y + targetHeight;

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

          {graph.nodes.map(node => (
            <div
              key={node.id}
              onClick={() => node.type !== NodeType.ACCOUNT && handleNodeClick(node)}
              className={`
                absolute transition-all duration-200 hover:z-20 shadow-sm hover:shadow-xl
                rounded-lg border flex flex-col justify-center z-10
                ${node.type === NodeType.CREATIVE ? 'w-[130px] px-2 py-1.5' : 'w-[280px] px-4 py-3'}
                ${node.type !== NodeType.ACCOUNT ? 'cursor-pointer hover:scale-105' : 'cursor-default'}
                ${node.type === NodeType.ACCOUNT ? 'bg-blue-600 border-blue-700 text-white min-h-[60px]' : ''}
                ${node.type === NodeType.GROUP ? 'bg-white border-gray-300 min-h-[50px]' : ''}
                ${node.type === NodeType.CAMPAIGN ? 'bg-white border-orange-200 border-l-4 border-l-orange-500 min-h-[70px]' : ''}
                ${node.type === NodeType.CREATIVE ? 'bg-white border-green-200 border-l-2 border-l-green-500 min-h-[42px]' : ''}
              `}
              style={{ 
                left: node.x, 
                top: node.y,
              }}
            >
              <div className={`flex items-center gap-1.5 ${node.type === NodeType.CREATIVE ? 'mb-0.5' : 'mb-1'}`}>
                {node.type === NodeType.ACCOUNT && <Globe className="w-4 h-4 text-blue-200" />}
                {node.type === NodeType.GROUP && <Briefcase className="w-4 h-4 text-gray-400" />}
                {node.type === NodeType.CAMPAIGN && <LayoutGrid className="w-4 h-4 text-orange-500" />}
                {node.type === NodeType.CREATIVE && (
                  (node.data as CreativeNode).format === 'VIDEO' 
                    ? <FileVideo className="w-3 h-3 text-green-500" /> 
                    : <FileImage className="w-3 h-3 text-green-500" />
                )}
                
                <span className={`font-bold uppercase tracking-wider
                  ${node.type === NodeType.CREATIVE ? 'text-[7px]' : 'text-[9px]'}
                  ${node.type === NodeType.ACCOUNT ? 'text-blue-100' : 'text-gray-400'}
                `}>
                  {node.type === NodeType.GROUP ? 'Campaign Group' : 
                   node.type === NodeType.CAMPAIGN ? 'Campaign' : 
                   node.type === NodeType.CREATIVE ? 'Ad' : 'Account'}
                </span>
              </div>
              
              <div 
                className={`font-semibold leading-tight truncate
                  ${node.type === NodeType.CREATIVE ? 'text-xs' : 'text-sm'}
                  ${node.type === NodeType.ACCOUNT ? 'text-white' : 'text-gray-900'}
                `} 
                title={node.name}
              >
                {node.name}
              </div>

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
          ))}
        </div>
      </div>
    </div>
  );
};
