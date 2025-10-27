
'use client';
import { 
  doc,
  getDoc,
  type Firestore,
} from "firebase/firestore";
import type { Game, Player, NightActionType, PlayerRole, AIPlayerPerspective } from "@/types";
import { generateAIChatMessage } from "@/ai/flows/generate-ai-chat-flow";
import { toPlainObject } from "@/lib/utils";
import { submitNightAction, submitVote, sendChatMessage, sendWolfChatMessage, sendTwinChatMessage, sendLoversChatMessage, submitHunterShot } from "@/lib/firebase-actions";


export async function getAIChatResponse(db: Firestore, gameId: string, aiPlayer: Player, triggerMessage: string, chatType: 'public' | 'wolf' | 'twin' | 'lovers' | 'ghost') {
    try {
        const gameDoc = await getDoc(doc(db, 'games', gameId));
        if (!gameDoc.exists()) return null;
        const game = gameDoc.data() as Game;
        if (game.status === 'finished') return null;

        const perspective: AIPlayerPerspective = {
            game: toPlainObject(game),
            aiPlayer: toPlainObject(aiPlayer),
            trigger: triggerMessage,
            players: toPlainObject(game.players),
            chatType,
        };

        const result = await generateAIChatMessage(perspective, chatType);
        
        if (result && result.shouldSend && result.message) {
            return result.message;
        }
        return null;

    } catch (e) {
        console.error("Error in getAIChatResponse:", e);
        return null;
    }
}


