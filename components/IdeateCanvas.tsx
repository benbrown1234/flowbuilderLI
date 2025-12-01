import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Plus, Minus, Maximize, Move, Trash2, Sparkles, Download, Copy, Folder, LayoutGrid, FileImage, Lightbulb, Send, X, GripVertical, Edit2, Check, ChevronDown, ChevronRight, Target, Settings, Image, Users, Percent, ArrowRight, Save, Share2, MessageSquare, Clock, FolderOpen, Link2, ExternalLink, CheckCircle, XCircle, Hand, MousePointer2 } from 'lucide-react';
import axios from 'axios';

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
  audienceCategory?: 'remarketing' | 'bof' | 'tof';
  audiencePercentage?: number;
  sourceCampaignId?: string;
  targetCampaignId?: string;
  // Campaign settings
  biddingType?: 'maximize_delivery' | 'manual_bidding';
  enhancedAudience?: boolean;
  linkedinAudienceNetwork?: boolean;
  tofAudienceId?: string;
  // Ad settings
  isThoughtLeaderAd?: boolean;
  // Saved Audience targeting
  companySizes?: string[];
  seniorities?: string[];
}

interface CanvasData {
  id: string;
  title: string;
  is_public: boolean;
  share_token: string;
  allow_public_comments: boolean;
  created_at: string;
  updated_at: string;
  version_number?: number;
  last_saved?: string;
}

interface Comment {
  id: number;
  canvas_id: string;
  node_id: string | null;
  author_name: string;
  content: string;
  is_resolved: boolean;
  created_at: string;
}

interface Props {
  onExport?: (nodes: IdeateNode[]) => void;
  canvasId?: string;
  shareToken?: string;
}

const AUDIENCE_CATEGORIES = {
  remarketing: {
    label: 'Remarketing Audience',
    description: 'Re-engage users who interacted with your content',
    hasSourceCampaign: true,
    hasTargetCampaign: true,
    color: 'purple',
    types: [
      { value: 'video_views', label: 'Video Views', icon: '🎬', description: 'People who watched your video ads' },
      { value: 'lead_form_opens', label: 'Lead Form Opens', icon: '📋', description: 'People who opened but didn\'t submit' },
      { value: 'ad_engagers', label: 'Ad Engagers', icon: '👆', description: 'People who clicked or engaged with ads' },
      { value: 'event_attendees', label: 'Event Attendees', icon: '📅', description: 'People who RSVPd to your events' },
    ]
  },
  bof: {
    label: 'BOF Audience (Website)',
    description: 'Bottom of funnel website visitors',
    hasSourceCampaign: false,
    hasTargetCampaign: true,
    color: 'orange',
    types: [
      { value: 'website_visitors', label: 'Website Visitors', icon: '🌐', description: 'All website visitors' },
      { value: 'company_page_visitors', label: 'Company Page Visitors', icon: '🏢', description: 'Visitors from company page' },
      { value: 'high_company_engagers', label: 'High Company Engagers', icon: '📊', description: 'Based on company report engagement' },
    ]
  },
  tof: {
    label: 'TOF Audience',
    description: 'Top of funnel targeting audiences',
    hasSourceCampaign: false,
    hasTargetCampaign: true,
    color: 'blue',
    types: [
      { value: 'saved_audience', label: 'Saved Audience', icon: '💾', description: 'Email, firmographics, demographics' },
      { value: 'abm_list', label: 'ABM Lists', icon: '📋', description: 'Uploaded company lists' },
    ]
  }
};

const NAMING_CONVENTIONS = {
  group: '[Objective] – [Audience] – [Industry] – [Location]',
  campaign: '[Group Acronym] – [Objective] – [Creative Format] – [Subsegment]',
  ad: '[Creative Type] – [Angle/Message] – [Version]',
};

const BIDDING_TYPES = [
  { value: 'manual_bidding', label: 'Manual Bidding', description: 'Set your own bid amount', default: true },
  { value: 'maximize_delivery', label: 'Maximize Delivery', description: 'Automatically optimize for delivery' },
];

const OBJECTIVE_RECOMMENDATIONS: Record<string, string[]> = {
  awareness: ['Brand Awareness'],
  consideration: ['Website Visits', 'Engagement', 'Video Views'],
  activation: ['Lead Generation', 'Website Conversions', 'Talent Leads', 'Job Applicants'],
};

const COMPANY_SIZE_OPTIONS = [
  { value: 'self_employed', label: 'Self-employed' },
  { value: '1_10', label: '1-10 employees' },
  { value: '11_50', label: '11-50 employees' },
  { value: '51_200', label: '51-200 employees' },
  { value: '201_500', label: '201-500 employees' },
  { value: '501_1000', label: '501-1,000 employees' },
  { value: '1001_5000', label: '1,001-5,000 employees' },
  { value: '5001_10000', label: '5,001-10,000 employees' },
  { value: '10001_plus', label: '10,001+ employees' },
];

const SENIORITY_OPTIONS = [
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'training', label: 'Training' },
  { value: 'entry', label: 'Entry' },
  { value: 'senior', label: 'Senior' },
  { value: 'manager', label: 'Manager' },
  { value: 'director', label: 'Director' },
  { value: 'vp', label: 'VP' },
  { value: 'cxo', label: 'CXO' },
  { value: 'partner', label: 'Partner' },
  { value: 'owner', label: 'Owner' },
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

const ALL_OBJECTIVES = [
  { value: 'Brand Awareness', label: 'Brand Awareness', description: 'Maximize impressions to increase brand visibility', category: 'awareness', icon: '📢' },
  { value: 'Website Visits', label: 'Website Visits', description: 'Drive traffic to your website or landing page', category: 'consideration', icon: '🌐' },
  { value: 'Engagement', label: 'Engagement', description: 'Drive likes, comments, shares on your content', category: 'consideration', icon: '🏆' },
  { value: 'Video Views', label: 'Video Views', description: 'Get more people to watch your video content', category: 'consideration', icon: '▶️' },
  { value: 'Lead Generation', label: 'Lead Generation', description: 'Collect leads with LinkedIn Lead Gen Forms', category: 'conversions', icon: '🎯' },
  { value: 'Talent Leads', label: 'Talent Leads', description: 'Find qualified candidates for your company', category: 'conversions', icon: '👤' },
  { value: 'Website Conversions', label: 'Website Conversions', description: 'Drive specific actions on your website', category: 'conversions', icon: '✅' },
  { value: 'Job Applicants', label: 'Job Applicants', description: 'Attract qualified candidates for open roles', category: 'conversions', icon: '📋' },
];

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

