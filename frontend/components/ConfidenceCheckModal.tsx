import React, { useState, useEffect, useCallback } from 'react';
import { VideoProviderName } from '../types';
import { MatchResult, searchWithProvider, findTopMatches, LOW_CONFIDENCE_THRESHOLD } from '../services/videoResolver';
import { saveProviderMapping } from '../services/api';
import { getProviderDisplayName, VIDEO_PROVIDER_BASE_URLS } from '../services/providerConfig';
import { useToast } from '../context/ToastContext';

interface ConfidenceCheckModalProps {
  /** The original reference ID (e.g., "tmdb:12345") */
  refId: string;
  /** The matched title from provider */
  matchedTitle: string;
  /** Confidence score of the match (0-1) */
  confidence: number;
  /** The provider-specific ID of the match */
  matchedProviderId: string;
  /** Alternative matches to display */
  alternatives: MatchResult[];
  /** The video provider */
  provider: VideoProviderName;
  /** Original title being searched */
  originalTitle: string;
  /** Media type hint */
  mediaType?: 'movie' | 'tv' | 'anime';
  /** Called when user confirms a selection */
  onConfirm: (providerId: string, providerTitle: string) => void;
  /** Called when user wants to search manually (opens provider search) */
  onSearchManually: () => void;
  /** Called to close modal (cancel) */
  onClose: () => void;
}

// Helper to proxy image URLs with provider referer
function proxyImageUrl(url: string | null, providerReferer?: string): string | null {
  if (!url) return null;
  if (url.startsWith('blob:') || url.startsWith('/api/')) return url;
  let proxyUrl = `/api/proxy/image?url=${encodeURIComponent(url)}`;
  if (providerReferer) {
    proxyUrl += `&referer=${encodeURIComponent(providerReferer)}`;
  }
  return proxyUrl;
}

// Format confidence score as percentage with color
function getConfidenceDisplay(score: number): { text: string; colorClass: string } {
  const percent = Math.round(score * 100);
  if (score >= 0.9) {
    return { text: `${percent}%`, colorClass: 'text-green-500' };
  } else if (score >= 0.7) {
    return { text: `${percent}%`, colorClass: 'text-yellow-500' };
  } else if (score >= 0.5) {
    return { text: `${percent}%`, colorClass: 'text-orange-500' };
  }
  return { text: `${percent}%`, colorClass: 'text-red-500' };
}

