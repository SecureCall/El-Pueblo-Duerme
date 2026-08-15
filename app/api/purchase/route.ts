import { NextRequest, NextResponse } from 'next/server';
import { initAdminApp } from '@/lib/firebase/admin';
import { verifyAuthToken } from '@/lib/firebase/verifyAuth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorePrice } from '@/lib/store/catalog';

export async function POST(req: NextRequest) {
  const uid = await verifyAuthToken(req);
  if (!uid) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  try {
    const body = await req.json();
    const itemId = typeof body?.itemId === 'string' ? body.itemId : '';
    const price = getStorePrice(itemId);
    if (!price) return NextResponse.json({ error: 'Artículo no válido' }, { status: 400 });

    initAdminApp();
    const db = getFirestore();
    const userRef = db.collection('users').doc(uid);
    const purchaseRef = userRef.collection('purchases').doc(itemId);

    await db.runTransaction(async tx => {
      const [userSnap, purchaseSnap] = await Promise.all([tx.get(userRef), tx.get(purchaseRef)]);
      if (!userSnap.exists) throw new Error('Usuario no encontrado');
      if (purchaseSnap.exists) throw new Error('Artículo ya comprado');

      const coins = Number(userSnap.data()?.coins ?? 0);
      if (!Number.isFinite(coins) || coins < price) throw new Error('Monedas insuficientes');

      tx.update(userRef, { coins: coins - price });
      tx.create(purchaseRef, {
        itemId,
        amount: price,
        purchasedAt: new Date(),
      });
    });

    return NextResponse.json({ ok: true, itemId, amount: price });
  } catch (error: any) {
    const message = error?.message === 'Monedas insuficientes'
      ? error.message
      : error?.message === 'Artículo ya comprado'
        ? error.message
        : 'Error interno';
    const status = message === 'Monedas insuficientes' ? 409 : message === 'Artículo ya comprado' ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
