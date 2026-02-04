

'use server';

import { type Transaction, type DocumentReference } from "firebase-admin/firestore";
import { 
  type Game, 
  type Player, 
  type GameEvent, type PlayerRole, type PlayerPublicData, type PlayerPrivateData,
  type NightAction,
  type NightActionType,
} from "@/types";
import { toPlainObject, getMillis, splitPlayerData, PHASE_DURATION_SECONDS } from "@/lib/utils";
import { roleDetails } from "./roles";
import { adminDb } from './firebase-admin';

export const generateRoles = (playerCount: number, settings: Game['settings']): (PlayerRole)[] => {
    let roles: PlayerRole[] = [];
    
    const numWerewolves = Math.max(1, Math.floor(playerCount / 5));
    for (let i = 0; i < numWerewolves; i++) {
        roles.push('werewolf');
    }

    const availableSpecialRoles: PlayerRole[] = (Object.keys(settings) as Array<keyof typeof settings>)
        .filter(key => {
            const roleKey = key as PlayerRole;
            return settings[key as keyof Game['settings']] === true && roleKey && roleDetails[roleKey as keyof typeof roleDetails];
        })
        .sort(() => Math.random() - 0.5) as PlayerRole[];
    
    for (const specialRole of availableSpecialRoles) {
        if (roles.length >= playerCount) break;

        if (specialRole === 'twin') {
            if (roles.length + 2 <= playerCount) {
                roles.push('twin', 'twin');
            }
        } else {
            roles.push(specialRole);
        }
    }
    
    while (roles.length < playerCount) {
        roles.push('villager');
    }

    return roles.sort(() => Math.random() - 0.5);
};


async function performKill(transaction: Transaction, gameRef: DocumentReference, gameData: Game, players: Player[], playerIdToKill: string | null, cause: GameEvent['type'], customMessage?: string): Promise<{ updatedGame: Game; updatedPlayers: Player[]; triggeredHunterId: string | null; }> {
    let newGameData = { ...gameData };
    let newPlayers = [...players];
    let triggeredHunterId: string | null = null;
    
    if (!playerIdToKill) return { updatedGame: newGameData, updatedPlayers: newPlayers, triggeredHunterId };

    const killQueue: {id: string, cause: GameEvent['type'], message?: string}[] = [{id: playerIdToKill, cause, message: customMessage}];
    const alreadyProcessed = new Set<string>();

    while (killQueue.length > 0) {
        const {id: currentIdToKill, cause: currentCause, message: currentMessage} = killQueue.shift()!;
        if (!currentIdToKill || alreadyProcessed.has(currentIdToKill)) {
            continue;
        }

        const playerIndex = newPlayers.findIndex((p: Player) => p.userId === currentIdToKill);
        if (playerIndex === -1 || !newPlayers[playerIndex].isAlive) {
            continue;
        }
        
        alreadyProcessed.add(currentIdToKill);
        const playerToKill = { ...newPlayers[playerIndex] };
        
        newPlayers[playerIndex].isAlive = false;
        
        const deathMessage = currentMessage || `${playerToKill.displayName} ha muerto. Su rol era: ${roleDetails[playerToKill.role!]?.name || 'Desconocido'}`;

        newGameData.events.push({
            id: `evt_${currentCause}_${Date.now()}_${currentIdToKill}`,
            gameId: newGameData.id!, round: newGameData.currentRound, type: currentCause,
            message: deathMessage,
            data: { killedPlayerIds: [currentIdToKill], revealedRole: playerToKill.role }, createdAt: new Date(),
        });
        
        // --- Post-death triggers ---

        // Executioner Fail Condition
        const executioner = newPlayers.find(p => p.isAlive && p.role === 'executioner' && p.executionerTargetId === playerToKill.userId);
        if (executioner && cause !== 'vote_result') {
            const execIndex = newPlayers.findIndex(p => p.userId === executioner.userId);
            if (execIndex > -1) {
                newPlayers[execIndex].role = 'villager';
                newPlayers[execIndex].executionerTargetId = null;

                const execPrivateRef = adminDb.collection('games').doc(newGameData.id).collection('playerData').doc(executioner.userId);
                transaction.update(execPrivateRef, { role: 'villager', executionerTargetId: null });

                newGameData.events.push({
                    id: `evt_exec_fail_${Date.now()}`,
                    gameId: newGameData.id, round: newGameData.currentRound, type: 'special',
                    message: 'Tu objetivo ha muerto por otras causas. Has perdido tu objetivo y ahora eres un simple aldeano. Ganas con el pueblo.',
                    data: { targetId: executioner.userId }, createdAt: new Date(),
                });
            }
        }
        
        // Shapeshifter transformation logic
        const shapeshifterIndex = newPlayers.findIndex((p: Player) => 
            p.isAlive && 
            p.role === 'shapeshifter' && 
            p.shapeshifterTargetId === playerToKill.userId
        );

        if (shapeshifterIndex !== -1 && playerToKill.role) {
            const shifter = newPlayers[shapeshifterIndex];
            const newRole = playerToKill.role;
            
            newPlayers[shapeshifterIndex].role = newRole;
            newPlayers[shapeshifterIndex].shapeshifterTargetId = null; 
            
            const shifterPrivateRef = adminDb.collection('games').doc(newGameData.id).collection('playerData').doc(shifter.userId);
            transaction.update(shifterPrivateRef, {
                role: newRole,
                shapeshifterTargetId: null,
            });

            newGameData.events.push({ 
                id: `evt_transform_${Date.now()}_${shifter.userId}`,
                gameId: newGameData.id, 
                round: newGameData.currentRound, 
                type: 'special',
                message: `¡Has cambiado de forma! Ahora eres: ${roleDetails[newRole]?.name || 'un rol desconocido'}. Tu nuevo objetivo es ganar con tu nuevo equipo.`,
                data: { targetId: shifter.userId },
                createdAt: new Date(),
            });
        }
        
        // Other triggers
        if (playerToKill.role === 'seer' && newGameData.settings.seer_apprentice) newGameData.seerDied = true;
        if (playerToKill.role === 'hunter' && newGameData.settings.hunter && !triggeredHunterId) triggeredHunterId = playerToKill.userId;
        if (playerToKill.role === 'leprosa' && currentCause === 'werewolf_kill') newGameData.leprosaBlockedRound = newGameData.currentRound + 1;
        if (playerToKill.role === 'wolf_cub') newGameData.wolfCubRevengeRound = newGameData.currentRound;

        const checkAndQueueChainDeath = (linkedIds: (string[] | null | undefined), deadPlayer: Player, messageTemplate: string, eventType: GameEvent['type']) => {
            if (!linkedIds || !linkedIds.includes(deadPlayer.userId)) return;

            const otherId = linkedIds.find(id => id !== deadPlayer.userId);
            const otherPlayer = otherId ? newPlayers.find(p => p.userId === otherId) : undefined;
            
            if (otherPlayer && otherPlayer.isAlive && !alreadyProcessed.has(otherId!) && !killQueue.some(k => k.id === otherId)) {
                killQueue.push({
                    id: otherId!,
                    cause: eventType,
                    message: messageTemplate.replace('{otherName}', otherPlayer.displayName).replace('{victimName}', deadPlayer.displayName),
                });
            }
        };
        
        if (playerToKill.isLover && newGameData.lovers) {
             const otherLoverId = newGameData.lovers.find(id => id !== playerToKill.userId);
             if (otherLoverId) {
                checkAndQueueChainDeath([playerToKill.userId, otherLoverId], playerToKill, 'Por un amor eterno, {otherName} se quita la vida tras la muerte de {victimName}.', 'lover_death');
             }
        }
        
        if (playerToKill.virginiaWoolfTargetId) {
             checkAndQueueChainDeath([playerToKill.userId, playerToKill.virginiaWoolfTargetId], playerToKill, 'Arrastrado por un vínculo fatal, {otherName} muere junto a {victimName}.', 'special');
        }
    }
    
    return { updatedGame: newGameData, updatedPlayers: newPlayers, triggeredHunterId };
}


