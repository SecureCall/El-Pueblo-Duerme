/**
 * POST /api/sync-night-action
 * Canonical server-side endpoint for player night actions.
 * The client may request an action, but the server derives the role from the
 * game document and validates the action before writing it.
 */
import { NextRequest, NextResponse } from 'next/server';
import { initAdminApp } from '@/lib/firebase/admin';
import { verifyAuthToken } from '@/lib/firebase/verifyAuth';
import { getFirestore } from 'firebase-admin/firestore';

const ROLE_KEYS: Record<string, string> = {
  'Lobo': 'wolves',
  'Lobo Blanco': 'wolves',
  'Cría de Lobo': 'wolves',
  'Vidente': 'vidente',
  'Hechicera': 'hechicera',
  'Bruja': 'bruja',
  'Cupido': 'cupido',
  'Guardián': 'guardian',
  'Doctor': 'doctor',
  'Flautista': 'flautista',
  'Perro Lobo': 'perrolo',
  'Niño Salvaje': 'salvaje',
  'Profeta': 'profeta',
  'Sacerdote': 'sacerdote',
  'Ladrón': 'ladron',
  'Espía': 'espia',
  'Anciana Líder': 'anciana',
  'Ángel Resucitador': 'angelresucitador',
  'Silenciadora': 'silenciadora',
  'Sirena del Río': 'sirena',
  'Virginia Woolf': 'virginiawoolf',
  'Vigía': 'vigia',
  'Banshee': 'banshee',
  'Cambiaformas': 'cambiaformas',
  'Líder del Culto': 'liderculto',
  'Pescador': 'pescador',
  'Vampiro': 'vampiro',
  'Hada Buscadora': 'hadabuscadora',
  'Médico Forense': 'forense',
  'Saboteador': 'saboteador',
};

const ROLE_ACTIONS: Record<string, string[]> = {
  'Lobo': ['wolfTarget', 'wolfTarget2'],
  'Lobo Blanco': ['wolfTarget', 'wolfTarget2', 'loboBlancoCide'],
  'Cría de Lobo': ['wolfTarget', 'wolfTarget2'],
  'Vidente': ['seerTarget', 'seerTarget2'],
  'Hechicera': ['witchSave', 'witchPoison'],
  'Bruja': ['brujaTarget'],
  'Cupido': ['cupidTargets'],
  'Guardián': ['guardianTarget'],
  'Doctor': ['doctorTarget'],
  'Flautista': ['flautistaTargets'],
  'Perro Lobo': ['perroLoboSide'],
  'Niño Salvaje': ['salvajeMentor'],
  'Profeta': ['profetaTarget'],
  'Sacerdote': ['sacerdoteTarget'],
  'Ladrón': ['ladronTarget'],
  'Espía': ['espiaActivate'],
  'Anciana Líder': ['ancianaTarget'],
  'Ángel Resucitador': ['angelResucitarTarget'],
  'Silenciadora': ['silenciadoraTarget'],
  'Sirena del Río': ['sirenaTarget'],
  'Virginia Woolf': ['virginiawoolTarget'],
  'Vigía': ['vigiaActivate'],
  'Banshee': ['bansheePrediction'],
  'Cambiaformas': ['cambiaformasTarget'],
  'Líder del Culto': ['liderCultoTarget'],
  'Pescador': ['pescadorTarget'],
  'Vampiro': ['vampiroTarget'],
  'Hada Buscadora': ['hadaBuscadoraTarget'],
  'Médico Forense': ['forenseTarget'],
  'Saboteador': ['saboteadorTarget'],
};

const STRING_TARGET_KEYS = new Set([
  'wolfTarget', 'wolfTarget2', 'seerTarget', 'seerTarget2', 'witchPoison',
  'brujaTarget', 'guardianTarget', 'doctorTarget', 'salvajeMentor',
  'profetaTarget', 'sacerdoteTarget', 'ladronTarget', 'ancianaTarget',
  'angelResucitarTarget', 'silenciadoraTarget', 'sirenaTarget',
  'virginiawoolTarget', 'bansheePrediction', 'cambiaformasTarget',
  'liderCultoTarget', 'pescadorTarget', 'vampiroTarget', 'hadaBuscadoraTarget',
  'forenseTarget', 'saboteadorTarget', 'loboBlancoCide',
]);

