import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { MediaItem, MediaStatus, SortBy, FriendActivityFilter, FriendStatus, ActiveProgress, Collection } from '@/types';
import { STATUS_OPTIONS } from '@/constants';
import { SuggestToFriendModal } from '@/features/social/components/SuggestToFriendModal';
import { FriendAvatar } from '@/features/social/components/FriendList';
import { SpoilerBlur, SpoilerIndicator } from '@/shared/ui/SpoilerBlur';
import { useSpoilerProtection } from '@/context/SpoilerContext';
import { AddToCollectionModal, CollectionItemData } from '@/features/collections/components/AddToCollectionModal';
import { getMyCollections, addCollectionItem } from '@/features/collections/api';
import type { GroupedListResponse, StatusGroupPagination } from '@/features/library/api';
import { ProxiedImage, ProxiedImageCompact } from '@/shared/ui/ProxiedImage';
import { getRefIdImageUrl } from '@/shared/media';
import { useToast } from '@/context/ToastContext';
import { useAuth } from '@/context/AuthContext';

// ==================== Swipe Gesture Hook ====================

interface SwipeState {
  startX: number;
  startY: number;
  startTime: number;
  currentX: number;
  isSwiping: boolean;
  isHorizontal: boolean | null; // null = not yet determined
}

interface UseSwipeGestureOptions {
  onSwipeLeft?: () => void;
  minDistance?: number; // Minimum distance to trigger (default 60px)
  velocityThreshold?: number; // Minimum velocity for fast swipes (px/ms)
  deadZone?: number; // Initial dead zone before swipe starts (default 10px)
  maxSwipeDistance?: number; // Maximum visual offset (default 120px)
  enableHaptics?: boolean;
}

function useSwipeGesture(options: UseSwipeGestureOptions = {}) {
  const {
    onSwipeLeft,
    minDistance = 60,
    velocityThreshold = 0.5,
    deadZone = 10,
    maxSwipeDistance = 120,
    enableHaptics = true,
  } = options;

  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isTriggered, setIsTriggered] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const swipeStateRef = useRef<SwipeState>({
    startX: 0,
    startY: 0,
    startTime: 0,
    currentX: 0,
    isSwiping: false,
    isHorizontal: null,
  });
  const cardRef = useRef<HTMLDivElement>(null);

  const triggerHaptic = useCallback(() => {
    if (enableHaptics && 'vibrate' in navigator) {
      try {
        navigator.vibrate(10);
      } catch {
        // Haptics not supported or permission denied
      }
    }
  }, [enableHaptics]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    swipeStateRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      startTime: Date.now(),
      currentX: touch.clientX,
      isSwiping: false,
      isHorizontal: null,
    };
    setIsTriggered(false);
    setShowSuccess(false);

    // Add swiping class for CSS
    if (cardRef.current) {
      cardRef.current.classList.remove('snap-back', 'swipe-success');
      cardRef.current.classList.add('swiping');
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const state = swipeStateRef.current;
    const touch = e.touches[0];
    const deltaX = touch.clientX - state.startX;
    const deltaY = touch.clientY - state.startY;
    const absDeltaX = Math.abs(deltaX);
    const absDeltaY = Math.abs(deltaY);

    // Determine if this is a horizontal or vertical swipe (only once)
    if (state.isHorizontal === null && (absDeltaX > deadZone || absDeltaY > deadZone)) {
      state.isHorizontal = absDeltaX > absDeltaY;
    }

    // If determined to be vertical, ignore the swipe
    if (state.isHorizontal === false) {
      return;
    }

    // Dead zone - don't start swiping until we've moved enough
    if (!state.isSwiping && absDeltaX < deadZone) {
      return;
    }

    // Mark as swiping once we pass the dead zone
    if (!state.isSwiping && absDeltaX >= deadZone) {
      state.isSwiping = true;
    }

    state.currentX = touch.clientX;

    // Only allow left swipe (negative delta)
    if (deltaX < 0) {
      // Clamp the offset to maxSwipeDistance
      const offset = Math.max(-maxSwipeDistance, deltaX);
      setSwipeOffset(offset);

      // Check if we've crossed the trigger threshold
      const wasTriggered = isTriggered;
      const nowTriggered = Math.abs(offset) >= minDistance;

      if (nowTriggered && !wasTriggered) {
        setIsTriggered(true);
        triggerHaptic();
      } else if (!nowTriggered && wasTriggered) {
        setIsTriggered(false);
      }

      // Prevent scrolling while swiping horizontally
      if (state.isSwiping && state.isHorizontal) {
        e.preventDefault();
      }
    } else {
      // Right swipe - reset
      setSwipeOffset(0);
      setIsTriggered(false);
    }
  }, [deadZone, maxSwipeDistance, minDistance, triggerHaptic, isTriggered]);

  const handleTouchEnd = useCallback(() => {
    const state = swipeStateRef.current;
    const deltaX = state.currentX - state.startX;
    const elapsed = Date.now() - state.startTime;
    const velocity = Math.abs(deltaX) / elapsed;
    const absDeltaX = Math.abs(deltaX);

    // Remove swiping class, add snap-back
    if (cardRef.current) {
      cardRef.current.classList.remove('swiping');
      cardRef.current.classList.add('snap-back');
    }

    // Check if swipe should trigger action:
    // 1. Distance threshold met, OR
    // 2. Fast swipe with at least 30px distance
    const distanceThresholdMet = absDeltaX >= minDistance;
    const velocityThresholdMet = velocity >= velocityThreshold && absDeltaX >= 30;
    const shouldTrigger = deltaX < 0 && (distanceThresholdMet || velocityThresholdMet);

    if (shouldTrigger && onSwipeLeft) {
      // Trigger the action
      onSwipeLeft();
      triggerHaptic();
      setShowSuccess(true);

      // Add success animation class
      if (cardRef.current) {
        cardRef.current.classList.add('swipe-success');
      }
    }

    // Reset state
    setSwipeOffset(0);
    setIsTriggered(false);

    // Reset swipe state
    swipeStateRef.current = {
      startX: 0,
      startY: 0,
      startTime: 0,
      currentX: 0,
      isSwiping: false,
      isHorizontal: null,
    };
  }, [minDistance, velocityThreshold, onSwipeLeft, triggerHaptic]);

  return {
    cardRef,
    swipeOffset,
    isTriggered,
    showSuccess,
    handlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
    },
  };
}

// ==================== Constants ====================

const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: 'status', label: 'STATUS' },
  { value: 'title', label: 'TITLE' },
  { value: 'rating', label: 'RATING' },
  { value: 'updatedAt', label: 'RECENTLY UPDATED' },
  { value: 'createdAt', label: 'DATE ADDED' },
];

const FILTER_STATUS_OPTIONS = [
  { value: '', label: 'ALL' },
  ...STATUS_OPTIONS,
];

const FRIEND_ACTIVITY_OPTIONS: { value: FriendActivityFilter; label: string }[] = [
  { value: '', label: 'ALL' },
  { value: 'friends_watching', label: 'WATCHING/READING' },
  { value: 'friends_done', label: 'COMPLETED' },
  { value: 'friends_dropped', label: 'DROPPED' },
];

// Status group order and configuration
const STATUS_GROUP_CONFIG: {
  status: MediaStatus;
  label: string;
  icon: React.ReactNode;
  color: string;
  borderColor: string;
}[] = [
    {
      status: 'WATCHING',
      label: 'WATCHING',
      icon: <PlayIcon />,
      color: 'text-green-400',
      borderColor: 'border-l-green-500',
    },
    {
      status: 'READING',
      label: 'READING',
      icon: <PlayIcon />,
      color: 'text-green-400',
      borderColor: 'border-l-green-500',
    },
    {
      status: 'PLAYING',
      label: 'PLAYING',
      icon: <PlayIcon />,
      color: 'text-green-400',
      borderColor: 'border-l-green-500',
    },
    {
      status: 'PAUSED',
      label: 'PAUSED',
      icon: <PauseIcon />,
      color: 'text-yellow-500',
      borderColor: 'border-l-yellow-500',
    },
    {
      status: 'PLAN_TO_WATCH',
      label: 'PLANNED',
      icon: <ClockIcon />,
      color: 'text-blue-400',
      borderColor: 'border-l-blue-500',
    },
    {
      status: 'COMPLETED',
      label: 'COMPLETED',
      icon: <CheckIcon />,
      color: 'text-neutral-500',
      borderColor: 'border-l-neutral-600',
    },
    {
      status: 'DROPPED',
      label: 'DROPPED',
      icon: <XIcon />,
      color: 'text-red-400',
      borderColor: 'border-l-red-500',
    },
  ];

// Local storage keys
const COLLAPSE_STATE_KEY = 'medialist-collapse-state';
const VIEW_MODE_KEY = 'medialist-view-mode';

// ==================== Helpers ====================

