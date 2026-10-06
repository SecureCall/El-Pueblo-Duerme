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
    const { gameId } = await req.json() as { gameId?: string };
    if (!gameId) return NextResponse.json({ error: 'gameId requerido' }, { status: 400 });

    const vapidPublicKey = process.env.VAPID_PUBLIC_KEY ?? '';
    const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY ?? '';
    const vapidSubject = process.env.VAPID_SUBJECT ?? 'mailto:admin@elpuebloduerme.com';

    if (!vapidPublicKey || !vapidPrivateKey) {
      return NextResponse.json({ error: 'VAPID keys not configured' }, { status: 503 });
    }

    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

    initAdminApp();
    const db = getFirestore();
    const gameSnap = await db.collection('games').doc(gameId).get();
    if (!gameSnap.exists) return NextResponse.json({ error: 'Partida no encontrada' }, { status: 404 });
    const game = gameSnap.data() ?? {};
    if (game.hostUid !== tokenUid || game.phase !== 'ended') return NextResponse.json({ error: 'No autorizado para esta partida' }, { status: 403 });
    const recipients = (Array.isArray(game.players) ? game.players : [])
      .filter((p: any) => p && typeof p.uid === 'string' && p.uid !== tokenUid && p.isAI !== true)
      .map((p: any) => p.uid);
    if (recipients.length === 0) return NextResponse.json({ ok: true, sent: 0 });
    let sent = 0;
    let failed = 0;
    for (const uid of recipients) {
      const subsSnapshot = await db.collection('users').doc(uid).collection('pushSubscriptions').get();
      const results = await Promise.allSettled(
        subsSnapshot.docs.map(async (docSnap) => {
          const sub = docSnap.data();
          try {
            await webpush.sendNotification(
              { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth }, expirationTime: sub.expirationTime ?? undefined },
              JSON.stringify({
                title: '⚔️ ¡Revancha en El Pueblo Duerme!',
                body: `${game.hostName ?? 'El nuevo anfitrión'} ha iniciado una nueva partida. ¡Vuelve y venga!`,
                url: `/game/${gameId}`,
                tag: `rematch-${gameId}`,
                icon: '/icons/192.png',
                requireInteraction: false,
              }),
            );
          } catch (error: any) {
            if (error?.statusCode === 404 || error?.statusCode === 410) await docSnap.ref.delete().catch(() => {});
            throw error;
          }
        }),
      );
      sent += results.filter((r) => r.status === 'fulfilled').length;
      failed += results.filter((r) => r.status === 'rejected').length;
    }

    return NextResponse.json({ ok: true, sent, failed });
  } catch (err: any) {
    console.error('[push-send]', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
