import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken } from '@/lib/firebase/verifyAuth';
import { getSdks } from '@/lib/server/firebase-admin';

function clean(value: unknown, max: number) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

export async function POST(req: NextRequest) {
  const uid = await verifyAuthToken(req);
  if (!uid) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const displayName = clean(body?.displayName, 60);
  const photoURL = clean(body?.photoURL, 2048);
  if (displayName.length < 3) return NextResponse.json({ error: 'Nombre inválido' }, { status: 400 });

  const { db } = getSdks();
  const ref = db.collection('users').doc(uid);
  const snap = await ref.get();

  if (!snap.exists) {
    const user = await (await import('firebase-admin/auth')).getAuth().getUser(uid);
    await ref.create({
      uid,
      displayName,
      email: user.email ?? '',
      photoURL,
      coins: 100,
      createdAt: new Date(),
    });
  } else {
    await ref.update({ displayName, photoURL });
  }

  return NextResponse.json({ ok: true });
}
