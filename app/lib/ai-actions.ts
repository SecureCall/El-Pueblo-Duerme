
'use server';
import { getDoc, doc } from "firebase/firestore";
import { 
  type Game, 
  type Player, 
  type NightActionType,
  PlayerRoleEnum,
} from "@/types";
import { getAuthenticatedSdks } from "@/lib/firebase-server";
import { submitNightAction, submitHunterShot, submitVote } from "@/lib/firebase-actions";

export async function runAIActions(gameId: string, phase: 'day' | 'night' | 'hunter_shot') {
    const { firestore } = await getAuthenticatedSdks();
    try {
        const gameDoc = await getDoc(doc(firestore, 'games', gameId));
        if (!gameDoc.exists()) return;
        const game = gameDoc.data() as Game;

        if (game.status === 'finished') return;

        const alivePlayers = game.players.filter(p => p.isAlive);
        const deadPlayers = game.players.filter(p => !p.isAlive);

        if (phase === 'night') {
            const aiPlayersToDoAction = game.players.filter(p => p.isAI && p.isAlive && !p.usedNightAbility);
            for (const ai of aiPlayersToDoAction) {
                const { actionType, targetId } = await getDeterministicAIAction(ai, game, alivePlayers, deadPlayers);
                if (!actionType || actionType === 'NONE' || !targetId || actionType === 'VOTE' || actionType === 'SHOOT') continue;
                await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 500));
                await submitNightAction({ gameId, round: game.currentRound, playerId: ai.userId, actionType: actionType, targetId });
            }
        } else if (phase === 'day') {
            const aiPlayersToVote = game.players.filter(p => p.isAI && p.isAlive && !p.votedFor);
            for (const ai of aiPlayersToVote) {
                const { targetId } = await getDeterministicAIAction(ai, game, alivePlayers, deadPlayers);
                if (targetId) {
                    await new Promise(resolve => setTimeout(resolve, Math.random() * 8000 + 2000));
                    await submitVote(gameId, ai.userId, targetId);
                }
            }
        } else if (phase === 'hunter_shot') {
             const hunter = game.players.find(p => p.userId === game.pendingHunterShot);
             if (hunter && hunter.isAI) {
                await runAIHunterShot(gameId, hunter);
             }
        }
    } catch(e) {
        console.error("Error in AI Actions:", e);
    }
}


