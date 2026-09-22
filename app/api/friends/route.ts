import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { verifyAuthToken } from '@/lib/firebase/verifyAuth';
import { getSdks } from '@/lib/server/firebase-admin';

type Action = 'send' | 'accept' | 'reject' | 'remove';

export async function POST(req: NextRequest) {
  const uid = await verifyAuthToken(req);
  if (!uid) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const action = body?.action as Action;
  const targetUid = typeof body?.targetUid === 'string' ? body.targetUid.trim() : '';

  if (!['send', 'accept', 'reject', 'remove'].includes(action) || !targetUid) {
    return NextResponse.json({ error: 'Acción o usuario inválido' }, { status: 400 });
  }
  if (uid === targetUid) return NextResponse.json({ error: 'No puedes operar contigo mismo' }, { status: 400 });

  const { db } = getSdks();
  const meRef = db.collection('users').doc(uid);
  const targetRef = db.collection('users').doc(targetUid);

  try {
    await db.runTransaction(async tx => {
      const [meSnap, targetSnap] = await Promise.all([tx.get(meRef), tx.get(targetRef)]);
      if (!meSnap.exists || !targetSnap.exists) throw new Error('USER_NOT_FOUND');

      const me = meSnap.data() ?? {};
      const target = targetSnap.data() ?? {};
      const friends = Array.isArray(me.friends) ? me.friends : [];
      const requests = Array.isArray(me.friendRequests) ? me.friendRequests : [];
      const targetFriends = Array.isArray(target.friends) ? target.friends : [];
      const targetRequests = Array.isArray(target.friendRequests) ? target.friendRequests : [];

      if (action === 'send') {
        if (friends.includes(targetUid) || targetFriends.includes(uid)) return;
        if (!targetRequests.includes(uid)) {
          tx.update(targetRef, { friendRequests: FieldValue.arrayUnion(uid) });
        }
        return;
      }

      if (action === 'accept') {
        if (!requests.includes(targetUid)) throw new Error('REQUEST_NOT_FOUND');
        tx.update(meRef, {
          friends: FieldValue.arrayUnion(targetUid),
          friendRequests: FieldValue.arrayRemove(targetUid),
        });
        tx.update(targetRef, { friends: FieldValue.arrayUnion(uid) });
        return;
      }

      if (action === 'reject') {
        tx.update(meRef, { friendRequests: FieldValue.arrayRemove(targetUid) });
        return;
      }

      tx.update(meRef, { friends: FieldValue.arrayRemove(targetUid) });
      tx.update(targetRef, { friends: FieldValue.arrayRemove(uid) });
    });

    return NextResponse.json({ ok: true, action, targetUid });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'UNKNOWN';
    if (code === 'USER_NOT_FOUND') return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    if (code === 'REQUEST_NOT_FOUND') return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 409 });
    console.error('[friends] mutation failed', error);
    return NextResponse.json({ error: 'No se pudo actualizar la relación' }, { status: 409 });
  }
}
