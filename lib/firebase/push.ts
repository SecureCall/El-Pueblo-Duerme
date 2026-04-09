/**
 * Push Notification helpers
 *
 * Flow:
 *  1. Call `subscribeToPush()` to request permission and get a PushSubscription.
 *  2. Pass the subscription to your server (or store in Firestore) so the server
 *     can send Web Push messages via the VAPID keys.
 *  3. Call `sendPushToUser(uid, payload)` from a server action / API route.
 *
 * The VAPID public key lives in NEXT_PUBLIC_VAPID_PUBLIC_KEY.
 * Generate a pair once with:  npx web-push generate-vapid-keys
 */

export const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

/** Request push permission and return the PushSubscription (or null on deny). */
export async function subscribeToPush(): Promise<PushSubscription | null> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return null;

  const reg = await navigator.serviceWorker.ready;

  const existing = await reg.pushManager.getSubscription();
  if (existing) return existing;

  if (!VAPID_PUBLIC_KEY) {
    console.warn('[Push] NEXT_PUBLIC_VAPID_PUBLIC_KEY not set — skipping subscription');
    return null;
  }

  return reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  });
}

/** Unsubscribe this device from push. */
export async function unsubscribeFromPush(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  await sub?.unsubscribe();
}

export type PushPayload = {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  url?: string;
  data?: Record<string, unknown>;
};

/** Build a Notification options object from a PushPayload (used by the SW). */
export function buildNotificationOptions(payload: PushPayload): NotificationOptions {
  return {
    body: payload.body,
    icon: payload.icon ?? '/icons/192.png',
    badge: payload.badge ?? '/icons/72.png',
    tag: payload.tag,
    data: { url: payload.url ?? '/', ...(payload.data ?? {}) },
    vibrate: [200, 100, 200],
  };
}
