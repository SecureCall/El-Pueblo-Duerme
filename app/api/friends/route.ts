import { NextRequest, NextResponse } from 'next/server';
import { initAdminApp } from '@/lib/firebase/admin';
import { verifyAuthToken } from '@/lib/firebase/verifyAuth';
import { getFirestore } from 'firebase-admin/firestore';
import { applyFriendAction, FriendAction } from '@/lib/server/friendships';

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
    await applyFriendAction(getFirestore(), uid, otherUid, action as FriendAction);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const code = err instanceof Error ? err.message : 'INTERNAL';
    const [error, status] = ERRORS[code] ?? ['Error interno', 500];
    console.error('[friends]', code);
    return NextResponse.json({ error }, { status });
  }
}