function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function isStringId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 128;
}

function alivePlayer(players: any[], uid: string) {
  return players.find((p: any) => p.uid === uid && p.isAlive === true);
}

function validateTarget(players: any[], uid: unknown, actorUid: string, allowSelf = false) {
  if (!isStringId(uid)) return false;
  if (!allowSelf && uid === actorUid) return false;
  return Boolean(alivePlayer(players, uid));
}

function validateAction(
  role: string,
  payload: Record<string, unknown>,
  game: any,
  actorUid: string,
  players: any[],
) {
  const allowed = ROLE_ACTIONS[role];
  if (!allowed) return 'Este rol no tiene acción nocturna válida';

  const keys = Object.keys(payload).filter(k => k !== '_skip');
  if (keys.some(k => !allowed.includes(k))) return 'Acción no permitida para este rol';
  if (keys.length === 0) return null;

  for (const key of keys) {
    const value = payload[key];

    if (STRING_TARGET_KEYS.has(key)) {
      const allowSelf = role === 'Doctor' || role === 'Guardián' || role === 'Sacerdote';
      if (!validateTarget(players, value, actorUid, allowSelf)) return `Objetivo inválido: ${key}`;
    }

    if (key === 'wolfTarget' || key === 'wolfTarget2') {
      const target = alivePlayer(players, value as string);
      const targetRole = game.roles?.[target.uid];
      if (targetRole === 'Lobo' || targetRole === 'Lobo Blanco' || targetRole === 'Cría de Lobo' || targetRole === 'Bruja') {
        return 'Los lobos no pueden seleccionar a un aliado como víctima';
      }
      if (game.brujaProtectedUid === target.uid) return 'Ese jugador está protegido por la Bruja';
      if (game.lobosBlocked) return 'La manada está bloqueada esta noche';
    }

    if (key === 'loboBlancoCide') {
      const targetRole = game.roles?.[value as string];
      if (!['Lobo', 'Lobo Blanco', 'Cría de Lobo'].includes(targetRole)) return 'El Lobo Blanco solo puede eliminar a un lobo aliado';
      if ((game.roundNumber ?? 1) % 2 !== 0) return 'La acción del Lobo Blanco no está disponible esta noche';
      if (value === actorUid) return 'No puedes eliminarte a ti mismo';
    }

    if (key === 'wolfTarget2' && !game.criaLoboRage) return 'La segunda víctima de la Cría no está disponible';
    if ((key === 'seerTarget2') && (!game.doubleSeerActive || value === payload.seerTarget)) return 'La segunda visión no está disponible';

    if (key === 'cupidTargets') {
      if (!Array.isArray(value) || value.length !== 2 || new Set(value).size !== 2) return 'Cupido debe elegir exactamente 2 jugadores distintos';
      if (!value.every(v => validateTarget(players, v, actorUid, true))) return 'Objetivo de Cupido inválido';
      if ((game.roundNumber ?? 1) !== 1) return 'Cupido solo actúa en la primera noche';
    }

    if (key === 'flautistaTargets') {
      if (!Array.isArray(value) || value.length < 1 || value.length > 2 || new Set(value).size !== value.length) return 'El Flautista debe elegir 1 o 2 jugadores distintos';
      if (!value.every(v => validateTarget(players, v, actorUid, false))) return 'Objetivo del Flautista inválido';
    }

    if (key === 'perroLoboSide' && value !== 'wolves' && value !== 'village') return 'Bando de Perro Lobo inválido';
    if (key === 'perroLoboSide' && (game.roundNumber ?? 1) !== 1) return 'Perro Lobo solo decide bando en la primera noche';
    if (key === 'perroLoboSide' && game.perroLoboChoices?.[actorUid]) return 'Ya has elegido bando';

    if (key === 'witchSave' && value !== true) return 'Acción de salvación inválida';
    if (key === 'witchPoison' && game.hechiceraPoisonUsed) return 'La poción de veneno ya fue utilizada';
    if (key === 'witchSave' && game.hechiceraLifeUsed) return 'La poción de vida ya fue utilizada';
    if (key === 'witchSave' && !game.nightActions?.wolfTarget) return 'No hay víctima de lobos que salvar';

    if (key === 'angelResucitarTarget') {
      if (game.angelResucitadorUsed) return 'El Ángel Resucitador ya utilizó su poder';
      const dead = players.find((p: any) => p.uid === value && !p.isAlive);
      if (!dead) return 'Solo puedes resucitar a un jugador muerto';
    }

    if (key === 'espiaActivate' && value !== true) return 'Activación del Espía inválida';
    if (key === 'vigiaActivate' && value !== true) return 'Activación del Vigía inválida';
    if (key === 'vigiaActivate' && game.vigiaUsed) return 'El Vigía ya utilizó su poder';

    if (['sirenaTarget', 'virginiawoolTarget', 'cambiaformasTarget'].includes(key) && (game.roundNumber ?? 1) !== 1) return 'Esta habilidad solo está disponible en la primera noche';
    if (key === 'ladronTarget' && (game.roundNumber ?? 1) !== 1) return 'El Ladrón solo actúa la primera noche';
    if (key === 'hadaBuscadoraTarget' && game.hadaLinked) return 'El Hada Buscadora ya ha encontrado a su objetivo';
  }

  return null;
}