export const getDeterministicAIAction = (
    aiPlayer: Player,
    game: Game,
    alivePlayers: Player[],
    deadPlayers: Player[],
): { actionType: NightActionType | 'VOTE' | 'SHOOT' | 'NONE', targetId: string } => {
    const { role, userId } = aiPlayer;
    const { currentRound, nightActions = [] } = game;
    const wolfRoles: PlayerRole[] = ['werewolf', 'wolf_cub', 'cursed'];
    const wolfCubRevengeActive = game.wolfCubRevengeRound === game.currentRound;
    const apprenticeIsActive = role === 'seer_apprentice' && game.seerDied;
    const canFairiesKill = game.fairiesFound && !game.fairyKillUsed && (role === 'seeker_fairy' || role === 'sleeping_fairy');

    const potentialTargets = alivePlayers.filter(p => p.userId !== userId);

    const randomTarget = (targets: Player[], count = 1): string => {
        if (targets.length === 0) return '';
        let availableTargets = [...targets];
        let selectedTargets: string[] = [];
        for (let i = 0; i < count && availableTargets.length > 0; i++) {
            const randomIndex = Math.floor(Math.random() * availableTargets.length);
            const target = availableTargets.splice(randomIndex, 1)[0];
            if (target) {
                selectedTargets.push(target.userId);
            }
        }
        return selectedTargets.join('|');
    };

    if (game.phase === 'day') {
        if (aiPlayer.role === 'executioner' && aiPlayer.executionerTargetId) {
            const targetIsAlive = alivePlayers.some(p => p.userId === aiPlayer.executionerTargetId);
            if (targetIsAlive && Math.random() < 0.75) {
                return { actionType: 'VOTE', targetId: aiPlayer.executionerTargetId };
            }
        }
        return { actionType: 'VOTE', targetId: randomTarget(potentialTargets) };
    }

    if (game.phase === 'hunter_shot' && game.pendingHunterShot === userId) {
        return { actionType: 'SHOOT', targetId: randomTarget(potentialTargets) };
    }

    if (game.phase !== 'night' || game.exiledPlayerId === userId) {
        return { actionType: 'NONE', targetId: '' };
    }

    if (canFairiesKill) {
        const nonFairies = potentialTargets.filter(p => p.role !== 'seeker_fairy' && p.role !== 'sleeping_fairy');
        return { actionType: 'fairy_kill', targetId: randomTarget(nonFairies) };
    }

    switch (role) {
        case 'werewolf':
        case 'wolf_cub': {
             const wolfActions = nightActions.filter(a => a.round === currentRound && a.actionType === 'werewolf_kill' && a.playerId !== userId && wolfRoles.includes(game.players.find(p=>p.userId === a.playerId)?.role || null));
             if (wolfActions.length > 0 && Math.random() < 0.8) { 
                 const leaderAction = wolfActions[0];
                 if (leaderAction && leaderAction.targetId) {
                    return { actionType: 'werewolf_kill', targetId: leaderAction.targetId };
                 }
             }

            const nonWolves = potentialTargets.filter(p => {
                if (p.role && wolfRoles.includes(p.role)) return false;
                if (game.witchFoundSeer && p.role === 'witch') return false; 
                return true;
            });
            const killCount = wolfCubRevengeActive ? 2 : 1;
            return { actionType: 'werewolf_kill', targetId: randomTarget(nonWolves, killCount) };
        }
        case 'seer':
        case 'seer_apprentice':
            if (role === 'seer' || apprenticeIsActive) {
                const lastVoteEvent = game.events.find(e => e.type === 'vote_result' && e.round === currentRound - 1);
                
                const suspicionMap: Record<string, number> = {};
                alivePlayers.forEach(p => {
                    if (p.userId !== aiPlayer.userId) suspicionMap[p.userId] = 1;
                });
                
                if(lastVoteEvent?.data) {
                    const lynchedPlayerId = lastVoteEvent.data.lynchedPlayerId;
                    const lynchedPlayer = game.players.find(p => p.userId === lynchedPlayerId);
                    if(lynchedPlayer?.role === 'villager') {
                         game.players.filter(p => p.votedFor === lynchedPlayerId).forEach(voter => {
                            if (suspicionMap[voter.userId]) suspicionMap[voter.userId] += 10;
                         });
                    }
                    (lastVoteEvent.data.tiedPlayerIds || []).forEach((id: string) => {
                         if (suspicionMap[id]) suspicionMap[id] += 5;
                    });
                }
                
                const sortedSuspects = Object.keys(suspicionMap).sort((a,b) => suspicionMap[b] - suspicionMap[a]);
                if (sortedSuspects.length > 0 && Math.random() < 0.6) {
                    return { actionType: 'seer_check', targetId: sortedSuspects[0] };
                }

                return { actionType: 'seer_check', targetId: randomTarget(potentialTargets) };
            }
            return { actionType: 'NONE', targetId: '' };
        case 'doctor':
        case 'guardian': {
            const healableTargets = potentialTargets.filter(p => p.lastHealedRound !== currentRound - 1);
            if (role === 'guardian' && (aiPlayer.guardianSelfProtects || 0) < 1 && Math.random() < 0.2) {
                 return { actionType: 'guardian_protect', targetId: userId };
            }
            return { actionType: role === 'doctor' ? 'doctor_heal' : 'guardian_protect', targetId: randomTarget(healableTargets.length > 0 ? healableTargets : potentialTargets) };
        }
        case 'priest':
            if (!aiPlayer.priestSelfHealUsed && Math.random() < 0.2) return { actionType: 'priest_bless', targetId: userId };
            return { actionType: 'priest_bless', targetId: randomTarget(potentialTargets) };
        case 'resurrector_angel':
            if (!aiPlayer.resurrectorAngelUsed && deadPlayers.length > 0) {
                 return { actionType: 'resurrect', targetId: randomTarget(deadPlayers, 1) };
            }
            return { actionType: 'NONE', targetId: '' };
        case 'vampire': {
            const biteableTargets = potentialTargets.filter(p => (p.biteCount || 0) < 3);
            return { actionType: 'vampire_bite', targetId: randomTarget(biteableTargets.length > 0 ? biteableTargets : potentialTargets) };
        }
        case 'cult_leader': {
            const nonCultMembers = potentialTargets.filter(p => !p.isCultMember);
            return { actionType: 'cult_recruit', targetId: randomTarget(nonCultMembers) };
        }
        case 'fisherman': {
            const nonBoatTargets = potentialTargets.filter(p => !game.boat?.includes(p.userId));
            return { actionType: 'fisherman_catch', targetId: randomTarget(nonBoatTargets) };
        }
        case 'silencer':
        case 'elder_leader':
             return { actionType: role === 'silencer' ? 'silencer_silence' : 'elder_leader_exile', targetId: randomTarget(potentialTargets) };
        case 'seeker_fairy':
            if (!game.fairiesFound) {
                 const sleepingFairy = alivePlayers.find(p => p.role === 'sleeping_fairy');
                 if (sleepingFairy && Math.random() < 0.25) {
                     return { actionType: 'fairy_find', targetId: sleepingFairy.userId };
                 }
                 return { actionType: 'fairy_find', targetId: randomTarget(potentialTargets) };
            }
            return { actionType: 'NONE', targetId: '' };
        case 'witch':
            if (!game.witchFoundSeer) {
                return { actionType: 'witch_hunt', targetId: randomTarget(potentialTargets) };
            }
            return { actionType: 'NONE', targetId: '' };
        case 'cupid':
            if (currentRound === 1) {
                return { actionType: 'cupid_love', targetId: randomTarget(potentialTargets, 2) };
            }
            return { actionType: 'NONE', targetId: '' };
        case 'shapeshifter':
            if (currentRound === 1) {
                return { actionType: 'shapeshifter_select', targetId: randomTarget(potentialTargets) };
            }
            return { actionType: 'NONE', targetId: '' };
        case 'virginia_woolf':
            if (currentRound === 1) {
                return { actionType: 'virginia_woolf_link', targetId: randomTarget(potentialTargets) };
            }
            return { actionType: 'NONE', targetId: '' };
        case 'river_siren':
            if (currentRound === 1) {
                return { actionType: 'river_siren_charm', targetId: randomTarget(potentialTargets) };
            }
            return { actionType: 'NONE', targetId: '' };
        case 'hechicera':
             const hasPoison = !aiPlayer.potions?.poison;
             if (hasPoison) {
                 return { actionType: 'hechicera_poison', targetId: randomTarget(potentialTargets) };
             }
             return { actionType: 'NONE', targetId: '' };
        case 'executioner':
            return { actionType: 'NONE', targetId: '' };
        default:
            return { actionType: 'NONE', targetId: '' };
    }
};

