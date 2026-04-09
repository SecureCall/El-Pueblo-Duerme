/**
 * POST /api/push-send
 * Body: { uid: string, payload: PushPayload }
 *
 * Fetches all push subscriptions for the given uid from Firestore,
 * then sends a Web Push notification to each one using the VAPID keys.
 *
 * Environment variables required (server-side only):
 *   VAPID_PUBLIC_KEY   – base64url VAPID public key
 *   VAPID_PRIVATE_KEY  – base64url VAPID private key
 *   VAPID_SUBJECT      – mailto: or https: contact URI
 */
import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { initAdminApp } from '@/lib/firebase/admin';
import webpush from 'web-push';

export async function POST(req: NextRequest) {
  try {
    const { uid, payload } = await req.json() as {
      uid: string;
      payload: {
        title: string;
        body: string;
        url?: string;
        tag?: string;
        icon?: string;
        requireInteraction?: boolean;
      };
    };

    if (!uid || !payload?.title) {
      return NextResponse.json({ error: 'uid and payload.title required' }, { status: 400 });
    }

    const vapidPublicKey = process.env.VAPID_PUBLIC_KEY ?? '';
    const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY ?? '';
    const vapidSubject = process.env.VAPID_SUBJECT ?? 'mailto:admin@elpuebloduerme.com';

    if (!vapidPublicKey || !vapidPrivateKey) {
      return NextResponse.json({ error: 'VAPID keys not configured' }, { status: 503 });
    }

    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

    initAdminApp();
    const db = getFirestore();
    const subsSnapshot = await db
      .collection('users')
      .doc(uid)
      .collection('pushSubscriptions')
      .get();

    if (subsSnapshot.empty) {
      return NextResponse.json({ ok: true, sent: 0, reason: 'no subscriptions' });
    }

    const results = await Promise.allSettled(
      subsSnapshot.docs.map((doc) => {
        const sub = doc.data();
        return webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth },
            expirationTime: sub.expirationTime ?? undefined,
          },
          JSON.stringify({
            title: payload.title,
            body: payload.body,
            url: payload.url ?? '/',
            tag: payload.tag ?? 'elpueblo',
            icon: payload.icon ?? '/icons/192.png',
            requireInteraction: payload.requireInteraction ?? false,
          })
        );
      })
    );

    const sent = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    return NextResponse.json({ ok: true, sent, failed });
  } catch (err: any) {
    console.error('[push-send]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