export async function killPlayer(transaction: Transaction, gameRef: DocumentReference, gameData: Game, players: Player[], playerIdToKill: string, cause: GameEvent['type'], customMessage?: string): Promise<{ updatedGame: Game; updatedPlayers: Player[]; triggeredHunterId: string | null; }> {
    const playerToKill = players.find(p => p.userId === playerIdToKill);
    if (!playerToKill || !playerToKill.isAlive) return { updatedGame: gameData, updatedPlayers: players, triggeredHunterId: null };

    if (cause === 'vote_result' && playerToKill.role === 'prince' && gameData.settings.prince && !playerToKill.princeRevealed) {
        let updatedGame = { ...gameData };
        let updatedPlayers = [...players];
        const playerIndex = updatedPlayers.findIndex(p => p.userId === playerIdToKill);

        if (playerIndex > -1) {
            updatedPlayers[playerIndex].princeRevealed = true;
            
            const playerPublicRef = adminDb.collection('games').doc(gameData.id).collection('players').doc(playerIdToKill);
            transaction.update(playerPublicRef, { princeRevealed: true });

            updatedGame.events.push({
                id: `evt_prince_reveal_${Date.now()}`,
                gameId: gameData.id,
                round: gameData.currentRound,
                type: 'vote_result',
                message: `${playerToKill.displayName} ha sido sentenciado, ¡pero revela su identidad como Príncipe y sobrevive!`,
                createdAt: new Date(),
                data: { lynchedPlayerId: null, final: true, revealedPlayerId: playerIdToKill },
            });
            // Add notable play event for the prince
            updatedGame.events.push({
                id: `evt_notable_prince_${Date.now()}`,
                gameId: gameData.id,
                round: gameData.currentRound,
                type: 'special',
                message: 'El príncipe se revela.', // This message is internal
                createdAt: new Date(),
                data: {
                  notablePlayerId: playerIdToKill,
                  notablePlay: {
                      title: '¡Sangre Real!',
                      description: `Te revelaste como Príncipe y sobreviviste al linchamiento.`,
                  },
                },
            });
            return { updatedGame, updatedPlayers, triggeredHunterId: null };
        }
    }
    
    return performKill(transaction, gameRef, gameData, players, playerIdToKill, cause, customMessage);
}

export async function killPlayerUnstoppable(transaction: Transaction, gameRef: DocumentReference, gameData: Game, players: Player[], playerIdToKill: string, cause: GameEvent['type'], customMessage?: string): Promise<{ updatedGame: Game; updatedPlayers: Player[]; triggeredHunterId: string | null; }> {
    return performKill(transaction, gameRef, gameData, players, playerIdToKill, cause, customMessage);
}

function generateBehavioralClue(game: Game, players: Player[], nightActions: NightAction[], nightContext: any): string | null {
    const clues: string[] = [];

    // Clue 1: Two people visit the same house
    const visits = new Map<string, string[]>(); // targetId -> [visitorId, visitorId...]
    const visitorActions: NightActionType[] = ['seer_check', 'doctor_heal', 'guardian_protect', 'priest_bless', 'werewolf_kill', 'hechicera_poison', 'vampire_bite', 'witch_hunt'];
    for (const action of nightActions) {
        if (visitorActions.includes(action.actionType)) {
            const visitors = visits.get(action.targetId) || [];
            if (!visitors.includes(action.playerId)) { // Don't count the same player twice (e.g. multi-kill)
                visitors.push(action.playerId);
            }
            visits.set(action.targetId, visitors);
        }
    }

    for (const [targetId, visitorIds] of visits.entries()) {
        if (visitorIds.length > 1) {
            const target = players.find(p => p.userId === targetId);
            if (target && target.isAlive) { // Only report on alive targets
                clues.push(`Anoche se escucharon ruidos de pasos cerca de la casa de ${target.displayName}, como si varias personas la hubieran visitado.`);
            }
        }
    }

    // Clue 2: A protected player was targeted by wolves
    const wolfAction = nightActions.find(a => a.actionType === 'werewolf_kill');
    if (wolfAction) {
        const targetId = wolfAction.targetId;
        const targetProtections = nightContext.protections.get(targetId);
        if (targetProtections && (targetProtections.has('guard') || targetProtections.has('bless'))) {
             clues.push("Se escuchó un aullido en la distancia, seguido por el sonido metálico de algo siendo bloqueado, como un escudo.");
        }
    }
    
    // Clue 3: The Leprosa blocked the wolves
    if (game.leprosaBlockedRound === game.currentRound && nightActions.some(a => a.actionType === 'werewolf_kill')) {
         clues.push("Los lobos parecieron desorientados anoche, como si una extraña enfermedad les impidiera cazar.");
    }


    // Clue 4: Generic flavor text if no other clue is generated
    if (clues.length === 0) {
        const flavorClues = [
            "El panadero se queja de que el pan no ha subido bien esta noche.",
            "Un viento gélido barrió las calles del pueblo, haciendo que todos los perros ladraran.",
            "La campana de la iglesia sonó una vez a medianoche, aunque nadie sabe por qué.",
            "Se vio una luz parpadeante en la ventana del viejo molino abandonado."
        ];
        if (Math.random() < 0.4) { // Only add flavor text sometimes
             clues.push(flavorClues[Math.floor(Math.random() * flavorClues.length)]);
        }
    }

    if (clues.length === 0) return null;

    // Pick one of the generated clues at random
    return clues[Math.floor(Math.random() * clues.length)];
}

