
import React, { useLayoutEffect, useRef, useState, useEffect } from 'react';
import { AccountStructure, NodeType, TargetingSummary, CreativeNode, SegmentNode } from '../types';
import { getRemarketingGraph, RemarketingGraph } from '../services/linkedinLogic';
import { Filter, Users, Megaphone, ArrowRight, Activity, MousePointerClick, Building2, UserCheck, Globe, Sparkles } from 'lucide-react';

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
    const timeout = setTimeout(calculateLines, 100);
    return () => {
      window.removeEventListener('resize', calculateLines);
      clearTimeout(timeout);
    };
  }, [graph]);

  if (!graph) return null;

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

  const companyLists = data.segments?.filter(s => s.type === 'COMPANY') || [];
  const contactLists = data.segments?.filter(s => s.type === 'CONTACT') || [];
  const websiteSegments = data.segments?.filter(s => s.type === 'WEBSITE') || [];
  const lookalikeSegments = data.segments?.filter(s => s.type === 'LOOKALIKE') || [];
  const otherSegments = data.segments?.filter(s => s.type === 'OTHER') || [];

  const getSegmentIcon = (type: SegmentNode['type']) => {
    switch(type) {
      case 'COMPANY': return <Building2 size={14} />;
      case 'CONTACT': return <UserCheck size={14} />;
      case 'WEBSITE': return <Globe size={14} />;
      case 'LOOKALIKE': return <Sparkles size={14} />;
      default: return <Users size={14} />;
    }
  };

  const getSegmentColor = (type: SegmentNode['type']) => {
    switch(type) {
      case 'COMPANY': return 'bg-blue-50 border-blue-200 text-blue-700';
      case 'CONTACT': return 'bg-indigo-50 border-indigo-200 text-indigo-700';
      case 'WEBSITE': return 'bg-green-50 border-green-200 text-green-700';
      case 'LOOKALIKE': return 'bg-purple-50 border-purple-200 text-purple-700';
      default: return 'bg-gray-50 border-gray-200 text-gray-700';
    }
  };

  const getStatusBadge = (status: string) => {
    const statusColors: Record<string, string> = {
      'READY': 'bg-green-100 text-green-700',
      'BUILDING': 'bg-yellow-100 text-yellow-700',
      'ACTIVE': 'bg-green-100 text-green-700',
      'EXPIRED': 'bg-red-100 text-red-700',
      'ARCHIVED': 'bg-gray-100 text-gray-500',
    };
    return statusColors[status] || 'bg-gray-100 text-gray-500';
  };

  const formatAudienceCount = (count?: number) => {
    if (!count) return null;
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(0)}K`;
    return count.toString();
  };

  const SegmentCard: React.FC<{ segment: SegmentNode }> = ({ segment }) => (
    <div className={`p-3 rounded-lg border ${getSegmentColor(segment.type)} transition-all hover:shadow-sm`}>
      <div className="flex items-center gap-2">
        {getSegmentIcon(segment.type)}
        <span className="text-sm font-medium truncate flex-1">{segment.name}</span>
      </div>
      <div className="flex items-center gap-2 mt-2">
        <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusBadge(segment.status)}`}>
          {segment.status}
        </span>
        {segment.audienceCount && (
          <span className="text-xs text-gray-500">
            ~{formatAudienceCount(segment.audienceCount)} members
          </span>
        )}
      </div>
    </div>
  );

  const SegmentSection: React.FC<{ 
    title: string; 
    icon: React.ReactNode; 
    segments: SegmentNode[];
    colorClass: string;
  }> = ({ title, icon, segments, colorClass }) => (
    <div className="mb-6">
      <div className={`flex items-center gap-2 mb-3 pb-2 border-b ${colorClass}`}>
        {icon}
        <h4 className="text-sm font-semibold">{title}</h4>
        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full ml-auto">
          {segments.length}
        </span>
      </div>
      {segments.length > 0 ? (
        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
          {segments.map(seg => (
            <SegmentCard key={seg.id} segment={seg} />
          ))}
        </div>
      ) : (
        <div className="text-xs text-gray-400 italic py-4 text-center border-2 border-dashed border-gray-100 rounded">
          No segments
        </div>
      )}
    </div>
  );

  const hasSegments = data.segments && data.segments.length > 0;

  return (
    <div className="flex gap-6">
      {hasSegments && (
        <div className="w-80 flex-shrink-0 bg-white rounded-xl shadow-sm border border-gray-200 p-4 overflow-y-auto max-h-[700px]">
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4 text-center border-b pb-2">
            Matched Audiences
          </h3>
          
          <SegmentSection 
            title="Company Lists" 
            icon={<Building2 size={16} className="text-blue-600" />}
            segments={companyLists}
            colorClass="border-blue-200"
          />
          
          <SegmentSection 
            title="Contact Lists" 
            icon={<UserCheck size={16} className="text-indigo-600" />}
            segments={contactLists}
            colorClass="border-indigo-200"
          />
          
          <SegmentSection 
            title="Website Visitors" 
            icon={<Globe size={16} className="text-green-600" />}
            segments={websiteSegments}
            colorClass="border-green-200"
          />
          
          <SegmentSection 
            title="Lookalike Audiences" 
            icon={<Sparkles size={16} className="text-purple-600" />}
            segments={lookalikeSegments}
            colorClass="border-purple-200"
          />
          
          {otherSegments.length > 0 && (
            <SegmentSection 
              title="Other Segments" 
              icon={<Users size={16} className="text-gray-600" />}
              segments={otherSegments}
              colorClass="border-gray-200"
            />
          )}
        </div>
      )}

      <div className="flex-1 relative bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden min-h-[600px] p-6" ref={containerRef}>
        
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
    </div>
  );
};
