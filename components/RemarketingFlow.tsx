import React, { useLayoutEffect, useRef, useState, useEffect } from 'react';
import { AccountStructure, NodeType, TargetingSummary, CreativeNode, SegmentNode, CampaignNode } from '../types';
import { Megaphone, Users, Activity, MousePointerClick, Building2, UserCheck, Globe, Sparkles, Video, ArrowRight } from 'lucide-react';

interface Props {
  data: AccountStructure;
  onSelect: (type: NodeType, name: string, targeting?: TargetingSummary, creatives?: CreativeNode[]) => void;
}

interface CampaignInfo {
  id: string;
  name: string;
  groupName: string;
  outputAudiences: string[];
  targetedAudiences: string[];
  campaign: CampaignNode;
}

interface AudienceInfo {
  id: string;
  name: string;
  type: string;
  segment?: SegmentNode;
  feedingCampaigns: string[];
  targetingCampaigns: string[];
}

interface ConnectionLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  key: string;
  type: 'output' | 'targeting';
  sourceId: string;
  targetId: string;
}

export const RemarketingFlow: React.FC<Props> = ({ data, onSelect }) => {
  const [lines, setLines] = useState<ConnectionLine[]>([]);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const { coldCampaigns, remarketingCampaigns, audiences, outputLinks, targetingLinks } = React.useMemo(() => {
    const allCampaigns: CampaignInfo[] = [];
    const audienceMap = new Map<string, AudienceInfo>();
    const outputLinks: { campaignId: string; audienceId: string }[] = [];
    const targetingLinks: { audienceId: string; campaignId: string }[] = [];

    const knownSegmentNames = new Set<string>();
    const segmentIdToAudId = new Map<string, string>();

    data.segments?.forEach(seg => {
      const audId = `seg-${seg.id}`;
      audienceMap.set(audId, {
        id: audId,
        name: seg.name,
        type: seg.type,
        segment: seg,
        feedingCampaigns: [],
        targetingCampaigns: []
      });
      knownSegmentNames.add(seg.name.toLowerCase());
      segmentIdToAudId.set(seg.id, audId);
      segmentIdToAudId.set(seg.name.toLowerCase(), audId);
    });

    const findOrCreateAudience = (audName: string): string => {
      if (segmentIdToAudId.has(audName)) {
        return segmentIdToAudId.get(audName)!;
      }
      
      const nameLower = audName.toLowerCase();
      if (segmentIdToAudId.has(nameLower)) {
        return segmentIdToAudId.get(nameLower)!;
      }
      
      let matchedAudId: string | null = null;
      audienceMap.forEach((aud, id) => {
        if (aud.name.toLowerCase() === nameLower) {
          matchedAudId = id;
        }
      });
      
      if (matchedAudId) return matchedAudId;
      
      const audId = `aud-${audName.replace(/[^a-z0-9]/gi, '-').toLowerCase()}`;
      if (!audienceMap.has(audId)) {
        let audType: string = 'OTHER';
        const lower = nameLower;
        if (lower.includes('website') || lower.includes('visitor')) audType = 'WEBSITE';
        else if (lower.includes('video') || lower.includes('viewer')) audType = 'VIDEO';
        else if (lower.includes('company') || lower.includes('abm')) audType = 'COMPANY';
        else if (lower.includes('contact') || lower.includes('list')) audType = 'CONTACT';
        else if (lower.includes('lookalike')) audType = 'LOOKALIKE';
        else if (lower.includes('engaged') || lower.includes('retarget')) audType = 'ENGAGED';
        
        audienceMap.set(audId, {
          id: audId,
          name: audName,
          type: audType,
          feedingCampaigns: [],
          targetingCampaigns: []
        });
      }
      return audId;
    };

    data.groups.forEach(group => {
      group.children.forEach(campaign => {
        const targetedAudiences: string[] = [];
        
        campaign.targetingResolved.audiences.forEach(audName => {
          const audId = findOrCreateAudience(audName);
          targetedAudiences.push(audId);
          audienceMap.get(audId)!.targetingCampaigns.push(campaign.id);
          targetingLinks.push({ audienceId: audId, campaignId: campaign.id });
        });

        const outputAudienceIds: string[] = [];
        campaign.outputAudiences?.forEach(outAud => {
          const audId = findOrCreateAudience(outAud);
          outputAudienceIds.push(audId);
          audienceMap.get(audId)!.feedingCampaigns.push(campaign.id);
          outputLinks.push({ campaignId: campaign.id, audienceId: audId });
        });

        allCampaigns.push({
          id: campaign.id,
          name: campaign.name,
          groupName: group.name,
          outputAudiences: outputAudienceIds,
          targetedAudiences,
          campaign
        });
      });
    });

    const isRemarketingCampaign = (camp: CampaignInfo) => {
      return camp.targetedAudiences.some(audId => {
        const aud = audienceMap.get(audId);
        if (!aud) return false;
        if (aud.segment) return true;
        if (audId.startsWith('seg-')) return true;
        const audType = aud.type;
        return audType === 'WEBSITE' || 
               audType === 'VIDEO' || 
               audType === 'ENGAGED' ||
               audType === 'LOOKALIKE' ||
               audType === 'CONTACT';
      });
    };

    const coldCampaigns = allCampaigns.filter(c => !isRemarketingCampaign(c));
    const remarketingCampaigns = allCampaigns.filter(c => isRemarketingCampaign(c));

    const usedAudienceIds = new Set<string>();
    outputLinks.forEach(l => usedAudienceIds.add(l.audienceId));
    targetingLinks.forEach(l => usedAudienceIds.add(l.audienceId));

    const audiences = Array.from(audienceMap.values()).filter(a => usedAudienceIds.has(a.id));

    return { coldCampaigns, remarketingCampaigns, audiences, outputLinks, targetingLinks };
  }, [data]);

  const calculateLines = () => {
    if (!containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    const newLines: ConnectionLine[] = [];

    outputLinks.forEach(link => {
      const sourceEl = nodeRefs.current.get(`cold-${link.campaignId}`);
      const targetEl = nodeRefs.current.get(`aud-${link.audienceId}`);

      if (sourceEl && targetEl) {
        const sRect = sourceEl.getBoundingClientRect();
        const tRect = targetEl.getBoundingClientRect();

        newLines.push({
          x1: sRect.right - containerRect.left,
          y1: sRect.top + sRect.height / 2 - containerRect.top,
          x2: tRect.left - containerRect.left,
          y2: tRect.top + tRect.height / 2 - containerRect.top,
          key: `out-${link.campaignId}-${link.audienceId}`,
          type: 'output',
          sourceId: link.campaignId,
          targetId: link.audienceId
        });
      }
    });

    targetingLinks.forEach(link => {
      const sourceEl = nodeRefs.current.get(`aud-${link.audienceId}`);
      const targetEl = nodeRefs.current.get(`rmkt-${link.campaignId}`);

      if (sourceEl && targetEl) {
        const sRect = sourceEl.getBoundingClientRect();
        const tRect = targetEl.getBoundingClientRect();

        newLines.push({
          x1: sRect.right - containerRect.left,
          y1: sRect.top + sRect.height / 2 - containerRect.top,
          x2: tRect.left - containerRect.left,
          y2: tRect.top + tRect.height / 2 - containerRect.top,
          key: `tgt-${link.audienceId}-${link.campaignId}`,
          type: 'targeting',
          sourceId: link.audienceId,
          targetId: link.campaignId
        });
      }
    });

    setLines(newLines);
  };

  useLayoutEffect(() => {
    nodeRefs.current.clear();
  }, [data]);

  useLayoutEffect(() => {
    const timer = setTimeout(calculateLines, 150);
    return () => clearTimeout(timer);
  }, [coldCampaigns, remarketingCampaigns, audiences, outputLinks, targetingLinks]);

  useEffect(() => {
    window.addEventListener('resize', calculateLines);
    return () => window.removeEventListener('resize', calculateLines);
  }, []);

  const isNodeHighlighted = (nodeId: string, nodeType: 'cold' | 'aud' | 'rmkt') => {
    if (!hoveredNode && !selectedNode) return true;
    const activeNode = selectedNode || hoveredNode;
    if (!activeNode) return true;
    
    if (activeNode === nodeId) return true;

    const connected = lines.some(l => {
      if (nodeType === 'cold') {
        return l.sourceId === nodeId && (l.targetId === activeNode || activeNode.includes(l.targetId));
      } else if (nodeType === 'aud') {
        return (l.targetId === nodeId && activeNode === l.sourceId) ||
               (l.sourceId === nodeId && activeNode === l.targetId) ||
               l.targetId === nodeId || l.sourceId === nodeId;
      } else {
        return l.targetId === nodeId && (l.sourceId === activeNode || activeNode.includes(l.sourceId));
      }
    });

    if (connected) return true;

    const isActiveConnected = lines.some(l => 
      l.sourceId === activeNode || l.targetId === activeNode ||
      activeNode.includes(l.sourceId) || activeNode.includes(l.targetId)
    );
    
    if (!isActiveConnected) return true;

    return lines.some(l => {
      if (l.sourceId === activeNode || activeNode.includes(l.sourceId)) {
        return l.targetId === nodeId || nodeId.includes(l.targetId);
      }
      if (l.targetId === activeNode || activeNode.includes(l.targetId)) {
        return l.sourceId === nodeId || nodeId.includes(l.sourceId);
      }
      return false;
    });
  };

  const isLineHighlighted = (line: ConnectionLine) => {
    if (!hoveredNode && !selectedNode) return false;
    const activeNode = selectedNode || hoveredNode;
    if (!activeNode) return false;
    
    return line.sourceId === activeNode || 
           line.targetId === activeNode ||
           activeNode.includes(line.sourceId) ||
           activeNode.includes(line.targetId);
  };

  const handleCampaignClick = (campaign: CampaignInfo) => {
    if (selectedNode === campaign.id) {
      setSelectedNode(null);
    } else {
      setSelectedNode(campaign.id);
      onSelect(NodeType.CAMPAIGN, campaign.name, campaign.campaign.targetingResolved, campaign.campaign.children);
    }
  };

  const handleAudienceClick = (audId: string) => {
    if (selectedNode === audId) {
      setSelectedNode(null);
    } else {
      setSelectedNode(audId);
    }
  };

  const getAudienceIcon = (type: string) => {
    switch(type) {
      case 'WEBSITE': return <Globe size={14} className="text-green-600" />;
      case 'VIDEO': return <Video size={14} className="text-red-600" />;
      case 'ENGAGED': return <Activity size={14} className="text-orange-600" />;
      case 'COMPANY': return <Building2 size={14} className="text-blue-600" />;
      case 'CONTACT': return <UserCheck size={14} className="text-indigo-600" />;
      case 'LOOKALIKE': return <Sparkles size={14} className="text-purple-600" />;
      default: return <Users size={14} className="text-gray-600" />;
    }
  };

  const getAudienceColor = (type: string) => {
    switch(type) {
      case 'WEBSITE': return 'border-green-300 bg-green-50';
      case 'VIDEO': return 'border-red-300 bg-red-50';
      case 'ENGAGED': return 'border-orange-300 bg-orange-50';
      case 'COMPANY': return 'border-blue-300 bg-blue-50';
      case 'CONTACT': return 'border-indigo-300 bg-indigo-50';
      case 'LOOKALIKE': return 'border-purple-300 bg-purple-50';
      default: return 'border-gray-300 bg-gray-50';
    }
  };

  const formatCount = (count?: number) => {
    if (!count) return null;
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(0)}K`;
    return count.toString();
  };

  if (coldCampaigns.length === 0 && remarketingCampaigns.length === 0) {
    return (
      <div className="w-full bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
        <Users size={48} className="mx-auto text-gray-300 mb-4" />
        <h3 className="text-lg font-semibold text-gray-600 mb-2">No Campaign Data</h3>
        <p className="text-sm text-gray-400">
          Connect to LinkedIn and select an account to visualize the remarketing funnel.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full relative bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden min-h-[650px] p-6" ref={containerRef}>
      
      {selectedNode && (
        <button
          onClick={() => setSelectedNode(null)}
          className="absolute top-4 right-4 z-30 px-3 py-1.5 bg-gray-800 text-white text-xs rounded-lg hover:bg-gray-700 transition-colors"
        >
          Clear Selection
        </button>
      )}

      <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 5 }}>
        <defs>
          <marker id="arrowhead-blue" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill="#3b82f6" />
          </marker>
          <marker id="arrowhead-green" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill="#22c55e" />
          </marker>
        </defs>
        {lines.map((line) => {
          const highlighted = isLineHighlighted(line);
          const baseOpacity = hoveredNode || selectedNode ? (highlighted ? 0.9 : 0.1) : 0.4;
          const strokeWidth = highlighted ? 2.5 : 1.5;
          const color = line.type === 'output' ? '#3b82f6' : '#22c55e';
          const midX = (line.x1 + line.x2) / 2;

          return (
            <path
              key={line.key}
              d={`M ${line.x1} ${line.y1} C ${midX} ${line.y1}, ${midX} ${line.y2}, ${line.x2} ${line.y2}`}
              fill="none"
              stroke={color}
              strokeWidth={strokeWidth}
              strokeOpacity={baseOpacity}
              markerEnd={highlighted ? `url(#arrowhead-${line.type === 'output' ? 'blue' : 'green'})` : undefined}
              style={{ transition: 'all 0.2s ease' }}
            />
          );
        })}
      </svg>

      <div className="grid grid-cols-3 gap-6 h-full relative z-10">
        
        <div className="flex flex-col">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-orange-200">
            <h3 className="text-xs font-bold uppercase tracking-wider text-orange-600 flex items-center gap-2">
              <Megaphone size={14} />
              Cold Campaigns
            </h3>
            <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">{coldCampaigns.length}</span>
          </div>
          
          <div className="flex-1 overflow-y-auto space-y-3 pr-2">
            {coldCampaigns.length > 0 ? coldCampaigns.map(camp => {
              const highlighted = isNodeHighlighted(camp.id, 'cold');
              const hasOutput = camp.outputAudiences.length > 0;
              
              return (
                <div
                  key={camp.id}
                  ref={el => { if (el) nodeRefs.current.set(`cold-${camp.id}`, el) }}
                  onMouseEnter={() => setHoveredNode(camp.id)}
                  onMouseLeave={() => setHoveredNode(null)}
                  onClick={() => handleCampaignClick(camp)}
                  className={`
                    p-3 rounded-lg border-2 cursor-pointer transition-all duration-200
                    ${selectedNode === camp.id ? 'ring-2 ring-orange-500 ring-offset-1' : ''}
                    ${highlighted ? 'border-orange-300 bg-orange-50 opacity-100' : 'border-gray-200 bg-gray-50 opacity-30 grayscale'}
                    hover:shadow-md hover:scale-[1.02]
                  `}
                >
                  <div className="text-[9px] text-gray-400 uppercase font-medium truncate mb-1">{camp.groupName}</div>
                  <div className="flex items-start gap-2">
                    <Megaphone size={14} className="text-orange-600 mt-0.5 flex-shrink-0" />
                    <span className="text-xs font-medium text-orange-800 leading-tight">{camp.name}</span>
                  </div>
                  {hasOutput && (
                    <div className="mt-2 flex items-center gap-1 text-[10px] text-blue-600 bg-blue-50 px-2 py-1 rounded">
                      <ArrowRight size={10} />
                      <span>Builds {camp.outputAudiences.length} audience{camp.outputAudiences.length > 1 ? 's' : ''}</span>
                    </div>
                  )}
                </div>
              );
            }) : (
              <div className="text-center text-xs text-gray-300 italic py-10 border-2 border-dashed border-gray-100 rounded">
                No cold campaigns
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-purple-200">
            <h3 className="text-xs font-bold uppercase tracking-wider text-purple-600 flex items-center gap-2">
              <Users size={14} />
              Remarketing Audiences
            </h3>
            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">{audiences.length}</span>
          </div>
          
          <div className="flex-1 overflow-y-auto space-y-2 pr-2">
            {audiences.length > 0 ? audiences.map(aud => {
              const highlighted = isNodeHighlighted(aud.id, 'aud');
              const hasFeeders = aud.feedingCampaigns.length > 0;
              const hasTargeters = aud.targetingCampaigns.length > 0;
              
              return (
                <div
                  key={aud.id}
                  ref={el => { if (el) nodeRefs.current.set(`aud-${aud.id}`, el) }}
                  onMouseEnter={() => setHoveredNode(aud.id)}
                  onMouseLeave={() => setHoveredNode(null)}
                  onClick={() => handleAudienceClick(aud.id)}
                  className={`
                    p-3 rounded-lg border-2 cursor-pointer transition-all duration-200
                    ${selectedNode === aud.id ? 'ring-2 ring-purple-500 ring-offset-1' : ''}
                    ${highlighted ? `${getAudienceColor(aud.type)} opacity-100` : 'border-gray-200 bg-gray-50 opacity-30 grayscale'}
                    hover:shadow-md
                  `}
                >
                  <div className="flex items-center gap-2">
                    {getAudienceIcon(aud.type)}
                    <span className="text-xs font-medium truncate flex-1">{aud.name}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    {aud.segment && (
                      <>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                          aud.segment.status === 'READY' || aud.segment.status === 'ACTIVE' 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-gray-100 text-gray-500'
                        }`}>
                          {aud.segment.status}
                        </span>
                        {aud.segment.audienceCount && (
                          <span className="text-[10px] text-gray-400">
                            ~{formatCount(aud.segment.audienceCount)}
                          </span>
                        )}
                      </>
                    )}
                    {hasFeeders && (
                      <span className="text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                        ← {aud.feedingCampaigns.length} source{aud.feedingCampaigns.length > 1 ? 's' : ''}
                      </span>
                    )}
                    {hasTargeters && (
                      <span className="text-[10px] text-green-600 bg-green-50 px-1.5 py-0.5 rounded">
                        → {aud.targetingCampaigns.length} campaign{aud.targetingCampaigns.length > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>
              );
            }) : (
              <div className="text-center text-xs text-gray-300 italic py-10 border-2 border-dashed border-gray-100 rounded">
                No remarketing audiences
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-green-200">
            <h3 className="text-xs font-bold uppercase tracking-wider text-green-600 flex items-center gap-2">
              <Activity size={14} />
              Remarketing Campaigns
            </h3>
            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">{remarketingCampaigns.length}</span>
          </div>
          
          <div className="flex-1 overflow-y-auto space-y-3 pr-2">
            {remarketingCampaigns.length > 0 ? remarketingCampaigns.map(camp => {
              const highlighted = isNodeHighlighted(camp.id, 'rmkt');
              
              return (
                <div
                  key={camp.id}
                  ref={el => { if (el) nodeRefs.current.set(`rmkt-${camp.id}`, el) }}
                  onMouseEnter={() => setHoveredNode(camp.id)}
                  onMouseLeave={() => setHoveredNode(null)}
                  onClick={() => handleCampaignClick(camp)}
                  className={`
                    p-3 rounded-lg border-2 cursor-pointer transition-all duration-200
                    ${selectedNode === camp.id ? 'ring-2 ring-green-500 ring-offset-1' : ''}
                    ${highlighted ? 'border-green-300 bg-green-50 opacity-100' : 'border-gray-200 bg-gray-50 opacity-30 grayscale'}
                    hover:shadow-md hover:scale-[1.02]
                  `}
                >
                  <div className="text-[9px] text-gray-400 uppercase font-medium truncate mb-1">{camp.groupName}</div>
                  <div className="flex items-start gap-2">
                    <Activity size={14} className="text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-xs font-medium text-green-800 leading-tight">{camp.name}</span>
                  </div>
                  {camp.targetedAudiences.length > 0 && (
                    <div className="mt-2 text-[10px] text-green-600">
                      Targets {camp.targetedAudiences.length} audience{camp.targetedAudiences.length > 1 ? 's' : ''}
                    </div>
                  )}
                </div>
              );
            }) : (
              <div className="text-center text-xs text-gray-300 italic py-10 border-2 border-dashed border-gray-100 rounded">
                No remarketing campaigns
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="absolute bottom-4 left-4 flex items-center gap-4 text-[10px] text-gray-400 bg-white/80 px-3 py-2 rounded-lg border">
        <div className="flex items-center gap-1">
          <div className="w-8 h-0.5 bg-blue-500 rounded"></div>
          <span>Builds Audience</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-8 h-0.5 bg-green-500 rounded"></div>
          <span>Targets Audience</span>
        </div>
      </div>
    </div>
  );
};