export async function processNightEngine(transaction: Transaction, gameRef: DocumentReference, game: Game, fullPlayers: Player[]) {
  if (game.phaseEndsAt && getMillis(game.phaseEndsAt) > Date.now()) {
      console.warn("processNight called before phase end. Ignoring.");
      return { nightEvent: undefined };
  }

  if (game.phase === 'role_reveal' && game.status === 'in_progress') {
     const phaseEndsAt = new Date(Date.now() + PHASE_DURATION_SECONDS * 1000);
     transaction.update(gameRef, toPlainObject({ phase: 'night', phaseEndsAt, currentRound: 1 }));
     return { nightEvent: undefined };
  }
  
  if (game.phase !== 'night' || game.status === 'finished') {
      return { nightEvent: undefined };
  }
  
  const initialPlayers = JSON.parse(JSON.stringify(fullPlayers));
  const actions = (game.nightActions?.filter(a => a.round === game.currentRound) || [])
      .sort((a, b) => getActionPriority(a.actionType) - getActionPriority(b.actionType));

  const context = {
      protections: new Map<string, Set<'guard' | 'bless'>>(),
      deathMarks: new Map<string, GameEvent['type']>(),
      savedByHealPotion: new Map<string, string>(), // TargetId -> SaviorId
      bites: new Map<string, number>(),
      gameUpdates: {} as Partial<Game>,
      playerUpdates: new Map<string, Partial<PlayerPrivateData>>(),
      newEvents: [] as GameEvent[],
  };

  const getPlayer = (userId: string) => {
      const updatedPlayer = context.playerUpdates.get(userId);
      const originalPlayer = fullPlayers.find(p => p.userId === userId);
      return { ...originalPlayer, ...updatedPlayer } as Player;
  }

  for (const action of actions) {
      const actor = getPlayer(action.playerId);
      if (!actor || !actor.isAlive || game.exiledPlayerId === actor.userId) continue;

      if (action.actionType === 'cupid_love') {
        if (game.currentRound !== 1) continue;
        const targetIds = action.targetId.split('|');
        if (targetIds.length !== 2) continue;

        const [lover1Id, lover2Id] = targetIds;
        context.gameUpdates.lovers = [lover1Id, lover2Id];

        const lover1Updates = context.playerUpdates.get(lover1Id) || {};
        context.playerUpdates.set(lover1Id, { ...lover1Updates, isLover: true });

        const lover2Updates = context.playerUpdates.get(lover2Id) || {};
        context.playerUpdates.set(lover2Id, { ...lover2Updates, isLover: true });

        const lover1Name = getPlayer(lover1Id)?.displayName;
        const lover2Name = getPlayer(lover2Id)?.displayName;
        
        context.newEvents.push({
            id: `evt_lover_link_${Date.now()}_1`,
            gameId: game.id, round: game.currentRound, type: 'special',
            message: `Has sido flechado por Cupido. Tu amor eterno es ${lover2Name}. Vuestro objetivo ahora es sobrevivir juntos, por encima de todo.`,
            data: { targetId: lover1Id }, createdAt: new Date(),
        });
        context.newEvents.push({
            id: `evt_lover_link_${Date.now()}_2`,
            gameId: game.id, round: game.currentRound, type: 'special',
            message: `Has sido flechado por Cupido. Tu amor eterno es ${lover1Name}. Vuestro objetivo ahora es sobrevivir juntos, por encima de todo.`,
            data: { targetId: lover2Id }, createdAt: new Date(),
        });
        continue;
      }

      // Handle targetless actions
      if (action.actionType === 'lookout_spy') {
          const lookoutPrivateRef = adminDb.collection('games').doc(game.id).collection('playerData').doc(actor.userId);
          const lookoutUpdates = context.playerUpdates.get(actor.userId) || {};
          context.playerUpdates.set(actor.userId, { ...lookoutUpdates, lookoutUsed: true });

          const wolvesAttackedLookout = context.deathMarks.get(actor.userId) === 'werewolf_kill';

          if (wolvesAttackedLookout) {
              // Lookout was targeted, they die. The deathMark is already set. Nothing more to do.
          } else {
              // Lookout succeeds.
              const wolfRoles: PlayerRole[] = ['werewolf', 'wolf_cub'];
              const aliveWolves = fullPlayers.filter(p => p.isAlive && p.role && wolfRoles.includes(p.role));
              
              if (aliveWolves.length > 0) {
                  const wolfNames = aliveWolves.map(w => w.displayName).join(', ');
                  const successMessage = `En las sombras, has logrado identificar a la manada. Los lobos son: ${wolfNames}.`;
                  context.newEvents.push({
                      id: `evt_lookout_success_${Date.now()}`,
                      gameId: game.id, round: game.currentRound, type: 'special',
                      message: successMessage, data: { targetId: actor.userId }, createdAt: new Date(),
                  });
              } else {
                  const noWolvesMessage = `Has espiado en la noche, pero no has encontrado rastro de lobos.`;
                   context.newEvents.push({
                      id: `evt_lookout_nowolves_${Date.now()}`,
                      gameId: game.id, round: game.currentRound, type: 'special',
                      message: noWolvesMessage, data: { targetId: actor.userId }, createdAt: new Date(),
                  });
              }
          }
          continue; // Done with this action, move to the next.
      }


      const targetIds = action.targetId.split('|');

      for (const targetId of targetIds) {
          const target = getPlayer(targetId);
          if (!target) continue;

          switch (action.actionType) {
              case 'resurrect': {
                  if (target.isAlive) break; 
                  const actorUpdates = context.playerUpdates.get(actor.userId) || {};
                  context.playerUpdates.set(actor.userId, { ...actorUpdates, resurrectorAngelUsed: true });
                  
                  const targetUpdates = context.playerUpdates.get(targetId) || {};
                  context.playerUpdates.set(targetId, { ...targetUpdates, isAlive: true });

                  context.newEvents.push({
                      id: `evt_resurrect_${Date.now()}`,
                      gameId: game.id, round: game.currentRound, type: 'special',
                      message: `${target.displayName} ha sido devuelto a la vida por el Ángel Resucitador.`,
                      data: { resurrectedPlayerId: targetId }, createdAt: new Date(),
                  });
                  break;
              }
              case 'banshee_scream': {
                  const updates = context.playerUpdates.get(actor.userId) || {};
                  const newScreams = { ...(actor.bansheeScreams || {}), [game.currentRound]: targetId };
                  context.playerUpdates.set(actor.userId, { ...updates, bansheeScreams: newScreams });
                  break;
              }
              case 'priest_bless':
              case 'guardian_protect':
              case 'doctor_heal':
                  const protectionType = action.actionType === 'priest_bless' ? 'bless' : 'guard';
                  const currentProtections = context.protections.get(targetId) || new Set();
                  currentProtections.add(protectionType);
                  context.protections.set(targetId, currentProtections);
                  if (protectionType === 'guard') {
                      const updates = context.playerUpdates.get(targetId) || {};
                      context.playerUpdates.set(targetId, {...updates, lastHealedRound: game.currentRound});
                  }
                  break;

              case 'werewolf_kill':
                  if (game.leprosaBlockedRound === game.currentRound) {
                      const wolfEventMessage = `El miasma de la Leprosa que matasteis la noche anterior os impide cazar esta noche.`;
                      const wolves = fullPlayers.filter(p => p.isAlive && (p.role === 'werewolf' || p.role === 'wolf_cub'));
                      for (const wolf of wolves) {
                          context.newEvents.push({
                              id: `evt_leprosa_block_${Date.now()}_${wolf.userId}`,
                              gameId: game.id, round: game.currentRound, type: 'special',
                              message: wolfEventMessage,
                              data: { targetId: wolf.userId }, createdAt: new Date(),
                          });
                      }
                      break; // Skip the kill
                  }
                  if (target.role === 'cursed' && game.settings.cursed) {
                      const updates = context.playerUpdates.get(targetId) || {};
                      context.playerUpdates.set(targetId, { ...updates, role: 'werewolf' });

                      const transformEvent: GameEvent = {
                          id: `evt_cursed_transform_${Date.now()}`,
                          gameId: game.id, round: game.currentRound, type: 'special',
                          message: '¡Has sido atacado por los lobos! La maldición se ha apoderado de ti y ahora eres uno de ellos. Tu nuevo objetivo es ganar con la manada.',
                          data: { targetId }, createdAt: new Date(),
                      };
                      context.newEvents.push(transformEvent);

                      const wolfEventMessage = `${target.displayName} ha sido atacado y se ha unido a la manada. ¡Ahora es un Hombre Lobo!`;
                      const wolves = fullPlayers.filter(p => p.isAlive && (p.role === 'werewolf' || p.role === 'wolf_cub'));
                      for (const wolf of wolves) {
                          context.newEvents.push({
                              id: `evt_cursed_inform_${Date.now()}_${wolf.userId}`,
                              gameId: game.id, round: game.currentRound, type: 'special',
                              message: wolfEventMessage,
                              data: { targetId: wolf.userId }, createdAt: new Date(),
                          });
                      }
                  } else if (game.witchFoundSeer && target.role === 'witch') {
                        const wolfEventMessage = `Intentasteis atacar a la Bruja, pero un poder oscuro la protegió.`;
                        const wolves = fullPlayers.filter(p => p.isAlive && (p.role === 'werewolf' || p.role === 'wolf_cub'));
                        for (const wolf of wolves) {
                            context.newEvents.push({
                                id: `evt_witch_protect_${Date.now()}_${wolf.userId}`,
                                gameId: game.id, round: game.currentRound, type: 'special',
                                message: wolfEventMessage,
                                data: { targetId: wolf.userId }, createdAt: new Date(),
                            });
                        }
                  } else if (!context.protections.get(targetId)?.has('guard') && !context.protections.get(targetId)?.has('bless')) {
                      context.deathMarks.set(targetId, 'werewolf_kill');
                  }
                  break;
              
              case 'hechicera_poison':
                  if (!context.protections.get(targetId)?.has('bless')) {
                     context.deathMarks.set(targetId, 'special');
                     const updates = context.playerUpdates.get(actor.userId) || {};
                     context.playerUpdates.set(actor.userId, {...updates, potions: {...actor.potions, poison: game.currentRound}});
                  }
                  break;

              case 'vampire_bite':
                  const newBiteCount = (target.biteCount || 0) + 1;
                  context.playerUpdates.set(targetId, { ...context.playerUpdates.get(targetId), biteCount: newBiteCount });
                  if (newBiteCount >= 3) {
                      if (!context.protections.get(targetId)?.has('bless')) {
                        context.deathMarks.set(targetId, 'vampire_kill');
                        context.gameUpdates.vampireKills = (game.vampireKills || 0) + 1;
                      }
                  }
                  break;

               case 'hechicera_save':
                    context.savedByHealPotion.set(targetId, actor.userId);
                    const updates = context.playerUpdates.get(actor.userId) || {};
                    context.playerUpdates.set(actor.userId, {...updates, potions: {...actor.potions, save: game.currentRound}});
                    break;
                
                case 'shapeshifter_select': {
                    if (game.currentRound !== 1) break;
                    const actorUpdates = context.playerUpdates.get(actor.userId) || {};
                    context.playerUpdates.set(actor.userId, { ...actorUpdates, shapeshifterTargetId: targetId });
                    break;
                }
                case 'virginia_woolf_link': {
                    if (game.currentRound !== 1) break;
                    const actorUpdates = context.playerUpdates.get(actor.userId) || {};
                    context.playerUpdates.set(actor.userId, { ...actorUpdates, virginiaWoolfTargetId: targetId });
                    break;
                }
                case 'river_siren_charm': {
                    if (game.currentRound !== 1) break;
                    const actorUpdates = context.playerUpdates.get(actor.userId) || {};
                    context.playerUpdates.set(actor.userId, { ...actorUpdates, riverSirenTargetId: targetId });
                    break;
                }
                case 'fisherman_catch': {
                    const boatUpdates = context.gameUpdates.boat || [...game.boat];
                    if (!boatUpdates.includes(targetId)) {
                        boatUpdates.push(targetId);
                        context.gameUpdates.boat = boatUpdates;

                        const targetPlayer = getPlayer(targetId);
                        const wolfRoles: PlayerRole[] = ['werewolf', 'wolf_cub'];
                        if (targetPlayer?.role && wolfRoles.includes(targetPlayer.role)) {
                            // Fisherman caught a wolf and dies.
                            context.deathMarks.set(actor.userId, 'special');
                            context.newEvents.push({
                                id: `evt_fisherman_fail_${Date.now()}`,
                                gameId: game.id, round: game.currentRound, type: 'special',
                                message: `¡Has pescado a un Lobo! La bestia te arrastra a las profundidades.`,
                                data: { targetId: actor.userId }, createdAt: new Date(),
                            });
                        }
                    }
                    break;
                }
              case 'cult_recruit':
                  const cultUpdates = context.playerUpdates.get(targetId) || {};
                  context.playerUpdates.set(targetId, { ...cultUpdates, isCultMember: true });
                  break;
              
              case 'silencer_silence':
                  context.gameUpdates.silencedPlayerId = targetId;
                  break;

              case 'elder_leader_exile':
                  context.gameUpdates.exiledPlayerId = targetId;
                  break;
              
              case 'witch_hunt':
                  if (target.role === 'seer' && !game.witchFoundSeer) {
                      context.gameUpdates.witchFoundSeer = true;
                      
                      const witchEvent: GameEvent = {
                          id: `evt_witch_find_${Date.now()}`,
                          gameId: game.id, round: game.currentRound, type: 'special',
                          message: '¡Has encontrado a la Vidente! A partir de ahora, la manada no puede elegirte como objetivo nocturno. Los lobos han sido informados de tu descubrimiento.',
                          data: { targetId: actor.userId },
                          createdAt: new Date(),
                      };
                      context.newEvents.push(witchEvent);
                      
                      const wolfEventMessage = `La Bruja (${actor.displayName}) ha encontrado a la Vidente (${target.displayName}). Ya no podéis atacar a la Bruja.`;
                      const wolves = fullPlayers.filter(p => p.isAlive && (p.role === 'werewolf' || p.role === 'wolf_cub'));
                      
                      for (const wolf of wolves) {
                           context.newEvents.push({
                              id: `evt_witch_inform_${Date.now()}_${wolf.userId}`,
                              gameId: game.id, round: game.currentRound, type: 'special',
                              message: wolfEventMessage,
                              data: { targetId: wolf.userId }, createdAt: new Date(),
                          });
                      }
                  }
                  break;
              case 'fairy_find':
                  if (target.role === 'sleeping_fairy') {
                      context.gameUpdates.fairiesFound = true;
                      const seekerEvent: GameEvent = {
                          id: `evt_fairy_found_seeker_${Date.now()}`,
                          gameId: game.id, round: game.currentRound, type: 'special',
                          message: `¡Has encontrado a tu compañera! Ahora podéis hablar en secreto y tramar vuestra venganza. Tenéis un solo asesinato que podéis cometer juntas.`,
                          data: { targetId: actor.userId }, createdAt: new Date(),
                      };
                      const sleeperEvent: GameEvent = {
                          id: `evt_fairy_found_sleeper_${Date.now()}`,
                          gameId: game.id, round: game.currentRound, type: 'special',
                          message: `¡El Hada Buscadora te ha encontrado! Ahora podéis hablar en secreto y tramar vuestra venganza. Tenéis un solo asesinato que podéis cometer juntas.`,
                          data: { targetId: target.userId }, createdAt: new Date(),
                      };
                      context.newEvents.push(seekerEvent, sleeperEvent);
                  } else {
                       const notFoundEvent: GameEvent = {
                          id: `evt_fairy_not_found_${Date.now()}`,
                          gameId: game.id, round: game.currentRound, type: 'special',
                          message: `Has buscado, pero ${target.displayName} no es el Hada Durmiente. Debes seguir buscando.`,
                          data: { targetId: actor.userId }, createdAt: new Date(),
                      };
                      context.newEvents.push(notFoundEvent);
                  }
                  break;
              case 'fairy_kill':
                  if (game.fairiesFound && !game.fairyKillUsed) {
                      if (!context.protections.get(targetId)?.has('guard') && !context.protections.get(targetId)?.has('bless')) {
                          context.deathMarks.set(targetId, 'special');
                          context.gameUpdates.fairyKillUsed = true;
                      }
                  }
                  break;
          }
      }
  }

  let mutableGame = JSON.parse(JSON.stringify(game));
  let mutableFullPlayers = JSON.parse(JSON.stringify(fullPlayers));
  Object.assign(mutableGame, context.gameUpdates);

  context.playerUpdates.forEach((updates, userId) => {
      const playerIndex = mutableFullPlayers.findIndex((p:Player) => p.userId === userId);
      if (playerIndex !== -1) {
          const privatePlayerRef = adminDb.collection('games').doc(game.id).collection('playerData').doc(userId);
          transaction.update(privatePlayerRef, toPlainObject(updates));
          mutableFullPlayers[playerIndex] = { ...mutableFullPlayers[playerIndex], ...updates };
      }
  });

  let triggeredHunterId: string | null = null;
  const killedPlayerIdsThisNight: string[] = [];
  const successfulSaves: Record<string, string> = {}; // savedPlayerId -> saviorId

  for (const [targetId, cause] of context.deathMarks.entries()) {
      let isSaved = false;
      let saviorId: string | undefined;

      if (context.savedByHealPotion.has(targetId)) {
          saviorId = context.savedByHealPotion.get(targetId)!;
          isSaved = true;
      }

      const targetProtections = context.protections.get(targetId);
      if (!isSaved && cause === 'werewolf_kill' && targetProtections) {
          if (targetProtections.has('guard')) {
              const guardAction = actions.find(a => (a.actionType === 'doctor_heal' || a.actionType === 'guardian_protect') && a.targetId === targetId);
              if (guardAction) {
                  saviorId = guardAction.playerId;
              }
              isSaved = true;
          } else if (targetProtections.has('bless')) {
              const blessAction = actions.find(a => a.actionType === 'priest_bless' && a.targetId === targetId);
              if (blessAction) {
                  saviorId = blessAction.playerId;
              }
              isSaved = true;
          }
      }
      
      if(isSaved && saviorId) {
        successfulSaves[targetId] = saviorId;
        continue;
      }

      const { updatedGame, updatedPlayers, triggeredHunterId: newHunterId } = await killPlayer(transaction, gameRef, mutableGame, mutableFullPlayers, targetId, cause, `Anoche, el pueblo perdió a ${mutableFullPlayers.find((p:Player)=>p.userId === targetId)?.displayName}.`);
      mutableGame = updatedGame;
      mutableFullPlayers = updatedPlayers;
      killedPlayerIdsThisNight.push(targetId);
      if(newHunterId) triggeredHunterId = newHunterId;
  }
  
    const bansheeAction = actions.find(a => a.actionType === 'banshee_scream');
    if (bansheeAction) {
        const screamTargetId = bansheeAction.targetId;
        if (killedPlayerIdsThisNight.includes(screamTargetId)) {
            const bansheePrivateRef = adminDb.collection('games').doc(game.id).collection('playerData').doc(bansheeAction.playerId);
            transaction.update(bansheePrivateRef, { 'bansheePoints': adminDb.FieldValue.increment(1) });
        }
    }

  mutableGame.events.push(...context.newEvents);
  
  const clue = generateBehavioralClue(game, initialPlayers, actions, context);
  if (clue) {
      const clueEvent: GameEvent = {
          id: `evt_clue_${mutableGame.currentRound}`,
          gameId: mutableGame.id,
          round: mutableGame.currentRound,
          type: 'behavior_clue',
          message: clue,
          createdAt: new Date(),
          data: {},
      };
      mutableGame.events.push(clueEvent);
  }

    // Add notable play events for successful saves
  for (const [savedId, saviorId] of Object.entries(successfulSaves)) {
      const savedPlayer = initialPlayers.find(p => p.userId === savedId);
      const saviorPlayer = initialPlayers.find(p => p.userId === saviorId);
      if (savedPlayer && saviorPlayer) {
          const notablePlayEvent: GameEvent = {
              id: `evt_notable_save_${Date.now()}_${saviorId}`,
              gameId: mutableGame.id,
              round: mutableGame.currentRound,
              type: 'special',
              message: `¡Jugada destacada! ${saviorPlayer.displayName} salvó a ${savedPlayer.displayName}.`,
              createdAt: new Date(),
              data: {
                  notablePlayerId: saviorId,
                  notablePlay: {
                      title: '¡Salvador!',
                      description: `Salvaste a ${savedPlayer.displayName} de una muerte segura.`,
                  },
              },
          };
          mutableGame.events.push(notablePlayEvent);
      }
  }


  let gameOverInfo = await checkGameOver(mutableGame, mutableFullPlayers);
  if (gameOverInfo.isGameOver) {
      mutableGame.status = "finished";
      mutableGame.phase = "finished";
      mutableGame.events.push({ id: `evt_gameover_${Date.now()}`, gameId: mutableGame.id, round: mutableGame.currentRound, type: 'game_over', message: gameOverInfo.message, data: { winnerCode: gameOverInfo.winnerCode, winners: gameOverInfo.winners }, createdAt: new Date() });
      
      for (const player of mutableFullPlayers) {
        const { publicData, privateData } = splitPlayerData(player);
        const publicPlayerRef = adminDb.collection('games').doc(mutableGame.id).collection('players').doc(player.userId);
        transaction.set(publicPlayerRef, toPlainObject(publicData), { merge: true });
        const privatePlayerRef = adminDb.collection('games').doc(mutableGame.id).collection('playerData').doc(player.userId);
        transaction.set(privatePlayerRef, toPlainObject(privateData), { merge: true });
      }
      transaction.update(gameRef, toPlainObject({ status: 'finished', phase: 'finished', events: mutableGame.events }));
      return { nightEvent: undefined };
  }

  if (triggeredHunterId) {
      mutableGame.pendingHunterShot = triggeredHunterId;

      for (const player of mutableFullPlayers) {
        const { publicData, privateData } = splitPlayerData(player);
        const publicPlayerRef = adminDb.collection('games').doc(mutableGame.id).collection('players').doc(player.userId);
        transaction.set(publicPlayerRef, toPlainObject(publicData), { merge: true });
        const privatePlayerRef = adminDb.collection('games').doc(mutableGame.id).collection('playerData').doc(player.userId);
        transaction.set(privatePlayerRef, toPlainObject(privateData), { merge: true });
      }
      transaction.update(gameRef, toPlainObject({ events: mutableGame.events, phase: 'hunter_shot', pendingHunterShot: mutableGame.pendingHunterShot }));
      return { nightEvent: undefined };
  }
  
  let nightMessage;
  if (killedPlayerIdsThisNight.length > 0) {
      const killedNames = killedPlayerIdsThisNight.map(id => initialPlayers.find((p:any) => p.userId === id)?.displayName).join(', ');
      nightMessage = `Anoche, el pueblo perdió a ${killedNames}.`;
  } else if (context.deathMarks.size > 0 && Object.keys(successfulSaves).length > 0) {
      nightMessage = "La noche fue tensa. Los lobos atacaron, pero alguien fue salvado por una fuerza protectora.";
  } else {
      nightMessage = "La noche transcurre en un inquietante silencio. Nadie ha muerto.";
  }
  
  const nightEvent: GameEvent = { 
      id: `evt_night_${mutableGame.currentRound}`, 
      gameId: mutableGame.id, 
      round: mutableGame.currentRound, 
      type: 'night_result', 
      message: nightMessage, 
      data: { 
          killedPlayerIds: killedPlayerIdsThisNight, 
          successfulSaves: successfulSaves,
        }, 
      createdAt: new Date() 
    };
  mutableGame.events.push(nightEvent);

  for (const p of mutableFullPlayers) {
    const publicPlayerRef = adminDb.collection('games').doc(mutableGame.id).collection('players').doc(p.userId);
    transaction.update(publicPlayerRef, { votedFor: null });
    const privatePlayerRef = adminDb.collection('games').doc(mutableGame.id).collection('playerData').doc(p.userId);
    transaction.update(privatePlayerRef, { usedNightAbility: false });
  }
  
  const phaseEndsAt = new Date(Date.now() + PHASE_DURATION_SECONDS * 1000);
  
  transaction.update(gameRef, toPlainObject({
      ...mutableGame,
      phase: 'day',
      phaseEndsAt,
      pendingHunterShot: null, 
      silencedPlayerId: null, 
      exiledPlayerId: null,
  }));

  return { nightEvent };
}
export async function processVotesEngine(transaction: Transaction, gameRef: DocumentReference, game: Game, fullPlayers: Player[]) {
    if (game.phase !== 'day') return { voteEvent: undefined };
    if (game.phaseEndsAt && getMillis(game.phaseEndsAt) > Date.now()) return { voteEvent: undefined };

    const lastVoteEvent = [...game.events].sort((a,b) => getMillis(b.createdAt) - getMillis(a.createdAt)).find(e => e.type === 'vote_result');
    const isTiebreaker = Array.isArray(lastVoteEvent?.data?.tiedPlayerIds) && !lastVoteEvent?.data?.final;

    const siren = fullPlayers.find(p => p.role === 'river_siren' && p.isAlive);
    const charmedPlayerId = siren?.riverSirenTargetId;

    const alivePlayers = fullPlayers.filter(p => p.isAlive);
    const voteCounts: Record<string, number> = {};
    
    alivePlayers.forEach(player => {
        let finalVote = player.votedFor;
        // Siren override logic
        if (siren && charmedPlayerId === player.userId && siren.votedFor) {
            finalVote = siren.votedFor;
        }
        
        if (finalVote) {
            if (!isTiebreaker || (lastVoteEvent!.data.tiedPlayerIds && lastVoteEvent!.data.tiedPlayerIds.includes(finalVote))) {
                voteCounts[finalVote] = (voteCounts[finalVote] || 0) + 1;
            }
        }
    });

    let maxVotes = 0;
    let mostVotedPlayerIds: string[] = [];
    for (const playerId in voteCounts) {
        if (voteCounts[playerId] > maxVotes) {
            maxVotes = voteCounts[playerId];
            mostVotedPlayerIds = [playerId];
        } else if (voteCounts[playerId] === maxVotes && maxVotes > 0) {
            mostVotedPlayerIds.push(playerId);
        }
    }
    
    if (mostVotedPlayerIds.length > 1 && !isTiebreaker) {
        const tiedPlayerNames = mostVotedPlayerIds.map(id => fullPlayers.find(p=>p.userId === id)?.displayName).join(', ');
        const tieEvent: GameEvent = { id: `evt_vote_tie_${game.currentRound}`, gameId: game.id, round: game.currentRound, type: 'vote_result', message: `¡La votación resultó en un empate! Se requiere una segunda votación solo entre los siguientes jugadores: ${tiedPlayerNames}.`, data: { tiedPlayerIds: mostVotedPlayerIds, final: false }, createdAt: new Date() };
        game.events.push(tieEvent);
        
        for (const player of fullPlayers) {
            const publicPlayerRef = adminDb.collection('games').doc(game.id).collection('players').doc(player.userId);
            transaction.update(publicPlayerRef, { votedFor: null });
        }
        
        const phaseEndsAt = new Date(Date.now() + PHASE_DURATION_SECONDS * 1000);
        transaction.update(gameRef, toPlainObject({ events: game.events, phaseEndsAt }));
        return { voteEvent: tieEvent };
    }

    if (mostVotedPlayerIds.length > 1 && isTiebreaker) {
        if (game.settings.juryVoting) {
            game.phase = "jury_voting";
            const tiedPlayerNames = mostVotedPlayerIds.map(id => fullPlayers.find(p => p.userId === id)?.displayName).join(' o ');
            const juryEvent: GameEvent = { id: `evt_jury_vote_${game.currentRound}`, gameId: game.id, round: game.currentRound, type: 'vote_result', message: `¡El pueblo sigue dividido! Los espíritus de los caídos emitirán el voto final para decidir el destino de: ${tiedPlayerNames}.`, data: { tiedPlayerIds: mostVotedPlayerIds, final: false }, createdAt: new Date() };
            game.events.push(juryEvent);
            const phaseEndsAt = new Date(Date.now() + PHASE_DURATION_SECONDS * 1000);
            transaction.update(gameRef, toPlainObject({ events: game.events, phase: "jury_voting", phaseEndsAt }));
            return { voteEvent: juryEvent };
        } else {
            mostVotedPlayerIds = [];
        }
    }

    let lynchedPlayerId: string | null = mostVotedPlayerIds[0] || null;
    let triggeredHunterId: string | null = null;
    let mutableFullPlayers = [...fullPlayers];
    let mutableGame = {...game};

    if (lynchedPlayerId) {
        const { updatedGame, updatedPlayers, triggeredHunterId: newHunterId } = await killPlayer(transaction, gameRef, mutableGame, mutableFullPlayers, lynchedPlayerId, 'vote_result', `El pueblo ha hablado. ${fullPlayers.find(p => p.userId === lynchedPlayerId)?.displayName} ha sido linchado.`);
        mutableGame = updatedGame;
        mutableFullPlayers = updatedPlayers;
        triggeredHunterId = newHunterId;
    } else {
        const message = isTiebreaker ? 'Tras un segundo empate, el pueblo decide perdonar una vida hoy.' : 'El pueblo no pudo llegar a un acuerdo. Nadie fue linchado.';
        mutableGame.events.push({ id: `evt_vote_result_${mutableGame.currentRound}`, gameId: mutableGame.id, round: mutableGame.currentRound, type: 'vote_result', message, data: { lynchedPlayerId: null, final: true }, createdAt: new Date() });
    }

    if (mutableGame.pendingTroublemakerDuel) {
        const { target1Id, target2Id } = mutableGame.pendingTroublemakerDuel;
        const target1 = mutableFullPlayers.find(p => p.userId === target1Id);
        const target2 = mutableFullPlayers.find(p => p.userId === target2Id);
        if (target1 && target2) {
            const duelMessage = `Al final del día, una pelea estalla. ${target1.displayName} y ${target2.displayName} se han matado mutuamente, víctimas de la Alborotadora.`;
            const result1 = await killPlayer(transaction, gameRef, mutableGame, mutableFullPlayers, target1Id, 'troublemaker_duel', duelMessage);
            mutableGame = result1.updatedGame;
            mutableFullPlayers = result1.updatedPlayers;
            if (result1.triggeredHunterId && !triggeredHunterId) triggeredHunterId = result1.triggeredHunterId;

            const result2 = await killPlayer(transaction, gameRef, mutableGame, mutableFullPlayers, target2Id, 'troublemaker_duel', duelMessage);
            mutableGame = result2.updatedGame;
            mutableFullPlayers = result2.updatedPlayers;
            if (result2.triggeredHunterId && !triggeredHunterId) triggeredHunterId = result2.triggeredHunterId;
        }
        mutableGame.pendingTroublemakerDuel = null;
    }

    let lynchedPlayerObject = fullPlayers.find(p => p.userId === lynchedPlayerId) || null;
    let gameOverInfo = await checkGameOver(mutableGame, mutableFullPlayers, lynchedPlayerObject);
    if (gameOverInfo.isGameOver) {
        mutableGame.status = "finished";
        mutableGame.phase = "finished";
        mutableGame.events.push({ id: `evt_gameover_${Date.now()}`, gameId: mutableGame.id, type: 'game_over', round: mutableGame.currentRound, message: gameOverInfo.message, data: { winnerCode: gameOverInfo.winnerCode, winners: gameOverInfo.winners }, createdAt: new Date() });
        for (const player of mutableFullPlayers) {
            const { publicData, privateData } = splitPlayerData(player);
            transaction.set(adminDb.collection('games').doc(game.id).collection('players').doc(player.userId), toPlainObject(publicData), { merge: true });
            transaction.set(adminDb.collection('games').doc(game.id).collection('playerData').doc(player.userId), toPlainObject(privateData), { merge: true });
        }
        transaction.update(gameRef, toPlainObject({ status: 'finished', phase: 'finished', events: mutableGame.events }));
        return { voteEvent: mutableGame.events[mutableGame.events.length - 1] };
    }

    if (triggeredHunterId) {
        mutableGame.pendingHunterShot = triggeredHunterId;
        for (const player of mutableFullPlayers) {
            const { publicData, privateData } = splitPlayerData(player);
            transaction.set(adminDb.collection('games').doc(game.id).collection('players').doc(player.userId), toPlainObject(publicData), { merge: true });
            transaction.set(adminDb.collection('games').doc(game.id).collection('playerData').doc(player.userId), toPlainObject(privateData), { merge: true });
        }
        transaction.update(gameRef, toPlainObject({ events: mutableGame.events, phase: 'hunter_shot', pendingHunterShot: mutableGame.pendingHunterShot }));
        return { voteEvent: mutableGame.events[mutableGame.events.length - 1] };
    }

    const phaseEndsAt = new Date(Date.now() + PHASE_DURATION_SECONDS * 1000);
    const nextRound = mutableGame.currentRound + 1;
    
    for (const p of mutableFullPlayers) {
        const publicPlayerRef = adminDb.collection('games').doc(game.id).collection('players').doc(p.userId);
        transaction.update(publicPlayerRef, { votedFor: null });
        const privatePlayerRef = adminDb.collection('games').doc(game.id).collection('playerData').doc(p.userId);
        transaction.update(privatePlayerRef, { usedNightAbility: false });
    }
    
    transaction.update(gameRef, toPlainObject({
        ...mutableGame,
        phase: 'night',
        currentRound: nextRound,
        phaseEndsAt
    }));
     return { voteEvent: mutableGame.events[mutableGame.events.length-1] };
}
export async function processJuryVotesEngine(transaction: Transaction, gameRef: DocumentReference, game: Game, fullPlayers: Player[]) {
    if (game.phase !== 'jury_voting' || (game.phaseEndsAt && getMillis(game.phaseEndsAt) > Date.now())) return;

    const juryVotes = game.juryVotes || {};
    const voteCounts: Record<string, number> = {};
    Object.values(juryVotes).forEach(targetId => {
        voteCounts[targetId] = (voteCounts[targetId] || 0) + 1;
    });
    
    let maxVotes = 0;
    let mostVotedPlayerId: string | null = null;
    let tie = false;

    for (const playerId in voteCounts) {
        if (voteCounts[playerId] > maxVotes) {
            maxVotes = voteCounts[playerId];
            mostVotedPlayerId = playerId;
            tie = false;
        } else if (voteCounts[playerId] === maxVotes) {
            tie = true;
        }
    }
    
    if (tie && mostVotedPlayerId) {
        const tiedPlayers = Object.keys(voteCounts).filter(id => voteCounts[id] === maxVotes);
        mostVotedPlayerId = tiedPlayers[Math.floor(Math.random() * tiedPlayers.length)];
    }
    
    let lynchedPlayerObject: Player | null = null;
    let triggeredHunterId: string | null = null;

    if (mostVotedPlayerId) {
        const { updatedGame, updatedPlayers, triggeredHunterId: newHunterId } = await killPlayer(transaction, gameRef, game, fullPlayers, mostVotedPlayerId, 'vote_result', `El jurado de los muertos ha decidido. ${fullPlayers.find(p=>p.userId === mostVotedPlayerId)?.displayName} ha sido linchado.`);
        game = updatedGame;
        fullPlayers = updatedPlayers;
        triggeredHunterId = newHunterId;
        lynchedPlayerObject = fullPlayers.find(p => p.userId === mostVotedPlayerId) || null;
    } else {
         game.events.push({ id: `evt_jury_no_vote_${game.currentRound}`, gameId: game.id, round: game.currentRound, type: 'vote_result', message: "El jurado de los muertos no llegó a un consenso. Nadie es linchado.", data: { lynchedPlayerId: null, final: true }, createdAt: new Date() });
    }
    
    let gameOverInfo = await checkGameOver(game, fullPlayers, lynchedPlayerObject);
    if (gameOverInfo.isGameOver) {
        game.status = "finished";
        game.phase = "finished";
        game.events.push({ id: `evt_gameover_${Date.now()}`, gameId: game.id, type: 'game_over', round: game.currentRound, message: gameOverInfo.message, data: { winnerCode: gameOverInfo.winnerCode, winners: gameOverInfo.winners }, createdAt: new Date() });
        for (const player of fullPlayers) {
            const { publicData, privateData } = splitPlayerData(player);
            transaction.set(adminDb.collection('games').doc(game.id).collection('players').doc(player.userId), toPlainObject(publicData), { merge: true });
            transaction.set(adminDb.collection('games').doc(game.id).collection('playerData').doc(player.userId), toPlainObject(privateData), { merge: true });
        }
        transaction.update(gameRef, toPlainObject({ status: 'finished', phase: 'finished', events: game.events }));
        return;
    }

    if (triggeredHunterId) {
        game.pendingHunterShot = triggeredHunterId;
         for (const player of fullPlayers) {
            const { publicData, privateData } = splitPlayerData(player);
            transaction.set(adminDb.collection('games').doc(game.id).collection('players').doc(player.userId), toPlainObject(publicData), { merge: true });
            transaction.set(adminDb.collection('games').doc(game.id).collection('playerData').doc(player.userId), toPlainObject(privateData), { merge: true });
        }
        transaction.update(gameRef, toPlainObject({ events: game.events, phase: 'hunter_shot', pendingHunterShot: game.pendingHunterShot }));
        return;
    }

    const phaseEndsAt = new Date(Date.now() + PHASE_DURATION_SECONDS * 1000);
    const nextRound = game.currentRound + 1;
    
    for (const p of fullPlayers) {
        const publicPlayerRef = adminDb.collection('games').doc(game.id).collection('players').doc(p.userId);
        transaction.update(publicPlayerRef, { votedFor: null });
        const privatePlayerRef = adminDb.collection('games').doc(game.id).collection('playerData').doc(p.userId);
        transaction.update(privatePlayerRef, { usedNightAbility: false });
    }

    transaction.update(gameRef, toPlainObject({
        ...game, phase: 'night', currentRound: nextRound, phaseEndsAt
    }));
}


