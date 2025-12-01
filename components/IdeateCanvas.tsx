import React, { useState, useRef, useCallback } from 'react';
import { Plus, Minus, Maximize, Move, Trash2, Sparkles, Download, Copy, Folder, LayoutGrid, FileImage, Lightbulb, Send, X, GripVertical, Edit2, Check, ChevronDown, ChevronRight, Target, Settings, Image, Users, Percent, ArrowRight } from 'lucide-react';

export interface IdeateNode {
  id: string;
  type: 'group' | 'campaign' | 'ad' | 'audience';
  name: string;
  x: number;
  y: number;
  parentId?: string;
  objective?: string;
  adFormat?: string;
  notes?: string;
  industries?: string[];
  funnelStage?: 'awareness' | 'consideration' | 'activation';
  audienceType?: string;
  audiencePercentage?: number;
  sourceCampaignId?: string;
  targetCampaignId?: string;
}

interface Props {
  onExport?: (nodes: IdeateNode[]) => void;
}

const AUDIENCE_TYPES = [
  { value: 'video_viewers', label: 'Video Viewers', icon: '🎬', description: 'People who watched your video ads' },
  { value: 'website_visitors', label: 'Website Visitors', icon: '🌐', description: 'People who visited your website' },
  { value: 'lead_form_opens', label: 'Lead Form Opens', icon: '📋', description: 'People who opened but didn\'t submit' },
  { value: 'ad_engagers', label: 'Ad Engagers', icon: '👆', description: 'People who clicked or engaged with ads' },
  { value: 'page_visitors', label: 'Company Page Visitors', icon: '🏢', description: 'People who visited your LinkedIn page' },
  { value: 'event_attendees', label: 'Event Attendees', icon: '📅', description: 'People who RSVPd to your events' },
  { value: 'lookalike', label: 'Lookalike Audience', icon: '👥', description: 'Similar to your best customers' },
];

const INDUSTRY_CATEGORIES: Record<string, string[]> = {
  'Technology & IT': [
    'IT Services and IT Consulting',
    'Software Development',
    'Computer and Network Security',
    'Data Infrastructure and Analytics',
    'Technology, Information and Internet',
    'Computer Hardware Manufacturing',
    'Semiconductor Manufacturing',
  ],
  'Professional Services': [
    'Business Consulting and Services',
    'Accounting',
    'Legal Services',
    'Human Resources Services',
    'Marketing Services',
    'Advertising Services',
    'Market Research',
    'Staffing and Recruiting',
  ],
  'Finance': [
    'Banking',
    'Financial Services',
    'Investment Banking',
    'Investment Management',
    'Insurance',
    'Venture Capital and Private Equity',
    'Capital Markets',
  ],
  'Healthcare': [
    'Hospitals and Health Care',
    'Medical Equipment Manufacturing',
    'Pharmaceutical Manufacturing',
    'Biotechnology Research',
    'Mental Health Care',
    'Wellness and Fitness Services',
  ],
  'Manufacturing': [
    'Manufacturing (General)',
    'Industrial Machinery Manufacturing',
    'Automation Machinery Manufacturing',
    'Motor Vehicle Manufacturing',
    'Electrical Equipment Manufacturing',
    'Chemical Manufacturing',
  ],
  'Education': [
    'Higher Education',
    'E-Learning Providers',
    'Education',
    'Professional Training and Coaching',
    'Primary and Secondary Education',
  ],
  'Retail & E-commerce': [
    'Retail',
    'Online and Mail Order Retail',
    'Consumer Goods',
    'Retail Apparel and Fashion',
    'Retail Luxury Goods and Jewelry',
  ],
  'Real Estate': [
    'Real Estate',
    'Commercial Real Estate',
    'Leasing Residential Real Estate',
    'Construction',
    'Architecture and Planning',
  ],
};

const OBJECTIVE_OPTIONS = {
  awareness: [
    { value: 'Brand Awareness', label: 'Brand Awareness', description: 'Maximize impressions to increase brand visibility' },
    { value: 'Engagement', label: 'Engagement', description: 'Drive likes, comments, shares on your content' },
  ],
  consideration: [
    { value: 'Website Visits', label: 'Website Visits', description: 'Drive traffic to your website or landing page' },
    { value: 'Video Views', label: 'Video Views', description: 'Get more people to watch your video content' },
  ],
  activation: [
    { value: 'Lead Generation', label: 'Lead Generation', description: 'Collect leads with LinkedIn Lead Gen Forms' },
    { value: 'Website Conversions', label: 'Website Conversions', description: 'Drive specific actions on your website' },
    { value: 'Job Applicants', label: 'Job Applicants', description: 'Attract qualified candidates for open roles' },
  ],
};

const AD_FORMAT_OPTIONS = [
  { value: 'Single Image Ad', label: 'Single Image Ad', icon: '🖼️' },
  { value: 'Video Ad', label: 'Video Ad', icon: '🎬' },
  { value: 'Carousel Ad', label: 'Carousel Ad', icon: '🎠' },
  { value: 'Document Ad', label: 'Document Ad', icon: '📄' },
  { value: 'Event Ad', label: 'Event Ad', icon: '📅' },
  { value: 'Message Ad', label: 'Message Ad', icon: '💬' },
  { value: 'Text Ad', label: 'Text Ad', icon: '📝' },
  { value: 'Spotlight Ad', label: 'Spotlight Ad', icon: '✨' },
  { value: 'Follower Ad', label: 'Follower Ad', icon: '👥' },
];

