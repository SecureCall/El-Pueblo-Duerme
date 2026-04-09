'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { subscribeToPush } from '@/lib/firebase/push';
import { useAuth } from '@/app/providers/AuthProvider';

export function RegisterSW() {
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    // Register the service worker
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((reg) => {
        console.log('[SW] Registrado:', reg.scope);

        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('[SW] Nueva versión disponible.');
              }
            });
          }
        });
      })
      .catch((err) => console.warn('[SW] Error al registrar:', err));

    // launch_handler: listen for NAVIGATE messages from the SW (focus-existing behavior).
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'NAVIGATE' && typeof event.data.url === 'string') {
        try {
          const target = new URL(event.data.url);
          router.push(target.pathname + target.search + target.hash);
        } catch {
          // ignore malformed URLs
        }
      }
    };

    navigator.serviceWorker.addEventListener('message', handleMessage);
    return () => navigator.serviceWorker.removeEventListener('message', handleMessage);
  }, [router]);

  // ── Push subscription: subscribe once the user is logged in ──────────────
  useEffect(() => {
    if (!user?.uid) return;
    if (!('Notification' in window)) return;
    // Only attempt if permission is already granted (don't prompt automatically —
    // the UI should call subscribeToPush() explicitly when the user opts in)
    if (Notification.permission !== 'granted') return;

    subscribeToPush().then(async (sub) => {
      if (!sub) return;
      try {
        await fetch('/api/push-subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uid: user.uid, subscription: sub.toJSON() }),
        });
      } catch {
        // non-critical
      }
    });
  }, [user?.uid]);

  return null;
}