export async function checkGameOver(gameData: Game, fullPlayers: Player[], lynchedPlayer?: Player | null): Promise<{ isGameOver: boolean; message: string; winnerCode?: string; winners: Player[] }> {
    if (gameData.status === 'finished') {
        const lastEvent = gameData.events.find(e => e.type === 'game_over');
        return { isGameOver: true, message: lastEvent?.message || "La partida ha terminado.", winnerCode: lastEvent?.data?.winnerCode, winners: lastEvent?.data?.winners || [] };
    }
    
    const alivePlayers = fullPlayers.filter(p => p.isAlive);
    const wolfRoles: PlayerRole[] = ['werewolf', 'wolf_cub', 'witch', 'seeker_fairy'];

    if (gameData.settings.vampire) {
        const vampire = fullPlayers.find(p => p.role === 'vampire' && p.isAlive);
        if (vampire && gameData.vampireKills >= 3) {
            return {
                isGameOver: true,
                winnerCode: 'vampire',
                message: '¡El Vampiro ha ganado! Ha reclamado suficientes víctimas para saciar su sed de sangre.',
                winners: [vampire],
            };
        }
    }
    
    if (gameData.settings.cult_leader) {
        const cultLeader = fullPlayers.find(p => p.role === 'cult_leader' && p.isAlive);
        if (cultLeader) {
            const allAliveAreCultMembers = alivePlayers.every(p => p.isCultMember);
            if (allAliveAreCultMembers && alivePlayers.length > 1) {
                return {
                    isGameOver: true,
                    winnerCode: 'cult',
                    message: `¡El Líder del Culto ha ganado! Ha convertido a todos los supervivientes.`,
                    winners: [cultLeader],
                };
            }
        }
    }

    if (gameData.settings.fisherman) {
        const fisherman = fullPlayers.find(p => p.role === 'fisherman' && p.isAlive);
        if (fisherman) {
            const aliveVillagers = alivePlayers.filter(p => {
                const pRole = p.role;
                if (!pRole) return false;
                const details = roleDetails[pRole];
                // Exclude fisherman himself from the count
                return details?.team === 'Aldeanos' && p.userId !== fisherman.userId;
            });
            const villagersInBoat = gameData.boat.filter(id => aliveVillagers.some(p => p.userId === id));

            if (aliveVillagers.length > 0 && villagersInBoat.length === aliveVillagers.length) {
                return {
                    isGameOver: true, winnerCode: 'fisherman',
                    message: `¡El Pescador ha ganado! Ha salvado a todos los aldeanos restantes en su barco.`,
                    winners: [fisherman],
                };
            }
        }
    }
    
    if (lynchedPlayer) {
        if (lynchedPlayer.role === 'drunk_man' && gameData.settings.drunk_man) {
            return {
                isGameOver: true, winnerCode: 'drunk_man',
                message: `¡El Hombre Ebrio ha ganado! Ha conseguido que el pueblo lo linche.`,
                winners: [lynchedPlayer],
            };
        }
        
        const executioner = fullPlayers.find(p => p.role === 'executioner' && p.isAlive);
        if (executioner && executioner.executionerTargetId === lynchedPlayer.userId) {
            return {
                isGameOver: true, winnerCode: 'executioner',
                message: `¡El Verdugo ha ganado! Ha logrado su objetivo de que el pueblo linche a ${lynchedPlayer.displayName}.`,
                winners: [executioner],
            };
        }
    }

     if (gameData.settings.banshee) {
        const banshee = fullPlayers.find(p => p.role === 'banshee' && p.isAlive);
        if (banshee && (banshee.bansheePoints || 0) >= 2) {
             return {
                isGameOver: true, winnerCode: 'banshee',
                message: `¡La Banshee ha ganado! Sus dos gritos han sentenciado a muerte y ha cumplido su objetivo.`,
                winners: [banshee],
            };
        }
    }

    if (gameData.lovers) {
        const aliveLovers = alivePlayers.filter(p => gameData.lovers!.includes(p.userId));
        if (aliveLovers.length === alivePlayers.length && alivePlayers.length >= 2) {
            return {
                isGameOver: true, winnerCode: 'lovers',
                message: '¡El amor ha triunfado! Los enamorados son los únicos supervivientes.',
                winners: aliveLovers
            };
        }
    }

    const aliveWolves = alivePlayers.filter(p => p.role && wolfRoles.includes(p.role));
    const aliveWolvesCount = aliveWolves.length;
    
    const neutralThreats = alivePlayers.filter(p => {
        if (!p.role) return false;
        const details = roleDetails[p.role];
        // A threat is a neutral player who hasn't met their win condition and isn't aligned with the village implicitly.
        if (details?.team !== 'Neutral') return false;
        if (p.role === 'executioner' && p.executionerTargetId) return true; // Threat until target is lynched
        if (p.role === 'vampire' || p.role === 'cult_leader' || p.role === 'banshee') return true; // Always threats until they win
        return false;
    });

    const totalThreats = aliveWolvesCount + neutralThreats.length;
    
    if (totalThreats === 0 && alivePlayers.length > 0) {
        return { isGameOver: true, winnerCode: 'villagers', message: "¡El pueblo ha ganado! Todas las amenazas han sido eliminadas.", winners: alivePlayers };
    }
    
    if (aliveWolvesCount > 0 && aliveWolvesCount >= (alivePlayers.length - aliveWolvesCount)) {
        return { isGameOver: true, winnerCode: 'wolves', message: "¡Los hombres lobo han ganado! Superan en número al pueblo.", winners: fullPlayers.filter(p => p.role && wolfRoles.includes(p.role)) };
    }
    
    if (alivePlayers.length === 0) {
        return { isGameOver: true, winnerCode: 'draw', message: "¡Nadie ha sobrevivido a la masacre!", winners: [] };
    }
    
    if (gameData.phase === 'hunter_shot') {
        const hunter = fullPlayers.find(p => p.userId === gameData.pendingHunterShot);
        if (hunter && !hunter.isAlive) {
            // Hunter died but hasn't shot yet, so the game isn't over yet
            return { isGameOver: false, message: "", winners: [] };
        }
    }

    return { isGameOver: false, message: "", winners: [] };
}


const getActionPriority = (actionType: NightActionType) => {
    switch (actionType) {
        case 'resurrect':
            return 0;
        case 'cupid_love':
        case 'shapeshifter_select':
        case 'virginia_woolf_link':
        case 'river_siren_charm':
            return 1;
        case 'silencer_silence':
        case 'elder_leader_exile':
            return 2;
        case 'priest_bless':
        case 'guardian_protect':
        case 'doctor_heal':
            return 3;
        case 'werewolf_kill':
        case 'hechicera_poison':
        case 'fairy_kill':
        case 'vampire_bite':
            return 4;
        case 'hechicera_save':
            return 5;
        case 'seer_check':
        case 'cult_recruit':
        case 'fisherman_catch':
        case 'witch_hunt':
        case 'lookout_spy':
        case 'banshee_scream':
        case 'fairy_find':
            return 6;
        default:
            return 99;
    }
}




    