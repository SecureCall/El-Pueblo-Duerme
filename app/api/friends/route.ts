import { NextRequest, NextResponse } from 'next/server';
import { initAdminApp } from '@/lib/firebase/admin';
import { verifyAuthToken } from '@/lib/firebase/verifyAuth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

const ERRORS: Record<string, [string, number]> = {
  USER_NOT_FOUND: ['Usuario no encontrado', 404],
  ALREADY_FRIENDS: ['Ya sois amigos', 409],
  REQUEST_NOT_FOUND: ['La solicitud ya no está disponible', 409],
  INVALID_ACTION: ['Operación no válida', 400],
};

export async function POST(req: NextRequest) {
  const uid = await verifyAuthToken(req);
  if (!uid) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  try {
    const body: unknown = await req.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
    }

    const input = body as Record<string, unknown>;
    const action = input.action;
    const otherUid = typeof input.otherUid === 'string' ? input.otherUid.trim() : '';

    if (typeof action !== 'string' || !['send', 'accept', 'reject', 'remove'].includes(action) ||
        !otherUid || otherUid.length > 128 || otherUid.includes('/') || otherUid === uid) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
    }

    initAdminApp();
    const db = getFirestore();
    const myRef = db.collection('users').doc(uid);
    const otherRef = db.collection('users').doc(otherUid);

    await db.runTransaction(async tx => {
      const [mySnap, otherSnap] = await Promise.all([tx.get(myRef), tx.get(otherRef)]);
      if (!mySnap.exists || !otherSnap.exists) throw new Error('USER_NOT_FOUND');

      const mine = mySnap.data()!;
      const theirs = otherSnap.data()!;
      const myFriends = stringList(mine.friends);
      const otherFriends = stringList(theirs.friends);
      const myRequests = stringList(mine.friendRequests);
      const otherRequests = stringList(theirs.friendRequests);

      switch (action) {
        case 'send': {
          if (myFriends.includes(otherUid) || otherFriends.includes(uid)) throw new Error('ALREADY_FRIENDS');
          if (!otherRequests.includes(uid)) {
            tx.update(otherRef, { friendRequests: FieldValue.arrayUnion(uid) });
          }
          return;
        }
        case 'accept': {
          if (!myRequests.includes(otherUid)) throw new Error('REQUEST_NOT_FOUND');
          tx.update(myRef, {
            friends: Array.from(new Set([...myFriends, otherUid])),
            friendRequests: FieldValue.arrayRemove(otherUid),
          });
          tx.update(otherRef, { friends: Array.from(new Set([...otherFriends, uid])) });
          return;
        }
        case 'reject': {
          if (!myRequests.includes(otherUid)) throw new Error('REQUEST_NOT_FOUND');
          tx.update(myRef, { friendRequests: FieldValue.arrayRemove(otherUid) });
          return;
        }
        case 'remove': {
          tx.update(myRef, { friends: myFriends.filter(id => id !== otherUid) });
          tx.update(otherRef, { friends: otherFriends.filter(id => id !== uid) });
          return;
        }
      }
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const code = err instanceof Error ? err.message : 'INTERNAL';
    const [error, status] = ERRORS[code] ?? ['Error interno', 500];
    console.error('[friends]', code);
    return NextResponse.json({ error }, { status });
  }
}
