import React, { useState } from 'react';
import { useSpoilerProtection } from '../context/SpoilerContext';

interface SpoilerBlurProps {
  /** Unique identifier for this spoiler item (used for reveal state tracking) */
  itemId: string;
  /** Whether this content is actually a spoiler (if false, no blur is applied) */
  isSpoiler: boolean;
  /** The content to blur */
  children: React.ReactNode;
  /** Optional custom message to show when blurred */
  blurMessage?: string;
  /** Whether to show the lock/eye icon overlay */
  showIcon?: boolean;
  /** Additional class names */
  className?: string;
  /** Type of blur: 'image' for thumbnails, 'text' for titles */
  type?: 'image' | 'text';
}

/**
 * SpoilerBlur component that wraps content and applies a blur effect
 * when the content is determined to be a spoiler.
 * 
 * The blur can be temporarily revealed by clicking/tapping.
 */
export const SpoilerBlur: React.FC<SpoilerBlurProps> = ({
  itemId,
  isSpoiler,
  children,
  blurMessage = 'Spoiler hidden',
  showIcon = true,
  className = '',
  type = 'image',
}) => {
  const { spoilerProtectionEnabled, isRevealed, revealItem, hideItem } = useSpoilerProtection();
  const [isHovered, setIsHovered] = useState(false);

  // Don't apply any blur if protection is disabled or content isn't a spoiler
  if (!spoilerProtectionEnabled || !isSpoiler) {
    return <>{children}</>;
  }

  const revealed = isRevealed(itemId);

  const handleReveal = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    if (revealed) {
      hideItem(itemId);
    } else {
      revealItem(itemId);
    }
  };

  const blurAmount = type === 'image' ? 'blur-lg' : 'blur-sm';
  const textBlurStyle: React.CSSProperties = type === 'text' ? { 
    filter: revealed ? 'none' : 'blur(4px)',
    transition: 'filter 0.2s ease-in-out',
    userSelect: revealed ? 'auto' : 'none',
  } : {};

  return (
    <div 
      className={`relative ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Blurred content */}
      <div 
        className={`${type === 'image' && !revealed ? blurAmount : ''} transition-all duration-200`}
        style={textBlurStyle}
      >
        {children}
      </div>

      {/* Overlay with icon and reveal button (only shown when blurred) */}
      {!revealed && (
        <div 
          className={`absolute inset-0 flex flex-col items-center justify-center transition-opacity duration-200 ${
            type === 'image' ? 'bg-black/30' : ''
          }`}
          onClick={handleReveal}
          style={{ cursor: 'pointer' }}
        >
          {/* Eye-off icon */}
          {showIcon && type === 'image' && (
            <svg 
              className="w-6 h-6 text-white/80 drop-shadow-lg"
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" 
              />
            </svg>
          )}

          {/* Reveal button - shown on hover/tap */}
          {(isHovered || type === 'text') && (
            <button
              onClick={handleReveal}
              className={`
                ${type === 'image' ? 'mt-2' : ''} 
                text-[10px] uppercase tracking-wider font-bold
                px-2 py-1 
                bg-neutral-900/90 text-neutral-300
                border border-neutral-700
                hover:bg-neutral-800 hover:text-white hover:border-neutral-600
                transition-all duration-150
                backdrop-blur-sm
              `}
            >
              Reveal
            </button>
          )}
        </div>
      )}

      {/* Re-hide button (shown when revealed) */}
      {revealed && isHovered && (
        <button
          onClick={handleReveal}
          className={`
            absolute ${type === 'image' ? 'top-1 right-1' : 'right-0 top-1/2 -translate-y-1/2'}
            text-[10px] uppercase tracking-wider font-bold
            px-2 py-1 
            bg-neutral-900/90 text-neutral-400
            border border-neutral-700
            hover:bg-neutral-800 hover:text-white hover:border-neutral-600
            transition-all duration-150
            backdrop-blur-sm
          `}
        >
          Hide
        </button>
      )}
    </div>
  );
};

/**
 * Small indicator shown next to blurred content to explain why it's hidden
 */
export const SpoilerIndicator: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <span 
      className={`inline-flex items-center gap-1 text-[10px] text-amber-500/80 uppercase tracking-wider ${className}`}
      title="This content is hidden because the user is ahead of you"
    >
      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          strokeWidth={2} 
          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" 
        />
      </svg>
      <span>Spoiler</span>
    </span>
  );
};

export default SpoilerBlur;
