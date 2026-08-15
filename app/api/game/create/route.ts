import { NextRequest, NextResponse } from 'next/server';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { initAdminApp } from '@/lib/firebase/admin';
import { verifyAuthToken } from '@/lib/firebase/verifyAuth';
import { z } from 'zod';
import { ROLES } from '@/components/game/play/roles';

const CreateGameSchema = z.object({
  name: z.string().trim().min(1).max(50),
  playerName: z.string().trim().min(1).max(30),
  maxPlayers: z.number().int().min(4).max(32),
  isPublic: z.boolean().default(false),
  fillWithAI: z.boolean().default(false),
  juryVote: z.boolean().default(true),
  gameMode: z.enum(['casual', 'normal', 'chaos']).default('normal'),
  specialRoles: z.array(z.string().trim().min(1).max(64)).max(40).default([]),
});

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CASUAL_ROLES = new Set(['Vidente', 'Doctor', 'Hechicera', 'Cazador', 'Cupido', 'Guardián', 'Príncipe', 'Sheriff']);

function generateCode(length = 6) {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, b => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
}

function wolfCount(players: number) {
  return Math.max(1, Math.floor(players / 5));
}

function validateRoles(roles: string[], mode: 'casual' | 'normal' | 'chaos') {
  const invalid = roles.filter(role => !ROLES[role] && !CASUAL_ROLES.has(role));
  if (invalid.length) return `Roles no válidos: ${invalid.join(', ')}`;
  if (mode === 'casual') {
    const invalidCasual = roles.filter(role => !CASUAL_ROLES.has(role));
    if (invalidCasual.length) return 'El modo Casual contiene roles no permitidos';
  }
  return null;
}

export async function POST(req: NextRequest) {
  const uid = await verifyAuthToken(req);
  if (!uid) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  let input: z.infer<typeof CreateGameSchema>;
  try {
    input = CreateGameSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'Configuración de partida inválida' }, { status: 400 });
  }

  const uniqueRoles = [...new Set(input.specialRoles)];
  if (uniqueRoles.length !== input.specialRoles.length) {
    return NextResponse.json({ error: 'No se permiten roles duplicados' }, { status: 400 });
  }

  const roleError = validateRoles(uniqueRoles, input.gameMode);
  if (roleError) return NextResponse.json({ error: roleError }, { status: 400 });

  try {
    initAdminApp();
    const db = getFirestore();
    const games = db.collection('games');

    let ref;
    let code = '';
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = generateCode();
      const existing = await games.where('code', '==', candidate).limit(1).get();
      if (existing.empty) {
        code = candidate;
        ref = games.doc();
        break;
      }
    }
    if (!ref || !code) {
      return NextResponse.json({ error: 'No se pudo generar un código de sala único' }, { status: 503 });
    }

    const displayName = input.playerName || 'Jugador';
    const data = {
      name: input.name,
      hostUid: uid,
      hostName: displayName,
      code,
      maxPlayers: input.maxPlayers,
      wolves: wolfCount(input.maxPlayers),
      isPublic: input.isPublic,
      fillWithAI: input.fillWithAI,
      juryVote: input.juryVote,
      gameMode: input.gameMode,
      specialRoles: uniqueRoles,
      playerCount: 1,
      status: 'lobby',
      phase: 'lobby',
      players: [{ uid, name: displayName, photoURL: '', isHost: true, isAlive: true, role: null }],
      createdAt: FieldValue.serverTimestamp(),
    };

    await ref.create(data);
    return NextResponse.json({ gameId: ref.id, code }, { status: 201 });
  } catch (error) {
    console.error('game/create failed', error);
    return NextResponse.json({ error: 'Error al crear la partida' }, { status: 500 });
  }
}
