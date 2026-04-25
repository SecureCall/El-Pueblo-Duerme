/**
 * POST /api/push-send
 * Sends a push notification to the given uid on behalf of the authenticated caller.
 * Security: requires Firebase Auth token (prevents unauthenticated spam).
 */
import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { initAdminApp } from '@/lib/firebase/admin';
import { verifyAuthToken } from '@/lib/firebase/verifyAuth';
import webpush from 'web-push';

export async function POST(req: NextRequest) {
  const tokenUid = await verifyAuthToken(req);
  if (!tokenUid) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

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
      .collection('users').doc(uid)
      .collection('pushSubscriptions').get();

    if (subsSnapshot.empty) {
      return NextResponse.json({ ok: true, sent: 0, reason: 'no subscriptions' });
    }

    const results = await Promise.allSettled(
      subsSnapshot.docs.map((docSnap) => {
        const sub = docSnap.data();
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
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
