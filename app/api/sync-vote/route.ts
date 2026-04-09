/**
 * POST /api/sync-vote
 * Called by the service worker Background Sync handler when connectivity is restored.
 * Body matches PendingVote shape from lib/firebase/backgroundSync.ts
 */
import { NextRequest, NextResponse } from 'next/server';
import { initAdminApp } from '@/lib/firebase/admin';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { gameId, uid, target, round, submittedAt } = body as {
      gameId: string;
      uid: string;
      target: string;
      round: number;
      submittedAt: number;
    };

    if (!gameId || !uid || !target) {
      return NextResponse.json({ error: 'gameId, uid, target required' }, { status: 400 });
    }

    initAdminApp();
    const db = getFirestore();

    await db
      .collection('games')
      .doc(gameId)
      .collection('votes')
      .doc(uid)
      .set({ target, round, submittedAt, syncedAt: Date.now() }, { merge: true });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[sync-vote]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
