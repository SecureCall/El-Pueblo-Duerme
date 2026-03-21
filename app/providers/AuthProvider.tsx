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

  return <AuthContext.Provider value={authState}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextState => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider.');
  }
  return context;
};
