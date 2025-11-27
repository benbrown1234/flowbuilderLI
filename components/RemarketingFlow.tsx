
import React, { useLayoutEffect, useRef, useState, useEffect } from 'react';
import { AccountStructure, NodeType, TargetingSummary, CreativeNode, SegmentNode } from '../types';
import { Filter, Users, Megaphone, ArrowRight, Activity, MousePointerClick, Building2, UserCheck, Globe, Sparkles, Video, ChevronDown, X } from 'lucide-react';

interface Props {
  data: AccountStructure;
  onSelect: (type: NodeType, name: string, targeting?: TargetingSummary, creatives?: CreativeNode[]) => void;
}

interface AudienceToCampaignLink {
  audienceId: string;
  audienceName: string;
  audienceType: string;
  campaignId: string;
  campaignName: string;
  groupName: string;
}

export const RemarketingFlow: React.FC<Props> = ({ data, onSelect }) => {
  const [lines, setLines] = useState<{ x1: number, y1: number, x2: number, y2: number, key: string, sourceType: string }[]>([]);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [selectedSourceType, setSelectedSourceType] = useState<string>('all');
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const audienceToCampaignLinks = React.useMemo(() => {
    const links: AudienceToCampaignLink[] = [];
    const segmentMap = new Map<string, SegmentNode>();
    
    data.segments?.forEach(seg => {
      segmentMap.set(seg.name.toLowerCase(), seg);
      segmentMap.set(seg.id, seg);
    });

    data.groups.forEach(group => {
      group.children.forEach(campaign => {
        campaign.targetingResolved.audiences.forEach(audName => {
          const segment = segmentMap.get(audName.toLowerCase()) || segmentMap.get(audName);
          
          let audienceType = 'OTHER';
          if (segment) {
            audienceType = segment.type;
          } else {
            const lower = audName.toLowerCase();
            if (lower.includes('website') || lower.includes('visitor') || lower.includes('url')) {
              audienceType = 'WEBSITE';
            } else if (lower.includes('video') || lower.includes('viewer') || lower.includes('watch')) {
              audienceType = 'VIDEO';
            } else if (lower.includes('company') || lower.includes('abm')) {
              audienceType = 'COMPANY';
            } else if (lower.includes('contact') || lower.includes('list') || lower.includes('upload')) {
              audienceType = 'CONTACT';
            } else if (lower.includes('lookalike') || lower.includes('similar')) {
              audienceType = 'LOOKALIKE';
            } else if (lower.includes('engaged') || lower.includes('retarget')) {
              audienceType = 'ENGAGED';
            }
          }

          links.push({
            audienceId: segment?.id || audName,
            audienceName: audName,
            audienceType,
            campaignId: campaign.id,
            campaignName: campaign.name,
            groupName: group.name
          });
        });
      });
    });

    return links;
  }, [data]);

  const uniqueAudiences = React.useMemo(() => {
    const map = new Map<string, { id: string; name: string; type: string; segment?: SegmentNode }>();
    
    audienceToCampaignLinks.forEach(link => {
      if (!map.has(link.audienceId)) {
        const segment = data.segments?.find(s => s.id === link.audienceId || s.name === link.audienceName);
        map.set(link.audienceId, {
          id: link.audienceId,
          name: link.audienceName,
          type: link.audienceType,
          segment
        });
      }
    });
    
    return Array.from(map.values());
  }, [audienceToCampaignLinks, data.segments]);

  const uniqueCampaigns = React.useMemo(() => {
    const map = new Map<string, { id: string; name: string; groupName: string }>();
    
    audienceToCampaignLinks.forEach(link => {
      if (!map.has(link.campaignId)) {
        map.set(link.campaignId, {
          id: link.campaignId,
          name: link.campaignName,
          groupName: link.groupName
        });
      }
    });
    
    return Array.from(map.values());
  }, [audienceToCampaignLinks]);

  const sourceTypes = [
    { id: 'WEBSITE', name: 'Website Visitors', icon: Globe, color: 'green' },
    { id: 'VIDEO', name: 'Video Engagers', icon: Video, color: 'red' },
    { id: 'ENGAGED', name: 'Ad Engagers', icon: Activity, color: 'orange' },
    { id: 'COMPANY', name: 'Company Lists', icon: Building2, color: 'blue' },
    { id: 'CONTACT', name: 'Contact Lists', icon: UserCheck, color: 'indigo' },
    { id: 'LOOKALIKE', name: 'Lookalike Audiences', icon: Sparkles, color: 'purple' },
    { id: 'OTHER', name: 'Other Audiences', icon: Users, color: 'gray' },
  ];

  const activeSourceTypes = sourceTypes.filter(st => 
    uniqueAudiences.some(a => a.type === st.id)
  );

  const getFilteredData = () => {
    let audiences = uniqueAudiences;
    let campaigns = uniqueCampaigns;
    let links = audienceToCampaignLinks;

    if (selectedSourceType !== 'all') {
      audiences = uniqueAudiences.filter(a => a.type === selectedSourceType);
      const audienceIds = new Set(audiences.map(a => a.id));
      links = audienceToCampaignLinks.filter(l => audienceIds.has(l.audienceId));
      const campaignIds = new Set(links.map(l => l.campaignId));
      campaigns = uniqueCampaigns.filter(c => campaignIds.has(c.id));
    }

    if (selectedNode) {
      const isAudience = audiences.some(a => a.id === selectedNode);
      const isCampaign = campaigns.some(c => c.id === selectedNode);
      
      if (isAudience) {
        const connectedCampaignIds = new Set(
          links.filter(l => l.audienceId === selectedNode).map(l => l.campaignId)
        );
        campaigns = campaigns.filter(c => connectedCampaignIds.has(c.id));
        audiences = audiences.filter(a => a.id === selectedNode);
        links = links.filter(l => l.audienceId === selectedNode);
      } else if (isCampaign) {
        const connectedAudienceIds = new Set(
          links.filter(l => l.campaignId === selectedNode).map(l => l.audienceId)
        );
        audiences = audiences.filter(a => connectedAudienceIds.has(a.id));
        campaigns = campaigns.filter(c => c.id === selectedNode);
        links = links.filter(l => l.campaignId === selectedNode);
      }
    }

    return { audiences, campaigns, links };
  };

  const { audiences: filteredAudiences, campaigns: filteredCampaigns, links: filteredLinks } = getFilteredData();

  type AudienceItem = { id: string; name: string; type: string; segment?: SegmentNode };
  
  const audiencesByType = React.useMemo(() => {
    const grouped: Record<string, AudienceItem[]> = {};
    filteredAudiences.forEach(aud => {
      if (!grouped[aud.type]) grouped[aud.type] = [];
      grouped[aud.type].push(aud);
    });
    return grouped;
  }, [filteredAudiences]);

  const calculateLines = () => {
    if (!containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    const newLines: typeof lines = [];

    filteredLinks.forEach((link) => {
      const sourceEl = nodeRefs.current.get(`aud-${link.audienceId}`);
      const targetEl = nodeRefs.current.get(`camp-${link.campaignId}`);

      if (sourceEl && targetEl) {
        const sRect = sourceEl.getBoundingClientRect();
        const tRect = targetEl.getBoundingClientRect();

        const x1 = sRect.right - containerRect.left;
        const y1 = sRect.top + sRect.height / 2 - containerRect.top;
        const x2 = tRect.left - containerRect.left;
        const y2 = tRect.top + tRect.height / 2 - containerRect.top;

        if (x1 > 0 && y1 > 0 && x2 > 0 && y2 > 0) {
          newLines.push({
            x1, y1, x2, y2,
            key: `${link.audienceId}-${link.campaignId}`,
            sourceType: link.audienceType
          });
        }
      }
    });
    setLines(newLines);
  };

  useLayoutEffect(() => {
    nodeRefs.current.clear();
  }, [selectedSourceType, selectedNode]);

  useLayoutEffect(() => {
    const timer = setTimeout(calculateLines, 150);
    return () => clearTimeout(timer);
  }, [filteredLinks, selectedSourceType, selectedNode]);

  useEffect(() => {
    const handleResize = () => calculateLines();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const getTypeColor = (type: string) => {
    const st = sourceTypes.find(s => s.id === type);
    return st?.color || 'gray';
  };

  const getTypeIcon = (type: string) => {
    const st = sourceTypes.find(s => s.id === type);
    const Icon = st?.icon || Users;
    return <Icon size={14} />;
  };

  const getStrokeColor = (type: string) => {
    const colors: Record<string, string> = {
      'WEBSITE': '#16a34a',
      'VIDEO': '#dc2626',
      'ENGAGED': '#ea580c',
      'COMPANY': '#2563eb',
      'CONTACT': '#4f46e5',
      'LOOKALIKE': '#9333ea',
      'OTHER': '#6b7280',
    };
    return colors[type] || '#6b7280';
  };

  const isHighlighted = (id: string) => {
    if (!hoveredNode) return true;
    if (hoveredNode === id) return true;
    
    const isConnected = filteredLinks.some(l => 
      (l.audienceId === hoveredNode && l.campaignId === id) ||
      (l.campaignId === hoveredNode && l.audienceId === id) ||
      (`aud-${l.audienceId}` === hoveredNode && `camp-${l.campaignId}` === id) ||
      (`camp-${l.campaignId}` === hoveredNode && `aud-${l.audienceId}` === id)
    );
    return isConnected;
  };

  const isLineHighlighted = (audienceId: string, campaignId: string) => {
    if (!hoveredNode) return false;
    return hoveredNode === `aud-${audienceId}` || hoveredNode === `camp-${campaignId}`;
  };

  const handleAudienceClick = (id: string) => {
    setSelectedNode(selectedNode === id ? null : id);
  };

  const handleCampaignClick = (id: string) => {
    if (selectedNode === id) {
      setSelectedNode(null);
    } else {
      setSelectedNode(id);
    }
    
    for (const group of data.groups) {
      const camp = group.children.find(c => c.id === id);
      if (camp) {
        onSelect(NodeType.CAMPAIGN, camp.name, camp.targetingResolved, camp.children);
        return;
      }
    }
  };

  const clearSelection = () => {
    setSelectedNode(null);
  };

  const selectedTypeName = selectedSourceType !== 'all' 
    ? sourceTypes.find(s => s.id === selectedSourceType)?.name 
    : null;

  if (audienceToCampaignLinks.length === 0) {
    return (
      <div className="w-full bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
        <Users size={48} className="mx-auto text-gray-300 mb-4" />
        <h3 className="text-lg font-semibold text-gray-600 mb-2">No Remarketing Data Found</h3>
        <p className="text-sm text-gray-400">
          This account doesn't have any campaigns targeting matched audiences yet.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full relative bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden min-h-[600px] p-6" ref={containerRef}>
      
      {/* Source Type Filter - Top Right */}
      <div className="absolute top-4 right-4 z-30">
        <div className="relative">
          <button
            onClick={() => setShowTypeDropdown(!showTypeDropdown)}
            className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors min-w-[200px] justify-between"
          >
            <span className="truncate text-left flex-1">
              {selectedTypeName || 'All Audience Types'}
            </span>
            <ChevronDown size={16} className={`flex-shrink-0 transition-transform ${showTypeDropdown ? 'rotate-180' : ''}`} />
          </button>
          
          {showTypeDropdown && (
            <div className="absolute top-full right-0 mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
              <button
                onClick={() => {
                  setSelectedSourceType('all');
                  setShowTypeDropdown(false);
                  setSelectedNode(null);
                }}
                className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors ${selectedSourceType === 'all' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'}`}
              >
                All Audience Types
              </button>
              {activeSourceTypes.map(st => {
                const Icon = st.icon;
                return (
                  <button
                    key={st.id}
                    onClick={() => {
                      setSelectedSourceType(st.id);
                      setShowTypeDropdown(false);
                      setSelectedNode(null);
                    }}
                    className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors border-t border-gray-100 flex items-center gap-2 ${selectedSourceType === st.id ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'}`}
                  >
                    <Icon size={14} />
                    <span>{st.name}</span>
                    <span className="ml-auto text-xs text-gray-400">
                      {uniqueAudiences.filter(a => a.type === st.id).length}
                    </span>
                  </button>
                );
              })}
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

      {/* SVG Lines */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 5 }}>
        <defs>
          <filter id="remarketing-glow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        {lines.map((line) => {
          const [audienceId, campaignId] = line.key.split('-');
          const stroke = getStrokeColor(line.sourceType);
          const midX = (line.x1 + line.x2) / 2;
          const highlighted = isLineHighlighted(audienceId, campaignId);
          const opacity = hoveredNode ? (highlighted ? 0.9 : 0.15) : 0.6;
          const width = hoveredNode ? (highlighted ? 3 : 1) : 2;
          
          return (
            <path
              key={line.key}
              d={`M ${line.x1} ${line.y1} C ${midX} ${line.y1}, ${midX} ${line.y2}, ${line.x2} ${line.y2}`}
              fill="none"
              stroke={stroke}
              strokeWidth={width}
              strokeOpacity={opacity}
              filter={highlighted || !hoveredNode ? "url(#remarketing-glow)" : undefined}
              style={{ transition: 'all 0.2s ease' }}
            />
          );
        })}
      </svg>

      {/* Main Content - 2 Columns */}
      <div className="flex h-full relative z-10 justify-between pt-12 gap-8">
        
        {/* Left Column: Audiences by Type */}
        <div className="w-[350px] flex flex-col pr-4 h-full overflow-y-auto flex-shrink-0">
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4 border-b pb-2 flex items-center justify-between">
            <span>Matched Audiences</span>
            <span className="text-gray-300">{filteredAudiences.length}</span>
          </h3>
          
          {Object.entries(audiencesByType).map(([type, audiences]: [string, AudienceItem[]]) => {
            const st = sourceTypes.find(s => s.id === type);
            const Icon = st?.icon || Users;
            const colorMap: Record<string, string> = {
              'green': 'text-green-600 border-green-200 bg-green-50',
              'red': 'text-red-600 border-red-200 bg-red-50',
              'orange': 'text-orange-600 border-orange-200 bg-orange-50',
              'blue': 'text-blue-600 border-blue-200 bg-blue-50',
              'indigo': 'text-indigo-600 border-indigo-200 bg-indigo-50',
              'purple': 'text-purple-600 border-purple-200 bg-purple-50',
              'gray': 'text-gray-600 border-gray-200 bg-gray-50',
            };
            const colors = colorMap[st?.color || 'gray'];
            
            return (
              <div key={type} className="mb-4">
                <div className={`flex items-center gap-2 mb-2 text-xs font-semibold ${colors.split(' ')[0]}`}>
                  <Icon size={12} />
                  <span>{st?.name || type}</span>
                  <span className="ml-auto text-gray-400">{audiences.length}</span>
                </div>
                <div className="space-y-2">
                  {audiences.map(aud => {
                    const isSelected = selectedNode === aud.id;
                    const highlighted = isHighlighted(`aud-${aud.id}`);
                    
                    return (
                      <div
                        key={aud.id}
                        ref={el => { if (el) nodeRefs.current.set(`aud-${aud.id}`, el) }}
                        onMouseEnter={() => setHoveredNode(`aud-${aud.id}`)}
                        onMouseLeave={() => setHoveredNode(null)}
                        onClick={() => handleAudienceClick(aud.id)}
                        className={`
                          p-3 rounded-lg border cursor-pointer transition-all duration-200
                          ${colors}
                          ${isSelected ? 'ring-2 ring-offset-1 ring-blue-500 shadow-lg scale-105' : 'hover:shadow-md'}
                          ${!highlighted ? 'opacity-30 grayscale' : 'opacity-100'}
                        `}
                      >
                        <div className="flex items-center gap-2">
                          <Icon size={14} />
                          <span className="text-xs font-medium truncate flex-1">{aud.name}</span>
                        </div>
                        {aud.segment && (
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                              aud.segment.status === 'READY' || aud.segment.status === 'ACTIVE' 
                                ? 'bg-green-100 text-green-700' 
                                : 'bg-gray-100 text-gray-500'
                            }`}>
                              {aud.segment.status}
                            </span>
                            {aud.segment.audienceCount && (
                              <span className="text-[10px] text-gray-400">
                                {aud.segment.audienceCount >= 1000 
                                  ? `${(aud.segment.audienceCount / 1000).toFixed(0)}K` 
                                  : aud.segment.audienceCount} members
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          
          {filteredAudiences.length === 0 && (
            <div className="text-sm text-gray-300 italic text-center py-8">
              No audiences match the current filter
            </div>
          )}
        </div>

        {/* Right Column: Campaigns */}
        <div className="w-[350px] pl-4 border-l border-gray-100 overflow-y-auto flex-shrink-0">
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4 border-b pb-2 flex items-center justify-between">
            <span>Targeting Campaigns</span>
            <span className="text-gray-300">{filteredCampaigns.length}</span>
          </h3>
          <div className="flex flex-col gap-3">
            {filteredCampaigns.length > 0 ? filteredCampaigns.map((camp) => {
              const isSelected = selectedNode === camp.id;
              const highlighted = isHighlighted(`camp-${camp.id}`);
              
              return (
                <div
                  key={camp.id}
                  ref={el => { if (el) nodeRefs.current.set(`camp-${camp.id}`, el) }}
                  onMouseEnter={() => setHoveredNode(`camp-${camp.id}`)}
                  onMouseLeave={() => setHoveredNode(null)}
                  onClick={() => handleCampaignClick(camp.id)}
                  className={`
                    p-3 rounded-lg border border-orange-200 bg-orange-50 cursor-pointer transition-all duration-200
                    ${isSelected ? 'ring-2 ring-offset-1 ring-orange-500 shadow-lg scale-105' : 'hover:shadow-md'}
                    ${!highlighted ? 'opacity-30 grayscale' : 'opacity-100'}
                  `}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[9px] font-bold text-gray-400 uppercase truncate pr-1">{camp.groupName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Megaphone size={14} className="text-orange-600 flex-shrink-0" />
                    <span className="font-semibold text-orange-800 text-xs leading-tight">{camp.name}</span>
                  </div>
                </div>
              );
            }) : (
              <div className="text-sm text-gray-300 italic text-center py-8">
                No campaigns match the current filter
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Click outside to close dropdown */}
      {showTypeDropdown && (
        <div 
          className="fixed inset-0 z-20" 
          onClick={() => setShowTypeDropdown(false)}
        />
      )}
    </div>
  );
};
