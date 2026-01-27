
'use server';
import { getDoc, doc } from "firebase/firestore";
import { 
  type Game, 
  type Player, 
  type PlayerRole, 
  type NightActionType
} from "@/types";
import { submitNightAction, submitHunterShot, submitVote } from "@/lib/firebase-actions";
import { adminDb } from "./firebase-admin";

type AIActionDecision = { actionType: NightActionType | 'VOTE' | 'SHOOT' | 'NONE'; targetId: string };

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

const getVoteAction = (aiPlayer: Player, game: Game, alivePlayers: Player[]): AIActionDecision => {
    const potentialTargets = alivePlayers.filter(p => p.userId !== aiPlayer.userId);

    // Executioner logic: High chance to vote for the target.
    if (aiPlayer.role === 'executioner' && aiPlayer.executionerTargetId) {
        const targetIsAlive = alivePlayers.some(p => p.userId === aiPlayer.executionerTargetId);
        if (targetIsAlive && Math.random() < 0.75) {
            return { actionType: 'VOTE', targetId: aiPlayer.executionerTargetId };
        }
    }
    
    // Revenge logic: If someone voted for the AI last round, they are a high-priority target.
    const lastVoteEvents = game.events.filter(e => e.type === 'vote_result' && e.round === game.currentRound - 1);
    const votersForMe = lastVoteEvents
        .flatMap(e => game.players.filter(p => p.votedFor === aiPlayer.userId))
        .map(p => p.userId);
    
    const revengeTargets = potentialTargets.filter(p => votersForMe.includes(p.userId));
    if (revengeTargets.length > 0 && Math.random() < 0.8) {
        return { actionType: 'VOTE', targetId: randomTarget(revengeTargets) };
    }

    return { actionType: 'VOTE', targetId: randomTarget(potentialTargets) };
};

const getWolfAction = (aiPlayer: Player, game: Game, alivePlayers: Player[]): AIActionDecision => {
    const { currentRound, nightActions = [] } = game;
    const wolfRoles: PlayerRole[] = ['werewolf', 'wolf_cub'];
    
    const potentialTargets = alivePlayers.filter(p => {
        if (p.userId === aiPlayer.userId) return false;
        if (p.role && wolfRoles.includes(p.role)) return false;
        if (game.witchFoundSeer && p.role === 'witch') return false; 
        return true;
    });

    // Follow the pack: If another wolf has acted, high chance to follow their lead.
    const wolfActions = nightActions.filter(a => a.round === currentRound && a.actionType === 'werewolf_kill' && a.playerId !== aiPlayer.userId && wolfRoles.includes(game.players.find(p=>p.userId === a.playerId)?.role || null));
    if (wolfActions.length > 0 && Math.random() < 0.8) { 
        const leaderAction = wolfActions[0];
        if (leaderAction && leaderAction.targetId) {
           return { actionType: 'werewolf_kill', targetId: leaderAction.targetId };
        }
    }
    
    // Strategic targeting: Target the revealed Prince
    const prince = potentialTargets.find(p => p.princeRevealed);
    if (prince && Math.random() < 0.7) {
        return { actionType: 'werewolf_kill', targetId: prince.userId };
    }

    // Revenge: Target players who voted for a wolf last round.
    const lastVoteEvent = game.events.find(e => e.type === 'vote_result' && e.round === currentRound - 1);
    if(lastVoteEvent?.data?.lynchedPlayerId) {
        const lynchedPlayer = game.players.find(p => p.userId === lastVoteEvent.data.lynchedPlayerId);
        if (lynchedPlayer?.role && wolfRoles.includes(lynchedPlayer.role)) {
            const playersWhoVotedForWolf = game.players.filter(p => p.votedFor === lynchedPlayer?.userId).map(p => p.userId);
            const suspiciousTargets = potentialTargets.filter(p => playersWhoVotedForWolf.includes(p.userId));
            if (suspiciousTargets.length > 0 && Math.random() < 0.6) {
                return { actionType: 'werewolf_kill', targetId: randomTarget(suspiciousTargets) };
           }
        }
    }
    
    const wolfCubRevengeActive = game.wolfCubRevengeRound === game.currentRound;
    const killCount = wolfCubRevengeActive ? 2 : 1;
    return { actionType: 'werewolf_kill', targetId: randomTarget(potentialTargets, killCount) };
};