export async function runAIHunterShot(gameId: string, hunter: Player) {
    const { firestore } = await getAuthenticatedSdks();
    try {
        const gameDoc = await getDoc(doc(firestore, 'games', gameId));
        if (!gameDoc.exists()) return;
        const game = gameDoc.data() as Game;

        if (game.phase !== 'hunter_shot' || game.pendingHunterShot !== hunter.userId) return;

        const alivePlayers = game.players.filter(p => p.isAlive && p.userId !== hunter.userId);
        
        const { targetId } = await getDeterministicAIAction(hunter, game, alivePlayers, []);

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

export async function getDeterministicAIAction(
    aiPlayer: Player,
    game: Game,
    alivePlayers: Player[],
    deadPlayers: Player[],
): Promise<{ actionType: NightActionType | 'VOTE' | 'SHOOT' | 'NONE', targetId: string }> {
    const { role, userId } = aiPlayer;
    const { currentRound, nightActions = [] } = game;
    const wolfRoles: PlayerRoleEnum[] = [PlayerRoleEnum.werewolf, PlayerRoleEnum.wolf_cub];
    const wolfCubRevengeActive = game.wolfCubRevengeRound === game.currentRound;
    const apprenticeIsActive = role === PlayerRoleEnum.seer_apprentice && game.seerDied;
    const canFairiesKill = game.fairiesFound && !game.fairyKillUsed && (role === PlayerRoleEnum.seeker_fairy || role === PlayerRoleEnum.sleeping_fairy);

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
        if (aiPlayer.role === PlayerRoleEnum.executioner && aiPlayer.executionerTargetId) {
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

    if (game.phase !== 'night' || (aiPlayer.isExiled && game.exiledPlayerId === userId)) {
        return { actionType: 'NONE', targetId: '' };
    }

    if (canFairiesKill) {
        const nonFairies = potentialTargets.filter(p => p.role !== PlayerRoleEnum.seeker_fairy && p.role !== PlayerRoleEnum.sleeping_fairy);
        return { actionType: 'fairy_kill', targetId: randomTarget(nonFairies) };
    }

    switch (role) {
        case PlayerRoleEnum.werewolf:
        case PlayerRoleEnum.wolf_cub: {
             const wolfActions = nightActions.filter(a => a.round === currentRound && a.actionType === 'werewolf_kill' && a.playerId !== userId && wolfRoles.includes(game.players.find(p=>p.userId === a.playerId)?.role || null));
             if (wolfActions.length > 0 && Math.random() < 0.8) { 
                 const leaderAction = wolfActions[0];
                 if (leaderAction && leaderAction.targetId) {
                    return { actionType: 'werewolf_kill', targetId: leaderAction.targetId };
                 }
             }

            const nonWolves = potentialTargets.filter(p => {
                if (p.role && wolfRoles.includes(p.role as PlayerRoleEnum)) return false;
                if (game.witchFoundSeer && p.role === PlayerRoleEnum.witch) return false; 
                return true;
            });

            const prince = nonWolves.find(p => p.princeRevealed);
            if (prince && Math.random() < 0.7) {
                return { actionType: 'werewolf_kill', targetId: prince.userId };
            }

            const playersWhoVotedForWolves = game.players.filter(p => {
                const lastVoteEvent = game.events.find(e => e.type === 'vote_result' && e.round === currentRound - 1);
                if (!lastVoteEvent || !lastVoteEvent.data.lynchedPlayerId) return false;
                const lynchedPlayer = game.players.find(p => p.userId === lastVoteEvent.data.lynchedPlayerId);
                return p.votedFor === lynchedPlayer?.userId && lynchedPlayer?.role && wolfRoles.includes(lynchedPlayer.role);
            }).map(p => p.userId);

            const suspiciousPlayers = nonWolves.filter(p => playersWhoVotedForWolves.includes(p.userId));
            if (suspiciousPlayers.length > 0 && Math.random() < 0.6) {
                 return { actionType: 'werewolf_kill', targetId: randomTarget(suspiciousPlayers) };
            }

            const killCount = wolfCubRevengeActive ? 2 : 1;
            return { actionType: 'werewolf_kill', targetId: randomTarget(nonWolves, killCount) };
        }
        case PlayerRoleEnum.seer:
        case PlayerRoleEnum.seer_apprentice:
            if (role === PlayerRoleEnum.seer || apprenticeIsActive) {
                const previousTargets = nightActions.filter(a => a.playerId === userId && a.actionType === 'seer_check').map(a => a.targetId);
                const uninvestigatedTargets = potentialTargets.filter(p => !previousTargets.includes(p.userId));

                const lastVoteEvent = game.events.find(e => e.type === 'vote_result' && e.round === currentRound - 1);
                const suspicionMap: Record<string, number> = {};
                (uninvestigatedTargets.length > 0 ? uninvestigatedTargets : potentialTargets).forEach(p => {
                     suspicionMap[p.userId] = 1;
                });
                
                if(lastVoteEvent?.data) {
                    const lynchedPlayerId = lastVoteEvent.data.lynchedPlayerId;
                    if (lynchedPlayerId) {
                        const lynchedPlayer = game.players.find(p => p.userId === lynchedPlayerId);
                        if(lynchedPlayer?.role === PlayerRoleEnum.villager) {
                             game.players.filter(p => p.votedFor === lynchedPlayerId).forEach(voter => {
                                if (suspicionMap[voter.userId]) suspicionMap[voter.userId] += 10;
                             });
                        }
                    }
                    (lastVoteEvent.data.tiedPlayerIds || []).forEach((id: string) => {
                         if (suspicionMap[id]) suspicionMap[id] += 5;
                    });
                }
                
                const sortedSuspects = Object.keys(suspicionMap).sort((a,b) => suspicionMap[b] - suspicionMap[a]);
                if (sortedSuspects.length > 0 && Math.random() < 0.7) {
                    return { actionType: 'seer_check', targetId: sortedSuspects[0] };
                }

                return { actionType: 'seer_check', targetId: randomTarget(uninvestigatedTargets.length > 0 ? uninvestigatedTargets : potentialTargets) };
            }
            return { actionType: 'NONE', targetId: '' };
        case PlayerRoleEnum.doctor:
        case PlayerRoleEnum.guardian: {
            const healableTargets = potentialTargets.filter(p => p.lastHealedRound !== currentRound - 1);
            const seer = healableTargets.find(p => p.role === PlayerRoleEnum.seer);
            if (seer && Math.random() < 0.6) {
                 return { actionType: role === PlayerRoleEnum.doctor ? 'doctor_heal' : 'guardian_protect', targetId: seer.userId };
            }
            if (role === PlayerRoleEnum.guardian && (aiPlayer.guardianSelfProtects || 0) < 1 && Math.random() < 0.2) {
                 return { actionType: 'guardian_protect', targetId: userId };
            }
            return { actionType: role === PlayerRoleEnum.doctor ? 'doctor_heal' : 'guardian_protect', targetId: randomTarget(healableTargets.length > 0 ? healableTargets : potentialTargets) };
        }
        case PlayerRoleEnum.priest:
            if (!aiPlayer.priestSelfHealUsed && Math.random() < 0.2) return { actionType: 'priest_bless', targetId: userId };
            const seer = potentialTargets.find(p => p.role === PlayerRoleEnum.seer);
            if (seer && Math.random() < 0.5) return { actionType: 'priest_bless', targetId: seer.userId };
            return { actionType: 'priest_bless', targetId: randomTarget(potentialTargets) };
        case PlayerRoleEnum.resurrector_angel:
            if (!aiPlayer.resurrectorAngelUsed && deadPlayers.length > 0) {
                 return { actionType: 'resurrect', targetId: randomTarget(deadPlayers, 1) };
            }
            return { actionType: 'NONE', targetId: '' };
        case PlayerRoleEnum.vampire: {
            const biteableTargets = potentialTargets.filter(p => (p.biteCount || 0) < 3);
            return { actionType: 'vampire_bite', targetId: randomTarget(biteableTargets.length > 0 ? biteableTargets : potentialTargets) };
        }
        case PlayerRoleEnum.cult_leader: {
            const nonCultMembers = potentialTargets.filter(p => !p.isCultMember);
            return { actionType: 'cult_recruit', targetId: randomTarget(nonCultMembers) };
        }
        case PlayerRoleEnum.fisherman: {
            const nonBoatTargets = potentialTargets.filter(p => !game.boat?.includes(p.userId));
            return { actionType: 'fisherman_catch', targetId: randomTarget(nonBoatTargets) };
        }
        case PlayerRoleEnum.silencer:
        case PlayerRoleEnum.elder_leader:
             return { actionType: role === PlayerRoleEnum.silencer ? 'silencer_silence' : 'elder_leader_exile', targetId: randomTarget(potentialTargets) };
        case PlayerRoleEnum.seeker_fairy:
            if (!game.fairiesFound) {
                 const sleepingFairy = alivePlayers.find(p => p.role === PlayerRoleEnum.sleeping_fairy);
                 if (sleepingFairy && Math.random() < 0.25) {
                     return { actionType: 'fairy_find', targetId: sleepingFairy.userId };
                 }
                 return { actionType: 'fairy_find', targetId: randomTarget(potentialTargets) };
            }
            return { actionType: 'NONE', targetId: '' };
        case PlayerRoleEnum.witch:
            if (!game.witchFoundSeer) {
                return { actionType: 'witch_hunt', targetId: randomTarget(potentialTargets) };
            }
            return { actionType: 'NONE', targetId: '' };
        case PlayerRoleEnum.cupid:
            if (currentRound === 1) {
                return { actionType: 'cupid_love', targetId: randomTarget(potentialTargets, 2) };
            }
            return { actionType: 'NONE', targetId: '' };
        case PlayerRoleEnum.shapeshifter:
            if (currentRound === 1) {
                return { actionType: 'shapeshifter_select', targetId: randomTarget(potentialTargets) };
            }
            return { actionType: 'NONE', targetId: '' };
        case PlayerRoleEnum.virginia_woolf:
            if (currentRound === 1) {
                return { actionType: 'virginia_woolf_link', targetId: randomTarget(potentialTargets) };
            }
            return { actionType: 'NONE', targetId: '' };
        case PlayerRoleEnum.river_siren:
            if (currentRound === 1) {
                return { actionType: 'river_siren_charm', targetId: randomTarget(potentialTargets) };
            }
            return { actionType: 'NONE', targetId: '' };
        case PlayerRoleEnum.hechicera:
             const hasPoison = !aiPlayer.potions?.poison;
             if (hasPoison) {
                 return { actionType: 'hechicera_poison', targetId: randomTarget(potentialTargets) };
             }
             return { actionType: 'NONE', targetId: '' };
        case PlayerRoleEnum.executioner:
            return { actionType: 'NONE', targetId: '' };
        default:
            return { actionType: 'NONE', targetId: '' };
    }
}
    
