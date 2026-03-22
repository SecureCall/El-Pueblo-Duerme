import { doc, updateDoc, arrayUnion, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { Player, GameState, NightAction, Team } from './types';
import { RoleId, ROLES, getNightOrder, assignRoles } from './roles';

export function getDebateDuration(playerCount: number): number {
  if (playerCount <= 6) return 120;
  if (playerCount <= 10) return 180;
  if (playerCount <= 16) return 240;
  if (playerCount <= 24) return 300;
  return 360;
}

export async function startGame(gameId: string, game: GameState): Promise<void> {
  const livePlayers = game.players.filter(p => p.isAlive);
  const uids = livePlayers.map(p => p.uid);
  const wolves = game.wolves;
  const specialRoles = (game.specialRoles ?? []) as RoleId[];

  const assignments = assignRoles(uids, wolves, specialRoles);
  const allRoles = Object.values(assignments) as RoleId[];
  const nightOrder = getNightOrder(allRoles, 1);

  const twinUids = livePlayers
    .filter(p => assignments[p.uid] === 'gemela')
    .map(p => p.uid)
    .slice(0, 2);

  const updatedPlayers: Player[] = livePlayers.map(p => ({
    ...p,
    role: assignments[p.uid],
    team: ROLES[assignments[p.uid]]?.team ?? 'neutral',
    isAlive: true,
    isLover: false,
    loverUid: null,
    isTwin: twinUids.includes(p.uid),
    twinUid: twinUids.includes(p.uid) ? twinUids.find(u => u !== p.uid) ?? null : null,
    isSilenced: false,
    isExiled: false,
    isProtected: false,
    enchantedBy: null,
    vampirized: false,
    transformedToWolf: false,
  }));

  await updateDoc(doc(db, 'games', gameId), {
    status: 'playing',
    phase: 'role-reveal',
    round: 1,
    players: updatedPlayers,
    nightOrder,
    nightOrderIndex: 0,
    currentNightRole: null,
    nightActions: {},
    nightDeaths: [],
    dayAnnouncements: [],
    winner: null,
    winnerTeam: null,
    currentVotes: {},
    phaseStartedAt: Date.now(),
    phaseDuration: 10,
    loboTarget: null,
    witchPotions: { poison: true, protect: true },
    guardianLastProtected: null,
    priestSelfUsed: false,
    hunterUsed: false,
    hunterPendingDeath: null,
    twinUids,
    loverPairs: [],
  });

  await addSystemMessage(gameId, 'lobbyChat', '🎮 ¡La partida ha comenzado! Preparaos...');
}

export async function advanceToNight(gameId: string, game: GameState): Promise<void> {
  const allRoles = game.players.filter(p => p.isAlive).map(p => p.role as RoleId).filter(Boolean);
  const nightOrder = getNightOrder(allRoles, game.round);

  await updateDoc(doc(db, 'games', gameId), {
    phase: 'night',
    nightOrder,
    nightOrderIndex: 0,
    currentNightRole: nightOrder[0] ?? null,
    nightActions: {},
    nightDeaths: [],
    phaseStartedAt: Date.now(),
    phaseDuration: 30,
    loboTarget: null,
  });
}

export async function advanceNightRole(gameId: string, game: GameState): Promise<void> {
  const nextIndex = game.nightOrderIndex + 1;
  if (nextIndex >= game.nightOrder.length) {
    await resolveNight(gameId, game);
  } else {
    await updateDoc(doc(db, 'games', gameId), {
      nightOrderIndex: nextIndex,
      currentNightRole: game.nightOrder[nextIndex],
      phaseStartedAt: Date.now(),
      phaseDuration: 30,
    });
  }
}

export async function submitNightAction(gameId: string, action: NightAction): Promise<void> {
  await updateDoc(doc(db, 'games', gameId), {
    [`nightActions.${action.uid}`]: action,
  });
}

export async function submitWolfTarget(gameId: string, targetUid: string): Promise<void> {
  await updateDoc(doc(db, 'games', gameId), { loboTarget: targetUid });
}

export async function resolveNight(gameId: string, game: GameState): Promise<void> {
  const deaths: string[] = [];
  const announcements: string[] = [];
  let updatedPlayers = game.players.map(p => ({ ...p, isProtected: false }));

  // 1. Guardian / Sacerdote protection
  const protections: string[] = [];
  for (const [uid, action] of Object.entries(game.nightActions)) {
    const player = getPlayer(game, uid);
    if (!player?.isAlive) continue;
    if ((player.role === 'guardian' || player.role === 'sacerdote') && action.targetUid) {
      protections.push(action.targetUid);
    }
  }

  // 2. Silencer
  const silenced: string[] = [];
  for (const [uid, action] of Object.entries(game.nightActions)) {
    const player = getPlayer(game, uid);
    if (player?.role === 'silenciadora' && action.targetUid) {
      silenced.push(action.targetUid);
    }
  }

  // 3. Exile (Anciana Líder)
  const exiled: string[] = [];
  for (const [uid, action] of Object.entries(game.nightActions)) {
    const player = getPlayer(game, uid);
    if (player?.role === 'anciana_lider' && action.targetUid) {
      exiled.push(action.targetUid);
    }
  }

  // 4. Wolf kill
  let wolfKillTarget = game.loboTarget;
  const leprosaUid = game.players.find(p => p.role === 'leprosa' && p.isAlive)?.uid;
  if (wolfKillTarget) {
    const isProtected = protections.includes(wolfKillTarget);
    if (!isProtected) {
      if (wolfKillTarget === leprosaUid) {
        deaths.push(wolfKillTarget);
        announcements.push(`⚰️ Los lobos atacaron a la Leprosa. La siguiente noche no podrán atacar.`);
      } else {
        deaths.push(wolfKillTarget);
      }
    } else {
      announcements.push(`🛡️ Alguien fue protegido esta noche.`);
    }
  }

  // 5. Witch poison
  for (const [uid, action] of Object.entries(game.nightActions)) {
    const player = getPlayer(game, uid);
    if (player?.role === 'hechicera' && action.action === 'poison' && action.targetUid) {
      if (!deaths.includes(action.targetUid)) deaths.push(action.targetUid);
    }
    if (player?.role === 'hechicera' && action.action === 'protect' && action.targetUid) {
      deaths.splice(deaths.indexOf(action.targetUid), 1);
      announcements.push(`🧪 Una poción misteriosa salvó a alguien esta noche.`);
    }
  }

  // 6. Alborotadora (eliminates 2)
  for (const [uid, action] of Object.entries(game.nightActions)) {
    const player = getPlayer(game, uid);
    if (player?.role === 'alborotadora' && action.targetUid && action.target2Uid) {
      if (!deaths.includes(action.targetUid)) deaths.push(action.targetUid);
      if (!deaths.includes(action.target2Uid)) deaths.push(action.target2Uid);
      announcements.push(`⚡ ¡La Alborotadora ha sembrado el caos! Dos personas han caído.`);
    }
  }

  // 7. Process deaths and chains
  const finalDeaths = [...new Set(deaths)];
  const chainDeaths: string[] = [];

  for (const deadUid of finalDeaths) {
    const dead = getPlayer(game, deadUid);
    if (!dead) continue;

    // Virginia Woolf chain
    for (const p of game.players) {
      if (p.role === 'virginia_woolf' && p.uid === deadUid) {
        const target = game.nightActions[p.uid]?.targetUid;
        if (target && !finalDeaths.includes(target)) chainDeaths.push(target);
      }
    }

    // Lover chain (Cupido)
    for (const [a, b] of game.loverPairs ?? []) {
      if (a === deadUid && !finalDeaths.includes(b)) chainDeaths.push(b);
      if (b === deadUid && !finalDeaths.includes(a)) chainDeaths.push(a);
    }
  }

  const allDeaths = [...new Set([...finalDeaths, ...chainDeaths])];

  if (allDeaths.length === 0) {
    announcements.unshift(`🌙 El pueblo pasó la noche en paz. Nadie murió.`);
  } else {
    const names = allDeaths.map(uid => getPlayer(game, uid)?.name ?? 'Alguien').join(', ');
    announcements.unshift(`⚰️ Esta noche murieron: ${names}`);
  }

  updatedPlayers = updatedPlayers.map(p => ({
    ...p,
    isAlive: allDeaths.includes(p.uid) ? false : p.isAlive,
    isSilenced: silenced.includes(p.uid),
    isExiled: exiled.includes(p.uid),
    isProtected: false,
  }));

  const winResult = checkWinCondition(updatedPlayers, game);

  await updateDoc(doc(db, 'games', gameId), {
    phase: winResult ? 'ended' : 'night-result',
    players: updatedPlayers,
    nightDeaths: allDeaths,
    dayAnnouncements: announcements,
    phaseStartedAt: Date.now(),
    phaseDuration: 6,
    ...(winResult ? { winner: winResult.winner, winnerTeam: winResult.team, status: 'ended' } : {}),
  });

  for (const ann of announcements) {
    await addSystemMessage(gameId, 'publicChat', ann);
  }
}

export async function advanceToDay(gameId: string, game: GameState): Promise<void> {
  const debateDuration = getDebateDuration(game.players.filter(p => p.isAlive).length);
  await updateDoc(doc(db, 'games', gameId), {
    phase: 'day',
    phaseStartedAt: Date.now(),
    phaseDuration: debateDuration,
    currentVotes: {},
  });
}

export async function advanceToVote(gameId: string): Promise<void> {
  await updateDoc(doc(db, 'games', gameId), {
    phase: 'vote',
    phaseStartedAt: Date.now(),
    phaseDuration: 60,
    currentVotes: {},
  });
}

export async function submitVote(gameId: string, voterUid: string, targetUid: string): Promise<void> {
  await updateDoc(doc(db, 'games', gameId), {
    [`currentVotes.${voterUid}`]: targetUid,
  });
}

export async function resolveVote(gameId: string, game: GameState): Promise<void> {
  const votes = game.currentVotes ?? {};
  const tally: Record<string, number> = {};
  for (const targetUid of Object.values(votes)) {
    tally[targetUid] = (tally[targetUid] ?? 0) + 1;
  }

  const sorted = Object.entries(tally).sort((a, b) => b[1] - a[1]);
  const eliminated = sorted[0]?.[0];

  if (!eliminated) {
    await updateDoc(doc(db, 'games', gameId), {
      phase: 'night-result',
      dayAnnouncements: ['⚖️ No hubo acuerdo. El pueblo no eligió a nadie hoy.'],
      phaseStartedAt: Date.now(),
      phaseDuration: 4,
    });
    await addSystemMessage(gameId, 'publicChat', '⚖️ El juicio terminó sin condena. El pueblo no se puso de acuerdo.');
    return;
  }

  const target = getPlayer(game, eliminated);
  const isPrince = target?.role === 'principe';

  if (isPrince) {
    const updatedPlayers = game.players.map(p =>
      p.uid === eliminated ? { ...p, role: 'aldeano' as RoleId } : p
    );
    await updateDoc(doc(db, 'games', gameId), {
      players: updatedPlayers,
      phase: 'vote-result',
      dayAnnouncements: [`👑 ${target?.name} era el Príncipe y ha sobrevivido al juicio.`],
      phaseStartedAt: Date.now(),
      phaseDuration: 6,
    });
    await addSystemMessage(gameId, 'publicChat', `👑 ${target?.name} era el Príncipe. ¡No puede ser ejecutado por votación!`);
    setTimeout(() => advanceToNight(gameId, game), 7000);
    return;
  }

  let updatedPlayers = game.players.map(p =>
    p.uid === eliminated ? { ...p, isAlive: false } : p
  );

  const announcements = [`⚖️ ${target?.name} fue condenado. Era ${target?.role ? ROLES[target.role]?.name : '???'}.`];

  // Hombre Ebrio wins
  if (target?.role === 'hombre_ebrio') {
    await updateDoc(doc(db, 'games', gameId), {
      players: updatedPlayers, phase: 'ended', status: 'ended',
      winner: 'hombre_ebrio', winnerTeam: 'neutral',
      dayAnnouncements: announcements,
      phaseStartedAt: Date.now(), phaseDuration: 8,
    });
    return;
  }

  // Lover chain
  const chainDeaths: string[] = [];
  for (const [a, b] of game.loverPairs ?? []) {
    if (a === eliminated) chainDeaths.push(b);
    if (b === eliminated) chainDeaths.push(a);
  }
  if (chainDeaths.length) {
    const loverName = getPlayer(game, chainDeaths[0])?.name;
    announcements.push(`💔 ${loverName} murió de amor por ${target?.name}.`);
    updatedPlayers = updatedPlayers.map(p =>
      chainDeaths.includes(p.uid) ? { ...p, isAlive: false } : p
    );
  }

  const winResult = checkWinCondition(updatedPlayers, game);

  if (target?.role === 'cazador') {
    await updateDoc(doc(db, 'games', gameId), {
      players: updatedPlayers,
      phase: 'vote-result',
      dayAnnouncements: [...announcements, `🔫 El Cazador murió. Ahora debe elegir a quién llevarse.`],
      hunterPendingDeath: eliminated,
      phaseStartedAt: Date.now(),
      phaseDuration: 30,
      ...(winResult ? { winner: winResult.winner, winnerTeam: winResult.team, status: 'ended' } : {}),
    });
    return;
  }

  await updateDoc(doc(db, 'games', gameId), {
    players: updatedPlayers,
    phase: winResult ? 'ended' : 'vote-result',
    dayAnnouncements: announcements,
    phaseStartedAt: Date.now(),
    phaseDuration: 6,
    ...(winResult ? { winner: winResult.winner, winnerTeam: winResult.team, status: 'ended' } : {}),
  });

  for (const ann of announcements) {
    await addSystemMessage(gameId, 'publicChat', ann);
  }
}

export async function resolveHunterShot(gameId: string, game: GameState, targetUid: string): Promise<void> {
  const target = getPlayer(game, targetUid);
  const hunterName = getPlayer(game, game.hunterPendingDeath ?? '')?.name;
  const updatedPlayers = game.players.map(p =>
    p.uid === targetUid ? { ...p, isAlive: false } : p
  );
  const announcement = `🔫 ${hunterName} usó su última bala y se llevó a ${target?.name} con él.`;
  await addSystemMessage(gameId, 'publicChat', announcement);

  const winResult = checkWinCondition(updatedPlayers, game);
  await updateDoc(doc(db, 'games', gameId), {
    players: updatedPlayers, hunterPendingDeath: null, hunterUsed: true,
    phase: winResult ? 'ended' : 'night-result',
    dayAnnouncements: [announcement],
    phaseStartedAt: Date.now(), phaseDuration: 5,
    ...(winResult ? { winner: winResult.winner, winnerTeam: winResult.team, status: 'ended' } : {}),
  });
}

export function checkWinCondition(players: Player[], game: GameState): { winner: string; team: Team } | null {
  const alive = players.filter(p => p.isAlive);
  const aliveWolves = alive.filter(p => p.role === 'lobo' || p.role === 'cria_lobo' || p.transformedToWolf);
  const aliveVillagers = alive.filter(p => p.team === 'aldeanos' && !p.transformedToWolf);

  if (aliveWolves.length === 0 && alive.length > 0) {
    return { winner: 'aldeanos', team: 'aldeanos' };
  }
  if (aliveWolves.length >= aliveVillagers.length) {
    return { winner: 'lobos', team: 'lobos' };
  }
  return null;
}

export function getPlayer(game: GameState, uid: string): Player | undefined {
  return game.players.find(p => p.uid === uid);
}

async function addSystemMessage(gameId: string, channel: string, text: string) {
  await addDoc(collection(db, 'games', gameId, channel), {
    senderId: 'system',
    senderName: 'Narrador',
    text,
    isSystem: true,
    createdAt: serverTimestamp(),
  });
}
