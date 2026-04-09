/**
 * POST /api/push-subscribe
 * Body: { uid: string, subscription: PushSubscription (JSON) }
 *
 * Stores the subscription in Firestore under users/{uid}/pushSubscriptions/{endpoint-hash}.
 * The server can later iterate these docs to send Web Push messages.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { initAdminApp } from '@/lib/firebase/admin';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { uid, subscription } = body as {
      uid: string;
      subscription: {
        endpoint: string;
        keys: { p256dh: string; auth: string };
        expirationTime?: number | null;
      };
    };

    if (!uid || !subscription?.endpoint) {
      return NextResponse.json({ error: 'uid and subscription required' }, { status: 400 });
    }

    initAdminApp();
    const db = getFirestore();

    // Use a hash of the endpoint as doc ID so we can upsert safely
    const hash = Buffer.from(subscription.endpoint).toString('base64url').slice(0, 40);

    await db
      .collection('users')
      .doc(uid)
      .collection('pushSubscriptions')
      .doc(hash)
      .set({
        endpoint: subscription.endpoint,
        keys: subscription.keys,
        expirationTime: subscription.expirationTime ?? null,
        updatedAt: Date.now(),
        userAgent: req.headers.get('user-agent') ?? '',
      });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[push-subscribe]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