export const IdeateCanvas: React.FC<Props> = ({ onExport, canvasId: propCanvasId, shareToken }) => {
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
  
  // Canvas persistence state
  const [canvasId, setCanvasId] = useState<string | null>(propCanvasId || null);
  const [canvas, setCanvas] = useState<CanvasData | null>(null);
  const [canvasList, setCanvasList] = useState<CanvasData[]>([]);
  const [showCanvasList, setShowCanvasList] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showCommentsPanel, setShowCommentsPanel] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [commenterName, setCommenterName] = useState('');
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved' | 'error'>('saved');
  const [isReadOnly, setIsReadOnly] = useState(!!shareToken);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState('');
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedNodesRef = useRef<string>('');
  
  // Tool mode and multi-select state
  const [toolMode, setToolMode] = useState<'pan' | 'select'>('pan');
  const [selectedNodes, setSelectedNodes] = useState<string[]>([]);
  const [selectionBox, setSelectionBox] = useState<{ startX: number; startY: number; endX: number; endY: number } | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const justFinishedSelectingRef = useRef(false);

  // Load canvas or create new one
  useEffect(() => {
    const initCanvas = async () => {
      try {
        if (shareToken) {
          const response = await axios.get(`/api/canvas/share/${shareToken}`);
          setCanvas(response.data);
          setNodes(response.data.nodes || createDefaultFunnel());
          setIsReadOnly(true);
          lastSavedNodesRef.current = JSON.stringify(response.data.nodes || []);
          loadComments(response.data.id);
        } else if (propCanvasId) {
          const response = await axios.get(`/api/canvas/${propCanvasId}`);
          setCanvas(response.data);
          setCanvasId(response.data.id);
          setNodes(response.data.nodes || createDefaultFunnel());
          lastSavedNodesRef.current = JSON.stringify(response.data.nodes || []);
          loadComments(response.data.id);
        } else {
          const response = await axios.post('/api/canvas', { title: 'Untitled Canvas' });
          setCanvas(response.data);
          setCanvasId(response.data.id);
          lastSavedNodesRef.current = JSON.stringify(createDefaultFunnel());
          await saveCanvas(response.data.id, createDefaultFunnel());
        }
      } catch (err) {
        console.error('Failed to initialize canvas:', err);
      }
    };
    initCanvas();
    // Don't load canvas list in shared/read-only mode
    if (!shareToken) {
      loadCanvasList();
    }
  }, [propCanvasId, shareToken]);

  // Auto-save on changes (debounced)
  useEffect(() => {
    if (isReadOnly || !canvasId) return;
    
    const currentNodesStr = JSON.stringify(nodes);
    if (currentNodesStr === lastSavedNodesRef.current) return;
    
    setSaveStatus('unsaved');
    
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    saveTimeoutRef.current = setTimeout(() => {
      saveCanvas(canvasId, nodes);
    }, 2000);
    
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [nodes, canvasId, isReadOnly]);

  const loadCanvasList = async () => {
    try {
      const response = await axios.get('/api/canvas');
      setCanvasList(response.data);
    } catch (err) {
      console.error('Failed to load canvas list:', err);
    }
  };

  const loadComments = async (id: string) => {
    try {
      const response = await axios.get(`/api/canvas/${id}/comments`);
      setComments(response.data);
    } catch (err) {
      console.error('Failed to load comments:', err);
    }
  };

  const saveCanvas = async (id: string, nodesToSave: IdeateNode[]) => {
    try {
      setSaveStatus('saving');
      await axios.post(`/api/canvas/${id}/save`, { 
        nodes: nodesToSave,
        connections: [],
        settings: { transform }
      });
      lastSavedNodesRef.current = JSON.stringify(nodesToSave);
      setSaveStatus('saved');
      loadCanvasList();
    } catch (err) {
      console.error('Failed to save canvas:', err);
      setSaveStatus('error');
    }
  };

  const createNewCanvas = async () => {
    try {
      const response = await axios.post('/api/canvas', { title: 'Untitled Canvas' });
      setCanvas(response.data);
      setCanvasId(response.data.id);
      setNodes(createDefaultFunnel());
      setIsReadOnly(false);
      lastSavedNodesRef.current = JSON.stringify(createDefaultFunnel());
      await saveCanvas(response.data.id, createDefaultFunnel());
      setShowCanvasList(false);
      loadCanvasList();
    } catch (err) {
      console.error('Failed to create canvas:', err);
    }
  };

  const loadCanvas = async (id: string) => {
    try {
      const response = await axios.get(`/api/canvas/${id}`);
      setCanvas(response.data);
      setCanvasId(response.data.id);
      setNodes(response.data.nodes || createDefaultFunnel());
      setIsReadOnly(false);
      lastSavedNodesRef.current = JSON.stringify(response.data.nodes || []);
      setShowCanvasList(false);
      loadComments(id);
    } catch (err) {
      console.error('Failed to load canvas:', err);
    }
  };

  const deleteCanvasItem = async (id: string) => {
    if (!confirm('Are you sure you want to delete this canvas?')) return;
    try {
      await axios.delete(`/api/canvas/${id}`);
      loadCanvasList();
      if (canvasId === id) {
        createNewCanvas();
      }
    } catch (err) {
      console.error('Failed to delete canvas:', err);
    }
  };

  const updateCanvasTitle = async (newTitle: string) => {
    if (isReadOnly || !canvasId) return;
    try {
      const response = await axios.put(`/api/canvas/${canvasId}`, { title: newTitle });
      setCanvas(response.data);
      loadCanvasList();
    } catch (err) {
      console.error('Failed to update title:', err);
    }
  };

  const togglePublic = async () => {
    if (isReadOnly || !canvasId || !canvas) return;
    try {
      const response = await axios.put(`/api/canvas/${canvasId}`, { is_public: !canvas.is_public });
      setCanvas(response.data);
    } catch (err) {
      console.error('Failed to toggle public:', err);
    }
  };

  const regenerateShareLink = async () => {
    if (isReadOnly || !canvasId) return;
    try {
      const response = await axios.post(`/api/canvas/${canvasId}/regenerate-token`);
      setCanvas(response.data);
    } catch (err) {
      console.error('Failed to regenerate link:', err);
    }
  };

  const addCommentHandler = async () => {
    if (!canvasId || !newComment.trim()) return;
    try {
      const response = await axios.post(`/api/canvas/${canvasId}/comments`, {
        content: newComment,
        nodeId: selectedNode,
        authorName: commenterName || 'Anonymous'
      });
      setComments(prev => [response.data, ...prev]);
      setNewComment('');
    } catch (err) {
      console.error('Failed to add comment:', err);
    }
  };

  const resolveCommentHandler = async (commentId: number, resolved: boolean) => {
    if (isReadOnly) return; // Only owner can resolve comments
    try {
      await axios.put(`/api/canvas/comments/${commentId}/resolve`, { resolved });
      setComments(prev => prev.map(c => c.id === commentId ? { ...c, is_resolved: resolved } : c));
    } catch (err) {
      console.error('Failed to resolve comment:', err);
    }
  };

  const getShareUrl = () => {
    if (!canvas) return '';
    const baseUrl = window.location.origin;
    return `${baseUrl}/?share=${canvas.share_token}`;
  };

  const copyShareLink = () => {
    navigator.clipboard.writeText(getShareUrl());
  };

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
    if (isReadOnly) return; // No updates in read-only mode
    setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, ...updates } : n));
  };

  const getCampaignAdFormat = (campaignId: string): string | null => {
    const campaignAds = nodes.filter(n => n.type === 'ad' && n.parentId === campaignId);
    if (campaignAds.length > 0 && campaignAds[0].adFormat) {
      return campaignAds[0].adFormat;
    }
    return null;
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
    if (e.button !== 0) return; // Only interact with left mouse button
    if (draggedNode) return;
    
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    console.log('Canvas mousedown:', { toolMode, isReadOnly });
    
    if (toolMode === 'select' && !isReadOnly) {
      // Start selection box
      const canvasX = (e.clientX - rect.left - transform.x) / transform.scale;
      const canvasY = (e.clientY - rect.top - transform.y) / transform.scale;
      console.log('Starting selection at:', { canvasX, canvasY });
      setSelectionBox({ startX: canvasX, startY: canvasY, endX: canvasX, endY: canvasY });
      setIsSelecting(true);
    } else {
      // Pan mode
      setIsDragging(true);
      setStartPos({ x: e.clientX - transform.x, y: e.clientY - transform.y });
    }
  };

  const DRAG_THRESHOLD = 5;

  const handleMouseMove = (e: React.MouseEvent) => {
    // Handle selection box drawing
    if (isSelecting && selectionBox && toolMode === 'select') {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const canvasX = (e.clientX - rect.left - transform.x) / transform.scale;
      const canvasY = (e.clientY - rect.top - transform.y) / transform.scale;
      setSelectionBox(prev => prev ? { ...prev, endX: canvasX, endY: canvasY } : null);
      return;
    }
    
    if (pendingDragNode && !draggedNode && !isReadOnly) {
      const dx = e.clientX - dragStartPos.x;
      const dy = e.clientY - dragStartPos.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance > DRAG_THRESHOLD) {
        setDraggedNode(pendingDragNode);
      }
    }
    
    // Don't allow node dragging in read-only mode
    if (draggedNode && !isReadOnly) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      
      const x = (e.clientX - rect.left - transform.x) / transform.scale;
      const y = (e.clientY - rect.top - transform.y) / transform.scale;
      
      setNodes(prev => prev.map(n => 
        n.id === draggedNode ? { ...n, x, y } : n
      ));
    } else if (isDragging) {
      // Canvas panning is allowed in read-only mode
      setTransform(t => ({
        ...t,
        x: e.clientX - startPos.x,
        y: e.clientY - startPos.y
      }));
    }
  };

  // Helper to get node dimensions based on type
  const getNodeDimensions = (node: IdeateNode) => {
    if (node.type === 'group') return { width: 220, height: 60 };
    if (node.type === 'campaign') return { width: 220, height: 90 };
    if (node.type === 'ad') return { width: 120, height: 100 };
    if (node.type === 'audience') return { width: 180, height: 80 };
    return { width: 150, height: 60 };
  };

  // Check if a node intersects with the selection box
  const nodeIntersectsBox = (node: IdeateNode, box: { startX: number; startY: number; endX: number; endY: number }) => {
    const dims = getNodeDimensions(node);
    const boxLeft = Math.min(box.startX, box.endX);
    const boxRight = Math.max(box.startX, box.endX);
    const boxTop = Math.min(box.startY, box.endY);
    const boxBottom = Math.max(box.startY, box.endY);
    
    const nodeLeft = node.x;
    const nodeRight = node.x + dims.width;
    const nodeTop = node.y;
    const nodeBottom = node.y + dims.height;
    
    return !(nodeRight < boxLeft || nodeLeft > boxRight || nodeBottom < boxTop || nodeTop > boxBottom);
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    // Handle selection box completion
    if (isSelecting && selectionBox && toolMode === 'select') {
      const selected = nodes.filter(node => nodeIntersectsBox(node, selectionBox)).map(n => n.id);
      console.log('Selection complete:', { boxSize: { w: Math.abs(selectionBox.endX - selectionBox.startX), h: Math.abs(selectionBox.endY - selectionBox.startY) }, nodesChecked: nodes.length, selectedCount: selected.length });
      setSelectedNodes(selected);
      setSelectionBox(null);
      setIsSelecting(false);
      // Prevent the canvas click from clearing the selection (use ref for synchronous access)
      justFinishedSelectingRef.current = true;
      setTimeout(() => { justFinishedSelectingRef.current = false; }, 200);
      if (selected.length === 1) {
        setSelectedNode(selected[0]);
      } else {
        setSelectedNode(null);
      }
      return;
    }
    
    setIsDragging(false);
    setDraggedNode(null);
    setPendingDragNode(null);
  };

  // Delete selected nodes (bulk delete)
  const deleteSelectedNodes = () => {
    if (isReadOnly || selectedNodes.length === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedNodes.length} selected item(s)?`)) return;
    
    // Get all IDs to delete including children
    const idsToDelete = new Set<string>();
    selectedNodes.forEach(nodeId => {
      idsToDelete.add(nodeId);
      // Add children
      nodes.forEach(n => {
        if (n.parentId === nodeId) {
          idsToDelete.add(n.id);
          // Add grandchildren
          nodes.forEach(gc => {
            if (gc.parentId === n.id) idsToDelete.add(gc.id);
          });
        }
      });
    });
    
    setNodes(prev => prev.filter(n => !idsToDelete.has(n.id)));
    setSelectedNodes([]);
    setSelectedNode(null);
  };

  // Clear selection
  const clearSelection = () => {
    setSelectedNodes([]);
    setSelectedNode(null);
  };

  const handleNodeMouseDown = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    if (e.button !== 0) return; // Only interact with left mouse button
    // In read-only mode, only allow selection (not dragging)
    if (isReadOnly) {
      setSelectedNode(nodeId);
      return;
    }
    setPendingDragNode(nodeId);
    setDragStartPos({ x: e.clientX, y: e.clientY });
    setSelectedNode(nodeId);
    setJustClickedNode(true);
    setTimeout(() => setJustClickedNode(false), 100);
  };

  const handleCanvasClick = () => {
    if (!justClickedNode && !draggedNode && !isSelecting && !justFinishedSelectingRef.current) {
      setSelectedNode(null);
      setSelectedNodes([]);
    }
  };

  const zoomIn = () => setTransform(t => ({ ...t, scale: Math.min(t.scale + 0.2, 3) }));
  const zoomOut = () => setTransform(t => ({ ...t, scale: Math.max(t.scale - 0.2, 0.1) }));
  const resetZoom = () => setTransform({ x: 50, y: 30, scale: 0.85 });

  const addNode = (type: 'group' | 'campaign' | 'ad') => {
    if (isReadOnly) return; // No adding nodes in read-only mode
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
    
    let adFormat: string | undefined;
    if (type === 'ad' && parentId) {
      const existingFormat = getCampaignAdFormat(parentId);
      adFormat = existingFormat || 'Single Image Ad';
    }
    
    const newNode: IdeateNode = {
      id: generateId(),
      type,
      name: type === 'group' ? 'New Campaign Group' : type === 'campaign' ? 'New Campaign' : 'New Ad',
      x,
      y,
      parentId,
      objective: type === 'campaign' ? 'Website Visits' : undefined,
      adFormat: type === 'ad' ? adFormat : undefined,
    };
    setNodes(prev => [...prev, newNode]);
    setSelectedNode(newNode.id);
  };

  const addAudienceNode = (category: 'remarketing' | 'bof' | 'tof' = 'remarketing') => {
    if (isReadOnly) return; // No adding nodes in read-only mode
    const campaigns = nodes.filter(n => n.type === 'campaign');
    const categoryConfig = AUDIENCE_CATEGORIES[category];
    
    if (category === 'remarketing' && campaigns.length < 2) {
      alert('Create at least 2 campaigns to connect with a remarketing audience flow');
      return;
    }
    
    if (campaigns.length < 1) {
      alert('Create at least 1 campaign first');
      return;
    }
    
    const selectedNodeData = nodes.find(n => n.id === selectedNode);
    let sourceCampaign: IdeateNode | undefined;
    let targetCampaign: IdeateNode | undefined;
    
    if (selectedNodeData?.type === 'campaign') {
      if (category === 'remarketing') {
        sourceCampaign = selectedNodeData;
        const otherCampaigns = campaigns.filter(c => c.id !== sourceCampaign?.id);
        targetCampaign = otherCampaigns[0];
      } else {
        targetCampaign = selectedNodeData;
      }
    } else {
      if (category === 'remarketing') {
        sourceCampaign = campaigns[0];
        targetCampaign = campaigns[1];
      } else {
        targetCampaign = campaigns[0];
      }
    }
    
    const existingAudiences = nodes.filter(n => n.type === 'audience');
    let x = 100;
    let y = 100;
    
    if (targetCampaign) {
      x = targetCampaign.x - 200;
      y = targetCampaign.y + (existingAudiences.length * 100);
    }
    
    const defaultType = categoryConfig.types[0];
    
    const newNode: IdeateNode = {
      id: generateId(),
      type: 'audience',
      name: defaultType.label,
      x,
      y,
      audienceCategory: category,
      audienceType: defaultType.value,
      audiencePercentage: category === 'remarketing' ? 25 : undefined,
      sourceCampaignId: categoryConfig.hasSourceCampaign ? sourceCampaign?.id : undefined,
      targetCampaignId: targetCampaign?.id,
    };
    setNodes(prev => [...prev, newNode]);
    setSelectedNode(newNode.id);
  };

  const deleteNode = (nodeId: string) => {
    if (isReadOnly) return; // No deletions in read-only mode
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    
    const childIds = nodes.filter(n => n.parentId === nodeId).map(n => n.id);
    const grandchildIds = nodes.filter(n => childIds.includes(n.parentId || '')).map(n => n.id);
    
    const idsToDelete = [nodeId, ...childIds, ...grandchildIds];
    setNodes(prev => prev.filter(n => !idsToDelete.includes(n.id)));
    setSelectedNode(null);
  };

  const startEditing = (nodeId: string, currentName: string) => {
    if (isReadOnly) return; // No editing in read-only mode
    setEditingNode(nodeId);
    setEditingName(currentName);
  };

  const finishEditing = () => {
    if (isReadOnly) return; // No editing in read-only mode
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
    if (isReadOnly || !aiPrompt.trim()) return; // No AI generation in read-only mode
    
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
    if (isReadOnly) return; // No resetting in read-only mode
    setNodes(createDefaultFunnel());
    setSelectedNode(null);
    resetZoom();
  };

  const clearAll = () => {
    if (isReadOnly) return; // No clearing in read-only mode
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
    const recommendedObjectives = OBJECTIVE_RECOMMENDATIONS[funnelStage] || [];
    
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

        {/* Naming Convention Hint */}
        {(selectedNodeData.type === 'group' || selectedNodeData.type === 'campaign' || selectedNodeData.type === 'ad') && (
          <div className="px-4 py-3 border-b border-gray-100 bg-blue-50">
            <div className="flex items-start gap-2">
              <Lightbulb size={14} className="text-blue-500 mt-0.5 flex-shrink-0" />
              <div>
                <span className="text-[10px] font-semibold text-blue-700 uppercase">Naming Convention</span>
                <p className="text-xs text-blue-600 font-mono mt-0.5 leading-relaxed">
                  {selectedNodeData.type === 'group' && NAMING_CONVENTIONS.group}
                  {selectedNodeData.type === 'campaign' && NAMING_CONVENTIONS.campaign}
                  {selectedNodeData.type === 'ad' && NAMING_CONVENTIONS.ad}
                </p>
              </div>
            </div>
          </div>
        )}

        {selectedNodeData.type === 'group' && (
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
        )}

        {selectedNodeData.type === 'campaign' && (
          <>
            {/* TOF Audience Association */}
            <div className="p-4 border-b border-gray-100">
              <div className="flex items-center gap-2 mb-3">
                <Users size={16} className="text-blue-500" />
                <h4 className="font-semibold text-gray-700 text-sm">TOF Audience</h4>
              </div>
              <p className="text-xs text-gray-500 mb-3">Select the top-of-funnel audience feeding this campaign</p>
              <select
                value={selectedNodeData.tofAudienceId || ''}
                onChange={(e) => updateNode(selectedNodeData.id, { tofAudienceId: e.target.value || undefined })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">No TOF Audience</option>
                {nodes.filter(n => n.type === 'audience' && n.audienceCategory === 'tof').map(aud => (
                  <option key={aud.id} value={aud.id}>{aud.name}</option>
                ))}
              </select>
            </div>

            {/* Campaign Objective */}
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
              
              {/* Grouped by category */}
              {(['awareness', 'consideration', 'conversions'] as const).map(category => {
                const categoryObjectives = ALL_OBJECTIVES.filter(o => o.category === category);
                const categoryLabel = category === 'awareness' ? 'Awareness' : category === 'consideration' ? 'Consideration' : 'Conversions';
                return (
                  <div key={category} className="mb-3">
                    <h5 className="text-[10px] font-bold text-gray-400 uppercase mb-2">{categoryLabel}</h5>
                    <div className="space-y-1.5">
                      {categoryObjectives.map(opt => {
                        const isRecommended = recommendedObjectives.includes(opt.value);
                        return (
                          <button
                            key={opt.value}
                            onClick={() => updateNode(selectedNodeData.id, { objective: opt.value })}
                            className={`w-full text-left px-3 py-2 rounded-lg border-2 transition-colors ${
                              selectedNodeData.objective === opt.value
                                ? 'border-orange-400 bg-orange-50'
                                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-base">{opt.icon}</span>
                              <span className="font-medium text-sm text-gray-800">{opt.label}</span>
                              {isRecommended && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-green-100 text-green-700">RECOMMENDED</span>
                              )}
                            </div>
                            <div className="text-xs text-gray-500 mt-0.5 ml-6">{opt.description}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bidding Type */}
            <div className="p-4 border-b border-gray-100">
              <div className="flex items-center gap-2 mb-3">
                <Settings size={16} className="text-gray-500" />
                <h4 className="font-semibold text-gray-700 text-sm">Bidding Type</h4>
              </div>
              <div className="space-y-2">
                {BIDDING_TYPES.map(bid => (
                  <button
                    key={bid.value}
                    onClick={() => updateNode(selectedNodeData.id, { biddingType: bid.value as 'manual_bidding' | 'maximize_delivery' })}
                    className={`w-full text-left px-3 py-2 rounded-lg border-2 transition-colors ${
                      (selectedNodeData.biddingType || 'manual_bidding') === bid.value
                        ? 'border-blue-400 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-gray-800">{bid.label}</span>
                      {bid.default && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">DEFAULT</span>}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">{bid.description}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Audience Settings */}
            <div className="p-4 border-b border-gray-100">
              <div className="flex items-center gap-2 mb-3">
                <Users size={16} className="text-gray-500" />
                <h4 className="font-semibold text-gray-700 text-sm">Audience Settings</h4>
              </div>
              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedNodeData.enhancedAudience !== false}
                    onChange={(e) => updateNode(selectedNodeData.id, { enhancedAudience: e.target.checked })}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <div className="text-sm font-medium text-gray-800">Enhanced Audience</div>
                    <div className="text-xs text-gray-500">Automatically expand reach to similar audiences</div>
                  </div>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedNodeData.linkedinAudienceNetwork !== false}
                    onChange={(e) => updateNode(selectedNodeData.id, { linkedinAudienceNetwork: e.target.checked })}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <div className="text-sm font-medium text-gray-800">LinkedIn Audience Network</div>
                    <div className="text-xs text-gray-500">Extend reach beyond LinkedIn</div>
                  </div>
                </label>
              </div>
            </div>
          </>
        )}

        {selectedNodeData.type === 'ad' && (() => {
          const campaignId = selectedNodeData.parentId;
          const siblingAds = campaignId ? nodes.filter(n => n.type === 'ad' && n.parentId === campaignId && n.id !== selectedNodeData.id) : [];
          const isFormatLocked = siblingAds.length > 0;
          const lockedFormat = isFormatLocked && siblingAds[0].adFormat ? siblingAds[0].adFormat : null;
          
          const handleFormatChange = (newFormat: string) => {
            if (isFormatLocked && lockedFormat && newFormat !== lockedFormat) {
              const confirmChange = window.confirm(
                `This campaign already has ${siblingAds.length} ad(s) using "${lockedFormat}" format.\n\nAll ads in a campaign must use the same format. Do you want to change ALL ads in this campaign to "${newFormat}"?`
              );
              if (confirmChange && campaignId) {
                setNodes(prev => prev.map(n => 
                  (n.type === 'ad' && n.parentId === campaignId) 
                    ? { ...n, adFormat: newFormat } 
                    : n
                ));
              }
            } else {
              updateNode(selectedNodeData.id, { adFormat: newFormat });
            }
          };
          
          return (
            <>
              <div className="p-4 border-b border-gray-100">
                <div className="flex items-center gap-2 mb-2">
                  <Image size={16} className="text-gray-500" />
                  <h4 className="font-semibold text-gray-700 text-sm">Ad Format</h4>
                </div>
                {isFormatLocked && (
                  <div className="mb-3 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-[10px] text-amber-700 flex items-center gap-1">
                      <span>⚠️</span>
                      <span>All ads in a campaign must use the same format. Current: <strong>{lockedFormat}</strong></span>
                    </p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  {AD_FORMAT_OPTIONS.map(format => (
                    <button
                      key={format.value}
                      onClick={() => handleFormatChange(format.value)}
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
              
              {/* Thought Leader Ad Toggle */}
              <div className="p-4 border-b border-gray-100">
                <div className="flex items-center gap-2 mb-3">
                  <Users size={16} className="text-indigo-500" />
                  <h4 className="font-semibold text-gray-700 text-sm">Ad Type</h4>
                </div>
                <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg border-2 transition-colors hover:bg-gray-50 ${selectedNodeData.isThoughtLeaderAd ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200'}">
                  <input
                    type="checkbox"
                    checked={selectedNodeData.isThoughtLeaderAd || false}
                    onChange={(e) => updateNode(selectedNodeData.id, { isThoughtLeaderAd: e.target.checked })}
                    className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div>
                    <div className="text-sm font-medium text-gray-800 flex items-center gap-2">
                      Thought Leader Ad
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700">TLA</span>
                    </div>
                    <div className="text-xs text-gray-500">Sponsored content from an employee's personal profile</div>
                  </div>
                </label>
              </div>
            </>
          );
        })()}

        {selectedNodeData.type === 'audience' && (() => {
          const currentCategory = selectedNodeData.audienceCategory || 'remarketing';
          const categoryConfig = AUDIENCE_CATEGORIES[currentCategory as keyof typeof AUDIENCE_CATEGORIES];
          const colorClass = currentCategory === 'remarketing' ? 'purple' : currentCategory === 'bof' ? 'orange' : 'blue';
          
          return (
          <>
            {/* Audience Category Selection */}
            <div className="p-4 border-b border-gray-100">
              <div className="flex items-center gap-2 mb-3">
                <Users size={16} className="text-gray-500" />
                <h4 className="font-semibold text-gray-700 text-sm">Audience Category</h4>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {Object.entries(AUDIENCE_CATEGORIES).map(([key, cat]) => (
                  <button
                    key={key}
                    onClick={() => updateNode(selectedNodeData.id, { 
                      audienceCategory: key as 'remarketing' | 'bof' | 'tof',
                      audienceType: undefined,
                      sourceCampaignId: cat.hasSourceCampaign ? selectedNodeData.sourceCampaignId : undefined
                    })}
                    className={`px-2 py-2 rounded-lg border-2 text-center transition-colors ${
                      currentCategory === key
                        ? key === 'remarketing' ? 'border-purple-400 bg-purple-50'
                        : key === 'bof' ? 'border-orange-400 bg-orange-50'
                        : 'border-blue-400 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className={`text-[10px] font-bold ${
                      key === 'remarketing' ? 'text-purple-700' : key === 'bof' ? 'text-orange-700' : 'text-blue-700'
                    }`}>
                      {key === 'remarketing' ? 'Remarketing' : key === 'bof' ? 'BOF' : 'TOF'}
                    </div>
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-gray-500 mt-2">{categoryConfig.description}</p>
            </div>

            {/* Audience Type Selection */}
            <div className="p-4 border-b border-gray-100">
              <div className="flex items-center gap-2 mb-3">
                <Target size={16} className={`text-${colorClass}-500`} />
                <h4 className="font-semibold text-gray-700 text-sm">Audience Type</h4>
              </div>
              <div className="space-y-1">
                {categoryConfig.types.map(type => (
                  <button
                    key={type.value}
                    onClick={() => updateNode(selectedNodeData.id, { audienceType: type.value, name: type.label })}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg border-2 transition-colors text-left ${
                      selectedNodeData.audienceType === type.value
                        ? currentCategory === 'remarketing' ? 'border-purple-400 bg-purple-50'
                        : currentCategory === 'bof' ? 'border-orange-400 bg-orange-50'
                        : 'border-blue-400 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <span className="text-lg">{type.icon}</span>
                    <div>
                      <div className="font-medium text-xs text-gray-800">{type.label}</div>
                      <div className="text-[10px] text-gray-500">{type.description}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Conversion Rate - only for remarketing */}
            {currentCategory === 'remarketing' && (
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
            )}

            {/* Campaign Connections */}
            <div className="p-4 border-b border-gray-100">
              <div className="flex items-center gap-2 mb-3">
                <ArrowRight size={16} className={`text-${colorClass}-500`} />
                <h4 className="font-semibold text-gray-700 text-sm">Campaign Connection</h4>
              </div>
              <div className="space-y-3">
                {/* Source Campaign - only for remarketing */}
                {categoryConfig.hasSourceCampaign && (
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
                    <p className="text-[10px] text-gray-400 mt-1">Campaign that feeds this audience</p>
                  </div>
                )}
                {/* Target Campaign - always shown */}
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Target Campaign</label>
                  <select
                    value={selectedNodeData.targetCampaignId || ''}
                    onChange={(e) => updateNode(selectedNodeData.id, { targetCampaignId: e.target.value })}
                    className={`w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-${colorClass}-500`}
                  >
                    <option value="">Select target...</option>
                    {nodes.filter(n => n.type === 'campaign' && n.id !== selectedNodeData.sourceCampaignId).map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <p className="text-[10px] text-gray-400 mt-1">Campaign that uses this audience</p>
                </div>
              </div>
            </div>

            {/* Targeting Options - only for TOF Saved Audience */}
            {currentCategory === 'tof' && selectedNodeData.audienceType === 'saved_audience' && (
              <>
                {/* Company Size */}
                <div className="p-4 border-b border-gray-100">
                  <div className="flex items-center gap-2 mb-3">
                    <Target size={16} className="text-blue-500" />
                    <h4 className="font-semibold text-gray-700 text-sm">Company Size</h4>
                  </div>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {COMPANY_SIZE_OPTIONS.map(size => (
                      <label key={size.value} className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedNodeData.companySizes?.includes(size.value) || false}
                          onChange={() => {
                            const current = selectedNodeData.companySizes || [];
                            const updated = current.includes(size.value)
                              ? current.filter(s => s !== size.value)
                              : [...current, size.value];
                            updateNode(selectedNodeData.id, { companySizes: updated });
                          }}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-xs text-gray-700">{size.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Seniority */}
                <div className="p-4 border-b border-gray-100">
                  <div className="flex items-center gap-2 mb-3">
                    <Users size={16} className="text-blue-500" />
                    <h4 className="font-semibold text-gray-700 text-sm">Seniority</h4>
                  </div>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {SENIORITY_OPTIONS.map(sen => (
                      <label key={sen.value} className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedNodeData.seniorities?.includes(sen.value) || false}
                          onChange={() => {
                            const current = selectedNodeData.seniorities || [];
                            const updated = current.includes(sen.value)
                              ? current.filter(s => s !== sen.value)
                              : [...current, sen.value];
                            updateNode(selectedNodeData.id, { seniorities: updated });
                          }}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-xs text-gray-700">{sen.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Industry Targeting */}
                <div className="p-4 border-b border-gray-100">
                  <div className="flex items-center gap-2 mb-3">
                    <Target size={16} className="text-blue-500" />
                    <h4 className="font-semibold text-gray-700 text-sm">Industry Targeting</h4>
                  </div>
                  
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
          </>
        );
        })()}

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
    <div className="w-full h-full flex flex-col">
      {/* Canvas Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {!isReadOnly && (
            <button
              onClick={() => { loadCanvasList(); setShowCanvasList(true); }}
              className="flex items-center gap-1.5 px-2 py-1.5 hover:bg-gray-100 rounded text-gray-600 text-sm"
              title="Open Canvas List"
            >
              <FolderOpen size={16} />
            </button>
          )}
          
          {editingTitle ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={titleInput}
                onChange={(e) => setTitleInput(e.target.value)}
                className="px-2 py-1 border border-gray-300 rounded text-sm font-medium"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    updateCanvasTitle(titleInput);
                    setEditingTitle(false);
                  } else if (e.key === 'Escape') {
                    setEditingTitle(false);
                  }
                }}
              />
              <button
                onClick={() => { updateCanvasTitle(titleInput); setEditingTitle(false); }}
                className="p-1 hover:bg-green-100 rounded text-green-600"
              >
                <Check size={14} />
              </button>
              <button
                onClick={() => setEditingTitle(false)}
                className="p-1 hover:bg-red-100 rounded text-red-600"
              >
                <X size={14} />
              </button>
            </div>
          ) : isReadOnly ? (
            <span className="text-sm font-medium text-gray-800">
              {canvas?.title || 'Shared Canvas'}
            </span>
          ) : (
            <button
              onClick={() => { setTitleInput(canvas?.title || ''); setEditingTitle(true); }}
              className="text-sm font-medium text-gray-800 hover:text-blue-600 flex items-center gap-1"
            >
              {canvas?.title || 'Untitled Canvas'}
              <Edit2 size={12} className="text-gray-400" />
            </button>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {/* Save Status - Only show for owners */}
          {!isReadOnly && (
            <>
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                {saveStatus === 'saved' && (
                  <>
                    <CheckCircle size={14} className="text-green-500" />
                    <span>Saved</span>
                  </>
                )}
                {saveStatus === 'saving' && (
                  <>
                    <Clock size={14} className="text-blue-500 animate-spin" />
                    <span>Saving...</span>
                  </>
                )}
                {saveStatus === 'unsaved' && (
                  <>
                    <Clock size={14} className="text-yellow-500" />
                    <span>Unsaved changes</span>
                  </>
                )}
                {saveStatus === 'error' && (
                  <>
                    <XCircle size={14} className="text-red-500" />
                    <span>Save failed</span>
                  </>
                )}
              </div>
              
              <div className="w-px h-5 bg-gray-200" />
            </>
          )}
          
          {/* Comments */}
          <button
            onClick={() => setShowCommentsPanel(!showCommentsPanel)}
            className={`flex items-center gap-1.5 px-2 py-1.5 rounded text-sm ${showCommentsPanel ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100 text-gray-600'}`}
          >
            <MessageSquare size={16} />
            {comments.length > 0 && <span className="text-xs">{comments.length}</span>}
          </button>
          
          {/* Share */}
          {!isReadOnly && (
            <button
              onClick={() => setShowShareModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-white text-sm font-medium"
            >
              <Share2 size={14} />
              Share
            </button>
          )}
        </div>
      </div>
      
      <div className="flex-1 flex overflow-hidden">
      <div className={`flex-1 relative bg-[#f0f2f5] overflow-hidden ${selectedNodeData ? '' : 'rounded-b-xl'} shadow-inner border-x border-b border-gray-200`}>
      
      {/* Toolbar - Hidden for shared view - Two rows for better fit */}
      {!isReadOnly && (
      <div className="absolute top-4 left-4 z-50 flex flex-col gap-2">
        {/* Row 1: Add nodes and actions */}
        <div className="flex items-center gap-2">
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
            <div className="relative group">
              <button
                className="flex items-center gap-1.5 px-3 py-2 hover:bg-gray-100 rounded text-gray-700 text-sm font-medium"
                title="Add Audience"
              >
                <Users size={16} className="text-purple-500" />
                <span>Audience</span>
                <ChevronDown size={14} className="text-gray-400" />
              </button>
              <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-xl border border-gray-200 py-1 min-w-[180px] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                <button
                  onClick={() => addAudienceNode('remarketing')}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-purple-50 text-left"
                >
                  <span className="w-2 h-2 rounded-full bg-purple-500" />
                  <div>
                    <div className="text-sm font-medium text-gray-800">Remarketing</div>
                    <div className="text-[10px] text-gray-500">Source → Target campaign</div>
                  </div>
                </button>
                <button
                  onClick={() => addAudienceNode('bof')}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-orange-50 text-left"
                >
                  <span className="w-2 h-2 rounded-full bg-orange-500" />
                  <div>
                    <div className="text-sm font-medium text-gray-800">BOF (Website)</div>
                    <div className="text-[10px] text-gray-500">Target campaign only</div>
                  </div>
                </button>
                <button
                  onClick={() => addAudienceNode('tof')}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-blue-50 text-left"
                >
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  <div>
                    <div className="text-sm font-medium text-gray-800">TOF</div>
                    <div className="text-[10px] text-gray-500">Target campaign only</div>
                  </div>
                </button>
              </div>
            </div>
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
          
          <button
            onClick={resetToDefault}
            className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-gray-100 rounded-lg text-gray-700 text-sm font-medium border border-gray-200 shadow-sm"
            title="Reset to default funnel"
          >
            <Lightbulb size={16} className="text-yellow-500" />
            <span>Default</span>
          </button>
          
          <button
            onClick={clearAll}
            className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-red-50 rounded-lg text-gray-600 hover:text-red-600 text-sm font-medium border border-gray-200 hover:border-red-200 shadow-sm transition-colors"
            title="Clear entire canvas"
          >
            <Trash2 size={16} />
            <span>Clear</span>
          </button>
        </div>
        
        {/* Row 2: Tool mode and selection */}
        <div className="flex items-center gap-2">
          {/* Tool Mode Switcher */}
          <div className="flex items-center gap-1 bg-white rounded-lg shadow-lg border border-gray-200 p-1">
            <button
              onClick={() => { setToolMode('pan'); clearSelection(); }}
              className={`flex items-center gap-1.5 px-3 py-2 rounded text-sm font-medium transition-colors ${
                toolMode === 'pan' 
                  ? 'bg-blue-100 text-blue-700' 
                  : 'hover:bg-gray-100 text-gray-600'
              }`}
              title="Pan Mode (drag to move around)"
            >
              <Hand size={16} />
              <span>Pan</span>
            </button>
            <button
              onClick={() => setToolMode('select')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded text-sm font-medium transition-colors ${
                toolMode === 'select' 
                  ? 'bg-blue-100 text-blue-700' 
                  : 'hover:bg-gray-100 text-gray-600'
              }`}
              title="Select Mode (drag to select multiple items)"
            >
              <MousePointer2 size={16} />
              <span>Select</span>
            </button>
          </div>
          
          {/* Multi-Select Actions */}
          {selectedNodes.length > 0 && (
            <div className="flex items-center gap-2 bg-blue-50 rounded-lg px-3 py-1.5 border border-blue-200">
              <span className="text-sm text-blue-700 font-medium">{selectedNodes.length} selected</span>
              <button
                onClick={deleteSelectedNodes}
                className="flex items-center gap-1 px-2 py-1 bg-red-100 hover:bg-red-200 rounded text-red-600 text-sm font-medium"
                title="Delete selected items"
              >
                <Trash2 size={14} />
                Delete
              </button>
              <button
                onClick={clearSelection}
                className="p-1 hover:bg-blue-100 rounded text-blue-600"
                title="Clear selection"
              >
                <X size={14} />
              </button>
            </div>
          )}
        </div>
      </div>
      )}

      {/* AI Generate Button - Hidden for shared view */}
      {!isReadOnly && (
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
      )}

      {/* AI Panel */}
      {showAiPanel && !isReadOnly && (
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
        className={`w-full h-full ${
          toolMode === 'select' 
            ? isSelecting ? 'cursor-crosshair' : 'cursor-crosshair'
            : draggedNode ? 'cursor-grabbing' : isDragging ? 'cursor-grabbing' : 'cursor-grab'
        }`}
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
              const category = audience.audienceCategory || 'remarketing';
              const strokeColor = category === 'remarketing' ? '#a855f7' : category === 'bof' ? '#f97316' : '#3b82f6';
              const markerId = `arrowhead-${category}`;
              
              if (!targetCampaign) return null;
              
              const audienceX = audience.x;
              const audienceY = audience.y + 35;
              const audienceEndX = audience.x + 180;
              const targetX = targetCampaign.x;
              const targetY = targetCampaign.y + 45;
              
              return (
                <g key={`audience-flow-${audience.id}`}>
                  {/* Source to Audience (only for remarketing) */}
                  {sourceCampaign && category === 'remarketing' && (
                    <path
                      d={`M ${sourceCampaign.x + 260} ${sourceCampaign.y + 45} Q ${(sourceCampaign.x + 260 + audienceX) / 2} ${sourceCampaign.y + 45}, ${audienceX} ${audienceY}`}
                      fill="none"
                      stroke={strokeColor}
                      strokeWidth="2"
                      strokeDasharray="6,4"
                      strokeOpacity="0.7"
                    />
                  )}
                  {/* Audience to Target */}
                  <path
                    d={`M ${audienceEndX} ${audienceY} Q ${(audienceEndX + targetX) / 2} ${targetY}, ${targetX} ${targetY}`}
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth="2"
                    strokeDasharray="6,4"
                    strokeOpacity="0.7"
                    markerEnd={`url(#${markerId})`}
                  />
                </g>
              );
            })}
            
            {/* Arrow marker definitions for each category */}
            <defs>
              <marker id="arrowhead-remarketing" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill="#a855f7" fillOpacity="0.7" />
              </marker>
              <marker id="arrowhead-bof" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill="#f97316" fillOpacity="0.7" />
              </marker>
              <marker id="arrowhead-tof" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill="#3b82f6" fillOpacity="0.7" />
              </marker>
            </defs>
          </svg>

          {/* Selection Box */}
          {selectionBox && isSelecting && (
            <div
              className="absolute border-2 border-blue-500 bg-blue-100/30 pointer-events-none z-50"
              style={{
                left: Math.min(selectionBox.startX, selectionBox.endX),
                top: Math.min(selectionBox.startY, selectionBox.endY),
                width: Math.abs(selectionBox.endX - selectionBox.startX),
                height: Math.abs(selectionBox.endY - selectionBox.startY),
              }}
            />
          )}

          {/* Nodes */}
          {nodes.filter(n => n.type !== 'audience').map(node => {
            const isMultiSelected = selectedNodes.includes(node.id);
            const isSingleSelected = selectedNode === node.id;
            const isSelected = isMultiSelected || isSingleSelected;
            
            return (
            <div
              key={node.id}
              onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
              onDoubleClick={() => startEditing(node.id, node.name)}
              className={`
                absolute transition-shadow duration-200 rounded-lg border-2 flex flex-col justify-center z-10 select-none
                ${node.type === 'ad' ? 'w-[140px] px-3 py-2' : 'w-[260px] px-4 py-3'}
                ${draggedNode === node.id ? 'cursor-grabbing shadow-2xl scale-105' : 'cursor-grab hover:shadow-xl'}
                ${isSelected ? 'ring-2 ring-offset-2 ring-blue-500' : ''}
                ${node.type === 'group' ? `bg-white border-gray-300` : ''}
                ${node.type === 'campaign' ? `bg-white border-orange-300 border-l-4 border-l-orange-500` : ''}
                ${node.type === 'ad' ? `bg-white border-green-300 border-l-4 border-l-green-500` : ''}
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
                <div className="flex items-center gap-1 mt-1">
                  <span className="text-[8px] font-medium px-1.5 py-0.5 rounded bg-green-100 text-green-700">
                    {node.adFormat}
                  </span>
                  {node.isThoughtLeaderAd && (
                    <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700">
                      TLA
                    </span>
                  )}
                </div>
              )}
            </div>
          );
          })}

          {/* Audience Nodes */}
          {nodes.filter(n => n.type === 'audience').map(node => {
            const allAudienceTypes = [...AUDIENCE_CATEGORIES.remarketing.types, ...AUDIENCE_CATEGORIES.bof.types, ...AUDIENCE_CATEGORIES.tof.types];
            const audienceTypeInfo = allAudienceTypes.find(t => t.value === node.audienceType);
            const category = node.audienceCategory || 'remarketing';
            const colorClasses = {
              remarketing: { bg: 'from-purple-50 to-purple-100', border: 'border-purple-300', ring: 'ring-purple-400', text: 'text-purple-900', accent: 'text-purple-600' },
              bof: { bg: 'from-orange-50 to-orange-100', border: 'border-orange-300', ring: 'ring-orange-400', text: 'text-orange-900', accent: 'text-orange-600' },
              tof: { bg: 'from-blue-50 to-blue-100', border: 'border-blue-300', ring: 'ring-blue-400', text: 'text-blue-900', accent: 'text-blue-600' },
            };
            const colors = colorClasses[category];
            const isMultiSelected = selectedNodes.includes(node.id);
            const isSingleSelected = selectedNode === node.id;
            const isSelected = isMultiSelected || isSingleSelected;
            
            return (
              <div
                key={node.id}
                onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
                onDoubleClick={() => startEditing(node.id, node.name)}
                className={`
                  absolute transition-shadow duration-200 rounded-full border-2 flex items-center justify-center z-20 select-none
                  w-[180px] h-[70px] px-4
                  ${draggedNode === node.id ? 'cursor-grabbing shadow-2xl scale-105' : 'cursor-grab hover:shadow-xl'}
                  ${isSelected ? `ring-2 ring-offset-2 ring-blue-500` : ''}
                  bg-gradient-to-r ${colors.bg} ${colors.border}
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
                        className={`text-sm font-semibold bg-white border ${colors.border} rounded px-1 py-0.5 focus:outline-none focus:ring-1 w-24`}
                      />
                    ) : (
                      <>
                        <span className={`text-[10px] font-bold uppercase ${colors.accent}`}>
                          {category === 'remarketing' ? 'Remarketing' : category === 'bof' ? 'BOF' : 'TOF'}
                        </span>
                        <span className={`text-sm font-semibold ${colors.text} leading-tight`}>{node.name}</span>
                      </>
                    )}
                    {category === 'remarketing' && (
                      <span className={`text-lg font-bold ${colors.accent}`}>{node.audiencePercentage || 25}%</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      </div>
      {renderSidebar()}
      
      {/* Comments Panel */}
      {showCommentsPanel && (
        <div className="w-80 border-l border-gray-200 bg-white flex flex-col">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <h3 className="font-semibold text-gray-800">Comments</h3>
            <button onClick={() => setShowCommentsPanel(false)} className="p-1 hover:bg-gray-100 rounded">
              <X size={16} className="text-gray-500" />
            </button>
          </div>
          
          <div className="p-4 border-b border-gray-200">
            <input
              type="text"
              value={commenterName}
              onChange={(e) => setCommenterName(e.target.value)}
              placeholder="Your name"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg mb-2"
            />
            <div className="flex gap-2">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder={selectedNode ? "Comment on selected node..." : "Add a general comment..."}
                className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg resize-none h-16"
              />
              <button
                onClick={addCommentHandler}
                disabled={!newComment.trim()}
                className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 rounded-lg text-white"
              >
                <Send size={16} />
              </button>
            </div>
            {selectedNode && (
              <p className="text-xs text-blue-600 mt-1">Commenting on: {nodes.find(n => n.id === selectedNode)?.name}</p>
            )}
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {comments.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">No comments yet</p>
            ) : (
              comments.map(comment => {
                const relatedNode = comment.node_id ? nodes.find(n => n.id === comment.node_id) : null;
                return (
                  <div key={comment.id} className={`p-3 rounded-lg ${comment.is_resolved ? 'bg-gray-50 opacity-60' : 'bg-gray-100'}`}>
                    <div className="flex items-start justify-between mb-1">
                      <span className="text-sm font-medium text-gray-800">{comment.author_name}</span>
                      {!isReadOnly && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => resolveCommentHandler(comment.id, !comment.is_resolved)}
                            className={`p-1 rounded ${comment.is_resolved ? 'text-green-600' : 'text-gray-400 hover:text-green-600'}`}
                            title={comment.is_resolved ? 'Unresolve' : 'Resolve'}
                          >
                            <CheckCircle size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                    {relatedNode && (
                      <p className="text-xs text-blue-600 mb-1">On: {relatedNode.name}</p>
                    )}
                    <p className="text-sm text-gray-700">{comment.content}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(comment.created_at).toLocaleString()}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
      </div>
      
      {/* Canvas List Modal */}
      {showCanvasList && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]" onClick={() => setShowCanvasList(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[70vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-semibold text-gray-800">Your Canvases</h3>
              <button onClick={() => setShowCanvasList(false)} className="p-1 hover:bg-gray-100 rounded">
                <X size={20} className="text-gray-500" />
              </button>
            </div>
            
            <div className="p-4 border-b border-gray-200">
              <button
                onClick={createNewCanvas}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-medium"
              >
                <Plus size={16} />
                New Canvas
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {canvasList.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-8">No saved canvases</p>
              ) : (
                canvasList.map(c => (
                  <div
                    key={c.id}
                    className={`p-3 rounded-lg border ${c.id === canvasId ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'} cursor-pointer`}
                    onClick={() => loadCanvas(c.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-medium text-gray-800">{c.title}</h4>
                        <p className="text-xs text-gray-500">
                          {c.last_saved ? `Saved ${new Date(c.last_saved).toLocaleDateString()}` : 'No versions'}
                          {c.is_public && <span className="ml-2 text-blue-600">Public</span>}
                        </p>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteCanvasItem(c.id); }}
                        className="p-1 hover:bg-red-100 rounded text-gray-400 hover:text-red-600"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Share Modal */}
      {showShareModal && canvas && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]" onClick={() => setShowShareModal(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-semibold text-gray-800">Share Canvas</h3>
              <button onClick={() => setShowShareModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X size={20} className="text-gray-500" />
              </button>
            </div>
            
            <div className="p-4 space-y-4">
              <div>
                <label className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">Make Public</span>
                  <button
                    onClick={togglePublic}
                    className={`relative w-12 h-6 rounded-full transition-colors ${canvas.is_public ? 'bg-blue-600' : 'bg-gray-300'}`}
                  >
                    <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${canvas.is_public ? 'translate-x-6' : ''}`} />
                  </button>
                </label>
                <p className="text-xs text-gray-500 mt-1">
                  {canvas.is_public ? 'Anyone with the link can view this canvas' : 'Only you can access this canvas'}
                </p>
              </div>
              
              {canvas.is_public && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Share Link</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={getShareUrl()}
                        readOnly
                        className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50"
                      />
                      <button
                        onClick={copyShareLink}
                        className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700"
                        title="Copy link"
                      >
                        <Copy size={16} />
                      </button>
                      <a
                        href={getShareUrl()}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700"
                        title="Open in new tab"
                      >
                        <ExternalLink size={16} />
                      </a>
                    </div>
                  </div>
                  
                  <button
                    onClick={regenerateShareLink}
                    className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                  >
                    <Link2 size={14} />
                    Generate new link
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
