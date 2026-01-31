
'use server';
import { 
  Timestamp,
  runTransaction,
  FieldValue,
} from "firebase-admin/firestore";
import { 
  type Game, 
  type Player, 
  type PlayerPublicData,
  type PlayerPrivateData,
  type NightAction, 
  type GameEvent, 
  type PlayerRole, 
  type NightActionType, 
  type ChatMessage,
} from "@/types";
import { getAdminDb } from "./firebase-admin";
import { toPlainObject, splitPlayerData, getMillis, PHASE_DURATION_SECONDS } from "./utils";
import { masterActions } from "./master-actions";
import { processJuryVotesEngine, killPlayer, killPlayerUnstoppable, checkGameOver, processVotesEngine, processNightEngine, generateRoles } from './game-engine';

export async function sendChatMessage(gameId: string, senderId: string, senderName: string, text: string, isFromAI: boolean = false) {
    const adminDb = getAdminDb();
    if (!text?.trim()) return { success: false, error: 'El mensaje no puede estar vacío.' };
    const gameRef = adminDb.collection('games').doc(gameId);

    try {
        let latestGame: Game | null = null;
        await runTransaction(adminDb, async (transaction) => {
            const gameDoc = await transaction.get(gameRef);
            if (!gameDoc.exists()) throw new Error('Game not found');
            const game = gameDoc.data() as Game;
            latestGame = game;

            if (game.silencedPlayerId === senderId) throw new Error("No puedes hablar, has sido silenciado esta ronda.");
            
            const mentionedPlayerIds = game.players.filter(p => p.isAlive && text.toLowerCase().includes(p.displayName.toLowerCase())).map(p => p.userId);
            const messageData: ChatMessage = {id: `${Date.now()}_${senderId}`, senderId, senderName, text: text.trim(), round: game.currentRound, createdAt: new Date(), mentionedPlayerIds};
            transaction.update(gameRef, { chatMessages: FieldValue.arrayUnion(toPlainObject(messageData)) });
        });

        if (!isFromAI && latestGame) {
            const { triggerAIChat } = await import('./firebase-ai-actions');
            await triggerAIChat(gameId, `${senderName} dijo: "${text.trim()}"`, 'public');
        }
        return { success: true };

    } catch (error: any) {
        console.error("Error sending chat message: ", error);
        return { success: false, error: error.message || 'No se pudo enviar el mensaje.' };
    }
}

export async function processNight(gameId: string) {
    const adminDb = getAdminDb();
    const gameRef = adminDb.collection('games').doc(gameId);
    try {
        await runTransaction(adminDb, async (transaction) => {
            const gameDoc = await transaction.get(gameRef);
            if (!gameDoc.exists()) throw new Error("Game not found");
            const game = gameDoc.data() as Game;

            const privateDataSnapshots = await transaction.getAll(...game.players.map(p => adminDb.collection('games').doc(gameId).collection('playerData').doc(p.userId)));
            const fullPlayers = game.players.map((p, i) => ({ ...p, ...privateDataSnapshots[i].data() }));

            await processNightEngine(transaction, gameRef, game, fullPlayers as Player[]);
        });

        const updatedGameDoc = await gameRef.get();
        if (updatedGameDoc.exists()) {
            const game = updatedGameDoc.data() as Game;
            
            const aiActions = await import('./firebase-ai-actions');
            
            if (game.phase === 'night') {
                 await aiActions.runNightAIActions(gameId);
            }
            
            if(game.phase === 'day') {
                const latestNightResult = game.events
                    .filter(e => e.type === 'night_result' && e.round === game.currentRound)
                    .sort((a, b) => getMillis(a.createdAt) - getMillis(b.createdAt))[0];
                
                if (latestNightResult) {
                    await aiActions.triggerAIReactionToGameEvent(gameId, latestNightResult);
                }
            }
        }
    } catch (e) { console.error("Failed to process night", e); }
}

