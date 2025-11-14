
'use server';

import { 
  Timestamp,
  type Transaction,
  DocumentReference,
} from "firebase/firestore";
import { 
  type Game, 
  type Player, 
  type GameEvent, type PlayerRole,
} from "@/types";
import { toPlainObject } from "./utils";
import { roleDetails } from "./roles";

const PHASE_DURATION_SECONDS = 60;

export async function processNight(transaction: Transaction, gameRef: DocumentReference<Game>) {
  const gameSnap = await transaction.get(gameRef);
  if (!gameSnap.exists()) throw new Error("Game not found!");
  
  let game = gameSnap.data()!;
  
  if (game.phase === 'role_reveal' && game.status === 'in_progress') {
     const phaseEndsAt = new Date(Date.now() + PHASE_DURATION_SECONDS * 1000);
     transaction.update(gameRef, toPlainObject({ phase: 'night', phaseEndsAt }));
     return;
  }
  
  if (game.phase !== 'night' || game.status === 'finished') {
      return;
  }
  
  const initialPlayerState = JSON.parse(JSON.stringify(game.players));
  const actions = game.nightActions?.filter(a => a.round === game.currentRound) || [];

  // FASE 1: MANIPULACIÓN Y CONTROL
  actions.forEach(action => {
      const playerIndex = game.players.findIndex(p => p.userId === action.playerId);
      if (playerIndex === -1) return;

      if (action.actionType === 'silencer_silence') game.silencedPlayerId = action.targetId;
      if (action.actionType === 'elder_leader_exile') game.exiledPlayerId = action.targetId;
  });
  
  // FASE 2: PROTECCIÓN
  const protections: { targetId: string, type: 'bless' | 'potion' | 'guard' }[] = [];
  actions.forEach(action => {
      if (action.actionType === 'priest_bless') protections.push({ targetId: action.targetId, type: 'bless' });
      if (action.actionType === 'hechicera_save') protections.push({ targetId: action.targetId, type: 'potion' });
      if (action.actionType === 'doctor_heal' || action.actionType === 'guardian_protect') {
          protections.push({ targetId: action.targetId, type: 'guard' });
      }
  });


  // FASE 3: ACCIONES LETALES Y DE CONVERSIÓN
  let pendingDeaths: { playerId: string; cause: GameEvent['type']; message: string; }[] = [];
  
  if (game.leprosaBlockedRound !== game.currentRound) {
      const wolfVotes = actions.filter(a => a.actionType === 'werewolf_kill').map(a => a.targetId);
      const getConsensusTarget = (votes: string[]) => {
          if (votes.length === 0) return null;
          const voteCounts: Record<string, number> = {};
          votes.forEach(vote => vote.split('|').forEach(target => {
              if(target) voteCounts[target] = (voteCounts[target] || 0) + 1;
          }));
          const maxVotes = Math.max(...Object.values(voteCounts), 0);
          if (maxVotes === 0) return null;
          const mostVotedTargets = Object.keys(voteCounts).filter(id => voteCounts[id] === maxVotes);
          return mostVotedTargets[0] || null;
      };
      const wolfTargetId = getConsensusTarget(wolfVotes);
      
      if (wolfTargetId) {
          const targetPlayer = game.players.find(p => p.userId === wolfTargetId);
          if(targetPlayer?.role === 'cursed' && game.settings.cursed && !protections.some(p => p.targetId === wolfTargetId)) {
               const cursedPlayerIndex = game.players.findIndex(p => p.userId === wolfTargetId);
               if (cursedPlayerIndex !== -1) {
                   game.players[cursedPlayerIndex].role = 'werewolf';
                   game.events.push({ id: `evt_transform_cursed_${Date.now()}`, gameId: game.id, round: game.currentRound, type: 'player_transformed', message: `¡${targetPlayer.displayName} ha sido mordido y se ha transformado en Hombre Lobo!`, data: { targetId: targetPlayer.userId, newRole: 'werewolf' }, createdAt: new Date() });
               }
          } else {
              pendingDeaths.push({ playerId: wolfTargetId, cause: 'werewolf_kill', message: `Las marcas son inconfundibles: obra de los hombres lobo.` });
          }
      }
  }

  const hechiceraPoisonAction = actions.find(a => a.actionType === 'hechicera_poison');
  if(hechiceraPoisonAction) {
    pendingDeaths.push({ playerId: hechiceraPoisonAction.targetId, cause: 'special', message: `Yace sin una sola herida, pero con un rictus de dolor. Parece haber sido envenenado.` });
  }
  
  const fairyKillAction = actions.find(a => a.actionType === 'fairy_kill');
  if(fairyKillAction) {
    pendingDeaths.push({ playerId: fairyKillAction.targetId, cause: 'special', message: `Un aura de magia oscura rodea el cuerpo. Ha sido víctima de una maldición fatal.` });
  }

  actions.filter(a => a.actionType === 'vampire_bite').forEach(action => {
      const targetIndex = game.players.findIndex(p => p.userId === action.targetId);
      if (targetIndex === -1) return;
      game.players[targetIndex].biteCount = (game.players[targetIndex].biteCount || 0) + 1;
      if (game.players[targetIndex].biteCount >= 3) {
          pendingDeaths.push({ playerId: action.targetId, cause: 'vampire_kill', message: `Está pálido y exangüe, con dos pequeñas marcas en el cuello.` });
          game.vampireKills = (game.vampireKills || 0) + 1;
      }
  });


  // FASE 4: INVESTIGACIÓN Y RECLUTAMIENTO
  actions.forEach(action => {
      if (action.actionType === 'cult_recruit') {
          const targetIndex = game.players.findIndex(p => p.userId === action.targetId);
          if (targetIndex !== -1) game.players[targetIndex].isCultMember = true;
      }
      if (action.actionType === 'fisherman_catch') {
          const targetIndex = game.players.findIndex(p => p.userId === action.targetId);
          if (targetIndex !== -1) game.boat.push(action.targetId);
      }
  });


  // FASE 5: RESOLUCIÓN FINAL
  let savedPlayerIds = new Set<string>();
  let finalDeaths = pendingDeaths.filter(death => {
      const isBlessed = protections.some(p => p.targetId === death.playerId && p.type === 'bless');
      if (isBlessed) { savedPlayerIds.add(death.playerId); return false; }
      
      const isPotionSaved = protections.some(p => p.targetId === death.playerId && p.type === 'potion');
      if (isPotionSaved) { savedPlayerIds.add(death.playerId); return false; }

      if (death.cause === 'werewolf_kill') {
          const isGuarded = protections.some(p => p.targetId === death.playerId && p.type === 'guard');
          if (isGuarded) { savedPlayerIds.add(death.playerId); return false; }
      }
      return true;
  });

  let triggeredHunterId: string | null = null;
  for (const death of finalDeaths) {
      const { updatedGame, triggeredHunterId: newHunterId } = await killPlayer(transaction, gameRef, game, death.playerId, death.cause, death.message);
      game = updatedGame;
      if(newHunterId) triggeredHunterId = newHunterId;
  }
  
  let gameOverInfo = await checkGameOver(game);
  if (gameOverInfo.isGameOver) {
      game.status = "finished";
      game.phase = "finished";
      game.events.push({ id: `evt_gameover_${Date.now()}`, gameId: game.id, round: game.currentRound, type: 'game_over', message: gameOverInfo.message, data: { winnerCode: gameOverInfo.winnerCode, winners: gameOverInfo.winners }, createdAt: new Date() });
      transaction.update(gameRef, toPlainObject({ status: 'finished', phase: 'finished', players: game.players, events: game.events }));
      return;
  }

  if (triggeredHunterId) {
      game.pendingHunterShot = triggeredHunterId;
      transaction.update(gameRef, toPlainObject({ players: game.players, events: game.events, phase: 'hunter_shot', pendingHunterShot: game.pendingHunterShot }));
      return;
  }
  
  const newlyKilledPlayers = game.players.filter(p => !p.isAlive && initialPlayerState.find((ip:any) => ip.userId === p.userId)?.isAlive);
  
  let nightMessage;
  if (newlyKilledPlayers.length > 0) {
      nightMessage = `Anoche, el pueblo perdió a ${newlyKilledPlayers.map(p => p.displayName).join(', ')}.`;
  } else if (pendingDeaths.length > 0 && savedPlayerIds.size > 0) {
      nightMessage = "La noche fue tensa. Los lobos atacaron, pero alguien fue salvado por una fuerza protectora.";
  } else {
      nightMessage = "La noche transcurre en un inquietante silencio. Nadie ha muerto.";
  }
  
  const leprosaDeath = newlyKilledPlayers.find(p => p.role === 'leprosa');
  if (leprosaDeath && game.leprosaBlockedRound === game.currentRound + 1) {
      nightMessage += ` Como consecuencia de la muerte de la Leprosa, los lobos no podrán atacar la próxima noche.`;
  }

  game.events.push({ id: `evt_night_${game.currentRound}`, gameId: game.id, round: game.currentRound, type: 'night_result', message: nightMessage, data: { killedPlayerIds: newlyKilledPlayers.map(p => p.userId), savedPlayerIds: Array.from(savedPlayerIds) }, createdAt: new Date() });

  game.players.forEach(p => { p.votedFor = null; p.usedNightAbility = false; p.isExiled = false; });
  const phaseEndsAt = new Date(Date.now() + PHASE_DURATION_SECONDS * 1000);
  
  transaction.update(gameRef, toPlainObject({
      ...game,
      phase: 'day', phaseEndsAt,
      pendingHunterShot: null, silencedPlayerId: null, exiledPlayerId: null,
  }));
}
