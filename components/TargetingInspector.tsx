
import React from 'react';
import { TargetingSummary, NodeType, CreativeNode } from '../types';
import { Globe, Users, Briefcase, UserX, Target, FileVideo, FileImage, Layers, Play, DollarSign, Crosshair, Settings, MapPin } from 'lucide-react';

interface InspectorProps {
  node: {
    type: NodeType;
    name: string;
    targeting?: TargetingSummary;
    creatives?: CreativeNode[]; // List of creatives if it's a campaign
    singleCreative?: CreativeNode; // Specific creative data if it's a creative node
    objective?: string;        // NEW: Passed for Campaigns
    biddingStrategy?: string;  // NEW: Passed for Campaigns
  } | null;
  onClose: () => void;
}

const TargetingSection = ({ title, items, icon: Icon, colorClass, borderColor }: { title: string, items: string[], icon: any, colorClass: string, borderColor: string }) => {
  if (!items || items.length === 0) return null;
  return (
    <div className={`mb-4 p-3 rounded-lg border ${borderColor} bg-opacity-50`}>
      <h4 className="flex items-center text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">
        <Icon className="w-3.5 h-3.5 mr-2" />
        {title}
      </h4>
      <div className="flex flex-wrap gap-2">
        {items.map((item, idx) => (
          <span key={idx} className={`px-2.5 py-1 rounded text-sm font-medium border ${colorClass}`}>
            {item}
          </span>
        ))}
      </div>
    </div>
  );
};