export async function processVotes(gameId: string) {
    const adminDb = getAdminDb();
    const gameRef = adminDb.collection('games').doc(gameId);
    try {
        const { runAIVotes } = await import('./firebase-ai-actions');
        await runAIVotes(gameId);

        await runTransaction(adminDb, async (transaction) => {
            const gameDoc = await transaction.get(gameRef);
            if (!gameDoc.exists()) throw new Error("Game not found");
            const game = gameDoc.data() as Game;

            const privateDataSnapshots = await transaction.getAll(...game.players.map(p => adminDb.collection('games').doc(gameId).collection('playerData').doc(p.userId)));
            const fullPlayers = game.players.map((p, i) => ({ ...p, ...privateDataSnapshots[i].data() }));
            
            await processVotesEngine(transaction, gameRef, game, fullPlayers as Player[]);
        });

        const updatedGameSnap = await gameRef.get();
        if (updatedGameSnap.exists()) {
            const game = updatedGameSnap.data() as Game;
            const voteEvent = game.events
                .filter(e => e.type === 'vote_result' && e.round === (game.phase === 'night' ? game.currentRound -1 : game.currentRound))
                .sort((a,b) => getMillis(b.createdAt) - getMillis(a.createdAt))[0];

            const aiActions = await import('./firebase-ai-actions');
            
            if (voteEvent) {
                await aiActions.triggerAIReactionToGameEvent(gameId, voteEvent);
            }

            if (game.phase === 'night') {
                await aiActions.runNightAIActions(gameId);
            }
        }
    } catch (e) { console.error("Failed to process votes", e); }
}

export async function getSeerResult(gameId: string, seerId: string, targetId: string) {
    const adminDb = getAdminDb();
    const privateSeerRef = adminDb.collection('games').doc(gameId).collection('playerData').doc(seerId);
    const privateTargetRef = adminDb.collection('games').doc(gameId).collection('playerData').doc(targetId);
    const gameSnap = await adminDb.collection('games').doc(gameId).get();
    if (!gameSnap.exists()) throw new Error("Game not found");
    const game = gameSnap.data() as Game;
    const targetPublicData = game.players.find(p => p.userId === targetId)!;

    try {
        const [seerSnap, targetSnap] = await Promise.all([privateSeerRef.get(), privateTargetRef.get()]);
        if (!seerSnap.exists() || !targetSnap.exists()) throw new Error("Data not found");
        const seerData = seerSnap.data() as PlayerPrivateData;
        const targetData = targetSnap.data() as PlayerPrivateData;

        const isSeerOrApprentice = seerData.role === 'seer' || (seerData.role === 'seer_apprentice' && game.seerDied);
        if (!isSeerOrApprentice) throw new Error("No tienes el don de la videncia.");

        const wolfRoles: PlayerRole[] = ['werewolf', 'wolf_cub', 'cursed', 'lycanthrope'];
        const isWerewolf = !!(targetData.role && wolfRoles.includes(targetData.role));

        const newCheck = { targetName: targetPublicData.displayName, isWerewolf };
        const updatedChecks = [...(seerData.seerChecks || []), newCheck];

        await privateSeerRef.update({ seerChecks: updatedChecks });

        return { success: true, isWerewolf, targetName: targetPublicData.displayName };
    } catch(e: any) {
        return { success: false, error: e.message };
    }
}

export async function submitTroublemakerSelection(gameId: string, troublemakerId: string, target1Id: string, target2Id: string) {
    const adminDb = getAdminDb();
    const gameRef = adminDb.collection('games').doc(gameId);
    try {
        await runTransaction(adminDb, async (transaction) => {
            const gameSnap = await transaction.get(gameRef);
            if (!gameSnap.exists()) throw new Error("Partida no encontrada");
            let game = gameSnap.data() as Game;
            
            const privateRef = adminDb.collection('games').doc(gameId).collection('playerData').doc(troublemakerId);
            const privateSnap = await transaction.get(privateRef);
            const playerPrivate = privateSnap.data();

            if (!playerPrivate || playerPrivate.role !== 'troublemaker' || game.troublemakerUsed) throw new Error("No puedes realizar esta acción.");
            
            transaction.update(gameRef, toPlainObject({
                troublemakerUsed: true,
                pendingTroublemakerDuel: { target1Id, target2Id }
            }));
        });
        return { success: true };
    } catch (error: any) {
        return { success: false, error: (error as Error).message };
    }
}

export async function processJuryVotes(gameId: string) {
    const adminDb = getAdminDb();
    const gameRef = adminDb.collection('games').doc(gameId);
    try {
        const aiActions = await import('./firebase-ai-actions');
        await aiActions.runAIJuryVotes(gameId);

        await runTransaction(adminDb, async (transaction) => {
            const gameDoc = await transaction.get(gameRef);
            if (!gameDoc.exists()) throw new Error("Game not found");
            const game = gameDoc.data() as Game;

            const privateDataSnapshots = await transaction.getAll(...game.players.map(p => adminDb.collection('games').doc(gameId).collection('playerData').doc(p.userId)));
            const fullPlayers = game.players.map((p, i) => ({ ...p, ...privateDataSnapshots[i].data() }));

            await processJuryVotesEngine(transaction, gameRef, game, fullPlayers as Player[]);
        });

        const { runNightAIActions } = await import('./firebase-ai-actions');
        await runNightAIActions(gameId);
    } catch (e) { console.error("Failed to process jury votes", e); }
}