const getSeerAction = (aiPlayer: Player, game: Game, alivePlayers: Player[]): AIActionDecision => {
    const potentialTargets = alivePlayers.filter(p => p.userId !== aiPlayer.userId);
    const previousTargets = game.nightActions.filter(a => a.playerId === aiPlayer.userId && a.actionType === 'seer_check').map(a => a.targetId);
    const uninvestigatedTargets = potentialTargets.filter(p => !previousTargets.includes(p.userId));
    
    // Prioritize investigating players who received votes but weren't lynched.
    const lastVoteEvent = game.events.find(e => e.type === 'vote_result' && e.round === game.currentRound - 1);
    if(lastVoteEvent?.data) {
        const suspiciousIds = new Set<string>();
        (lastVoteEvent.data.tiedPlayerIds || []).forEach((id: string) => suspiciousIds.add(id));
        
        game.players.forEach(p => {
            if(p.votedFor && p.votedFor !== lastVoteEvent.data.lynchedPlayerId) {
                suspiciousIds.add(p.votedFor);
            }
        });
        
        const suspiciousUninvestigated = uninvestigatedTargets.filter(p => suspiciousIds.has(p.userId));
        if (suspiciousUninvestigated.length > 0 && Math.random() < 0.8) {
            return { actionType: 'seer_check', targetId: randomTarget(suspiciousUninvestigated) };
        }
    }

    return { actionType: 'seer_check', targetId: randomTarget(uninvestigatedTargets.length > 0 ? uninvestigatedTargets : potentialTargets) };
};

const getDoctorAction = (aiPlayer: Player, game: Game, alivePlayers: Player[], actionType: 'doctor_heal' | 'guardian_protect'): AIActionDecision => {
    const potentialTargets = alivePlayers.filter(p => p.userId !== aiPlayer.userId);
    const healableTargets = potentialTargets.filter(p => p.lastHealedRound !== game.currentRound - 1);
    
    // Prioritize protecting the seer or players who seem important/targeted
    const seer = healableTargets.find(p => p.role === 'seer');
    if (seer && Math.random() < 0.6) {
         return { actionType, targetId: seer.userId };
    }
    
    const lastVoteEvent = game.events.find(e => e.type === 'vote_result' && e.round === game.currentRound - 1);
    if(lastVoteEvent?.data?.lynchedPlayerId) {
        const mostVotedForRunnerUp = Object.entries(game.players.reduce((acc, p) => {
            if(p.votedFor) acc[p.votedFor] = (acc[p.votedFor] || 0) + 1;
            return acc;
        }, {} as Record<string, number>)).sort((a,b) => b[1] - a[1]).find(entry => entry[0] !== lastVoteEvent.data.lynchedPlayerId);

        if(mostVotedForRunnerUp) {
            const runnerUpId = mostVotedForRunnerUp[0];
            if(healableTargets.some(p => p.userId === runnerUpId) && Math.random() < 0.5) {
                 return { actionType, targetId: runnerUpId };
            }
        }
    }

    if (actionType === 'guardian_protect' && (aiPlayer.guardianSelfProtects || 0) < 1 && Math.random() < 0.2) {
         return { actionType, targetId: aiPlayer.userId };
    }

    return { actionType, targetId: randomTarget(healableTargets.length > 0 ? healableTargets : potentialTargets) };
};

const aiNightActionLogic: Partial<Record<PlayerRole, (aiPlayer: Player, game: Game, alivePlayers: Player[], deadPlayers: Player[]) => AIActionDecision>> = {
    'werewolf': (ai, game, alive) => getWolfAction(ai, game, alive),
    'wolf_cub': (ai, game, alive) => getWolfAction(ai, game, alive),
    'seer': (ai, game, alive) => getSeerAction(ai, game, alive),
    'seer_apprentice': (ai, game, alive) => game.seerDied ? getSeerAction(ai, game, alive) : { actionType: 'NONE', targetId: '' },
    'doctor': (ai, game, alive) => getDoctorAction(ai, game, alive, 'doctor_heal'),
    'guardian': (ai, game, alive) => getDoctorAction(ai, game, alive, 'guardian_protect'),
    'priest': (ai, game, alive) => {
        if (!ai.priestSelfHealUsed && Math.random() < 0.2) return { actionType: 'priest_bless', targetId: ai.userId };
        const seer = alive.find(p => p.role === 'seer');
        if (seer && Math.random() < 0.5) return { actionType: 'priest_bless', targetId: seer.userId };
        return { actionType: 'priest_bless', targetId: randomTarget(alive.filter(p => p.userId !== ai.userId)) };
    },
    'resurrector_angel': (ai, game, alive, dead) => !ai.resurrectorAngelUsed && dead.length > 0 ? { actionType: 'resurrect', targetId: randomTarget(dead) } : { actionType: 'NONE', targetId: '' },
    // Simplified logic for other roles
    'vampire': (ai, game, alive) => {
        const biteableTargets = alive.filter(p => p.userId !== ai.userId && (p.biteCount || 0) < 3);
        return { actionType: 'vampire_bite', targetId: randomTarget(biteableTargets) };
    },
    'cult_leader': (ai, game, alive) => {
        const nonCultMembers = alive.filter(p => p.userId !== ai.userId && !p.isCultMember);
        return { actionType: 'cult_recruit', targetId: randomTarget(nonCultMembers) };
    },
     'hechicera': (ai, game, alive) => {
        const hasPoison = !ai.potions?.poison;
        if (hasPoison) {
            return { actionType: 'hechicera_poison', targetId: randomTarget(alive.filter(p => p.userId !== ai.userId)) };
        }
        return { actionType: 'NONE', targetId: '' };
    },
    'silencer': (ai, game, alive) => ({ actionType: 'silencer_silence', targetId: randomTarget(alive.filter(p => p.userId !== ai.userId)) }),
    'cupid': (ai, game, alive) => game.currentRound === 1 ? { actionType: 'cupid_love', targetId: randomTarget(alive.filter(p => p.userId !== ai.userId), 2) } : { actionType: 'NONE', targetId: '' },
    // Roles with no or complex night actions
    'hunter': () => ({ actionType: 'NONE', targetId: '' }),
    'executioner': () => ({ actionType: 'NONE', targetId: '' }),
    'villager': () => ({ actionType: 'NONE', targetId: '' }),
};