const CreativePreview: React.FC<{ creative: CreativeNode, compact?: boolean }> = ({ creative, compact = false }) => {
  const getIcon = () => {
    switch (creative.format) {
      case 'VIDEO': return <FileVideo className={compact ? "w-5 h-5" : "w-12 h-12"} />;
      case 'CAROUSEL': return <Layers className={compact ? "w-5 h-5" : "w-12 h-12"} />;
      default: return <FileImage className={compact ? "w-5 h-5" : "w-12 h-12"} />;
    }
  };

  const getBgColor = () => {
    switch (creative.format) {
      case 'VIDEO': return 'bg-purple-100 text-purple-600';
      case 'CAROUSEL': return 'bg-orange-100 text-orange-600';
      default: return 'bg-blue-100 text-blue-600';
    }
  };

  if (compact) {
    return (
      <div className="flex items-center gap-3 p-2.5 rounded-lg border border-gray-100 bg-white hover:border-gray-300 transition-all">
        <div className={`p-2 rounded ${getBgColor()}`}>
          {getIcon()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{creative.name}</p>
          <p className="text-xs text-gray-500 font-mono mt-0.5">{creative.format}</p>
        </div>
      </div>
    );
  }

  // Full detail view
  return (
    <div className="space-y-4">
      <div className={`w-full aspect-video rounded-lg flex flex-col items-center justify-center ${getBgColor()} relative overflow-hidden group`}>
         {/* Mock Preview Content */}
         {getIcon()}
         {creative.format === 'VIDEO' && (
           <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-all">
              <div className="bg-white p-3 rounded-full shadow-lg opacity-80">
                <Play className="w-6 h-6 text-black fill-current" />
              </div>
           </div>
         )}
         <span className="absolute bottom-2 right-2 text-[10px] font-bold uppercase bg-white bg-opacity-90 px-2 py-1 rounded text-gray-800">
           {creative.format}
         </span>
      </div>
      <div>
        <label className="text-xs font-bold text-gray-400 uppercase">Ad Name</label>
        <p className="text-lg font-medium text-gray-900 leading-tight">{creative.name}</p>
      </div>
      <div>
        <label className="text-xs font-bold text-gray-400 uppercase">Asset ID</label>
        <p className="text-sm font-mono text-gray-600">{creative.id}</p>
      </div>
    </div>
  );
};

export const TargetingInspector: React.FC<InspectorProps> = ({ node, onClose }) => {
  if (!node) return null;

  // Helper to determine primary creative format from list
  const getPrimaryFormat = () => {
    if (!node.creatives || node.creatives.length === 0) return 'Unknown';
    return node.creatives[0].format; // Just take the first one for summary
  };

  return (
    <div className="fixed inset-y-0 right-0 w-full md:w-[400px] bg-white shadow-2xl transform transition-transform duration-300 ease-in-out border-l border-gray-200 z-50 overflow-y-auto">
      <div className="p-6">
        <div className="flex justify-between items-start mb-6">
          <div className="pr-4">
            <span className={`text-[10px] font-bold px-2 py-1 rounded tracking-wider uppercase ${
              node.type === NodeType.GROUP ? 'bg-gray-100 text-gray-700' : 
              node.type === NodeType.CAMPAIGN ? 'bg-orange-100 text-orange-800' :
              'bg-green-100 text-green-800'
            }`}>
              {node.type === NodeType.GROUP ? 'CAMPAIGN GROUP' : 
               node.type === NodeType.CAMPAIGN ? 'CAMPAIGN' : 'AD'}
            </span>
            <h2 className="text-xl font-bold text-gray-900 mt-3 leading-snug break-words">{node.name}</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 1. If it's a CREATIVE Node, show preview */}
        {node.type === NodeType.CREATIVE && node.singleCreative && (
          <div className="mb-8">
            <CreativePreview creative={node.singleCreative} />
          </div>
        )}

        {/* 2. If it's a CAMPAIGN (AD GROUP), show Configuration Grid FIRST */}
        {node.type === NodeType.CAMPAIGN && (
          <>
            <div className="mb-6">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center">
                 <Settings className="w-3.5 h-3.5 mr-1.5" /> Campaign Settings
              </h3>
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-100 space-y-3">
                <div className="flex justify-between items-center border-b border-gray-100 pb-2">
                   <div className="flex items-center text-xs text-gray-500">
                      <Crosshair className="w-3.5 h-3.5 mr-2" /> Objective
                   </div>
                   <div className="text-sm font-semibold text-gray-900 text-right">
                      {node.objective || 'Brand Awareness'}
                   </div>
                </div>
                
                <div className="flex justify-between items-center border-b border-gray-100 pb-2">
                   <div className="flex items-center text-xs text-gray-500">
                      <DollarSign className="w-3.5 h-3.5 mr-2" /> Bidding Strategy
                   </div>
                   <div className="text-sm font-semibold text-gray-900 text-right">
                      {node.biddingStrategy || 'Auto Bid'}
                   </div>
                </div>

                <div className="flex justify-between items-center">
                   <div className="flex items-center text-xs text-gray-500">
                      <Layers className="w-3.5 h-3.5 mr-2" /> Creative Type
                   </div>
                   <div className="text-sm font-semibold text-gray-900 text-right">
                      {getPrimaryFormat()}
                   </div>
                </div>
              </div>
            </div>

            {/* 3. If it's a CAMPAIGN, show Targeting Details */}
            {node.targeting && (
              <div className="mb-6">
                 <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center">
                   <Target className="w-3.5 h-3.5 mr-1.5" /> Targeting Rules
                 </h3>
                
                <TargetingSection 
                   title="Locations" 
                   items={node.targeting.geos} 
                   icon={MapPin}
                   colorClass="bg-blue-50 text-blue-700 border-blue-200"
                   borderColor="border-blue-100"
                 />

                <TargetingSection 
                  title="Audience Segments" 
                  items={node.targeting.audiences} 
                  icon={Users}
                  colorClass="bg-purple-50 text-purple-700 border-purple-200"
                  borderColor="border-purple-100"
                />

                <TargetingSection 
                  title="Industries" 
                  items={node.targeting.industries} 
                  icon={Briefcase}
                  colorClass="bg-indigo-50 text-indigo-700 border-indigo-200"
                  borderColor="border-indigo-100"
                />

                <TargetingSection 
                  title="Job Titles" 
                  items={node.targeting.jobTitles} 
                  icon={Target}
                  colorClass="bg-orange-50 text-orange-700 border-orange-200"
                  borderColor="border-orange-100"
                />

                {node.targeting.exclusions && node.targeting.exclusions.length > 0 && (
                  <div className="mt-6 pt-2">
                    <TargetingSection 
                      title="Exclusions" 
                      items={node.targeting.exclusions} 
                      icon={UserX}
                      colorClass="bg-red-50 text-red-700 border-red-200"
                      borderColor="border-red-200 bg-red-50"
                    />
                  </div>
                )}
                
                {(node.targeting.geos.length === 0 && node.targeting.audiences.length === 0 && node.targeting.exclusions.length === 0 && node.targeting.industries.length === 0 && node.targeting.jobTitles.length === 0) && (
                  <div className="text-gray-400 italic text-sm text-center py-4 bg-gray-50 rounded border border-gray-100 border-dashed">
                    No specific targeting criteria found.
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* 4. If it's a GROUP, just show minimal info */}
        {node.type === NodeType.GROUP && (
           <div className="text-gray-500 text-sm">
             <p className="mb-4">This contains specific ad groups that define targeting.</p>
             <div className="p-4 bg-gray-50 rounded border border-gray-100 flex items-center gap-3">
                <Briefcase className="text-gray-400 w-5 h-5" />
                <span className="font-medium text-gray-700">Settings are inherited by Ad Groups.</span>
             </div>
           </div>
        )}

        {/* 5. If it's a CAMPAIGN, show List of Creatives */}
        {node.type === NodeType.CAMPAIGN && node.creatives && node.creatives.length > 0 && (
          <div className="mt-8 pt-6 border-t border-gray-100">
            <h3 className="text-xs font-bold uppercase text-gray-500 mb-4 flex items-center tracking-wider">
              <Layers className="w-3.5 h-3.5 mr-2" />
              Active Ads ({node.creatives.length})
            </h3>
            <div className="space-y-2">
              {node.creatives.map(creative => (
                <CreativePreview key={creative.id} creative={creative} compact={true} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
