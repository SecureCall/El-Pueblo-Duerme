'use server';
import { 
  doc,
  setDoc,
  runTransaction,
  type DocumentReference,
  Timestamp,
} from "firebase/firestore";
import { 
  type Game, 
  type Player, 
  type GameEvent, 
  type PlayerRole,
} from "@/types";
import { toPlainObject } from "./utils";
import { masterActions } from "./master-actions";
import { getSdks } from "@/firebase/server-init";
import { processJuryVotes as processJuryVotesEngine, killPlayer, processVotes as processVotesEngine, processNight as processNightEngine } from './game-engine';
import { runAIActions as runAIActionsEngine } from './ai-actions';

export async function processNight(gameId: string) {
    const { firestore } = getSdks();
    const gameRef = doc(firestore, 'games', gameId) as DocumentReference<Game>;
    try {
        await runTransaction(firestore, async (transaction) => {
            await processNightEngine(transaction, gameRef);
        });
        await runAIActionsEngine(gameId, 'night');
    } catch (e) {
        console.error("Failed to process night", e);
    }
}

export async function processVotes(gameId: string) {
    const { firestore } = getSdks();
    const gameRef = doc(firestore, 'games', gameId) as DocumentReference<Game>;
    try {
        await runTransaction(firestore, async (transaction) => {
            await processVotesEngine(transaction, gameRef);
        });
    } catch (e) {
        console.error("Failed to process votes", e);
    }
}

export async function processJuryVotes(gameId: string) {
    const { firestore } = getSdks();
    const gameRef = doc(firestore, 'games', gameId) as DocumentReference<Game>;
    try {
        await runTransaction(firestore, async (transaction) => {
            await processJuryVotesEngine(transaction, gameRef);
        });
    } catch (e) {
        console.error("Failed to process jury votes", e);
    }
}

export async function executeMasterAction(gameId: string, actionId: string, sourceId: string | null, targetId: string) {
    const { firestore } = getSdks();
    const gameRef = doc(firestore, 'games', gameId);
     try {
        await runTransaction(firestore, async (transaction) => {
            const gameDoc = await transaction.get(gameRef as DocumentReference<Game>);
            if (!gameDoc.exists()) throw new Error("Game not found");
            let game = gameDoc.data()!;

            if (actionId === 'master_kill') {
                 if (game.masterKillUsed) throw new Error("El Zarpazo del Destino ya ha sido utilizado.");
                 const { updatedGame } = await killPlayer(transaction, gameRef as DocumentReference<Game>, game, targetId, 'special');
                 updatedGame.masterKillUsed = true;
                 game = updatedGame;
            } else {
                const action = masterActions[actionId as keyof typeof masterActions];
                if (action) {
                    const { updatedGame } = action.execute(game, sourceId!, targetId);
                    game = updatedGame;
                }
            }
            transaction.update(gameRef, toPlainObject(game));
        });
        return { success: true };
    } catch (error: any) {
        console.error("Error executing master action:", error);
        return { success: false, error: error.message };
    }
}

export async function resetGame(gameId: string) {
    const { firestore } = getSdks();
    const gameRef = doc(firestore, 'games', gameId);

    const createPlayerObject = (userId: string, gameId: string, displayName: string, avatarUrl: string, isAI: boolean = false): Player => ({
        userId,
        gameId,
        displayName: displayName.trim(),
        avatarUrl,
        role: null,
        isAlive: true,
        votedFor: null,
        joinedAt: Timestamp.now(),
        isAI,
        isExiled: false,
        lastHealedRound: 0,
        potions: { poison: null, save: null },
        priestSelfHealUsed: false,
        princeRevealed: false,
        guardianSelfProtects: 0,
        biteCount: 0,
        isCultMember: false,
        isLover: false,
        usedNightAbility: false,
        shapeshifterTargetId: null,
        virginiaWoolfTargetId: null,
        riverSirenTargetId: null,
        ghostMessageSent: false,
        resurrectorAngelUsed: false,
        bansheeScreams: {},
        lookoutUsed: false,
        executionerTargetId: null,
        secretObjectiveId: null,
    });
    
    try {
        await runTransaction(firestore, async (transaction) => {
            const gameSnap = await transaction.get(gameRef);
            if (!gameSnap.exists()) throw new Error("Partida no encontrada.");
            const game = gameSnap.data() as Game;

            const humanPlayers = game.players.filter(p => !p.isAI);

            const resetHumanPlayers = humanPlayers.map(player => {
                const newPlayer = createPlayerObject(player.userId, game.id, player.displayName, player.avatarUrl, player.isAI);
                newPlayer.joinedAt = player.joinedAt; 
                return newPlayer;
            });

            transaction.update(gameRef, toPlainObject({
                status: 'waiting', phase: 'waiting', currentRound: 0,
                events: [], chatMessages: [], wolfChatMessages: [], fairyChatMessages: [],
                twinChatMessages: [], loversChatMessages: [], ghostChatMessages: [], nightActions: [],
                twins: null, lovers: null, phaseEndsAt: Timestamp.now(), pendingHunterShot: null,
                wolfCubRevengeRound: 0, players: resetHumanPlayers, vampireKills: 0, boat: [],
                leprosaBlockedRound: 0, witchFoundSeer: false, seerDied: false,
                silencedPlayerId: null, exiledPlayerId: null, troublemakerUsed: false,
                fairiesFound: false, fairyKillUsed: false, juryVotes: {}, masterKillUsed: false
            }));
        });
        return { success: true };
    } catch (e: any) {
        console.error("Error resetting game:", e);
        return { error: e.message || 'No se pudo reiniciar la partida.' };
    }
}
