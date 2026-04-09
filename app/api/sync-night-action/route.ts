/**
 * POST /api/sync-night-action
 * Called by the service worker Background Sync handler when connectivity is restored.
 * Body matches PendingNightAction shape from lib/firebase/backgroundSync.ts
 */
import { NextRequest, NextResponse } from 'next/server';
import { initAdminApp } from '@/lib/firebase/admin';
import { getFirestore } from 'firebase-admin/firestore';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { gameId, uid, role, payload, submittedAt } = body as {
      gameId: string;
      uid: string;
      role: string;
      payload: Record<string, unknown>;
      submittedAt: number;
    };

    if (!gameId || !uid || !role) {
      return NextResponse.json({ error: 'gameId, uid, role required' }, { status: 400 });
    }

    initAdminApp();
    const db = getFirestore();

    // Merge into nightSubmissions — same structure the client writes
    await db
      .collection('games')
      .doc(gameId)
      .set(
        { nightSubmissions: { [role]: { ...payload, syncedAt: Date.now() } } },
        { merge: true }
      );

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[sync-night-action]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
