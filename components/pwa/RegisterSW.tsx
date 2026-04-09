'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export function RegisterSW() {
  const router = useRouter();

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    // Register the service worker
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((reg) => {
        console.log('[SW] Registrado:', reg.scope);

        // Notify user when a new version is ready
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
    // When another tab/device sends a share link and this window is already open,
    // the SW posts NAVIGATE so we route in-app without a full reload.
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

  return null;
}
