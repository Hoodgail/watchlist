import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const SPOILER_PROTECTION_KEY = 'spoiler_protection_enabled';

interface SpoilerContextType {
  spoilerProtectionEnabled: boolean;
  setSpoilerProtectionEnabled: (enabled: boolean) => void;
  revealedItems: Set<string>;
  revealItem: (itemId: string) => void;
  hideItem: (itemId: string) => void;
  isRevealed: (itemId: string) => boolean;
}

const SpoilerContext = createContext<SpoilerContextType | null>(null);

export function useSpoilerProtection(): SpoilerContextType {
  const context = useContext(SpoilerContext);
  if (!context) {
    throw new Error('useSpoilerProtection must be used within a SpoilerProvider');
  }
  return context;
}

interface SpoilerProviderProps {
  children: React.ReactNode;
}

export const SpoilerProvider: React.FC<SpoilerProviderProps> = ({ children }) => {
  // Load initial state from localStorage
  const [spoilerProtectionEnabled, setSpoilerProtectionEnabledState] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem(SPOILER_PROTECTION_KEY);
      return stored !== null ? JSON.parse(stored) : true; // Default to enabled
    } catch {
      return true;
    }
  });

  // Track temporarily revealed items (session-only, not persisted)
  const [revealedItems, setRevealedItems] = useState<Set<string>>(new Set());

  // Persist setting changes
  const setSpoilerProtectionEnabled = useCallback((enabled: boolean) => {
    setSpoilerProtectionEnabledState(enabled);
    try {
      localStorage.setItem(SPOILER_PROTECTION_KEY, JSON.stringify(enabled));
    } catch (error) {
      console.error('Failed to save spoiler protection setting:', error);
    }
    // Clear revealed items when toggling protection
    if (enabled) {
      setRevealedItems(new Set());
    }
  }, []);

  // Temporarily reveal an item
  const revealItem = useCallback((itemId: string) => {
    setRevealedItems(prev => new Set(prev).add(itemId));
  }, []);

  // Hide a previously revealed item
  const hideItem = useCallback((itemId: string) => {
    setRevealedItems(prev => {
      const next = new Set(prev);
      next.delete(itemId);
      return next;
    });
  }, []);

  // Check if an item is currently revealed
  const isRevealed = useCallback((itemId: string) => {
    return revealedItems.has(itemId);
  }, [revealedItems]);

  const value: SpoilerContextType = {
    spoilerProtectionEnabled,
    setSpoilerProtectionEnabled,
    revealedItems,
    revealItem,
    hideItem,
    isRevealed,
  };

  return <SpoilerContext.Provider value={value}>{children}</SpoilerContext.Provider>;
};

/**
 * Determines if friend's progress on a show is ahead of user's progress
 * @param userProgress - User's current episode/chapter number
 * @param friendProgress - Friend's current episode/chapter number
 * @returns true if friend is ahead (potential spoiler)
 */
export function isSpoiler(userProgress: number, friendProgress: number): boolean {
  return friendProgress > userProgress;
}