export async function submitHunterShot(gameId: string, hunterId: string, targetId: string) {
    const adminDb = getAdminDb();
    const gameRef = adminDb.collection('games').doc(gameId);
    try {
        await runTransaction(adminDb, async (transaction) => {
            const gameSnap = await transaction.get(gameRef);
            if (!gameSnap.exists()) throw new Error("Game not found");
            let game = gameSnap.data() as Game;

            if (game.phase !== 'hunter_shot' || game.pendingHunterShot !== hunterId) return;

            const privateDataSnapshots = await transaction.getAll(...game.players.map(p => adminDb.collection('games').doc(gameId).collection('playerData').doc(p.userId)));
            const fullPlayers = game.players.map((p, i) => ({ ...p, ...privateDataSnapshots[i].data() }));

            let { updatedGame, updatedPlayers, triggeredHunterId: anotherHunterId } = await killPlayer(transaction, gameRef, game, fullPlayers as Player[], targetId, 'hunter_shot', `En su último aliento, el Cazador dispara y se lleva consigo a ${game.players.find(p=>p.userId === targetId)?.displayName}.`);
            
            // Add notable play event for the hunter
            updatedGame.events.push({
                id: `evt_notable_hunter_${Date.now()}`,
                gameId: game.id,
                round: updatedGame.currentRound,
                type: 'special',
                message: 'El cazador se venga.', // Internal message
                createdAt: new Date(),
                data: {
                  notablePlayerId: hunterId,
                  notablePlay: {
                      title: '¡Última Bala!',
                      description: `Caíste, pero te llevaste a ${game.players.find(p=>p.userId === targetId)?.displayName} contigo.`,
                  },
                },
            });

            if(anotherHunterId) {
                updatedGame.pendingHunterShot = anotherHunterId;
                transaction.update(gameRef, toPlainObject(updatedGame));
            } else {
                 // Game over check or next phase logic
                 const gameOverInfo = await checkGameOver(updatedGame, updatedPlayers);
                 if (gameOverInfo.isGameOver) {
                    updatedGame.status = "finished";
                    updatedGame.phase = "finished";
                    updatedGame.events.push({ id: `evt_gameover_${Date.now()}`, gameId, round: updatedGame.currentRound, type: 'game_over', message: gameOverInfo.message, data: { winnerCode: gameOverInfo.winnerCode, winners: gameOverInfo.winners }, createdAt: new Date() });
                 } else {
                     updatedGame.phase = 'day';
                     updatedGame.pendingHunterShot = null;
                 }
                 transaction.update(gameRef, toPlainObject(updatedGame));
            }
        });
        return { success: true };
    } catch (error: any) {
        console.error("Error submitting hunter shot:", error);
        return { success: false, error: (error as Error).message };
    }
}
export async function executeMasterAction(gameId: string, actionId: MasterActionId, sourceId: string | null, targetId: string) {
    const adminDb = getAdminDb();
    const gameRef = adminDb.collection('games').doc(gameId);
     try {
        await runTransaction(adminDb, async (transaction) => {
            const gameDoc = await transaction.get(gameRef);
            if (!gameDoc.exists()) throw new Error("Game not found");
            let game = gameDoc.data() as Game;
            const privateDataSnapshots = await transaction.getAll(...game.players.map(p => adminDb.collection('games').doc(gameId).collection('playerData').doc(p.userId)));
            const fullPlayers = game.players.map((p, i) => ({ ...p, ...privateDataSnapshots[i].data() as PlayerPrivateData }));


            if (actionId === 'master_kill') {
                 if (game.masterKillUsed) throw new Error("El Zarpazo del Destino ya ha sido utilizado.");
                 const { updatedGame } = await killPlayerUnstoppable(transaction, gameRef, game, fullPlayers, targetId, 'special', `Por intervención divina, ${game.players.find(p=>p.userId === targetId)?.displayName} ha sido eliminado.`);
                 game = updatedGame;
                 game.masterKillUsed = true;
            } else {
                const action = masterActions[actionId as keyof typeof masterActions];
                if (action) {
                    const { updatedGame } = action.execute(game, sourceId!, targetId, fullPlayers);
                    game = updatedGame;
                }
            }
            transaction.update(gameRef, toPlainObject(game));
        });
        return { success: true };
    } catch (error: any) {
        console.error("Error executing master action:", error);
        return { success: false, error: (error as Error).message };
    }
}
