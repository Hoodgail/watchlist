import React, { useState } from 'react';
import { useSpoilerProtection } from '@/context/SpoilerContext';

interface SpoilerBlurProps {
  itemId: string;
  isSpoiler: boolean;
  children: React.ReactNode;
  blurMessage?: string;
  showIcon?: boolean;
  className?: string;
  type?: 'image' | 'text';
}

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
  const textBlurStyle: React.CSSProperties = type === 'text'
    ? {
        filter: revealed ? 'none' : 'blur(4px)',
        transition: 'filter 0.2s ease-in-out',
        userSelect: revealed ? 'auto' : 'none',
      }
    : {};

  return (
    <div
      className={`relative ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className={`${type === 'image' && !revealed ? blurAmount : ''} transition-all duration-200`}
        style={textBlurStyle}
      >
        {children}
      </div>

      {!revealed && (
        <div
          className={`absolute inset-0 flex flex-col items-center justify-center transition-opacity duration-200 ${
            type === 'image' ? 'bg-black/30' : ''
          }`}
          onClick={handleReveal}
          style={{ cursor: 'pointer' }}
        >
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
              {blurMessage}
            </button>
          )}
        </div>
      )}

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