export const ConfidenceCheckModal: React.FC<ConfidenceCheckModalProps> = ({
  refId,
  matchedTitle,
  confidence,
  matchedProviderId,
  alternatives,
  provider,
  originalTitle,
  mediaType,
  onConfirm,
  onSearchManually,
  onClose,
}) => {
  const { showToast } = useToast();
  const [selectedId, setSelectedId] = useState<string>(matchedProviderId);
  const [selectedTitle, setSelectedTitle] = useState<string>(matchedTitle);
  const [isSaving, setIsSaving] = useState(false);

  const confidenceDisplay = getConfidenceDisplay(confidence);

  // Handle confirm with the selected match
  const handleConfirm = async () => {
    setIsSaving(true);
    try {
      // Save the verified mapping to database
      await saveProviderMapping(refId, provider, selectedId, selectedTitle);
      showToast('Source confirmed', 'success');
      onConfirm(selectedId, selectedTitle);
    } catch (err) {
      console.error('[ConfidenceCheckModal] Failed to save mapping:', err);
      // Still proceed even if save fails - user intent is clear
      onConfirm(selectedId, selectedTitle);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle selecting an alternative
  const handleSelectAlternative = (match: MatchResult) => {
    setSelectedId(match.id);
    setSelectedTitle(match.title);
  };

  // Handle backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const isCurrentMatch = selectedId === matchedProviderId;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-black border border-neutral-700 w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-neutral-800 flex-shrink-0">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-yellow-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <h3 className="text-sm font-bold uppercase tracking-widest">
                CONFIRM MATCH
              </h3>
              <p className="text-xs text-neutral-500 mt-1">
                Low confidence match - please verify
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Original search info */}
          <div className="p-4 border-b border-neutral-800 bg-neutral-950">
            <p className="text-xs text-neutral-600 uppercase tracking-wider mb-1">
              Searching for
            </p>
            <p className="text-sm text-white font-medium">
              "{originalTitle}"
            </p>
            <p className="text-xs text-neutral-600 mt-1">
              via {getProviderDisplayName(provider)}
            </p>
          </div>

          {/* Best match (current selection) */}
          <div className="p-4 border-b border-neutral-800">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-neutral-600 uppercase tracking-wider">
                Best Match
              </p>
              <span className={`text-xs font-medium ${confidenceDisplay.colorClass}`}>
                {confidenceDisplay.text} match
              </span>
            </div>
            
            <button
              onClick={() => {
                setSelectedId(matchedProviderId);
                setSelectedTitle(matchedTitle);
              }}
              className={`w-full p-3 flex gap-3 text-left border transition-colors ${
                isCurrentMatch 
                  ? 'border-white bg-neutral-900' 
                  : 'border-neutral-800 hover:border-neutral-600'
              }`}
            >
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-white uppercase tracking-tight line-clamp-2">
                  {matchedTitle}
                </h4>
              </div>
              {isCurrentMatch && (
                <div className="flex-shrink-0 self-center">
                  <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
            </button>
          </div>

          {/* Alternative matches */}
          {alternatives.length > 0 && (
            <div className="p-4">
              <p className="text-xs text-neutral-600 uppercase tracking-wider mb-3">
                Alternative Matches ({alternatives.length})
              </p>
              
              <div className="space-y-2">
                {alternatives.map((alt, idx) => {
                  const isSelected = selectedId === alt.id;
                  const altConfidence = getConfidenceDisplay(alt.score);
                  
                  return (
                    <button
                      key={alt.id || idx}
                      onClick={() => handleSelectAlternative(alt)}
                      className={`w-full p-3 flex gap-3 text-left border transition-colors ${
                        isSelected 
                          ? 'border-white bg-neutral-900' 
                          : 'border-neutral-800 hover:border-neutral-600'
                      }`}
                    >
                      {/* Thumbnail */}
                      {alt.imageUrl && (
                        <div className="flex-shrink-0 w-12">
                          <img
                            src={proxyImageUrl(alt.imageUrl, VIDEO_PROVIDER_BASE_URLS[provider]) || ''}
                            alt={alt.title}
                            className="w-full aspect-[2/3] object-cover border border-neutral-800 bg-neutral-900"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        </div>
                      )}
                      
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-white uppercase tracking-tight line-clamp-2 text-sm">
                          {alt.title}
                        </h4>
                        <div className="flex items-center gap-2 text-xs text-neutral-500 mt-1 flex-wrap">
                          {alt.type && (
                            <span className="uppercase">{alt.type}</span>
                          )}
                          {alt.year && (
                            <span>{alt.year}</span>
                          )}
                          <span className={altConfidence.colorClass}>
                            {altConfidence.text}
                          </span>
                        </div>
                        {alt.description && (
                          <p className="text-xs text-neutral-600 mt-1 line-clamp-1">
                            {alt.description}
                          </p>
                        )}
                      </div>

                      {/* Selection indicator */}
                      {isSelected && (
                        <div className="flex-shrink-0 self-center">
                          <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="p-4 border-t border-neutral-800 space-y-2 flex-shrink-0">
          {/* Confirm button */}
          <button
            onClick={handleConfirm}
            disabled={isSaving}
            className="w-full py-3 text-xs font-bold uppercase tracking-wider bg-white text-black hover:bg-neutral-200 transition-colors disabled:opacity-50"
          >
            {isSaving ? 'Confirming...' : `Confirm "${selectedTitle}"`}
          </button>
          
          {/* Search manually option */}
          <button
            onClick={onSearchManually}
            className="w-full py-3 text-xs font-bold uppercase tracking-wider border border-neutral-700 text-neutral-400 hover:border-neutral-500 hover:text-white transition-colors"
          >
            SEARCH MANUALLY
          </button>
          
          {/* Cancel */}
          <button
            onClick={onClose}
            className="w-full py-2 text-xs uppercase tracking-wider text-neutral-600 hover:text-neutral-400 transition-colors"
          >
            CANCEL
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfidenceCheckModal;