const FUNNEL_STAGES = [
  { name: 'Awareness', objective: 'Brand Awareness', color: 'blue', adFormats: ['Video Ad', 'Single Image Ad', 'Carousel Ad'], funnelStage: 'awareness' as const },
  { name: 'Consideration', objective: 'Website Visits', color: 'purple', adFormats: ['Carousel Ad', 'Document Ad', 'Video Ad'], funnelStage: 'consideration' as const },
  { name: 'Activation', objective: 'Lead Generation', color: 'green', adFormats: ['Single Image Ad', 'Message Ad', 'Document Ad'], funnelStage: 'activation' as const },
];

const generateId = () => Math.random().toString(36).substr(2, 9);

const createDefaultFunnel = (): IdeateNode[] => {
  const nodes: IdeateNode[] = [];
  let yOffset = 80;
  
  FUNNEL_STAGES.forEach((stage, stageIndex) => {
    const groupId = generateId();
    const groupX = 100;
    
    nodes.push({
      id: groupId,
      type: 'group',
      name: `${stage.name} Campaign Group`,
      x: groupX,
      y: yOffset,
      objective: stage.objective,
      funnelStage: stage.funnelStage,
      industries: [],
    });
    
    const campaignId = generateId();
    nodes.push({
      id: campaignId,
      type: 'campaign',
      name: `${stage.name} - ${stage.objective}`,
      x: groupX + 350,
      y: yOffset,
      parentId: groupId,
      objective: stage.objective,
      funnelStage: stage.funnelStage,
    });
    
    stage.adFormats.forEach((format, adIndex) => {
      nodes.push({
        id: generateId(),
        type: 'ad',
        name: `Ad ${adIndex + 1}`,
        x: groupX + 700,
        y: yOffset - 60 + (adIndex * 70),
        parentId: campaignId,
        adFormat: format,
      });
    });
    
    yOffset += 280;
  });
  
  return nodes;
};