async function getFullPlayers(gameId: string, game: Game): Promise<Player[]> {
    const privateDataSnapshot = await getDocs(collection(adminDb, 'games', gameId, 'playerData'));
    const privateDataMap = new Map<string, Omit<Player, keyof PlayerPublicData>>();
    privateDataSnapshot.forEach(doc => {
        privateDataMap.set(doc.id, doc.data() as Omit<Player, keyof PlayerPublicData>);
    });

    const fullPlayers: Player[] = game.players.map(publicData => {
        const privateData = privateDataMap.get(publicData.userId);
        return { ...publicData, ...privateData } as Player;
    });

    return fullPlayers;
}


export async function runAIActions(gameId: string, phase: 'day' | 'night') {
    try {
        const gameDoc = await getDoc(doc(adminDb, 'games', gameId));
        if (!gameDoc.exists()) return;
        const game = gameDoc.data() as Game;

        if (game.status === 'finished') return;

        const fullPlayers = await getFullPlayers(gameId, game);
        const alivePlayers = fullPlayers.filter(p => p.isAlive);
        const deadPlayers = fullPlayers.filter(p => !p.isAlive);

        if (phase === 'night') {
            const aiPlayersToDoAction = alivePlayers.filter(p => p.isAI && !p.usedNightAbility);
            for (const ai of aiPlayersToDoAction) {
                if (!ai.role) continue;
                const actionLogic = aiNightActionLogic[ai.role];
                if (!actionLogic) continue;

                const { actionType, targetId } = actionLogic(ai, game, alivePlayers, deadPlayers);
                if (!actionType || actionType === 'NONE' || !targetId || actionType === 'VOTE' || actionType === 'SHOOT') continue;
                
                await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 500));
                await submitNightAction({ gameId, round: game.currentRound, playerId: ai.userId, actionType: actionType, targetId });
            }
        } else if (phase === 'day') {
            const aiPlayersToVote = alivePlayers.filter(p => p.isAI && !p.votedFor);
            for (const ai of aiPlayersToVote) {
                const { targetId } = getVoteAction(ai, game, alivePlayers);
                if (targetId) {
                    await new Promise(resolve => setTimeout(resolve, Math.random() * 8000 + 2000));
                    await submitVote(gameId, ai.userId, targetId);
                }
            }
        }
    } catch(e) {
        console.error("Error in AI Actions:", e);
    }
}

export async function runAIHunterShot(gameId: string) {
    try {
        const gameDoc = await getDoc(doc(adminDb, 'games', gameId));
        if (!gameDoc.exists()) return;
        const game = gameDoc.data() as Game;

        if (game.phase !== 'hunter_shot' || !game.pendingHunterShot) return;
        
        const fullPlayers = await getFullPlayers(gameId, game);
        const hunter = fullPlayers.find(p => p.userId === game.pendingHunterShot);

        if (!hunter || !hunter.isAI) return;

        const alivePlayers = fullPlayers.filter(p => p.isAlive && p.userId !== hunter.userId);
        
        const targetId = randomTarget(alivePlayers);

        if (targetId) {
            await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 1000));
            await submitHunterShot(gameId, hunter.userId, targetId);
        } else {
             console.error(`AI Hunter ${hunter.displayName} could not find a target to shoot.`);
        }
    } catch(e) {
         console.error("Error in runAIHunterShot:", e);
    }
}