export async function runAIActions(db: Firestore, gameId: string) {
    try {
        const gameDoc = await getDoc(doc(db, 'games', gameId));
        if (!gameDoc.exists()) return;
        const game = gameDoc.data() as Game;

        if(game.phase !== 'night' || game.status === 'finished') return;

        const aiPlayers = game.players.filter(p => p.isAI && p.isAlive && !p.usedNightAbility);
        const alivePlayers = game.players.filter(p => p.isAlive);
        const deadPlayers = game.players.filter(p => !p.isAlive);

        for (const ai of aiPlayers) {
            const { actionType, targetId } = getDeterministicAIAction(ai, game, alivePlayers, deadPlayers);

            if (!actionType || actionType === 'NONE' || !targetId || actionType === 'VOTE' || actionType === 'SHOOT') continue;

            await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 500));
            await submitNightAction(db, { gameId, round: game.currentRound, playerId: ai.userId, actionType: actionType, targetId });
        }
    } catch(e) {
        console.error("Error in AI Actions:", e);
    }
}

export async function triggerAIVote(db: Firestore, gameId: string) {
    try {
        const gameDoc = await getDoc(doc(db, 'games', gameId));
        if (!gameDoc.exists()) return;
        const game = gameDoc.data() as Game;
        if (game.status === 'finished' || game.phase !== 'day') return;

        const aiPlayersToVote = game.players.filter(p => p.isAI && p.isAlive && !p.votedFor);
        const alivePlayers = game.players.filter(p => p.isAlive);
        const deadPlayers = game.players.filter(p => !p.isAlive);

        for (const ai of aiPlayersToVote) {
            const { targetId } = getDeterministicAIAction(ai, game, alivePlayers, deadPlayers);
            if (targetId) {
                 await new Promise(resolve => setTimeout(resolve, Math.random() * 8000 + 2000));
                 await submitVote(db, gameId, ai.userId, targetId);
            }
        }

    } catch(e) {
        console.error("Error in triggerAIVote:", e);
    }
}

export async function runAIHunterShot(db: Firestore, gameId: string, hunter: Player) {
    try {
        const gameDoc = await getDoc(doc(db, 'games', gameId));
        if (!gameDoc.exists()) return;
        const game = gameDoc.data() as Game;

        if (game.phase !== 'hunter_shot' || game.pendingHunterShot !== hunter.userId) return;

        const alivePlayers = game.players.filter(p => p.isAlive && p.userId !== hunter.userId);
        
        const { targetId } = getDeterministicAIAction(hunter, game, alivePlayers, []);

        if (targetId) {
            await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 1000));
            await submitHunterShot(db, gameId, hunter.userId, targetId);
        } else {
             console.error(`AI Hunter ${hunter.displayName} could not find a target to shoot.`);
        }

    } catch(e) {
         console.error("Error in runAIHunterShot:", e);
    }
}