// Format time as "H:MM:SS" or "MM:SS"
function formatTime(seconds: number): string {
  if (!isFinite(seconds) || isNaN(seconds)) return '0:00';

  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ==================== Icons ====================

function PlayIcon() {
  return (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
    </svg>
  );
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      className={`w-4 h-4 transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}
      fill="currentColor"
      viewBox="0 0 20 20"
    >
      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
      <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
    </svg>
  );
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg className={`w-4 h-4 ${filled ? 'text-yellow-400' : 'text-neutral-700'}`} fill="currentColor" viewBox="0 0 20 20">
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
    </svg>
  );
}

// ==================== Game Platform Icons ====================

const GamePlatformIcons: React.FC<{ platforms: string[] }> = ({ platforms }) => {
  const getPlatformIcon = (platform: string): React.ReactNode => {
    const p = platform.toLowerCase();
    if (p.includes('pc') || p.includes('windows')) {
      return (
        <span title="PC">
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
            <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801" />
          </svg>
        </span>
      );
    }
    if (p.includes('playstation')) {
      return (
        <span title="PlayStation">
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8.985 2.596v17.548l3.915 1.261V6.688c0-.69.304-1.151.794-.991.636.181.76.814.76 1.505v5.876c2.441 1.193 4.362-.002 4.362-3.153 0-3.237-1.126-4.675-4.438-5.827-1.307-.448-3.728-1.186-5.393-1.502z" />
          </svg>
        </span>
      );
    }
    if (p.includes('xbox')) {
      return (
        <span title="Xbox">
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
            <path d="M4.102 21.033C6.211 22.881 8.977 24 12 24c3.026 0 5.789-1.119 7.902-2.967 1.877-1.912-4.316-8.709-7.902-11.417-3.582 2.708-9.779 9.505-7.898 11.417zm11.16-14.406c2.5 2.961 7.484 10.313 6.076 12.912C23.056 17.036 24 14.62 24 12c0-4.124-2.076-7.766-5.24-9.934-1.667 1.058-2.728 2.927-3.498 4.561zM12 4.063s-1.548-2.315-4.757-4.063C4.08 1.833 2.076 5.474 2.076 9.6c0 2.62.944 5.036 2.518 6.9-.192-2.599 3.576-9.882 7.406-12.437z" />
          </svg>
        </span>
      );
    }
    if (p.includes('nintendo') || p.includes('switch')) {
      return (
        <span title="Nintendo">
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
            <path d="M14.176 24h3.674c3.376 0 6.15-2.774 6.15-6.15V6.15C24 2.775 21.226 0 17.85 0h-3.674c-.21 0-.38.17-.38.38v23.24c0 .21.17.38.38.38zm3.623-15.15c1.18 0 2.138.957 2.138 2.137 0 1.18-.957 2.138-2.138 2.138-1.18 0-2.137-.957-2.137-2.138 0-1.18.957-2.137 2.137-2.137zM6.15 0C2.774 0 0 2.775 0 6.15v11.7C0 21.226 2.775 24 6.15 24h3.674c.21 0 .38-.17.38-.38V.38c0-.21-.17-.38-.38-.38z" />
          </svg>
        </span>
      );
    }
    if (p.includes('ios') || p.includes('iphone') || p.includes('ipad')) {
      return (
        <span title="iOS">
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83" />
          </svg>
        </span>
      );
    }
    if (p.includes('android')) {
      return (
        <span title="Android">
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.523 15.341c-.5 0-.91-.41-.91-.91v-5.137c0-.5.41-.91.91-.91s.91.41.91.91v5.137c0 .5-.41.91-.91.91zm-11.046 0c-.5 0-.91-.41-.91-.91v-5.137c0-.5.41-.91.91-.91s.91.41.91.91v5.137c0 .5-.41.91-.91.91zm11.523-7.91c0-.276-.224-.5-.5-.5H6.5c-.276 0-.5.224-.5.5v8.569c0 .276.224.5.5.5h11c.276 0 .5-.224.5-.5V7.431zm-1 8.069H7V7.931h10v7.569zM15.363 3.14l1.068-1.59c.127-.19.076-.447-.114-.574-.19-.127-.447-.076-.574.114l-1.117 1.662C13.789 2.282 12.917 2 12 2s-1.789.282-2.626.752L8.257 1.09c-.127-.19-.384-.241-.574-.114-.19.127-.241.384-.114.574l1.068 1.59C7.03 4.147 6 5.813 6 7.5h12c0-1.687-1.03-3.353-2.637-4.36zM9.5 5.5c-.276 0-.5-.224-.5-.5s.224-.5.5-.5.5.224.5.5-.224.5-.5.5zm5 0c-.276 0-.5-.224-.5-.5s.224-.5.5-.5.5.224.5.5-.224.5-.5.5z" />
          </svg>
        </span>
      );
    }
    if (p.includes('linux')) {
      return (
        <span title="Linux">
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12.504 0c-.155 0-.315.008-.48.021-4.226.333-3.105 4.807-3.17 6.298-.076 1.092-.3 1.953-1.05 3.02-.885 1.051-2.127 2.75-2.716 4.521-.278.832-.41 1.684-.287 2.489a.424.424 0 00-.11.135c-.26.268-.45.6-.663.839-.199.199-.485.267-.797.4-.313.136-.658.269-.864.68-.09.189-.136.394-.132.602 0 .199.027.4.055.536.058.399.116.728.04.97-.249.68-.28 1.145-.106 1.484.174.334.535.47.94.601.81.2 1.91.135 2.774.6.926.466 1.866.67 2.616.47.526-.116.97-.464 1.208-.946.587-.003 1.23-.269 2.26-.334.699-.058 1.574.267 2.577.2.025.134.063.198.114.333l.003.003c.391.778 1.113 1.132 1.884 1.071.771-.06 1.592-.536 2.257-1.306.631-.765 1.683-1.084 2.378-1.503.348-.199.629-.469.649-.853.023-.4-.2-.811-.714-1.376v-.097l-.003-.003c-.17-.2-.25-.535-.338-.926-.085-.401-.182-.786-.492-1.046h-.003c-.059-.054-.123-.067-.188-.135a.357.357 0 00-.19-.064c.431-1.278.264-2.55-.173-3.694-.533-1.41-1.465-2.638-2.175-3.483-.796-1.005-1.576-1.957-1.56-3.368.026-2.152.236-6.133-3.544-6.139z" />
          </svg>
        </span>
      );
    }
    if (p.includes('mac')) {
      return (
        <span title="macOS">
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
          </svg>
        </span>
      );
    }
    return null;
  };

  const getUniquePlatforms = (plats: string[]): string[] => {
    const seen = new Set<string>();
    return plats.filter(p => {
      const key = p.toLowerCase()
        .replace(/playstation \d+/i, 'playstation')
        .replace(/xbox.*/i, 'xbox')
        .replace(/nintendo.*/i, 'nintendo');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  const uniquePlatforms = getUniquePlatforms(platforms);

  return (
    <span className="flex items-center gap-1" title={platforms.join(', ')}>
      {uniquePlatforms.slice(0, 4).map((platform, idx) => (
        <span key={idx}>{getPlatformIcon(platform)}</span>
      ))}
      {uniquePlatforms.length > 4 && <span className="text-[10px]">+{uniquePlatforms.length - 4}</span>}
    </span>
  );
};

// ==================== Helper Functions ====================

const getShortStatus = (status: MediaStatus): string => {
  switch (status) {
    case 'WATCHING':
    case 'READING':
      return 'ACTIVE';
    case 'COMPLETED':
      return 'DONE';
    case 'DROPPED':
      return 'DROP';
    case 'PAUSED':
      return 'PAUSE';
    case 'PLAN_TO_WATCH':
      return 'PLAN';
    default:
      return status;
  }
};

const getStatusConfig = (status: MediaStatus) => {
  return STATUS_GROUP_CONFIG.find(c => c.status === status) || STATUS_GROUP_CONFIG[0];
};

// ==================== Friend Avatar Stack Component ====================

const FriendAvatarStack: React.FC<{
  friends: FriendStatus[];
  maxVisible?: number;
}> = ({ friends, maxVisible = 5 }) => {
  const visibleFriends = friends.slice(0, maxVisible);
  const remainingCount = friends.length - maxVisible;

  return (
    <div className="flex items-center">
      <div className="flex -space-x-2">
        {visibleFriends.map((friend, index) => (
          <div
            key={friend.id}
            className="relative"
            style={{ zIndex: maxVisible - index }}
            title={friend.displayName || friend.username}
          >
            <FriendAvatar
              user={{ username: friend.username, avatarUrl: friend.avatarUrl }}
              size="sm"
            />
          </div>
        ))}
        {remainingCount > 0 && (
          <div
            className="relative w-6 h-6 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center text-[10px] text-neutral-400 font-bold"
            style={{ zIndex: 0 }}
            title={`${remainingCount} more friends`}
          >
            {remainingCount > 9 ? '9+' : `+${remainingCount}`}
          </div>
        )}
      </div>
      <span className="ml-2 text-neutral-500 text-[10px]">
        {friends.length}
      </span>
    </div>
  );
};

// ==================== Types ====================

interface MediaListProps {
  title: string;
  items: MediaItem[];
  // Grouped data for per-status pagination
  groupedData?: GroupedListResponse | null;
  mediaTypeFilter?: 'video' | 'manga' | 'game';
  defaultTypeFilter?: 'all' | 'video' | 'manga' | 'game';
  onUpdate?: (id: string, updates: Partial<MediaItem>) => void;
  onDelete?: (id: string) => void;
  onAddToMyList?: (item: MediaItem) => void;
  onItemClick?: (item: MediaItem) => void;
  readonly?: boolean;
  filterStatus?: MediaStatus | '';
  friendActivityFilter?: FriendActivityFilter;
  sortBy?: SortBy;
  onFilterChange?: (status: MediaStatus | '') => void;
  onFriendActivityFilterChange?: (filter: FriendActivityFilter) => void;
  onSortChange?: (sortBy: SortBy) => void;
  showSuggestButton?: boolean;
  // Per-status pagination
  onPageChange?: (status: MediaStatus, page: number) => void;
  loadingStatuses?: Set<MediaStatus>;
  // User's progress map for spoiler detection: refId -> current episode/chapter
  userProgressMap?: Map<string, number>;
}

interface MediaItemCardProps {
  item: MediaItem;
  onUpdate?: (id: string, updates: Partial<MediaItem>) => void;
  onDelete?: (id: string) => void;
  onAddToMyList?: (item: MediaItem) => void;
  onItemClick?: (item: MediaItem) => void;
  readonly?: boolean;
  showSuggestButton?: boolean;
  searchQuery?: string;
  onSuggest?: (item: MediaItem) => void;
  onAddToCollection?: (item: MediaItem) => void;
  // User's progress on this item for spoiler detection
  userProgress?: number;
}

type ViewMode = 'grouped' | 'compact';
type LibraryTypeFilter = 'all' | 'video' | 'manga' | 'game';
type StatusTabValue = 'all' | 'active' | 'paused' | 'planned' | 'completed' | 'dropped';

const STATUS_TAB_OPTIONS: { value: StatusTabValue; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Watching' },
  { value: 'completed', label: 'Completed' },
  { value: 'dropped', label: 'Dropped' },
  { value: 'planned', label: 'Planned' },
  { value: 'paused', label: 'Paused' },
];

const TYPE_FILTER_OPTIONS: { value: LibraryTypeFilter; label: string }[] = [
  { value: 'all', label: 'All Types' },
  { value: 'video', label: 'Video' },
  { value: 'manga', label: 'Manga' },
  { value: 'game', label: 'Games' },
];

const ACTIVE_STATUSES = new Set<MediaStatus>(['WATCHING', 'READING', 'PLAYING']);

const getTypeFilterForItem = (item: MediaItem): Exclude<LibraryTypeFilter, 'all'> => {
  if (item.type === 'MANGA') return 'manga';
  if (item.type === 'GAME') return 'game';
  return 'video';
};

const matchesTypeFilter = (item: MediaItem, typeFilter: LibraryTypeFilter) => {
  if (typeFilter === 'all') return true;
  return getTypeFilterForItem(item) === typeFilter;
};

const matchesStatusTab = (item: MediaItem, statusTab: StatusTabValue) => {
  switch (statusTab) {
    case 'active':
      return ACTIVE_STATUSES.has(item.status);
    case 'completed':
      return item.status === 'COMPLETED';
    case 'dropped':
      return item.status === 'DROPPED';
    case 'planned':
      return item.status === 'PLAN_TO_WATCH';
    case 'paused':
      return item.status === 'PAUSED';
    default:
      return true;
  }
};

const getStatusTabFromFilter = (status: MediaStatus | ''): StatusTabValue => {
  if (!status) return 'all';
  if (ACTIVE_STATUSES.has(status)) return 'active';
  if (status === 'COMPLETED') return 'completed';
  if (status === 'DROPPED') return 'dropped';
  if (status === 'PLAN_TO_WATCH') return 'planned';
  if (status === 'PAUSED') return 'paused';
  return 'all';
};

const getStatusForExternalFilter = (
  statusTab: StatusTabValue,
  typeFilter: LibraryTypeFilter,
): MediaStatus | '' => {
  switch (statusTab) {
    case 'active':
      if (typeFilter === 'manga') return 'READING';
      if (typeFilter === 'game') return 'PLAYING';
      return 'WATCHING';
    case 'completed':
      return 'COMPLETED';
    case 'dropped':
      return 'DROPPED';
    case 'planned':
      return 'PLAN_TO_WATCH';
    case 'paused':
      return 'PAUSED';
    default:
      return '';
  }
};

const getStatusSortRank = (status: MediaStatus) => {
  switch (status) {
    case 'WATCHING':
    case 'READING':
    case 'PLAYING':
      return 0;
    case 'PAUSED':
      return 1;
    case 'PLAN_TO_WATCH':
      return 2;
    case 'COMPLETED':
      return 3;
    case 'DROPPED':
      return 4;
    default:
      return 5;
  }
};

// ==================== Statistics Summary Component ====================

const StatisticsSummary: React.FC<{
  items: MediaItem[];
  onStatusClick: (status: MediaStatus | '') => void;
  activeStatus: MediaStatus | '';
}> = ({ items, onStatusClick, activeStatus }) => {
  const stats = useMemo(() => {
    const statusCounts: Partial<Record<MediaStatus, number>> = {};
    let totalRating = 0;
    let ratedCount = 0;

    items.forEach(item => {
      statusCounts[item.status] = (statusCounts[item.status] || 0) + 1;
      if (item.rating != null) {
        totalRating += item.rating;
        ratedCount++;
      }
    });

    return {
      total: items.length,
      statusCounts,
      avgRating: ratedCount > 0 ? (totalRating / ratedCount).toFixed(1) : null,
    };
  }, [items]);

  return (
    <div className="flex flex-wrap items-center gap-2  ">
      {/* Total count */}
      <button
        onClick={() => onStatusClick('')}
        className={`text-xs px-2.5 py-1.5 border transition-colors ${activeStatus === ''
          ? 'border-white text-white bg-neutral-800'
          : 'border-neutral-700 text-neutral-400 hover:border-neutral-500'
          }`}
      >
        {stats.total}
      </button>

      {/* Status chips */}
      {STATUS_GROUP_CONFIG.map(config => {
        const count = stats.statusCounts[config.status] || 0;
        if (count === 0) return null;
        const isActive = activeStatus === config.status;
        return (
          <button
            key={config.status}
            onClick={() => onStatusClick(isActive ? '' : config.status)}
            className={`text-xs px-2.5 py-1.5 border transition-colors flex items-center gap-1.5 ${isActive
              ? `${config.color} border-current bg-neutral-800`
              : 'border-neutral-700 text-neutral-400 hover:border-neutral-500'
              }`}
          >
            {config.icon}
            <span className="uppercase"> {count}</span>
          </button>
        );
      })}

      {/* Average rating */}
      {stats.avgRating && (
        <div className="ml-auto flex items-center gap-1 text-xs text-neutral-500">
          <StarIcon filled />
          <span>AVG: {stats.avgRating}</span>
        </div>
      )}
    </div>
  );
};

// ==================== Search Input Component ====================

const SearchInput: React.FC<{
  value: string;
  onChange: (value: string) => void;
}> = ({ value, onChange }) => {
  return (
    <div className="relative">
      <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-neutral-600">
        <SearchIcon />
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search in list..."
        className="w-full bg-black border border-neutral-800 text-white pl-10 pr-8 py-2 text-sm focus:border-neutral-600 focus:outline-none placeholder-neutral-600"
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="absolute inset-y-0 right-0 flex items-center pr-3 text-neutral-600 hover:text-white"
        >
          <span className="text-lg">×</span>
        </button>
      )}
    </div>
  );
};

// ==================== View Toggle Component ====================

const ViewToggle: React.FC<{
  viewMode: ViewMode;
  onChange: (mode: ViewMode) => void;
}> = ({ viewMode, onChange }) => {
  return (
    <div className="flex border border-neutral-800">
      <button
        onClick={() => onChange('grouped')}
        className={`p-2 transition-colors ${viewMode === 'grouped'
          ? 'bg-neutral-800 text-white'
          : 'text-neutral-500 hover:text-white hover:bg-neutral-900'
          }`}
        title="Grouped view"
      >
        <ListIcon />
      </button>
      <button
        onClick={() => onChange('compact')}
        className={`p-2 transition-colors border-l border-neutral-800 ${viewMode === 'compact'
          ? 'bg-neutral-800 text-white'
          : 'text-neutral-500 hover:text-white hover:bg-neutral-900'
          }`}
        title="Compact view"
      >
        <GridIcon />
      </button>
    </div>
  );
};

// ==================== Status Group Header ====================

const StatusGroupHeader: React.FC<{
  config: typeof STATUS_GROUP_CONFIG[0];
  count: number;
  isExpanded: boolean;
  onToggle: () => void;
}> = ({ config, count, isExpanded, onToggle }) => {
  return (
    <button
      onClick={onToggle}
      className={`sticky top-0 z-10 w-full flex items-center gap-3 px-4 py-3 bg-neutral-950 border border-neutral-800 ${config.borderColor} border-l-2 hover:bg-neutral-900 transition-colors`}
    >
      <ChevronIcon expanded={isExpanded} />
      <span className={config.color}>{config.icon}</span>
      <span className={`font-bold uppercase tracking-wider ${config.color}`}>
        {config.label}
      </span>
      <span className="text-neutral-600 text-sm">({count})</span>
    </button>
  );
};

// ==================== Compact Item Card ====================

const CompactItemCard: React.FC<{
  item: MediaItem;
  onUpdate?: (id: string, updates: Partial<MediaItem>) => void;
  onDelete?: (id: string) => void;
  readonly?: boolean;
  searchQuery?: string;
}> = ({ item, onUpdate, onDelete, readonly, searchQuery }) => {
  const progressPercentage = item.total ? Math.min(100, (item.current / item.total) * 100) : 0;
  const config = getStatusConfig(item.status);
  const imageUrl = getRefIdImageUrl(item.imageUrl, item.refId);

  const highlightText = (text: string, query: string) => {
    if (!query) return text;
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === query.toLowerCase()
        ? <mark key={i} className="bg-yellow-500/30 text-white">{part}</mark>
        : part
    );
  };

  return (
    <div className={`group relative flex items-center gap-3 p-2 bg-black border border-neutral-800 ${config.borderColor} border-l-2 hover:border-neutral-600 transition-colors`}>
      {/* Tiny poster - uses ProxiedImageCompact for CLS-safe consistent sizing */}
      <ProxiedImageCompact
        src={imageUrl}
        alt={item.title}
        width={32}
        height={48}
      />

      {/* Title and type */}
      <div className="flex-grow min-w-0">
        <h4 className="font-medium text-sm text-white truncate">
          {highlightText(item.title, searchQuery || '')}
        </h4>
        <div className="flex items-center gap-2 text-xs text-neutral-500">
          <span>{item.type}</span>
          {item.rating != null && (
            <span className="flex items-center gap-0.5">
              <StarIcon filled />
              {item.rating}
            </span>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="hidden sm:flex flex-col items-end gap-1 min-w-[80px]">
        <span className="text-xs font-mono text-neutral-400">
          {item.current}{item.total && `/${item.total}`}
        </span>
        {item.total && (
          <div className="w-full h-1 bg-neutral-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-white transition-all duration-300"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        )}
      </div>

      {/* Quick +1 button */}
      {!readonly && onUpdate && (
        <button
          onClick={() => onUpdate(item.id, { current: item.current + 1 })}
          className="w-8 h-8 flex items-center justify-center border border-neutral-700 text-neutral-400 hover:border-white hover:text-white transition-colors"
        >
          +1
        </button>
      )}

      {/* Delete button */}
      {!readonly && onDelete && (
        <button
          onClick={() => onDelete(item.id)}
          className="opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center text-neutral-600 hover:text-red-500 transition-all"
        >
          ×
        </button>
      )}
    </div>
  );
};

// ==================== Full Item Card (Compact) ====================

const RATING_OPTIONS = [
  { value: null, label: '-' },
  ...Array.from({ length: 11 }, (_, i) => ({ value: i, label: String(i) })),
];

function uniqueFriends(friends: FriendStatus[]): FriendStatus[] {
  const seen = new Set<string>();
  return friends.filter(friend => {
    if (seen.has(friend.id)) return false;
    seen.add(friend.id);
    return true;
  });
}

const MediaItemCard: React.FC<MediaItemCardProps & { onOpenSheet?: (item: MediaItem) => void }> = ({
  item,
  onUpdate,
  onDelete,
  onAddToMyList,
  onItemClick,
  readonly,
  showSuggestButton,
  searchQuery,
  onSuggest,
  onAddToCollection,
  userProgress,
  onOpenSheet,
}) => {
  const { spoilerProtectionEnabled } = useSpoilerProtection();

  const progressPercentage = item.total ? Math.min(100, (item.current / item.total) * 100) : 0;
  const imageUrl = getRefIdImageUrl(item.imageUrl, item.refId);
  const config = getStatusConfig(item.status);

  const friends = item.friendsStatuses ? uniqueFriends(Object.values(item.friendsStatuses).flat()) : [];

  const isSpoiler = readonly && spoilerProtectionEnabled && userProgress !== undefined && item.current > userProgress;

  const playbackProgressPercent = item.activeProgress && !item.activeProgress.completed && item.activeProgress.percentComplete > 0
    ? item.activeProgress.percentComplete
    : undefined;

  // Swipe gesture handling
  const handleSwipeLeft = useCallback(() => {
    if (onUpdate && !readonly) {
      onUpdate(item.id, { current: item.current + 1 });
    }
  }, [onUpdate, readonly, item.id, item.current]);

  const {
    cardRef,
    swipeOffset,
    isTriggered,
    handlers: swipeHandlers,
  } = useSwipeGesture({
    onSwipeLeft: handleSwipeLeft,
    minDistance: 60,
    velocityThreshold: 0.5,
    deadZone: 10,
    maxSwipeDistance: 120,
    enableHaptics: true,
  });

  const highlightText = (text: string, query: string) => {
    if (!query) return text;
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === query.toLowerCase()
        ? <mark key={i} className="bg-yellow-500/30 text-white">{part}</mark>
        : part
    );
  };

  const showActionIndicator = Math.abs(swipeOffset) > 20;
  const actionWidth = Math.min(Math.abs(swipeOffset), 120);

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't open sheet if clicking on interactive elements
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('select') || target.closest('input') || target.closest('a')) return;
    if (onOpenSheet) {
      onOpenSheet(item);
    } else if (onItemClick) {
      onItemClick(item);
    }
  };

  return (
    <div className="relative overflow-hidden swipe-container">
      {/* Swipe action background */}
      {!readonly && (
        <div
          className={`swipe-action-bg ${showActionIndicator ? 'visible' : ''} ${isTriggered ? 'triggered' : ''}`}
          style={{ width: `${actionWidth}px`, backgroundColor: isTriggered ? 'rgb(22, 163, 74)' : 'rgb(34, 197, 94)' }}
        >
          <div className="flex flex-col items-center justify-center text-white">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            <span className="text-[10px] font-bold mt-0.5">+1</span>
          </div>
        </div>
      )}

      <div
        ref={cardRef}
        className={`swipe-card group relative bg-black/60 border border-neutral-800/60 hover:border-neutral-600 hover:bg-neutral-950 transition-all cursor-pointer ${config.borderColor} border-l-2`}
        {...(!readonly ? swipeHandlers : {})}
        style={{ transform: `translateX(${swipeOffset}px)` }}
        onClick={handleCardClick}
      >
        {/* Progress bar at bottom */}
        {item.total && (
          <div className="absolute bottom-0 left-0 h-[2px] bg-neutral-900 w-full">
            <div
              className={`h-full transition-all duration-500 ${progressPercentage === 100 ? 'bg-green-500/80' : 'bg-white/40'}`}
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        )}

        {/* Compact Row: Image | Content | Rating/Friends */}
        <div className="flex items-stretch gap-3 p-2.5 pr-3">

          {/* Poster thumbnail */}
          <div className="flex-shrink-0 relative">
            <SpoilerBlur itemId={`poster-${item.id}`} isSpoiler={isSpoiler} type="image" showIcon={true}>
              <ProxiedImage
                src={imageUrl}
                alt={item.title}
                widthClass="w-12"
                width={48}
                height={72}
                progressPercent={playbackProgressPercent}
              />
            </SpoilerBlur>
          </div>

          {/* Middle: Title / metadata / description */}
          <div className="flex-grow min-w-0 flex flex-col justify-center gap-0.5">
            {/* Title row */}
            <h3 className={`font-semibold text-[13px] leading-tight truncate ${item.status === 'COMPLETED' ? 'text-neutral-500' : 'text-white'}`}>
              {highlightText(item.title, searchQuery || '')}
            </h3>

            {/* Metadata row: genres | release date | playtime | platforms */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {item.genres && item.genres.length > 0 && (
                <span className="text-neutral-500 text-[10px] leading-tight">
                  {item.genres.slice(0, 2).join(' / ')}
                </span>
              )}
              {item.genres && item.genres.length > 0 && (item.year || (item.type === 'GAME' && item.playtimeHours) || (item.type === 'GAME' && item.platforms && item.platforms.length > 0)) && (
                <span className="text-neutral-700 text-[10px]">&middot;</span>
              )}
              {item.year && (
                <span className="text-neutral-600 text-[10px] leading-tight">{item.year}</span>
              )}
              {item.type === 'GAME' && item.playtimeHours && item.playtimeHours > 0 && (
                <>
                  <span className="text-neutral-700 text-[10px]">&middot;</span>
                  <span className="text-neutral-500 text-[10px] leading-tight">~{item.playtimeHours}h</span>
                </>
              )}
              {item.type === 'GAME' && item.platforms && item.platforms.length > 0 && (
                <>
                  <span className="text-neutral-700 text-[10px]">&middot;</span>
                  <span className="text-neutral-500">
                    <GamePlatformIcons platforms={item.platforms} />
                  </span>
                </>
              )}
              {item.type !== 'GAME' && (
                <>
                  {item.year && <span className="text-neutral-700 text-[10px]">&middot;</span>}
                  <span className="text-neutral-600 text-[10px] leading-tight">
                    {item.total ? `${item.total} ${item.type === 'MANGA' ? 'ch' : 'ep'}` : 'Ongoing'}
                  </span>
                </>
              )}
            </div>

            {/* Description snippet */}
            {item.description && (
              <p className="text-neutral-600 text-[10px] leading-snug line-clamp-1 mt-0.5">
                {item.description}
              </p>
            )}

            {/* Resume indicator */}
            {item.activeProgress && !item.activeProgress.completed && item.activeProgress.percentComplete > 0 && (
              <span className="text-red-400/80 flex items-center gap-1 text-[10px] mt-0.5" title={`Resume at ${formatTime(item.activeProgress.currentTime)}`}>
                <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                </svg>
                {item.activeProgress.seasonNumber
                  ? `S${item.activeProgress.seasonNumber}E${item.activeProgress.episodeNumber || '?'}`
                  : `E${item.activeProgress.episodeNumber || '?'}`
                }
              </span>
            )}
          </div>

          {/* Right side: Rating + Friends */}
          <div className="flex-shrink-0 flex flex-col items-end justify-center gap-1.5 min-w-[40px]">
            {/* Rating */}
            {item.rating != null && (
              <div className="flex items-center gap-0.5">
                <StarIcon filled />
                <span className="text-[11px] font-mono text-neutral-300">{item.rating}</span>
              </div>
            )}

            {/* Spoiler indicator */}
            {isSpoiler && <SpoilerIndicator className="" />}

            {/* Friends avatar stack */}
            {friends.length > 0 && (
              <div className="flex -space-x-1.5">
                {friends.slice(0, 3).map((friend, index) => (
                  <div
                    key={friend.id}
                    className="relative"
                    style={{ zIndex: 3 - index }}
                    title={friend.displayName || friend.username}
                  >
                    <FriendAvatar
                      user={{ username: friend.username, avatarUrl: friend.avatarUrl }}
                      size="sm"
                    />
                  </div>
                ))}
                {friends.length > 3 && (
                  <div className="relative w-5 h-5 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center text-[8px] text-neutral-400 font-bold" style={{ zIndex: 0 }}>
                    +{friends.length - 3}
                  </div>
                )}
              </div>
            )}

            {/* Notes indicator */}
            {item.notes && (
              <span className="text-neutral-700 text-[9px]" title="Has notes">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                </svg>
              </span>
            )}
          </div>
        </div>

        {/* Desktop Delete (Hover) */}
        {!readonly && onDelete && (
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}
            className="hidden sm:flex absolute -top-1.5 -right-1.5 w-5 h-5 bg-black border border-neutral-800 text-neutral-500 hover:text-red-500 hover:border-red-900 opacity-0 group-hover:opacity-100 transition-opacity items-center justify-center text-sm leading-none z-10"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
};

// ==================== Media Detail Sheet ====================

interface MediaDetailSheetProps {
  item: MediaItem;
  onUpdate?: (id: string, updates: Partial<MediaItem>) => void;
  onDelete?: (id: string) => void;
  onAddToMyList?: (item: MediaItem) => void;
  onItemClick?: (item: MediaItem) => void;
  readonly?: boolean;
  showSuggestButton?: boolean;
  onSuggest?: (item: MediaItem) => void;
  onClose: () => void;
  userProgress?: number;
}

const STATUS_BUTTON_CONFIG: { value: MediaStatus; label: string; activeClass: string }[] = [
  { value: 'WATCHING', label: 'Watching', activeClass: 'bg-green-500/20 border-green-500 text-green-400' },
  { value: 'READING', label: 'Reading', activeClass: 'bg-green-500/20 border-green-500 text-green-400' },
  { value: 'PLAYING', label: 'Playing', activeClass: 'bg-green-500/20 border-green-500 text-green-400' },
  { value: 'COMPLETED', label: 'Completed', activeClass: 'bg-neutral-500/20 border-neutral-400 text-neutral-300' },
  { value: 'DROPPED', label: 'Dropped', activeClass: 'bg-red-500/15 border-red-500 text-red-400' },
  { value: 'PLAN_TO_WATCH', label: 'Planned', activeClass: 'bg-blue-500/15 border-blue-500 text-blue-400' },
  { value: 'PAUSED', label: 'Paused', activeClass: 'bg-yellow-500/15 border-yellow-500 text-yellow-400' },
];

const MediaDetailSheet: React.FC<MediaDetailSheetProps> = ({
  item,
  onUpdate,
  onDelete,
  onAddToMyList,
  onItemClick,
  readonly,
  showSuggestButton,
  onSuggest,
  onClose,
  userProgress,
}) => {
  const { showToast } = useToast();
  const { user } = useAuth();
  const [sheetStatus, setSheetStatus] = useState<MediaStatus>(item.status);
  const [sheetRating, setSheetRating] = useState<number | null>(item.rating ?? null);
  const [sheetNotes, setSheetNotes] = useState(item.notes || '');
  const [sheetCurrent, setSheetCurrent] = useState(item.current);
  const [isClosing, setIsClosing] = useState(false);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [collectionsLoading, setCollectionsLoading] = useState(false);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  const imageUrl = getRefIdImageUrl(item.imageUrl, item.refId);
  const friends = item.friendsStatuses ? uniqueFriends(Object.values(item.friendsStatuses).flat()) : [];

  // Load collections for the quick-add section
  useEffect(() => {
    if (readonly || !item.refId) return;
    setCollectionsLoading(true);
    getMyCollections()
      .then(data => {
        const editable = data.filter(c => c.myRole === 'OWNER' || c.myRole === 'EDITOR' || c.owner.id === user?.id);
        setCollections(editable);
      })
      .catch(() => setCollections([]))
      .finally(() => setCollectionsLoading(false));
  }, [readonly, item.refId, user?.id]);

  // Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', handleEscape);
    // Prevent body scroll while sheet is open
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, []);

  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => onClose(), 280);
  }, [onClose]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) handleClose();
  };

  const handleSave = useCallback(async () => {
    if (!onUpdate || readonly) {
      handleClose();
      return;
    }

    setSaving(true);

    const updates: Partial<MediaItem> = {};
    if (sheetStatus !== item.status) updates.status = sheetStatus;
    if (sheetRating !== (item.rating ?? null)) updates.rating = sheetRating;
    if (sheetNotes !== (item.notes || '')) updates.notes = sheetNotes || undefined;
    if (sheetCurrent !== item.current) updates.current = sheetCurrent;

    if (Object.keys(updates).length > 0) {
      onUpdate(item.id, updates);
    }

    // Add to selected collection
    if (selectedCollectionId && item.refId) {
      try {
        await addCollectionItem(selectedCollectionId, {
          refId: item.refId,
          title: item.title,
          imageUrl: item.imageUrl,
          type: item.type,
        });
        showToast(`Added to collection`, 'success');
      } catch (err: any) {
        if (err.message?.toLowerCase().includes('already in the collection')) {
          showToast('Already in collection', 'error');
        } else {
          showToast('Failed to add to collection', 'error');
        }
      }
    }

    setSaving(false);
    handleClose();
  }, [onUpdate, readonly, sheetStatus, sheetRating, sheetNotes, sheetCurrent, item, selectedCollectionId, handleClose, showToast]);

  const getFilteredStatusButtons = () => {
    return STATUS_BUTTON_CONFIG.filter(btn => {
      if (item.type === 'GAME') return btn.value !== 'WATCHING' && btn.value !== 'READING';
      if (item.type === 'MANGA') return btn.value !== 'WATCHING' && btn.value !== 'PLAYING';
      return btn.value !== 'READING' && btn.value !== 'PLAYING';
    });
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-end justify-center media-sheet-backdrop ${isClosing ? 'closing' : ''}`}
      onClick={handleBackdropClick}
    >
      <div
        ref={sheetRef}
        className={`media-sheet w-full max-w-lg max-h-[92vh] bg-neutral-950 border-t border-neutral-700/50 overflow-y-auto ${isClosing ? 'closing' : ''}`}
      >
        {/* Banner / Image header */}
        <div className="relative h-44 overflow-hidden bg-neutral-900">
          {imageUrl && (
            <img
              src={imageUrl}
              alt=""
              className="absolute inset-0 w-full h-full object-cover opacity-30 blur-sm scale-110"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/60 to-transparent" />
          {/* Close handle */}
          <div className="absolute top-3 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-neutral-600/50" />
          <button
            onClick={handleClose}
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm text-neutral-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
          {/* Title overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <h2 className="text-lg font-bold text-white leading-tight">{item.title}</h2>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {item.year && <span className="text-neutral-400 text-xs">{item.year}</span>}
              {item.genres && item.genres.length > 0 && (
                <>
                  {item.year && <span className="text-neutral-600 text-xs">&middot;</span>}
                  <span className="text-neutral-400 text-xs">{item.genres.slice(0, 3).join(', ')}</span>
                </>
              )}
              {item.type === 'GAME' && item.platforms && item.platforms.length > 0 && (
                <>
                  <span className="text-neutral-600 text-xs">&middot;</span>
                  <span className="text-neutral-400"><GamePlatformIcons platforms={item.platforms} /></span>
                </>
              )}
              <span className="text-neutral-600 text-xs">&middot;</span>
              <span className="text-neutral-500 text-xs uppercase">{item.type}</span>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-5">

          {/* Status buttons */}
          {!readonly && (
            <div className="space-y-2">
              <label className="text-[10px] text-neutral-500 uppercase tracking-[0.2em]">Status</label>
              <div className="flex flex-wrap gap-1.5">
                {getFilteredStatusButtons().map(btn => {
                  const isActive = sheetStatus === btn.value;
                  return (
                    <button
                      key={btn.value}
                      onClick={() => setSheetStatus(btn.value)}
                      className={`px-3 py-1.5 text-xs border rounded-sm transition-all ${isActive ? btn.activeClass : 'border-neutral-800 text-neutral-500 hover:border-neutral-600 hover:text-neutral-300'}`}
                    >
                      {btn.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {readonly && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-neutral-500 uppercase tracking-[0.2em]">Status:</span>
              <span className="text-xs text-white uppercase">{item.status.replace('_', ' ')}</span>
            </div>
          )}

          {/* Progress */}
          <div className="space-y-2">
            <label className="text-[10px] text-neutral-500 uppercase tracking-[0.2em]">Progress</label>
            {!readonly ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSheetCurrent(Math.max(0, sheetCurrent - 1))}
                  className="w-9 h-9 border border-neutral-800 hover:bg-neutral-900 text-neutral-400 transition-colors rounded-sm flex items-center justify-center"
                >-</button>
                <input
                  type="number"
                  value={sheetCurrent}
                  onChange={(e) => setSheetCurrent(parseInt(e.target.value) || 0)}
                  className="w-16 h-9 bg-black text-center border border-neutral-800 font-mono text-white focus:border-neutral-500 outline-none rounded-sm"
                />
                <button
                  onClick={() => setSheetCurrent(sheetCurrent + 1)}
                  className="w-9 h-9 border border-neutral-800 hover:bg-neutral-900 text-neutral-400 transition-colors rounded-sm flex items-center justify-center"
                >+</button>
                {item.total && (
                  <span className="text-neutral-600 text-xs font-mono">/ {item.total}</span>
                )}
              </div>
            ) : (
              <span className="font-mono text-white text-sm">
                {item.current}{item.total && <span className="text-neutral-600">/{item.total}</span>}
              </span>
            )}
          </div>

          {/* Star Rating - 10 stars */}
          <div className="space-y-2">
            <label className="text-[10px] text-neutral-500 uppercase tracking-[0.2em]">Rating</label>
            {!readonly ? (
              <div className="flex items-center gap-0.5">
                {Array.from({ length: 10 }, (_, i) => i + 1).map(star => {
                  const isFilled = sheetRating !== null && sheetRating >= star;
                  return (
                    <button
                      key={star}
                      onClick={() => setSheetRating(sheetRating === star ? null : star)}
                      className="p-0.5 transition-transform hover:scale-125"
                      title={`${star}/10`}
                    >
                      <svg className={`w-5 h-5 transition-colors ${isFilled ? 'text-amber-400' : 'text-neutral-800 hover:text-neutral-600'}`} fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    </button>
                  );
                })}
                {sheetRating !== null && (
                  <span className="ml-2 text-xs font-mono text-neutral-400">{sheetRating}/10</span>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-1">
                {item.rating != null ? (
                  <>
                    <div className="flex items-center gap-0.5">
                      {Array.from({ length: 10 }, (_, i) => (
                        <svg key={i} className={`w-4 h-4 ${i < (item.rating ?? 0) ? 'text-amber-400' : 'text-neutral-800'}`} fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      ))}
                    </div>
                    <span className="ml-1 text-xs font-mono text-neutral-400">{item.rating}/10</span>
                  </>
                ) : (
                  <span className="text-xs text-neutral-600">No rating</span>
                )}
              </div>
            )}
          </div>

          {/* Private Note */}
          <div className="space-y-2">
            <label className="text-[10px] text-neutral-500 uppercase tracking-[0.2em]">Private Note</label>
            {!readonly ? (
              <textarea
                value={sheetNotes}
                onChange={(e) => setSheetNotes(e.target.value)}
                placeholder="Your thoughts..."
                className="w-full bg-black/50 border border-neutral-800 p-3 text-sm text-white placeholder-neutral-700 focus:border-neutral-600 outline-none resize-none min-h-[72px] rounded-sm"
              />
            ) : (
              <p className="text-sm text-neutral-400 whitespace-pre-wrap">
                {item.notes || <span className="text-neutral-700 italic">No notes</span>}
              </p>
            )}
          </div>

          {/* Quick add to collection */}
          {!readonly && item.refId && (
            <div className="space-y-2">
              <label className="text-[10px] text-neutral-500 uppercase tracking-[0.2em]">Add to Collection</label>
              {collectionsLoading ? (
                <div className="text-[10px] text-neutral-600 uppercase animate-pulse py-2">Loading...</div>
              ) : collections.length === 0 ? (
                <div className="text-[10px] text-neutral-700 py-2">No collections available</div>
              ) : (
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                  {collections.slice(0, 8).map(col => {
                    const isSelected = selectedCollectionId === col.id;
                    return (
                      <button
                        key={col.id}
                        onClick={() => setSelectedCollectionId(isSelected ? null : col.id)}
                        className={`px-2.5 py-1.5 text-[10px] border rounded-sm transition-all uppercase tracking-wider ${isSelected
                          ? 'border-white bg-white/10 text-white'
                          : 'border-neutral-800 text-neutral-500 hover:border-neutral-600'
                          }`}
                      >
                        {col.title}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Friends watching */}
          {friends.length > 0 && (
            <div className="space-y-2">
              <label className="text-[10px] text-neutral-500 uppercase tracking-[0.2em]">Friends</label>
              <div className="space-y-1.5">
                {friends.map(friend => (
                  <div key={friend.id} className="flex items-center gap-2.5 py-1.5 px-2 bg-black/30 border border-neutral-800/50 rounded-sm">
                    <FriendAvatar user={{ username: friend.username, avatarUrl: friend.avatarUrl }} size="sm" />
                    <div className="flex-grow min-w-0">
                      <span className="text-xs text-neutral-300 truncate block">{friend.displayName || friend.username}</span>
                      <span className="text-[10px] text-neutral-600 uppercase">{friend.status.replace('_', ' ')}</span>
                    </div>
                    {friend.rating != null && (
                      <div className="flex items-center gap-0.5 text-[10px] text-neutral-500">
                        <StarIcon filled />
                        <span className="font-mono">{friend.rating}</span>
                      </div>
                    )}
                    <span className="text-[10px] text-neutral-600 font-mono">{friend.current}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Readonly actions */}
          {readonly && onAddToMyList && (
            <button
              onClick={() => { onAddToMyList(item); handleClose(); }}
              className="w-full py-2.5 text-xs font-bold uppercase tracking-wider border border-neutral-600 text-neutral-300 hover:border-white hover:text-white transition-colors rounded-sm"
            >
              + Add to My List
            </button>
          )}

          {/* Suggest to friend */}
          {showSuggestButton && item.refId && onSuggest && (
            <button
              onClick={() => { onSuggest(item); handleClose(); }}
              className="w-full py-2.5 text-xs uppercase tracking-wider border border-neutral-800 text-neutral-500 hover:border-neutral-600 hover:text-neutral-300 transition-colors rounded-sm"
            >
              Suggest to Friend
            </button>
          )}

          {/* Save button */}
          {!readonly && onUpdate && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full py-3 text-xs font-bold uppercase tracking-[0.15em] bg-white text-black hover:bg-neutral-200 transition-colors rounded-sm disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          )}

          {/* Delete */}
          {!readonly && onDelete && (
            <button
              onClick={() => { onDelete(item.id); handleClose(); }}
              className="w-full py-2 text-[10px] uppercase tracking-wider text-neutral-700 hover:text-red-500 transition-colors"
            >
              Remove from List
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// ==================== Status Group Component ====================

const StatusGroup: React.FC<{
  config: typeof STATUS_GROUP_CONFIG[0];
  items: MediaItem[];
  totalCount: number;
  isExpanded: boolean;
  onToggle: () => void;
  onUpdate?: (id: string, updates: Partial<MediaItem>) => void;
  onDelete?: (id: string) => void;
  onAddToMyList?: (item: MediaItem) => void;
  onItemClick?: (item: MediaItem) => void;
  readonly?: boolean;
  showSuggestButton?: boolean;
  viewMode: ViewMode;
  searchQuery?: string;
  onSuggest?: (item: MediaItem) => void;
  onAddToCollection?: (item: MediaItem) => void;
  onOpenSheet?: (item: MediaItem) => void;
  // Pagination
  pagination?: StatusGroupPagination;
  isLoading?: boolean;
  onPageChange?: (page: number) => void;
  // User's progress map for spoiler detection
  userProgressMap?: Map<string, number>;
}> = ({
  config,
  items,
  totalCount,
  isExpanded,
  onToggle,
  onUpdate,
  onDelete,
  onAddToMyList,
  onItemClick,
  readonly,
  showSuggestButton,
  viewMode,
  searchQuery,
  onSuggest,
  onAddToCollection,
  onOpenSheet,
  pagination,
  isLoading = false,
  onPageChange,
  userProgressMap,
}) => {
    // Use totalCount (which accounts for filtering) for display, but items.length for empty check
    if (totalCount === 0) return null;

    const itemsPerPage = 50;
    const totalPages = pagination ? Math.ceil(pagination.total / itemsPerPage) : 1;

    return (
      <div className="space-y-2">
        <StatusGroupHeader
          config={config}
          count={totalCount}
          isExpanded={isExpanded}
          onToggle={onToggle}
        />

        {isExpanded && (
          <>
            <div className={`space-y-1 pl-0 sm:pl-2 animate-fadeIn ${viewMode === 'compact' ? 'grid grid-cols-1 gap-1' : ''}`}>
              {items.map((item) => (
                viewMode === 'compact' ? (
                  <CompactItemCard
                    key={item.id}
                    item={item}
                    onUpdate={onUpdate}
                    onDelete={onDelete}
                    readonly={readonly}
                    searchQuery={searchQuery}
                  />
                ) : (
                  <MediaItemCard
                    key={item.id}
                    item={item}
                    onUpdate={onUpdate}
                    onDelete={onDelete}
                    onAddToMyList={onAddToMyList}
                    onItemClick={onItemClick}
                    readonly={readonly}
                    showSuggestButton={showSuggestButton}
                    searchQuery={searchQuery}
                    onSuggest={onSuggest}
                    onAddToCollection={onAddToCollection}
                    onOpenSheet={onOpenSheet}
                    userProgress={item.refId ? userProgressMap?.get(item.refId) : undefined}
                  />
                )
              ))}
            </div>

            {/* Pagination controls */}
            {pagination && onPageChange && totalPages > 1 && (
              <div className="pl-0 sm:pl-2">
                <PaginationControls
                  currentPage={pagination.page}
                  totalPages={totalPages}
                  totalItems={pagination.total}
                  itemsPerPage={itemsPerPage}
                  isLoading={isLoading}
                  onPageChange={onPageChange}
                />
              </div>
            )}
          </>
        )}
      </div>
    );
  };

// ==================== Pagination Controls Component ====================

const PaginationControls: React.FC<{
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  isLoading: boolean;
  onPageChange: (page: number) => void;
}> = ({ currentPage, totalPages, totalItems, itemsPerPage, isLoading, onPageChange }) => {
  if (totalPages <= 1) return null;

  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  // Generate page numbers to show
  const getPageNumbers = () => {
    const pages: (number | 'ellipsis')[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      // Always show first page
      pages.push(1);

      if (currentPage > 3) {
        pages.push('ellipsis');
      }

      // Show pages around current
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);

      for (let i = start; i <= end; i++) {
        if (!pages.includes(i)) pages.push(i);
      }

      if (currentPage < totalPages - 2) {
        pages.push('ellipsis');
      }

      // Always show last page
      if (!pages.includes(totalPages)) pages.push(totalPages);
    }

    return pages;
  };

  return (
    <div className="flex items-center justify-between gap-4 py-3 px-2 bg-neutral-950 border border-neutral-800 rounded text-xs">
      {/* Item count */}
      <span className="text-neutral-500 hidden sm:inline">
        {startItem}-{endItem} of {totalItems}
      </span>

      {/* Page controls */}
      <div className="flex items-center gap-1 mx-auto sm:mx-0">
        {/* Previous */}
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1 || isLoading}
          className="px-2 py-1 border border-neutral-700 text-neutral-400 hover:border-neutral-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          &larr;
        </button>

        {/* Page numbers */}
        {getPageNumbers().map((page, idx) => (
          page === 'ellipsis' ? (
            <span key={`ellipsis-${idx}`} className="px-2 text-neutral-600">...</span>
          ) : (
            <button
              key={page}
              onClick={() => onPageChange(page)}
              disabled={isLoading}
              className={`min-w-[28px] px-2 py-1 border transition-colors ${page === currentPage
                ? 'border-white text-white bg-neutral-800'
                : 'border-neutral-700 text-neutral-400 hover:border-neutral-500 hover:text-white'
                } disabled:opacity-50`}
            >
              {page}
            </button>
          )
        ))}

        {/* Next */}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages || isLoading}
          className="px-2 py-1 border border-neutral-700 text-neutral-400 hover:border-neutral-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          &rarr;
        </button>
      </div>

      {/* Loading indicator */}
      {isLoading && (
        <svg className="animate-spin h-4 w-4 text-neutral-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      )}
    </div>
  );
};

// ==================== Main MediaList Component ====================

export const MediaList: React.FC<MediaListProps> = ({
  title,
  items,
  groupedData,
  mediaTypeFilter,
  defaultTypeFilter,
  onUpdate,
  onDelete,
  onAddToMyList,
  onItemClick,
  readonly,
  filterStatus = '',
  friendActivityFilter = '',
  sortBy = 'status',
  onFilterChange,
  onFriendActivityFilterChange,
  onSortChange,
  showSuggestButton = false,
  // Per-status pagination
  onPageChange,
  loadingStatuses,
  // User's progress map for spoiler detection
  userProgressMap,
}) => {
  // View mode state (persisted)
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    try {
      const saved = localStorage.getItem(VIEW_MODE_KEY);
      return (saved === 'compact' || saved === 'grouped') ? saved : 'grouped';
    } catch {
      return 'grouped';
    }
  });

  // Search state
  const [searchQuery, setSearchQuery] = useState('');

  const initialTypeFilter = useMemo<LibraryTypeFilter>(() => {
    if (defaultTypeFilter) return defaultTypeFilter;
    if (mediaTypeFilter) return mediaTypeFilter;
    return 'all';
  }, [defaultTypeFilter, mediaTypeFilter]);

  const [typeFilter, setTypeFilter] = useState<LibraryTypeFilter>(initialTypeFilter);
  const [statusTab, setStatusTab] = useState<StatusTabValue>(() => getStatusTabFromFilter(filterStatus));

  // Suggest modal state (lifted from MediaItemCard)
  const [suggestItem, setSuggestItem] = useState<MediaItem | null>(null);

  // Add to Collection modal state
  const [addToCollectionItem, setAddToCollectionItem] = useState<MediaItem | null>(null);

  // Detail sheet state
  const [sheetItem, setSheetItem] = useState<MediaItem | null>(null);

  const handleOpenSheet = useCallback((item: MediaItem) => {
    setSheetItem(item);
  }, []);

  // Save view mode to localStorage
  useEffect(() => {
    localStorage.setItem(VIEW_MODE_KEY, viewMode);
  }, [viewMode]);

  useEffect(() => {
    setTypeFilter(initialTypeFilter);
  }, [initialTypeFilter]);

  useEffect(() => {
    setStatusTab(getStatusTabFromFilter(filterStatus));
  }, [filterStatus]);

  const isOwnList = !readonly;

  const statusTabCounts = useMemo(() => {
    const counts: Record<StatusTabValue, number> = {
      all: 0,
      active: 0,
      completed: 0,
      dropped: 0,
      planned: 0,
      paused: 0,
    };

    items.forEach(item => {
      if (!matchesTypeFilter(item, typeFilter)) return;
      counts.all += 1;
      if (matchesStatusTab(item, 'active')) counts.active += 1;
      if (matchesStatusTab(item, 'completed')) counts.completed += 1;
      if (matchesStatusTab(item, 'dropped')) counts.dropped += 1;
      if (matchesStatusTab(item, 'planned')) counts.planned += 1;
      if (matchesStatusTab(item, 'paused')) counts.paused += 1;
    });

    return counts;
  }, [items, typeFilter]);

  let filteredItems = items.filter(item => matchesTypeFilter(item, typeFilter));

  if (statusTab !== 'all') {
    filteredItems = filteredItems.filter(item => matchesStatusTab(item, statusTab));
  }

  // Apply friend activity filter
  if (friendActivityFilter) {
    filteredItems = filteredItems.filter(item => {
      const friendsStatuses = item.friendsStatuses || [];
      if (friendsStatuses.length === 0) return false;

      switch (friendActivityFilter) {
        case 'friends_watching':
          return friendsStatuses.some(f => f.status === 'WATCHING' || f.status === 'READING');
        case 'friends_done':
          return friendsStatuses.some(f => f.status === 'COMPLETED');
        case 'friends_dropped':
          return friendsStatuses.some(f => f.status === 'DROPPED');
        default:
          return true;
      }
    });
  }

  // Apply search filter
  if (searchQuery) {
    const query = searchQuery.toLowerCase();
    filteredItems = filteredItems.filter(item =>
      item.title.toLowerCase().includes(query)
    );
  }

  const sortedItems = useMemo(() => {
    const sorted = [...filteredItems];

    sorted.sort((a, b) => {
      switch (sortBy) {
        case 'title':
          return a.title.localeCompare(b.title);
        case 'rating':
          return (b.rating ?? -1) - (a.rating ?? -1) || a.title.localeCompare(b.title);
        case 'status':
          return getStatusSortRank(a.status) - getStatusSortRank(b.status) || a.title.localeCompare(b.title);
        case 'updatedAt':
        case 'createdAt':
        default:
          return a.title.localeCompare(b.title);
      }
    });

    return sorted;
  }, [filteredItems, sortBy]);

  const handleStatusTabChange = useCallback((nextTab: StatusTabValue) => {
    setStatusTab(nextTab);
    onFilterChange?.(getStatusForExternalFilter(nextTab, typeFilter));
  }, [onFilterChange, typeFilter]);

  const handleTypeFilterChange = useCallback((nextType: LibraryTypeFilter) => {
    setTypeFilter(nextType);
    if (statusTab !== 'all') {
      onFilterChange?.(getStatusForExternalFilter(statusTab, nextType));
    }
  }, [onFilterChange, statusTab]);

  if (items.length === 0) {
    return (
      <div className="py-12 text-center text-neutral-600 border border-neutral-800 border-dashed">
        <h2 className="text-lg font-bold mb-2 uppercase">{title}</h2>
        <p className="text-sm">NO ITEMS FOUND</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-neutral-900 pb-4">
        <div className="flex flex-col gap-3  ">
          <div className="space-y-1">
            <h2 className="text-sm font-bold text-neutral-500 uppercase tracking-[0.35em]">{title}</h2>
            <p className="text-xs uppercase tracking-[0.28em] text-neutral-700">
              Unified queue for video, manga, and games
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <ViewToggle viewMode={viewMode} onChange={setViewMode} />
            {onSortChange && (
              <label className="flex items-center gap-2 rounded-full border border-neutral-800 bg-neutral-950 px-3 py-2 text-[11px] uppercase tracking-[0.25em] text-neutral-500">
                <span>Sort</span>
                <select
                  value={sortBy}
                  onChange={(e) => onSortChange(e.target.value as SortBy)}
                  className="bg-transparent text-white outline-none"
                >
                  {SORT_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value} className="bg-black text-white">
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        </div>
      </div>

      <div  >
        <div className="flex flex-col gap-4">
          <div className="flex   gap-2 overflow-x-auto hidden-scrollbar">
            {STATUS_TAB_OPTIONS.map((tab) => {
              const isActive = statusTab === tab.value;
              return (
                <button
                  key={tab.value}
                  onClick={() => handleStatusTabChange(tab.value)}
                  className={`flex relative h-fit rounded-[50px] p-[10px] px-[15px] rounded-full border text-[11px] uppercase tracking-[0.28em] transition-colors ${isActive
                    ? 'border-white bg-white text-black'
                    : 'border-neutral-800 bg-black/40 text-neutral-400 hover:border-neutral-600 hover:text-white'
                    }`}
                >
                  {tab.label}
                  <span className="ml-1 opacity-70">{statusTabCounts[tab.value]}</span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              {TYPE_FILTER_OPTIONS.map((option) => {
                const active = typeFilter === option.value;
                return (
                  <button
                    key={option.value}
                    onClick={() => handleTypeFilterChange(option.value)}
                    className={`rounded-full px-3 py-1.5 text-[11px] uppercase tracking-[0.24em] transition-colors ${active
                      ? 'bg-neutral-200 text-black'
                      : 'bg-neutral-900 text-neutral-400 hover:bg-neutral-800 hover:text-white'
                      }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="min-w-[220px] sm:min-w-[260px]">
                <SearchInput value={searchQuery} onChange={setSearchQuery} />
              </div>
              {isOwnList && onFriendActivityFilterChange && (
                <label className="flex items-center gap-2 rounded-full border border-neutral-800 bg-black/40 px-3 py-2 text-[11px] uppercase tracking-[0.25em] text-neutral-500">
                  <span>Friends</span>
                  <select
                    value={friendActivityFilter}
                    onChange={(e) => onFriendActivityFilterChange(e.target.value as FriendActivityFilter)}
                    className="bg-transparent text-white outline-none"
                  >
                    {FRIEND_ACTIVITY_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value} className="bg-black text-white">
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Items count when filtered */}
      {(statusTab !== 'all' || typeFilter !== 'all' || friendActivityFilter || searchQuery) && (
        <div className="text-xs text-neutral-600 uppercase flex items-center gap-2">
          <span>Showing {filteredItems.length} of {groupedData?.grandTotal ?? items.length} items</span>
          {(statusTab !== 'all' || typeFilter !== 'all' || searchQuery || friendActivityFilter) && (
            <button
              onClick={() => {
                if (onFilterChange) onFilterChange('');
                setStatusTab('all');
                setTypeFilter(initialTypeFilter);
                setSearchQuery('');
                onFriendActivityFilterChange?.('');
              }}
              className="text-neutral-500 hover:text-white underline"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* Grouped List */}
      {filteredItems.length === 0 ? (
        <div className="py-8 text-center text-neutral-600 border border-neutral-800 border-dashed">
          <p className="text-sm">NO ITEMS MATCH FILTER</p>
          <button
            onClick={() => {
              if (onFilterChange) onFilterChange('');
              setStatusTab('all');
              setTypeFilter(initialTypeFilter);
              setSearchQuery('');
              onFriendActivityFilterChange?.('');
            }}
            className="mt-2 text-xs text-neutral-500 hover:text-white underline"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className={`gap-1.5 ${viewMode === 'compact' ? 'grid grid-cols-1' : 'space-y-1.5'}`}>
          {sortedItems.map((item) => (
            viewMode === 'compact' ? (
              <CompactItemCard
                key={item.id}
                item={item}
                onUpdate={onUpdate}
                onDelete={onDelete}
                readonly={readonly}
                searchQuery={searchQuery}
              />
            ) : (
              <MediaItemCard
                key={item.id}
                item={item}
                onUpdate={onUpdate}
                onDelete={onDelete}
                onAddToMyList={onAddToMyList}
                onItemClick={onItemClick}
                readonly={readonly}
                showSuggestButton={showSuggestButton}
                searchQuery={searchQuery}
                onSuggest={setSuggestItem}
                onAddToCollection={setAddToCollectionItem}
                onOpenSheet={handleOpenSheet}
                userProgress={item.refId ? userProgressMap?.get(item.refId) : undefined}
              />
            )
          ))}
        </div>
      )}

      {/* Mobile hint for swipe */}
      {!readonly && (
        <div className="sm:hidden text-center text-xs text-neutral-700 py-2">
          Swipe left on an item to increment progress
        </div>
      )}

      {/* Suggest to Friend Modal - lifted to MediaList level */}
      {suggestItem && (
        <SuggestToFriendModal
          item={suggestItem}
          onClose={() => setSuggestItem(null)}
        />
      )}

      {/* Add to Collection Modal */}
      {addToCollectionItem && (
        <AddToCollectionModal
          item={{
            id: addToCollectionItem.id,
            title: addToCollectionItem.title,
            type: addToCollectionItem.type,
            imageUrl: addToCollectionItem.imageUrl,
            refId: addToCollectionItem.refId,
            total: addToCollectionItem.total,
          }}
          onClose={() => setAddToCollectionItem(null)}
        />
      )}

      {/* Media Detail Sheet */}
      {sheetItem && (
        <MediaDetailSheet
          item={sheetItem}
          onUpdate={onUpdate}
          onDelete={onDelete}
          onAddToMyList={onAddToMyList}
          onItemClick={onItemClick}
          readonly={readonly}
          showSuggestButton={showSuggestButton}
          onSuggest={setSuggestItem}
          onClose={() => setSheetItem(null)}
          userProgress={sheetItem.refId ? userProgressMap?.get(sheetItem.refId) : undefined}
        />
      )}
    </div>
  );
};
