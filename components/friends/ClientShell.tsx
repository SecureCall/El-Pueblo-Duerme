'use client';

import { useEffect } from 'react';
import { useAuth } from '@/app/providers/AuthProvider';
import { ensureUserProfile, setPresence } from '@/lib/firebase/friends';
import { InviteNotification } from './InviteNotification';

export function ClientShell({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    ensureUserProfile(user.uid, user.displayName ?? 'Jugador', user.photoURL ?? '').catch(() => {});
    setPresence(user.uid, user.displayName ?? 'Jugador', user.photoURL ?? '', true).catch(() => {});

    const handleBeforeUnload = () => {
      setPresence(user.uid, user.displayName ?? 'Jugador', user.photoURL ?? '', false).catch(() => {});
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    const interval = setInterval(() => {
      setPresence(user.uid, user.displayName ?? 'Jugador', user.photoURL ?? '', true).catch(() => {});
    }, 60000);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      clearInterval(interval);
      setPresence(user.uid, user.displayName ?? 'Jugador', user.photoURL ?? '', false).catch(() => {});
    };
  }, [user]);

  return (
    <>
      {children}
      <InviteNotification />
    </>
  );
}
