import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { getSdks } from '@/lib/server/firebase-admin';

const RECENT_AUTH_WINDOW_MS = 10 * 60 * 1000;

async function updateRefsInChunks(
  db: FirebaseFirestore.Firestore,
  snapshots: FirebaseFirestore.QueryDocumentSnapshot[],
  field: 'friends' | 'friendRequests',
  uid: string,
) {
  for (let i = 0; i < snapshots.length; i += 400) {
    const batch = db.batch();
    snapshots.slice(i, i + 400).forEach(snap => {
      const values = Array.isArray(snap.data()[field]) ? snap.data()[field] : [];
      batch.update(snap.ref, { [field]: values.filter((id: unknown) => id !== uid) });
    });
    await batch.commit();
  }
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const token = authHeader.slice(7);
  if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  try {
    const auth = getAuth();
    const decoded = await auth.verifyIdToken(token);
    const uid = decoded.uid;
    const authTimeMs = Number(decoded.auth_time ?? 0) * 1000;

    if (!Number.isFinite(authTimeMs) || Date.now() - authTimeMs > RECENT_AUTH_WINDOW_MS) {
      return NextResponse.json(
        { error: 'Sesión no suficientemente reciente. Vuelve a autenticarte antes de eliminar la cuenta.', code: 'RECENT_AUTH_REQUIRED' },
        { status: 401 },
      );
    }

    const { db } = getSdks();
    const userRef = db.collection('users').doc(uid);

    const [friendsSnap, requestsSnap, invitesSentSnap] = await Promise.all([
      db.collection('users').where('friends', 'array-contains', uid).get(),
      db.collection('users').where('friendRequests', 'array-contains', uid).get(),
      db.collectionGroup('items').where('hostUid', '==', uid).get(),
    ]);

    await updateRefsInChunks(db, friendsSnap.docs, 'friends', uid);
    await updateRefsInChunks(db, requestsSnap.docs, 'friendRequests', uid);

    for (const invite of invitesSentSnap.docs) {
      await db.recursiveDelete(invite.ref);
    }

    await db.recursiveDelete(userRef);

    await Promise.all([
      db.recursiveDelete(db.collection('gameInvites').doc(uid)),
      db.recursiveDelete(db.collection('pushSubscriptions').doc(uid)),
      db.doc(`playerBehavior/${uid}`).delete(),
      db.doc(`presence/${uid}`).delete(),
    ]);

    await auth.deleteUser(uid);

    return NextResponse.json({ ok: true });
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    if (code === 'auth/id-token-expired' || code === 'auth/id-token-revoked' || code === 'auth/argument-error') {
      return NextResponse.json({ error: 'Sesión inválida o caducada' }, { status: 401 });
    }
    console.error('[delete-account]', error);
    return NextResponse.json({ error: 'No se pudo eliminar la cuenta' }, { status: 500 });
  }
}