export async function POST(req: NextRequest) {
  const tokenUid = await verifyAuthToken(req);
  if (!tokenUid) return fail('No autorizado', 401);

  try {
    const body = await req.json();
    const { gameId, uid, payload } = body as {
      gameId?: string;
      uid?: string;
      role?: string;
      payload?: Record<string, unknown>;
    };

    if (!gameId || !uid || !payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return fail('gameId, uid y payload son obligatorios');
    }
    if (tokenUid !== uid) return fail('UID no coincide con el token', 403);

    initAdminApp();
    const db = getFirestore();
    const gameRef = db.collection('games').doc(gameId);
    const gameSnap = await gameRef.get();
    if (!gameSnap.exists) return fail('Partida no encontrada', 404);

    const game = gameSnap.data()!;
    if (game.phase !== 'night') return fail('No es fase de noche', 409);

    const players = Array.isArray(game.players) ? game.players : [];
    const me = players.find((p: any) => p.uid === uid);
    if (!me?.isAlive) return fail('Jugador no válido o muerto', 403);

    const role = game.roles?.[uid] ?? 'Aldeano';
    const submissionKey = ROLE_KEYS[role] ?? uid;
    const cleanPayload: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(payload)) {
      if (key === '_skip') {
        if (value !== true) return fail('Valor _skip inválido');
        continue;
      }
      if (typeof value === 'string' && value.length <= 128) cleanPayload[key] = value;
      else if (typeof value === 'boolean') cleanPayload[key] = value;
      else if (Array.isArray(value) && value.length <= 3 && value.every(v => typeof v === 'string' && v.length <= 128)) cleanPayload[key] = value;
      else return fail(`Payload inválido: ${key}`);
    }

    const validationError = validateAction(role, cleanPayload, game, uid, players);
    if (validationError) return fail(validationError, 422);

    const updates: Record<string, unknown> = {
      [`nightSubmissions.${submissionKey}`]: true,
    };
    for (const [key, value] of Object.entries(cleanPayload)) {
      updates[`nightActions.${key}`] = value;
    }
    if (role === 'Lobo Blanco' && (game.roundNumber ?? 1) % 2 === 0) {
      updates['nightSubmissions.loboblanco'] = true;
    }

    await gameRef.update(updates);
    return NextResponse.json({ ok: true, role, submissionKey });
  } catch (err) {
    console.error('[sync-night-action]', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
