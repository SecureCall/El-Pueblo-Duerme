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

    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then(async (reg) => {
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

        if (navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({ type: 'CACHE_PAGE', url: '/' });
        } else {
          navigator.serviceWorker.addEventListener('controllerchange', () => {
            navigator.serviceWorker.controller?.postMessage({ type: 'CACHE_PAGE', url: '/' });
          }, { once: true });
        }

        if ('periodicSync' in reg) {
          try {
            const status = await navigator.permissions.query({
              name: 'periodic-background-sync' as PermissionName,
            });
            if (status.state === 'granted') {
              await (reg as unknown as { periodicSync: { register: (tag: string, opts: object) => Promise<void> } }).periodicSync.register('refresh-content', {
                minInterval: 24 * 60 * 60 * 1000,
              });
              await (reg as unknown as { periodicSync: { register: (tag: string, opts: object) => Promise<void> } }).periodicSync.register('update-widget-data', {
                minInterval: 5 * 60 * 1000,
              });
            }
          } catch {
            // periodic sync not available — non-critical
          }
        }
      })
      .catch((err) => console.warn('[SW] Error al registrar:', err));

    // The service worker cannot access Firebase Auth directly. For queued
    // votes it asks the controlled page for a fresh ID token instead of
    // persisting an auth token in IndexedDB.
    const handleMessage = async (event: MessageEvent) => {
      if (event.data?.type === 'REQUEST_SYNC_AUTH') {
        const port = event.ports?.[0];
        if (!port) return;
        try {
          const token = user ? await user.getIdToken(true) : null;
          port.postMessage({ type: 'SYNC_AUTH_RESPONSE', token });
        } catch {
          port.postMessage({ type: 'SYNC_AUTH_RESPONSE', token: null });
        }
        return;
      }

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
    return () => navigator.serviceWorker.removeEventListener('message', handleMessage, false);
  }, [router, user]);

  useEffect(() => {
    if (!user?.uid) return;
    if (!('Notification' in window)) return;
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
