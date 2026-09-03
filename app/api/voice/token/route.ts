import { NextRequest, NextResponse } from 'next/server';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { AccessToken } from 'livekit-server-sdk';
import { z } from 'zod';
import type { VoiceChannel } from '@/lib/voice/voice-contract';

export const runtime = 'nodejs';

const requestSchema = z.object({
  gameId: z.string().trim().min(3).max(64),
  channel: z.enum(['main', 'wolves', 'ghost']),
  displayName: z.string().trim().min(1).max(40).optional(),
});

const WOLF_ROLES = new Set([
  'Lobo', 'Alfa', 'Lobo Solitario', 'Hechicera', 'Lobo Anciano',
  'Lobo Blanco', 'Cría de Lobo', 'Virginia Woolf',
]);

function getFirebaseApp() {
  return getApps()[0] ?? initializeApp();
}

function getBearerToken(request: NextRequest) {
  const value = request.headers.get('authorization') ?? '';
  const match = value.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

function canJoinChannel(
  channel: VoiceChannel,
  game: { phase?: string; roles?: Record<string, unknown>; wolfTeam?: Record<string, boolean> },
  uid: string,
  player: { isAlive?: boolean },
) {
  const alive = player.isAlive === true;
  if (channel === 'ghost') return !alive;
  if (!alive) return false;
  if (channel === 'main') return game.phase !== 'night';
  if (channel === 'wolves') {
    return game.phase === 'night' && (game.wolfTeam?.[uid] === true || WOLF_ROLES.has(String(game.roles?.[uid] ?? '')));
  }
  return false;
}

export async function POST(request: NextRequest) {
  try {
    const body = requestSchema.parse(await request.json());
    const bearer = getBearerToken(request);
    if (!bearer) {
      return NextResponse.json({ error: 'Missing authentication' }, { status: 401 });
    }

    const app = getFirebaseApp();
    const decoded = await getAuth(app).verifyIdToken(bearer, true);
    const db = getFirestore(app);
    const gameSnapshot = await db.collection('games').doc(body.gameId).get();

    if (!gameSnapshot.exists) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    const game = gameSnapshot.data() as {
      phase?: string;
      roles?: Record<string, unknown>;
      wolfTeam?: Record<string, boolean>;
      players?: Array<{ userId?: string; uid?: string; name?: string; isAlive?: boolean }>;
    };
    const player = game.players?.find(candidate => (candidate.userId ?? candidate.uid) === decoded.uid);
    if (!player) {
      return NextResponse.json({ error: 'Player is not in this game' }, { status: 403 });
    }

    if (!canJoinChannel(body.channel, game, decoded.uid, player)) {
      return NextResponse.json({ error: 'Not authorized for this voice channel' }, { status: 403 });
    }

    const serverUrl = process.env.LIVEKIT_URL;
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    if (!serverUrl || !apiKey || !apiSecret) {
      console.error('LiveKit server configuration is incomplete');
      return NextResponse.json({ error: 'Voice service unavailable' }, { status: 503 });
    }

    const roomName = `epd-${body.gameId}-${body.channel}`;
    const participantName = player.name || decoded.name || decoded.uid;
    const token = new AccessToken(apiKey, apiSecret, {
      identity: decoded.uid,
      name: participantName,
      ttl: '15m',
    });

    token.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: body.channel !== 'ghost',
      canSubscribe: true,
      canPublishData: false,
    });

    return NextResponse.json({
      server_url: serverUrl,
      participant_token: await token.toJwt(),
      room_name: roomName,
      participant_identity: decoded.uid,
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid voice request' }, { status: 400 });
    }
    console.error('LiveKit token endpoint failed', error);
    return NextResponse.json({ error: 'Unable to create voice token' }, { status: 500 });
  }
}