export const IdeateCanvas: React.FC<Props> = ({ onExport }) => {
  const [nodes, setNodes] = useState<IdeateNode[]>(createDefaultFunnel());
  const [transform, setTransform] = useState({ x: 50, y: 30, scale: 0.85 });
  const [isDragging, setIsDragging] = useState(false);
  const [draggedNode, setDraggedNode] = useState<string | null>(null);
  const [pendingDragNode, setPendingDragNode] = useState<string | null>(null);
  const [dragStartPos, setDragStartPos] = useState({ x: 0, y: 0 });
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [editingNode, setEditingNode] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [justClickedNode, setJustClickedNode] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedNodeData = selectedNode ? nodes.find(n => n.id === selectedNode) : null;
  
  const getParentGroup = (node: IdeateNode): IdeateNode | null => {
    if (node.type === 'group') return node;
    if (node.type === 'campaign') return nodes.find(n => n.id === node.parentId) || null;
    if (node.type === 'ad') {
      const campaign = nodes.find(n => n.id === node.parentId);
      if (campaign) return nodes.find(n => n.id === campaign.parentId) || null;
    }
    return null;
  };

  const updateNode = (nodeId: string, updates: Partial<IdeateNode>) => {
    setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, ...updates } : n));
  };

  const toggleIndustry = (nodeId: string, industry: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    const current = node.industries || [];
    const updated = current.includes(industry)
      ? current.filter(i => i !== industry)
      : [...current, industry];
    updateNode(nodeId, { industries: updated });
  };

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => ({ ...prev, [category]: !prev[category] }));
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const zoomSensitivity = 0.001;
      const newScale = Math.min(Math.max(0.1, transform.scale - e.deltaY * zoomSensitivity), 3);
      setTransform(t => ({ ...t, scale: newScale }));
    } else {
      setTransform(t => ({ ...t, x: t.x - e.deltaX, y: t.y - e.deltaY }));
    }
  };

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (draggedNode) return;
    setIsDragging(true);
    setStartPos({ x: e.clientX - transform.x, y: e.clientY - transform.y });
  };

  const DRAG_THRESHOLD = 5;

  const handleMouseMove = (e: React.MouseEvent) => {
    if (pendingDragNode && !draggedNode) {
      const dx = e.clientX - dragStartPos.x;
      const dy = e.clientY - dragStartPos.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance > DRAG_THRESHOLD) {
        setDraggedNode(pendingDragNode);
      }
    }
    
    if (draggedNode) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      
      const x = (e.clientX - rect.left - transform.x) / transform.scale;
      const y = (e.clientY - rect.top - transform.y) / transform.scale;
      
      setNodes(prev => prev.map(n => 
        n.id === draggedNode ? { ...n, x, y } : n
      ));
    } else if (isDragging) {
      setTransform(t => ({
        ...t,
        x: e.clientX - startPos.x,
        y: e.clientY - startPos.y
      }));
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDraggedNode(null);
    setPendingDragNode(null);
  };

  const handleNodeMouseDown = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    setPendingDragNode(nodeId);
    setDragStartPos({ x: e.clientX, y: e.clientY });
    setSelectedNode(nodeId);
    setJustClickedNode(true);
    setTimeout(() => setJustClickedNode(false), 100);
  };

  const handleCanvasClick = () => {
    if (!justClickedNode && !draggedNode) {
      setSelectedNode(null);
    }
  };

  const zoomIn = () => setTransform(t => ({ ...t, scale: Math.min(t.scale + 0.2, 3) }));
  const zoomOut = () => setTransform(t => ({ ...t, scale: Math.max(t.scale - 0.2, 0.1) }));
  const resetZoom = () => setTransform({ x: 50, y: 30, scale: 0.85 });

  const addNode = (type: 'group' | 'campaign' | 'ad') => {
    let parentId: string | undefined;
    let x = 200 + Math.random() * 100;
    let y = 200 + Math.random() * 100;
    
    if (type === 'group') {
      const existingGroups = nodes.filter(n => n.type === 'group');
      x = 100;
      y = existingGroups.length > 0 ? Math.max(...existingGroups.map(g => g.y)) + 280 : 80;
    } else if (type === 'campaign') {
      const selectedNodeData = nodes.find(n => n.id === selectedNode);
      if (selectedNodeData?.type === 'group') {
        parentId = selectedNode!;
        x = selectedNodeData.x + 350;
        y = selectedNodeData.y;
      } else if (selectedNodeData?.type === 'campaign') {
        parentId = selectedNodeData.parentId;
        x = selectedNodeData.x;
        y = selectedNodeData.y + 120;
      } else {
        const groups = nodes.filter(n => n.type === 'group');
        if (groups.length > 0) {
          parentId = groups[0].id;
          x = groups[0].x + 350;
          y = groups[0].y;
        } else {
          alert('Please create a Campaign Group first');
          return;
        }
      }
    } else if (type === 'ad') {
      const selectedNodeData = nodes.find(n => n.id === selectedNode);
      if (selectedNodeData?.type === 'campaign') {
        parentId = selectedNode!;
        const existingAds = nodes.filter(n => n.parentId === selectedNode);
        x = selectedNodeData.x + 350;
        y = selectedNodeData.y - 60 + (existingAds.length * 70);
      } else if (selectedNodeData?.type === 'ad') {
        parentId = selectedNodeData.parentId;
        x = selectedNodeData.x;
        y = selectedNodeData.y + 70;
      } else {
        const campaigns = nodes.filter(n => n.type === 'campaign');
        if (campaigns.length > 0) {
          parentId = campaigns[0].id;
          const existingAds = nodes.filter(n => n.parentId === campaigns[0].id);
          x = campaigns[0].x + 350;
          y = campaigns[0].y - 60 + (existingAds.length * 70);
        } else {
          alert('Please create a Campaign first');
          return;
        }
      }
    }
    
    const newNode: IdeateNode = {
      id: generateId(),
      type,
      name: type === 'group' ? 'New Campaign Group' : type === 'campaign' ? 'New Campaign' : 'New Ad',
      x,
      y,
      parentId,
      objective: type === 'campaign' ? 'Website Visits' : undefined,
      adFormat: type === 'ad' ? 'Single Image Ad' : undefined,
    };
    setNodes(prev => [...prev, newNode]);
    setSelectedNode(newNode.id);
  };

  const addAudienceNode = () => {
    const campaigns = nodes.filter(n => n.type === 'campaign');
    if (campaigns.length < 2) {
      alert('Create at least 2 campaigns to connect with an audience flow');
      return;
    }
    
    const selectedNodeData = nodes.find(n => n.id === selectedNode);
    let sourceCampaign: IdeateNode | undefined;
    
    if (selectedNodeData?.type === 'campaign') {
      sourceCampaign = selectedNodeData;
    } else {
      sourceCampaign = campaigns[0];
    }
    
    const otherCampaigns = campaigns.filter(c => c.id !== sourceCampaign?.id);
    const targetCampaign = otherCampaigns[0];
    
    const midX = (sourceCampaign.x + targetCampaign.x) / 2;
    const midY = (sourceCampaign.y + targetCampaign.y) / 2 + 50;
    
    const newNode: IdeateNode = {
      id: generateId(),
      type: 'audience',
      name: 'Video Viewers',
      x: midX,
      y: midY,
      audienceType: 'video_viewers',
      audiencePercentage: 25,
      sourceCampaignId: sourceCampaign.id,
      targetCampaignId: targetCampaign.id,
    };
    setNodes(prev => [...prev, newNode]);
    setSelectedNode(newNode.id);
  };

  const deleteNode = (nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    
    const childIds = nodes.filter(n => n.parentId === nodeId).map(n => n.id);
    const grandchildIds = nodes.filter(n => childIds.includes(n.parentId || '')).map(n => n.id);
    
    const idsToDelete = [nodeId, ...childIds, ...grandchildIds];
    setNodes(prev => prev.filter(n => !idsToDelete.includes(n.id)));
    setSelectedNode(null);
  };

  const startEditing = (nodeId: string, currentName: string) => {
    setEditingNode(nodeId);
    setEditingName(currentName);
  };

  const finishEditing = () => {
    if (editingNode && editingName.trim()) {
      setNodes(prev => prev.map(n => 
        n.id === editingNode ? { ...n, name: editingName.trim() } : n
      ));
    }
    setEditingNode(null);
    setEditingName('');
  };

  const validateAndNormalizeNodes = (rawNodes: any[]): IdeateNode[] => {
    const validatedNodes: IdeateNode[] = [];
    const idMap = new Map<string, string>();
    
    for (const node of rawNodes) {
      if (!node.type || !['group', 'campaign', 'ad'].includes(node.type)) continue;
      
      const newId = node.id || generateId();
      if (node.id) idMap.set(node.id, newId);
      
      validatedNodes.push({
        id: newId,
        type: node.type,
        name: node.name || `New ${node.type}`,
        x: typeof node.x === 'number' ? node.x : 100,
        y: typeof node.y === 'number' ? node.y : 100,
        parentId: node.parentId,
        objective: node.objective,
        adFormat: node.adFormat,
        notes: node.notes,
      });
    }
    
    for (const node of validatedNodes) {
      if (node.parentId && idMap.has(node.parentId)) {
        node.parentId = idMap.get(node.parentId);
      }
      
      if (node.type === 'group') {
        node.parentId = undefined;
      } else if (node.type === 'campaign') {
        const parent = validatedNodes.find(n => n.id === node.parentId);
        if (!parent || parent.type !== 'group') {
          const firstGroup = validatedNodes.find(n => n.type === 'group');
          node.parentId = firstGroup?.id;
        }
      } else if (node.type === 'ad') {
        const parent = validatedNodes.find(n => n.id === node.parentId);
        if (!parent || parent.type !== 'campaign') {
          const firstCampaign = validatedNodes.find(n => n.type === 'campaign');
          node.parentId = firstCampaign?.id;
        }
      }
    }
    
    return validatedNodes.filter(n => {
      if (n.type === 'group') return true;
      if (n.type === 'campaign') return n.parentId && validatedNodes.some(p => p.id === n.parentId && p.type === 'group');
      if (n.type === 'ad') return n.parentId && validatedNodes.some(p => p.id === n.parentId && p.type === 'campaign');
      return false;
    });
  };

  const generateFromAI = async () => {
    if (!aiPrompt.trim()) return;
    
    setIsGenerating(true);
    try {
      const response = await fetch('/api/linkedin/ideate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: aiPrompt }),
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.nodes && Array.isArray(data.nodes)) {
          const validatedNodes = validateAndNormalizeNodes(data.nodes);
          if (validatedNodes.length > 0) {
            setNodes(validatedNodes);
          } else {
            console.error('No valid nodes after validation');
          }
        }
      }
    } catch (error) {
      console.error('AI generation failed:', error);
    } finally {
      setIsGenerating(false);
      setShowAiPanel(false);
      setAiPrompt('');
    }
  };

  const resetToDefault = () => {
    setNodes(createDefaultFunnel());
    setSelectedNode(null);
    resetZoom();
  };

  const clearAll = () => {
    if (nodes.length === 0) return;
    if (confirm('Are you sure you want to clear the entire canvas?')) {
      setNodes([]);
      setSelectedNode(null);
    }
  };

  const exportAsText = () => {
    const groups = nodes.filter(n => n.type === 'group');
    let text = '# Campaign Structure\n\n';
    
    groups.forEach(group => {
      text += `## ${group.name}\n`;
      if (group.objective) text += `Objective: ${group.objective}\n`;
      if (group.notes) text += `Notes: ${group.notes}\n`;
      text += '\n';
      
      const campaigns = nodes.filter(n => n.type === 'campaign' && n.parentId === group.id);
      campaigns.forEach(campaign => {
        text += `### ${campaign.name}\n`;
        if (campaign.objective) text += `- Objective: ${campaign.objective}\n`;
        
        const ads = nodes.filter(n => n.type === 'ad' && n.parentId === campaign.id);
        if (ads.length > 0) {
          text += `- Ads:\n`;
          ads.forEach(ad => {
            text += `  - ${ad.name}${ad.adFormat ? ` (${ad.adFormat})` : ''}\n`;
          });
        }
        text += '\n';
      });
    });
    
    navigator.clipboard.writeText(text);
    alert('Structure copied to clipboard!');
  };

  const getNodeConnections = () => {
    const connections: { from: IdeateNode; to: IdeateNode }[] = [];
    nodes.forEach(node => {
      if (node.parentId) {
        const parent = nodes.find(n => n.id === node.parentId);
        if (parent) {
          connections.push({ from: parent, to: node });
        }
      }
    });
    return connections;
  };

  const connections = getNodeConnections();

  const getNodeWidth = (type: string) => type === 'ad' ? 140 : 260;
  const getNodeHeight = (type: string) => type === 'ad' ? 80 : 90;

  const renderSidebar = () => {
    if (!selectedNodeData) return null;
    
    const parentGroup = getParentGroup(selectedNodeData);
    const funnelStage = selectedNodeData.funnelStage || parentGroup?.funnelStage || 'awareness';
    const objectiveOptions = OBJECTIVE_OPTIONS[funnelStage] || OBJECTIVE_OPTIONS.awareness;
    
    return (
      <div className="w-80 bg-white border-l border-gray-200 overflow-y-auto flex-shrink-0">
        <div className="p-4 border-b border-gray-100 bg-gray-50">
          <div className="flex items-center gap-2 mb-1">
            {selectedNodeData.type === 'group' && <Folder size={18} className="text-gray-500" />}
            {selectedNodeData.type === 'campaign' && <LayoutGrid size={18} className="text-orange-500" />}
            {selectedNodeData.type === 'ad' && <FileImage size={18} className="text-green-500" />}
            {selectedNodeData.type === 'audience' && <Users size={18} className="text-purple-500" />}
            <span className="text-xs font-semibold uppercase text-gray-400">
              {selectedNodeData.type === 'group' ? 'Campaign Group' : selectedNodeData.type === 'audience' ? 'Audience Flow' : selectedNodeData.type}
            </span>
          </div>
          <h3 className="font-semibold text-gray-900 text-lg leading-tight">{selectedNodeData.name}</h3>
        </div>

        {selectedNodeData.type === 'group' && (
          <>
            <div className="p-4 border-b border-gray-100">
              <div className="flex items-center gap-2 mb-3">
                <Settings size={16} className="text-gray-500" />
                <h4 className="font-semibold text-gray-700 text-sm">Funnel Stage</h4>
              </div>
              <div className="flex gap-2">
                {(['awareness', 'consideration', 'activation'] as const).map(stage => (
                  <button
                    key={stage}
                    onClick={() => updateNode(selectedNodeData.id, { funnelStage: stage })}
                    className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                      funnelStage === stage
                        ? stage === 'awareness' ? 'bg-blue-100 text-blue-700 border-2 border-blue-300'
                        : stage === 'consideration' ? 'bg-purple-100 text-purple-700 border-2 border-purple-300'
                        : 'bg-green-100 text-green-700 border-2 border-green-300'
                        : 'bg-gray-100 text-gray-600 border-2 border-transparent hover:bg-gray-200'
                    }`}
                  >
                    {stage.charAt(0).toUpperCase() + stage.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-4 border-b border-gray-100">
              <div className="flex items-center gap-2 mb-3">
                <Target size={16} className="text-gray-500" />
                <h4 className="font-semibold text-gray-700 text-sm">Industry Targeting</h4>
              </div>
              <p className="text-xs text-gray-500 mb-3">Select industries to target with this campaign group</p>
              
              {(selectedNodeData.industries?.length || 0) > 0 && (
                <div className="mb-3 flex flex-wrap gap-1">
                  {selectedNodeData.industries?.map(ind => (
                    <span 
                      key={ind}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs"
                    >
                      {ind}
                      <button 
                        onClick={() => toggleIndustry(selectedNodeData.id, ind)}
                        className="hover:bg-blue-200 rounded-full p-0.5"
                      >
                        <X size={10} />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <div className="space-y-1 max-h-64 overflow-y-auto">
                {Object.entries(INDUSTRY_CATEGORIES).map(([category, industries]) => (
                  <div key={category} className="border border-gray-200 rounded-lg overflow-hidden">
                    <button
                      onClick={() => toggleCategory(category)}
                      className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 text-left"
                    >
                      <span className="text-sm font-medium text-gray-700">{category}</span>
                      {expandedCategories[category] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>
                    {expandedCategories[category] && (
                      <div className="p-2 space-y-1 bg-white">
                        {industries.map(industry => (
                          <label key={industry} className="flex items-center gap-2 px-2 py-1 hover:bg-gray-50 rounded cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedNodeData.industries?.includes(industry) || false}
                              onChange={() => toggleIndustry(selectedNodeData.id, industry)}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-xs text-gray-700">{industry}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {selectedNodeData.type === 'campaign' && (
          <div className="p-4 border-b border-gray-100">
            <div className="flex items-center gap-2 mb-3">
              <Target size={16} className="text-gray-500" />
              <h4 className="font-semibold text-gray-700 text-sm">Campaign Objective</h4>
            </div>
            <p className="text-xs text-gray-500 mb-3">
              {funnelStage === 'awareness' && 'Top-of-funnel objectives for brand visibility'}
              {funnelStage === 'consideration' && 'Mid-funnel objectives for engagement'}
              {funnelStage === 'activation' && 'Bottom-funnel objectives for conversions'}
            </p>
            <div className="space-y-2">
              {objectiveOptions.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => updateNode(selectedNodeData.id, { objective: opt.value })}
                  className={`w-full text-left px-3 py-2 rounded-lg border-2 transition-colors ${
                    selectedNodeData.objective === opt.value
                      ? 'border-orange-400 bg-orange-50'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="font-medium text-sm text-gray-800">{opt.label}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{opt.description}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {selectedNodeData.type === 'ad' && (
          <div className="p-4 border-b border-gray-100">
            <div className="flex items-center gap-2 mb-3">
              <Image size={16} className="text-gray-500" />
              <h4 className="font-semibold text-gray-700 text-sm">Ad Format</h4>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {AD_FORMAT_OPTIONS.map(format => (
                <button
                  key={format.value}
                  onClick={() => updateNode(selectedNodeData.id, { adFormat: format.value })}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 transition-colors ${
                    selectedNodeData.adFormat === format.value
                      ? 'border-green-400 bg-green-50'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <span className="text-lg">{format.icon}</span>
                  <span className="text-xs font-medium text-gray-700">{format.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {selectedNodeData.type === 'audience' && (
          <>
            <div className="p-4 border-b border-gray-100">
              <div className="flex items-center gap-2 mb-3">
                <Users size={16} className="text-purple-500" />
                <h4 className="font-semibold text-gray-700 text-sm">Audience Type</h4>
              </div>
              <div className="space-y-2">
                {AUDIENCE_TYPES.map(type => (
                  <button
                    key={type.value}
                    onClick={() => updateNode(selectedNodeData.id, { audienceType: type.value, name: type.label })}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg border-2 transition-colors text-left ${
                      selectedNodeData.audienceType === type.value
                        ? 'border-purple-400 bg-purple-50'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <span className="text-xl">{type.icon}</span>
                    <div>
                      <div className="font-medium text-sm text-gray-800">{type.label}</div>
                      <div className="text-xs text-gray-500">{type.description}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="p-4 border-b border-gray-100">
              <div className="flex items-center gap-2 mb-3">
                <Percent size={16} className="text-purple-500" />
                <h4 className="font-semibold text-gray-700 text-sm">Conversion Rate</h4>
              </div>
              <p className="text-xs text-gray-500 mb-3">Estimated % of source audience that flows to target</p>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="1"
                  max="100"
                  value={selectedNodeData.audiencePercentage || 25}
                  onChange={(e) => updateNode(selectedNodeData.id, { audiencePercentage: parseInt(e.target.value) })}
                  className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-500"
                />
                <span className="w-12 text-right font-bold text-purple-600">{selectedNodeData.audiencePercentage || 25}%</span>
              </div>
            </div>

            <div className="p-4 border-b border-gray-100">
              <div className="flex items-center gap-2 mb-3">
                <ArrowRight size={16} className="text-purple-500" />
                <h4 className="font-semibold text-gray-700 text-sm">Flow Connection</h4>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Source Campaign</label>
                  <select
                    value={selectedNodeData.sourceCampaignId || ''}
                    onChange={(e) => updateNode(selectedNodeData.id, { sourceCampaignId: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">Select source...</option>
                    {nodes.filter(n => n.type === 'campaign').map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Target Campaign</label>
                  <select
                    value={selectedNodeData.targetCampaignId || ''}
                    onChange={(e) => updateNode(selectedNodeData.id, { targetCampaignId: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">Select target...</option>
                    {nodes.filter(n => n.type === 'campaign' && n.id !== selectedNodeData.sourceCampaignId).map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </>
        )}

        <div className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Edit2 size={16} className="text-gray-500" />
            <h4 className="font-semibold text-gray-700 text-sm">Notes</h4>
          </div>
          <textarea
            value={selectedNodeData.notes || ''}
            onChange={(e) => updateNode(selectedNodeData.id, { notes: e.target.value })}
            placeholder="Add notes about this item..."
            className="w-full h-24 px-3 py-2 text-sm border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>
    );
  };

  return (
    <div className="w-full h-full flex">
      <div className={`flex-1 relative bg-[#f0f2f5] overflow-hidden ${selectedNodeData ? '' : 'rounded-xl'} shadow-inner border border-gray-200`}>
      
      {/* Toolbar */}
      <div className="absolute top-4 left-4 z-50 flex items-center gap-2">
        <div className="flex items-center gap-1 bg-white rounded-lg shadow-lg border border-gray-200 p-1">
          <button
            onClick={() => addNode('group')}
            className="flex items-center gap-1.5 px-3 py-2 hover:bg-gray-100 rounded text-gray-700 text-sm font-medium"
            title="Add Campaign Group"
          >
            <Folder size={16} className="text-gray-500" />
            <span>Group</span>
          </button>
          <div className="w-px h-6 bg-gray-200" />
          <button
            onClick={() => addNode('campaign')}
            className="flex items-center gap-1.5 px-3 py-2 hover:bg-gray-100 rounded text-gray-700 text-sm font-medium"
            title="Add Campaign"
          >
            <LayoutGrid size={16} className="text-orange-500" />
            <span>Campaign</span>
          </button>
          <div className="w-px h-6 bg-gray-200" />
          <button
            onClick={() => addNode('ad')}
            className="flex items-center gap-1.5 px-3 py-2 hover:bg-gray-100 rounded text-gray-700 text-sm font-medium"
            title="Add Ad"
          >
            <FileImage size={16} className="text-green-500" />
            <span>Ad</span>
          </button>
          <div className="w-px h-6 bg-gray-200" />
          <button
            onClick={addAudienceNode}
            className="flex items-center gap-1.5 px-3 py-2 hover:bg-gray-100 rounded text-gray-700 text-sm font-medium"
            title="Add Audience Flow"
          >
            <Users size={16} className="text-purple-500" />
            <span>Audience</span>
          </button>
        </div>
        
        {selectedNode && (
          <button
            onClick={() => deleteNode(selectedNode)}
            className="flex items-center gap-1.5 px-3 py-2 bg-red-50 hover:bg-red-100 rounded-lg text-red-600 text-sm font-medium border border-red-200"
          >
            <Trash2 size={16} />
            <span>Delete</span>
          </button>
        )}
        
        <div className="w-px h-8 bg-gray-300 mx-1" />
        
        <button
          onClick={resetToDefault}
          className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-gray-100 rounded-lg text-gray-700 text-sm font-medium border border-gray-200 shadow-sm"
          title="Reset to default funnel"
        >
          <Lightbulb size={16} className="text-yellow-500" />
          <span>Default Funnel</span>
        </button>
        
        <button
          onClick={clearAll}
          className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-red-50 rounded-lg text-gray-600 hover:text-red-600 text-sm font-medium border border-gray-200 hover:border-red-200 shadow-sm transition-colors"
          title="Clear entire canvas"
        >
          <Trash2 size={16} />
          <span>Clear All</span>
        </button>
      </div>

      {/* AI Generate Button */}
      <div className="absolute top-4 right-4 z-50 flex items-center gap-2">
        <button
          onClick={exportAsText}
          className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-gray-100 rounded-lg text-gray-700 text-sm font-medium border border-gray-200 shadow-sm"
          title="Copy structure as text"
        >
          <Copy size={16} />
          <span>Copy</span>
        </button>
        
        <button
          onClick={() => setShowAiPanel(!showAiPanel)}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium shadow-sm transition-all ${
            showAiPanel 
              ? 'bg-purple-600 text-white' 
              : 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white hover:from-purple-600 hover:to-indigo-700'
          }`}
        >
          <Sparkles size={16} />
          <span>AI Generate</span>
        </button>
      </div>

      {/* AI Panel */}
      {showAiPanel && (
        <div className="absolute top-16 right-4 z-50 w-96 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden">
          <div className="p-4 bg-gradient-to-r from-purple-500 to-indigo-600 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles size={20} />
                <span className="font-semibold">AI Campaign Generator</span>
              </div>
              <button onClick={() => setShowAiPanel(false)} className="hover:bg-white/20 rounded p-1">
                <X size={18} />
              </button>
            </div>
            <p className="text-sm text-purple-100 mt-1">
              Describe your campaign goals and AI will generate a structure
            </p>
          </div>
          
          <div className="p-4">
            <textarea
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="e.g., Create a B2B SaaS launch campaign targeting marketing directors in the UK with video ads for awareness and lead gen forms for conversion"
              className="w-full h-32 p-3 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
            
            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={generateFromAI}
                disabled={isGenerating || !aiPrompt.trim()}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:from-purple-600 hover:to-indigo-700"
              >
                {isGenerating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Generating...</span>
                  </>
                ) : (
                  <>
                    <Send size={16} />
                    <span>Generate Structure</span>
                  </>
                )}
              </button>
            </div>
            
            <div className="mt-3 text-xs text-gray-500">
              <p className="font-medium mb-1">Quick prompts:</p>
              <div className="flex flex-wrap gap-1">
                {[
                  'B2B awareness campaign',
                  'Product launch funnel',
                  'Retargeting sequence',
                ].map(prompt => (
                  <button
                    key={prompt}
                    onClick={() => setAiPrompt(prompt)}
                    className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-gray-600"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Zoom Controls */}
      <div className="absolute bottom-6 right-6 z-40 flex flex-col gap-2 bg-white rounded-lg shadow-lg border border-gray-200 p-1">
        <button onClick={zoomIn} className="p-2 hover:bg-gray-100 rounded text-gray-600" title="Zoom In"><Plus size={18} /></button>
        <button onClick={zoomOut} className="p-2 hover:bg-gray-100 rounded text-gray-600" title="Zoom Out"><Minus size={18} /></button>
        <div className="h-px bg-gray-200 my-0.5 w-full"></div>
        <button onClick={resetZoom} className="p-2 hover:bg-gray-100 rounded text-gray-600" title="Reset View"><Maximize size={18} /></button>
      </div>

      {/* Legend */}
      <div className="absolute bottom-6 left-6 z-40 flex flex-col gap-2 text-[10px] font-semibold text-gray-500 bg-white/90 p-3 rounded-lg backdrop-blur-sm border shadow-sm pointer-events-none">
        <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-gray-500"></span> Campaign Group</div>
        <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-orange-500"></span> Campaign</div>
        <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-green-500"></span> Ad</div>
        <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-purple-500"></span> Audience Flow</div>
        <div className="mt-2 pt-2 border-t border-gray-100 flex items-center gap-1 text-gray-400">
          <Move size={10} /> Drag to Pan
        </div>
        <div className="flex items-center gap-1 text-gray-400">
          <GripVertical size={10} /> Drag nodes to move
        </div>
      </div>

      {/* Canvas Area */}
      <div
        ref={containerRef}
        className={`w-full h-full ${draggedNode ? 'cursor-grabbing' : isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        onClick={handleCanvasClick}
      >
        <div
          className="relative transition-transform duration-75 origin-top-left will-change-transform"
          style={{
            transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
            width: 2000,
            height: 1500,
          }}
        >
          {/* Dot Grid Background */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)',
              backgroundSize: '20px 20px',
              opacity: 0.8,
            }}
          />

          {/* Connection Lines */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
            {connections.map(({ from, to }) => {
              const fromWidth = getNodeWidth(from.type);
              const fromHeight = getNodeHeight(from.type);
              const toHeight = getNodeHeight(to.type);
              
              const startX = from.x + fromWidth;
              const startY = from.y + fromHeight / 2;
              const endX = to.x;
              const endY = to.y + toHeight / 2;
              
              const cp1x = startX + (endX - startX) * 0.5;
              const cp1y = startY;
              const cp2x = startX + (endX - startX) * 0.5;
              const cp2y = endY;

              return (
                <path
                  key={`${from.id}-${to.id}`}
                  d={`M ${startX} ${startY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${endX} ${endY}`}
                  fill="none"
                  stroke="#94a3b8"
                  strokeWidth="2"
                  strokeOpacity="0.5"
                />
              );
            })}
            
            {/* Audience Flow Lines */}
            {nodes.filter(n => n.type === 'audience').map(audience => {
              const sourceCampaign = nodes.find(n => n.id === audience.sourceCampaignId);
              const targetCampaign = nodes.find(n => n.id === audience.targetCampaignId);
              
              if (!sourceCampaign || !targetCampaign) return null;
              
              const sourceX = sourceCampaign.x + 260;
              const sourceY = sourceCampaign.y + 45;
              const audienceX = audience.x;
              const audienceY = audience.y + 35;
              const audienceEndX = audience.x + 180;
              const targetX = targetCampaign.x;
              const targetY = targetCampaign.y + 45;
              
              return (
                <g key={`audience-flow-${audience.id}`}>
                  {/* Source to Audience */}
                  <path
                    d={`M ${sourceX} ${sourceY} Q ${(sourceX + audienceX) / 2} ${sourceY}, ${audienceX} ${audienceY}`}
                    fill="none"
                    stroke="#a855f7"
                    strokeWidth="2"
                    strokeDasharray="6,4"
                    strokeOpacity="0.7"
                  />
                  {/* Audience to Target */}
                  <path
                    d={`M ${audienceEndX} ${audienceY} Q ${(audienceEndX + targetX) / 2} ${targetY}, ${targetX} ${targetY}`}
                    fill="none"
                    stroke="#a855f7"
                    strokeWidth="2"
                    strokeDasharray="6,4"
                    strokeOpacity="0.7"
                    markerEnd="url(#arrowhead)"
                  />
                </g>
              );
            })}
            
            {/* Arrow marker definition */}
            <defs>
              <marker
                id="arrowhead"
                markerWidth="10"
                markerHeight="7"
                refX="9"
                refY="3.5"
                orient="auto"
              >
                <polygon points="0 0, 10 3.5, 0 7" fill="#a855f7" fillOpacity="0.7" />
              </marker>
            </defs>
          </svg>

          {/* Nodes */}
          {nodes.filter(n => n.type !== 'audience').map(node => (
            <div
              key={node.id}
              onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
              onDoubleClick={() => startEditing(node.id, node.name)}
              className={`
                absolute transition-shadow duration-200 rounded-lg border-2 flex flex-col justify-center z-10 select-none
                ${node.type === 'ad' ? 'w-[140px] px-3 py-2' : 'w-[260px] px-4 py-3'}
                ${draggedNode === node.id ? 'cursor-grabbing shadow-2xl scale-105' : 'cursor-grab hover:shadow-xl'}
                ${selectedNode === node.id ? 'ring-2 ring-offset-2' : ''}
                ${node.type === 'group' ? `bg-white border-gray-300 ${selectedNode === node.id ? 'ring-gray-400' : ''}` : ''}
                ${node.type === 'campaign' ? `bg-white border-orange-300 border-l-4 border-l-orange-500 ${selectedNode === node.id ? 'ring-orange-400' : ''}` : ''}
                ${node.type === 'ad' ? `bg-white border-green-300 border-l-4 border-l-green-500 ${selectedNode === node.id ? 'ring-green-400' : ''}` : ''}
              `}
              style={{
                left: node.x,
                top: node.y,
              }}
            >
              {/* Node Header */}
              <div className="flex items-center gap-1.5 mb-1">
                {node.type === 'group' && <Folder className="w-4 h-4 text-gray-400" />}
                {node.type === 'campaign' && <LayoutGrid className="w-4 h-4 text-orange-500" />}
                {node.type === 'ad' && <FileImage className="w-3 h-3 text-green-500" />}
                
                <span className={`font-bold uppercase tracking-wider ${node.type === 'ad' ? 'text-[7px]' : 'text-[9px]'} text-gray-400`}>
                  {node.type === 'group' ? 'Campaign Group' : node.type === 'campaign' ? 'Campaign' : 'Ad'}
                </span>
              </div>

              {/* Node Name */}
              {editingNode === node.id ? (
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && finishEditing()}
                    onBlur={finishEditing}
                    autoFocus
                    className="flex-1 text-sm font-semibold bg-gray-50 border border-gray-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <button onClick={finishEditing} className="p-0.5 hover:bg-gray-100 rounded">
                    <Check size={14} className="text-green-600" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1 group">
                  <span className={`font-semibold leading-tight ${node.type === 'ad' ? 'text-xs' : 'text-sm'} text-gray-900`}>
                    {node.name}
                  </span>
                  <button 
                    onClick={(e) => { e.stopPropagation(); startEditing(node.id, node.name); }}
                    className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-gray-100 rounded transition-opacity"
                  >
                    <Edit2 size={12} className="text-gray-400" />
                  </button>
                </div>
              )}

              {/* Objective/Format Badge */}
              {node.type === 'campaign' && node.objective && (
                <span className="mt-1.5 text-[9px] font-medium px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 self-start">
                  {node.objective}
                </span>
              )}
              {node.type === 'ad' && node.adFormat && (
                <span className="mt-1 text-[8px] font-medium px-1.5 py-0.5 rounded bg-green-100 text-green-700 self-start">
                  {node.adFormat}
                </span>
              )}
            </div>
          ))}

          {/* Audience Nodes */}
          {nodes.filter(n => n.type === 'audience').map(node => {
            const audienceTypeInfo = AUDIENCE_TYPES.find(t => t.value === node.audienceType);
            return (
              <div
                key={node.id}
                onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
                onDoubleClick={() => startEditing(node.id, node.name)}
                className={`
                  absolute transition-shadow duration-200 rounded-full border-2 flex items-center justify-center z-20 select-none
                  w-[180px] h-[70px] px-4
                  ${draggedNode === node.id ? 'cursor-grabbing shadow-2xl scale-105' : 'cursor-grab hover:shadow-xl'}
                  ${selectedNode === node.id ? 'ring-2 ring-offset-2 ring-purple-400' : ''}
                  bg-gradient-to-r from-purple-50 to-purple-100 border-purple-300
                `}
                style={{
                  left: node.x,
                  top: node.y,
                }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{audienceTypeInfo?.icon || '👥'}</span>
                  <div className="flex flex-col">
                    {editingNode === node.id ? (
                      <input
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && finishEditing()}
                        onBlur={finishEditing}
                        autoFocus
                        className="text-sm font-semibold bg-white border border-purple-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-purple-500 w-24"
                      />
                    ) : (
                      <span className="text-sm font-semibold text-purple-900 leading-tight">{node.name}</span>
                    )}
                    <span className="text-lg font-bold text-purple-600">{node.audiencePercentage || 25}%</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      </div>
      {renderSidebar()}
    </div>
  );
};
