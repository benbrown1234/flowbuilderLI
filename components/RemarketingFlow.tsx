
import React, { useLayoutEffect, useRef, useState, useEffect } from 'react';
import { AccountStructure, NodeType, TargetingSummary, CreativeNode } from '../types';
import { getRemarketingGraph, RemarketingGraph } from '../services/linkedinLogic';
import { Filter, Users, Megaphone, ArrowRight, Activity, MousePointerClick } from 'lucide-react';

interface Props {
  data: AccountStructure;
  onSelect: (type: NodeType, name: string, targeting?: TargetingSummary, creatives?: CreativeNode[]) => void;
}

export const RemarketingFlow: React.FC<Props> = ({ data, onSelect }) => {
  const [graph, setGraph] = useState<RemarketingGraph | null>(null);
  const [lines, setLines] = useState<{ x1: number, y1: number, x2: number, y2: number, key: string }[]>([]);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  useEffect(() => {
    setGraph(getRemarketingGraph(data));
  }, [data]);

  const calculateLines = () => {
    if (!graph || !containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    const newLines: typeof lines = [];

    graph.links.forEach((link) => {
      const sourceEl = nodeRefs.current.get(link.source);
      const targetEl = nodeRefs.current.get(link.target);

      if (sourceEl && targetEl) {
        const sRect = sourceEl.getBoundingClientRect();
        const tRect = targetEl.getBoundingClientRect();

        newLines.push({
          x1: sRect.right - containerRect.left,
          y1: sRect.top + sRect.height / 2 - containerRect.top,
          x2: tRect.left - containerRect.left,
          y2: tRect.top + tRect.height / 2 - containerRect.top,
          key: `${link.source}-${link.target}`
        });
      }
    });
    setLines(newLines);
  };

  useLayoutEffect(() => {
    calculateLines();
    window.addEventListener('resize', calculateLines);
    // Tiny delay to ensure DOM is painted
    const timeout = setTimeout(calculateLines, 100);
    return () => {
      window.removeEventListener('resize', calculateLines);
      clearTimeout(timeout);
    };
  }, [graph]);

  if (!graph) return null;

  // Group nodes by level - REMOVED LEVEL 0 (Sources) per request
  const levels = [1, 2, 3];
  const nodesByLevel = levels.map(lvl => graph.nodes.filter(n => n.level === lvl));

  const getLevelTitle = (lvl: number) => {
    switch(lvl) {
      case 1: return "Cold Campaigns";
      case 2: return "Retargeting Pools";
      case 3: return "Remarketing Campaigns";
      default: return "";
    }
  };

  const getNodeIcon = (type: string) => {
    switch(type) {
      case 'SOURCE': return <Filter size={14} />;
      case 'CAMPAIGN_COLD': return <Megaphone size={14} />;
      case 'AUDIENCE_POOL': return <Users size={14} />;
      case 'CAMPAIGN_RETARGETING': return <Activity size={14} />;
      default: return <Filter size={14} />;
    }
  };

  const getNodeColor = (type: string, isHovered: boolean, isRelated: boolean) => {
    const opacity = isHovered || isRelated || !hoveredNode ? 'opacity-100' : 'opacity-20 grayscale';
    
    switch(type) {
      case 'SOURCE': 
        return `bg-blue-50 border-blue-200 text-blue-700 ${opacity}`;
      case 'CAMPAIGN_COLD': 
        return `bg-orange-50 border-orange-200 text-orange-700 font-bold ${opacity}`;
      case 'AUDIENCE_POOL': 
        return `bg-purple-100 border-purple-300 text-purple-800 font-bold shadow-sm ${opacity}`;
      case 'CAMPAIGN_RETARGETING': 
        return `bg-green-50 border-green-200 text-green-700 font-bold ${opacity}`;
      default: 
        return `bg-gray-50 border-gray-200 text-gray-700 ${opacity}`;
    }
  };

  const handleNodeClick = (nodeId: string, type: string) => {
    if (type.includes('CAMPAIGN')) {
      // Find the campaign in data
      for (const group of data.groups) {
        const camp = group.children.find(c => c.id === nodeId);
        if (camp) {
          onSelect(NodeType.CAMPAIGN, camp.name, camp.targetingResolved, camp.children);
          return;
        }
      }
    }
  };

  const isRelated = (nodeId: string) => {
    if (!hoveredNode) return false;
    if (hoveredNode === nodeId) return true;
    return graph.links.some(l => 
      (l.source === hoveredNode && l.target === nodeId) || 
      (l.target === hoveredNode && l.source === nodeId)
    );
  };

  return (
    <div className="w-full relative bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden min-h-[600px] p-6" ref={containerRef}>
      
      {/* Links Layer */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
        {lines.map((line) => {
           const isLinkRelated = hoveredNode && (line.key.startsWith(hoveredNode) || line.key.endsWith(hoveredNode));
           const opacity = !hoveredNode ? 0.2 : (isLinkRelated ? 0.8 : 0.05);
           const strokeWidth = isLinkRelated ? 2 : 1;
           const color = isLinkRelated ? '#4f46e5' : '#cbd5e1';

           return (
            <path
              key={line.key}
              d={`M ${line.x1} ${line.y1} C ${line.x1 + 60} ${line.y1}, ${line.x2 - 60} ${line.y2}, ${line.x2} ${line.y2}`}
              fill="none"
              stroke={color}
              strokeWidth={strokeWidth}
              strokeOpacity={opacity}
              style={{ transition: 'all 0.3s ease' }}
            />
          );
        })}
      </svg>

      {/* Columns - Changed to grid-cols-3 since we removed one level */}
      <div className="grid grid-cols-3 gap-12 h-full relative z-20">
        {nodesByLevel.map((nodes, idx) => (
          <div key={idx} className="flex flex-col h-full">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-6 text-center border-b pb-2">
              {getLevelTitle(levels[idx])}
            </h3>
            
            <div className="flex-1 flex flex-col justify-center space-y-4">
              {nodes.map(node => (
                <div
                  key={node.id}
                  ref={el => { if(el) nodeRefs.current.set(node.id, el) }}
                  onMouseEnter={() => setHoveredNode(node.id)}
                  onMouseLeave={() => setHoveredNode(null)}
                  onClick={() => handleNodeClick(node.id, node.type)}
                  className={`
                    p-3 rounded-lg border cursor-pointer transition-all duration-300 relative group
                    ${getNodeColor(node.type, hoveredNode === node.id, isRelated(node.id))}
                    ${node.type.includes('CAMPAIGN') ? 'hover:scale-105 hover:shadow-md' : ''}
                  `}
                >
                  <div className="flex items-center gap-2 text-xs">
                    {getNodeIcon(node.type)}
                    <span className="truncate">{node.label}</span>
                  </div>

                  {node.type.includes('CAMPAIGN') && (
                     <div className="absolute -right-2 -top-2 opacity-0 group-hover:opacity-100 transition-opacity bg-white rounded-full shadow border p-0.5">
                       <MousePointerClick size={12} className="text-gray-500" />
                     </div>
                  )}
                </div>
              ))}
              {nodes.length === 0 && (
                <div className="text-center text-xs text-gray-300 italic py-10 border-2 border-dashed border-gray-100 rounded">
                  No Data
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
