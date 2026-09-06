/** POST /api/spend-coins — atomically validates and charges a store purchase. */
import { NextRequest, NextResponse } from 'next/server';
import { initAdminApp } from '@/lib/firebase/admin';
import { verifyAuthToken } from '@/lib/firebase/verifyAuth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

// Server-side price authority. Never trust price/name supplied by the client.
const STORE_PRICES: Record<string, { price: number; name: string }> = {
  'avatar-aldeano-sabio': { price: 300, name: 'Aldeano Sabio' },
  'avatar-bruja': { price: 400, name: 'Bruja Misteriosa' },
  'avatar-guardia': { price: 350, name: 'Guardia Valiente' },
  'avatar-panadero': { price: 200, name: 'Panadero' },
  'avatar-doncella': { price: 250, name: 'Joven Doncella' },
  'avatar-monja': { price: 250, name: 'Monja Devota' },
  'avatar-herrero': { price: 300, name: 'Anciano Herrero' },
  'avatar-nina': { price: 350, name: 'Niña Inocente' },
  'avatar-tejedora': { price: 200, name: 'Tejedora' },
  'avatar-boticario': { price: 300, name: 'Boticario' },
  'avatar-cazador': { price: 350, name: 'Cazador' },
  'avatar-clerigo': { price: 300, name: 'Clérigo Sagrado' },
  'avatar-granjero': { price: 200, name: 'Granjero Robusto' },
  'avatar-lobo-oveja': { price: 600, name: 'Lobo en Piel de Oveja' },
  'avatar-medico-plaga': { price: 500, name: 'Médico de la Plaga' },
  'avatar-noble': { price: 400, name: 'Noble Elegante' },
  'avatar-pescador': { price: 200, name: 'Pescador' },
  'avatar-picaro': { price: 450, name: 'Pícaro con Daga' },
  'avatar-trovador': { price: 300, name: 'Trovador' },
  'marco-dorado': { price: 300, name: 'Marco Dorado' },
  'marco-sangre': { price: 350, name: 'Marco de Sangre' },
  'tema-luna': { price: 400, name: 'Tema Luna Llena' },
  'emote-aullido': { price: 200, name: 'Emote Aullido' },
  'emote-cuchillo': { price: 200, name: 'Emote Cuchillo' },
  'sala-premium': { price: 800, name: 'Sala Premium' },
  'destacar-sala': { price: 300, name: 'Destacar Sala' },
  'estadisticas': { price: 600, name: 'Historial Extendido' },
  'titulo-maestro-lobo': { price: 400, name: 'Título: Maestro Lobo' },
  'titulo-aldea-legendario': { price: 400, name: 'Título: Aldeano Legendario' },
  'mensaje-dorado': { price: 700, name: 'Mensajes Dorados' },
  'cofre-misterioso': { price: 250, name: 'Cofre Misterioso' },
  'cofre-epico': { price: 600, name: 'Cofre Épico' },
  'pase-temporada': { price: 1500, name: 'Pase de Temporada' },
};

export async function POST(req: NextRequest) {
  const uid = await verifyAuthToken(req);
  if (!uid) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  try {
    const body = await req.json();
    const itemId = typeof body?.itemId === 'string' ? body.itemId : '';
    const item = STORE_PRICES[itemId];
    if (!item) return NextResponse.json({ error: 'Artículo no válido' }, { status: 400 });

    initAdminApp();
    const db = getFirestore();
    const userRef = db.collection('users').doc(uid);
    const purchaseQuery = userRef.collection('purchases').where('itemId', '==', itemId).limit(1);

    const result = await db.runTransaction(async (tx) => {
      const [userSnap, purchaseSnap] = await Promise.all([
        tx.get(userRef),
        tx.get(purchaseQuery),
      ]);
      if (purchaseSnap.size > 0) return { alreadyPurchased: true } as const;

      const balance = Number(userSnap.data()?.coins ?? 0);
      if (!Number.isFinite(balance) || balance < item.price) return { insufficient: true } as const;

      const purchaseRef = userRef.collection('purchases').doc();
      tx.update(userRef, { coins: FieldValue.increment(-item.price) });
      tx.set(purchaseRef, {
        itemId,
        itemName: item.name,
        amount: item.price,
        purchasedAt: new Date(),
      });
      return { ok: true, price: item.price, remainingCoins: balance - item.price } as const;
    });

    if ('alreadyPurchased' in result) return NextResponse.json({ error: 'Artículo ya comprado', alreadyPurchased: true }, { status: 409 });
    if ('insufficient' in result) return NextResponse.json({ error: 'Monedas insuficientes' }, { status: 400 });
    return NextResponse.json(result);
  } catch (err) {
    console.error('[spend-coins]', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
