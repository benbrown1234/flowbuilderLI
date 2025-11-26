
import React, { useState } from 'react';
import { GroupNode, CampaignNode, CreativeNode, NodeType, TargetingSummary } from '../types';
import { Folder, FileVideo, FileImage, LayoutGrid, ChevronRight, ChevronDown, Eye, Layers } from 'lucide-react';
import { OnSelectHandler } from '../types';

interface NodeProps {
  data: GroupNode | CampaignNode | CreativeNode;
  level?: number;
  onSelect: OnSelectHandler;
}

export const HierarchyNode: React.FC<NodeProps> = ({ data, level = 0, onSelect }) => {
  const [isExpanded, setIsExpanded] = useState(true);

  const hasChildren = 'children' in data && data.children && data.children.length > 0;
  
  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (data.type === NodeType.GROUP) {
      onSelect(data.type, data.name, (data as GroupNode).derivedTargeting);
    } else if (data.type === NodeType.CAMPAIGN) {
      const camp = data as CampaignNode;
      // Pass the children (creatives) AND metadata
      onSelect(
        data.type, 
        data.name, 
        camp.targetingResolved, 
        camp.children,
        undefined,
        camp.objective,      // NEW: Pass objective
        camp.biddingStrategy // NEW: Pass strategy
      );
    } else if (data.type === NodeType.CREATIVE) {
      // Pass the creative itself
      onSelect(
        data.type,
        data.name,
        undefined,
        undefined,
        data as CreativeNode
      );
    }
  };

  // Styles based on node type
  let containerClass = "mb-2 rounded-lg transition-all duration-200 border-l-4";
  let icon = null;
  let borderColor = "";
  let bgColor = "";

  switch (data.type) {
    case NodeType.GROUP:
      containerClass += " border-l-blue-500 bg-white shadow-sm hover:shadow-md";
      borderColor = "border-blue-500";
      bgColor = "bg-blue-50";
      icon = <Folder className="w-5 h-5 text-blue-600" />;
      break;
    case NodeType.CAMPAIGN:
      containerClass += " border-l-green-500 bg-white shadow-sm hover:shadow-md ml-4 md:ml-8";
      borderColor = "border-green-500";
      bgColor = "bg-green-50";
      icon = <LayoutGrid className="w-5 h-5 text-green-600" />;
      break;
    case NodeType.CREATIVE:
      containerClass += " border-l-purple-500 bg-gray-50 hover:bg-white border hover:border-purple-200 ml-8 md:ml-16";
      borderColor = "border-purple-500";
      bgColor = "bg-purple-50";
      const cNode = data as CreativeNode;
      icon = cNode.format === 'VIDEO' ? <FileVideo className="w-4 h-4 text-purple-600" /> : <FileImage className="w-4 h-4 text-purple-600" />;
      break;
  }

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div 
        className={`relative p-3 md:p-4 ${containerClass} cursor-pointer group`}
        onClick={handleClick}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {hasChildren && (
              <button 
                onClick={handleToggle}
                className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
              >
                {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </button>
            )}
            
            <div className={`p-2 rounded-md ${bgColor}`}>
              {icon}
            </div>

            <div>
              <div className="flex items-center gap-2">
                 <h3 className="font-semibold text-gray-800 text-sm md:text-base">{data.name}</h3>
                 <span className="text-[10px] uppercase font-bold text-gray-400 border border-gray-200 px-1 rounded">
                   {data.type}
                 </span>
              </div>

              {/* Subtitle / Metadata */}
              <div className="text-xs text-gray-500 mt-1 flex items-center gap-4">
                {data.type === NodeType.GROUP && (
                  <span>Budget: <span className="font-medium text-gray-700">${(data as GroupNode).totalBudget.toFixed(2)}</span></span>
                )}
                {data.type === NodeType.CAMPAIGN && (
                  <span>Budget: <span className="font-medium text-gray-700">${(data as CampaignNode).dailyBudget.toFixed(2)}/day</span></span>
                )}
                
                {data.type === NodeType.GROUP && (
                   <span className="flex items-center text-blue-600 font-medium hover:underline">
                      <Eye className="w-3 h-3 mr-1" /> View Targeting
                   </span>
                )}
                {data.type === NodeType.CAMPAIGN && (
                   <span className="flex items-center text-green-600 font-medium hover:underline">
                      <Eye className="w-3 h-3 mr-1" /> Inspect
                   </span>
                )}
                 {data.type === NodeType.CREATIVE && (
                   <span className="flex items-center text-purple-600 font-medium hover:underline">
                      <Eye className="w-3 h-3 mr-1" /> View Asset
                   </span>
                )}
              </div>
            </div>
          </div>
          
          <div className="text-right flex items-center gap-3">
             {data.type === NodeType.CAMPAIGN && 'children' in data && data.children && (
               <div className="hidden sm:flex items-center text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded">
                  <Layers className="w-3 h-3 mr-1" />
                  {data.children.length} Ads
               </div>
             )}
             
             {data.type !== NodeType.CREATIVE && (
               <span className={`text-xs font-bold px-2 py-1 rounded-full ${(data as any).status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                 {(data as any).status}
               </span>
             )}
          </div>
        </div>
      </div>

      {/* Render Children */}
      {isExpanded && hasChildren && (
        <div className="relative">
            {/* Thread line visual */}
            <div className="absolute left-6 md:left-10 top-0 bottom-0 w-px bg-gray-200 -z-10"></div>
            <div className="mt-2">
              {(data as GroupNode | CampaignNode).children.map((child) => (
                <HierarchyNode 
                  key={child.id} 
                  data={child} 
                  level={level + 1} 
                  onSelect={onSelect} 
                />
              ))}
            </div>
        </div>
      )}
    </div>
  );
};
