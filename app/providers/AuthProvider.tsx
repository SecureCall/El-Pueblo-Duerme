'use client';

import React, { createContext, useContext, ReactNode, useState, useEffect } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase/config';
import { handleRedirectResult } from '@/lib/firebase/auth-social';

interface AuthContextState {
  user: User | null;
  isLoading: boolean;
  error: Error | null;
  redirectError: string | null;
}

const AuthContext = createContext<AuthContextState | undefined>(undefined);

/**
 * Adds a Firebase ID token to the two AI routes that are called directly
 * from the client. This keeps existing callers simple while preventing
 * unauthenticated public access to Gemini-backed endpoints.
 */
function installAiApiAuth(user: User | null): () => void {
  if (typeof window === 'undefined') return () => {};

  const originalFetch = window.fetch.bind(window);
  const protectedPaths = new Set(['/api/ai-chat', '/api/wolf-agree', '/api/narrator']);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.pathname : input.url;
    const pathname = (() => {
      try { return new URL(url, window.location.origin).pathname; } catch { return url; }
    })();

    if (!user || !protectedPaths.has(pathname)) {
      return originalFetch(input, init);
    }

    try {
      const token = await user.getIdToken();
      if (!token) return originalFetch(input, init);

      const headers = new Headers(input instanceof Request ? input.headers : undefined);
      if (init?.headers) new Headers(init.headers).forEach((value, key) => headers.set(key, value));
      if (!headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);

      return originalFetch(input, { ...init, headers });
    } catch {
      return originalFetch(input, init);
    }
  };

  return () => { window.fetch = originalFetch; };
}

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [authState, setAuthState] = useState<AuthContextState>({
    user: null,
    isLoading: true,
    error: null,
    redirectError: null,
  });

  useEffect(() => {
    handleRedirectResult().then(({ error }) => {
      if (error) {
        setAuthState(prev => ({ ...prev, redirectError: error }));
      }
    });

    const unsubscribe = onAuthStateChanged(
      auth,
      (user) => setAuthState(prev => ({ ...prev, user, isLoading: false, error: null })),
      (error) => setAuthState(prev => ({ ...prev, user: null, isLoading: false, error }))
    );
    return () => unsubscribe();
  }, []);

  useEffect(() => installAiApiAuth(authState.user), [authState.user?.uid]);

  return <AuthContext.Provider value={authState}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextState => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider.');
  }
  return context;
};
