import React from 'react';
import { ExternalLink, Play } from 'lucide-react';

interface AdPreviewCardProps {
  imageUrl?: string;
  videoUrl?: string;
  headline?: string;
  description?: string;
  callToAction?: string;
  destinationUrl?: string;
  mediaType?: string;
  isThoughtLeader?: boolean;
  authorName?: string;
}

export function AdPreviewCard({
  imageUrl,
  videoUrl,
  headline,
  description,
  callToAction,
  destinationUrl,
  mediaType,
  isThoughtLeader,
  authorName,
}: AdPreviewCardProps) {
  const getDomain = (url?: string) => {
    if (!url) return '';
    try {
      const domain = new URL(url).hostname.replace('www.', '');
      return domain.length > 30 ? domain.substring(0, 27) + '...' : domain;
    } catch {
      return url.substring(0, 30);
    }
  };

  const hasMedia = imageUrl || videoUrl;
  const isVideo = mediaType === 'Video' || !!videoUrl;

  return (
    <div className="bg-white rounded-lg shadow-xl border border-gray-200 w-72 overflow-hidden">
      {/* LinkedIn-style header */}
      <div className="px-3 py-2 border-b border-gray-100 flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-xs font-bold">
          {isThoughtLeader ? 'TL' : 'in'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold text-gray-900 truncate">
            {authorName || (isThoughtLeader ? 'Thought Leader' : 'Sponsored')}
          </div>
          <div className="text-[10px] text-gray-500">Promoted</div>
        </div>
      </div>

      {/* Media section */}
      {hasMedia && (
        <div className="relative aspect-[1.91/1] bg-gray-100">
          {isVideo ? (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt="Video thumbnail"
                  className="w-full h-full object-cover opacity-80"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : null}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
                  <Play className="w-6 h-6 text-gray-800 ml-1" fill="currentColor" />
                </div>
              </div>
            </div>
          ) : imageUrl ? (
            <img
              src={imageUrl}
              alt="Ad creative"
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).parentElement!.style.display = 'none';
              }}
            />
          ) : null}
        </div>
      )}

      {/* Content section */}
      <div className="p-3">
        {/* Headline */}
        {headline && (
          <h3 className="text-sm font-semibold text-gray-900 leading-tight mb-1 line-clamp-2">
            {headline}
          </h3>
        )}

        {/* Description */}
        {description && (
          <p className="text-xs text-gray-600 leading-relaxed mb-2 line-clamp-2">
            {description}
          </p>
        )}

        {/* Destination URL */}
        {destinationUrl && (
          <div className="flex items-center gap-1 text-[10px] text-gray-500 mb-2">
            <ExternalLink className="w-3 h-3" />
            <span className="truncate">{getDomain(destinationUrl)}</span>
          </div>
        )}

        {/* CTA Button */}
        {callToAction && (
          <button className="w-full py-1.5 px-3 text-xs font-semibold text-[#0A66C2] border border-[#0A66C2] rounded-full hover:bg-blue-50 transition-colors">
            {callToAction}
          </button>
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-2 border-t border-gray-100 flex items-center justify-between text-[10px] text-gray-400">
        <span>Static Preview</span>
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
          Instant
        </span>
      </div>
    </div>
  );
}
