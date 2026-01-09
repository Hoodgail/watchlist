import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AuthUser, LoginCredentials, RegisterCredentials } from '../types';
import * as api from '../services/api';

// Key for caching user in localStorage for offline access
const CACHED_USER_KEY = 'watchlist_cached_user';

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isOfflineAuthenticated: boolean; // True when user is loaded from cache due to network failure
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (credentials: RegisterCredentials) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  initiateOAuthLogin: (provider: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

interface AuthProviderProps {
  children: React.ReactNode;
}

// Helper to cache user in localStorage
const cacheUser = (user: AuthUser | null) => {
  if (user) {
    localStorage.setItem(CACHED_USER_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(CACHED_USER_KEY);
  }
};

// Helper to get cached user from localStorage
const getCachedUser = (): AuthUser | null => {
  try {
    const cached = localStorage.getItem(CACHED_USER_KEY);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (error) {
    console.error('Failed to parse cached user:', error);
  }
  return null;
};

// Check if error is a network error
const isNetworkError = (error: unknown): boolean => {
  if (error instanceof Error) {
    // Check for common network error indicators
    return (
      error.message.includes('Network Error') ||
      error.message.includes('Failed to fetch') ||
      error.message.includes('net::ERR_') ||
      error.message.includes('NetworkError') ||
      error.name === 'TypeError' // fetch throws TypeError on network failure
    );
  }
  return false;
};

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOfflineAuthenticated, setIsOfflineAuthenticated] = useState(false);

  // Check for existing session on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const currentUser = await api.getCurrentUser();
        setUser(currentUser);
        setIsOfflineAuthenticated(false);
        // Cache the user for offline access
        cacheUser(currentUser);
      } catch (error) {
        console.error('Auth check failed:', error);
        
        // If it's a network error and we have a cached user, use offline authentication
        if (isNetworkError(error) || !navigator.onLine) {
          const cachedUser = getCachedUser();
          if (cachedUser) {
            console.log('[Auth] Using cached user for offline mode');
            setUser(cachedUser);
            setIsOfflineAuthenticated(true);
          } else {
            setUser(null);
            setIsOfflineAuthenticated(false);
          }
        } else {
          // Not a network error (e.g., 401 unauthorized) - clear cached user
          setUser(null);
          setIsOfflineAuthenticated(false);
          cacheUser(null);
        }
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = useCallback(async (credentials: LoginCredentials) => {
    const response = await api.login(credentials);
    setUser(response.user);
    setIsOfflineAuthenticated(false);
    cacheUser(response.user);
  }, []);

  const register = useCallback(async (credentials: RegisterCredentials) => {
    const response = await api.register(credentials);
    setUser(response.user);
    setIsOfflineAuthenticated(false);
    cacheUser(response.user);
  }, []);

  const logout = useCallback(async () => {
    await api.logout();
    setUser(null);
    setIsOfflineAuthenticated(false);
    cacheUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const currentUser = await api.getCurrentUser();
      setUser(currentUser);
      setIsOfflineAuthenticated(false);
      cacheUser(currentUser);
    } catch (error) {
      console.error('Failed to refresh user:', error);
    }
  }, []);

  const initiateOAuthLogin = useCallback(async (provider: string) => {
    try {
      const authUrl = await api.getOAuthUrl(provider);
      // Redirect to OAuth provider
      window.location.href = authUrl;
    } catch (error) {
      console.error('Failed to initiate OAuth login:', error);
      throw error;
    }
  }, []);

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    isOfflineAuthenticated,
    login,
    register,
    logout,
    refreshUser,
    initiateOAuthLogin,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
