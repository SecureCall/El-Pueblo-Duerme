/**
 * POST /api/push-subscribe
 * Stores a push subscription for the authenticated user.
 * Security: requires Firebase Auth token; uid must match the authenticated user.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { initAdminApp } from '@/lib/firebase/admin';
import { verifyAuthToken } from '@/lib/firebase/verifyAuth';

export async function POST(req: NextRequest) {
  const tokenUid = await verifyAuthToken(req);
  if (!tokenUid) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

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

    if (tokenUid !== uid) {
      return NextResponse.json({ error: 'UID no coincide con el token' }, { status: 403 });
    }

    initAdminApp();
    const db = getFirestore();
    const hash = Buffer.from(subscription.endpoint).toString('base64url').slice(0, 40);

    await db
      .collection('users').doc(uid)
      .collection('pushSubscriptions').doc(hash)
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
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
