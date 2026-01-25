
'use server';

import type { Game, Player, PlayerRole, NightActionType } from '@/types';

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
    if (aiPlayer.role === 'executioner' && aiPlayer.executionerTargetId) {
        const targetIsAlive = alivePlayers.some(p => p.userId === aiPlayer.executionerTargetId);
        if (targetIsAlive && Math.random() < 0.75) {
            return { actionType: 'VOTE', targetId: aiPlayer.executionerTargetId };
        }
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

    const wolfActions = nightActions.filter(a => a.round === currentRound && a.actionType === 'werewolf_kill' && a.playerId !== aiPlayer.userId && wolfRoles.includes(game.players.find(p=>p.userId === a.playerId)?.role || null));
    if (wolfActions.length > 0 && Math.random() < 0.8) { 
        const leaderAction = wolfActions[0];
        if (leaderAction && leaderAction.targetId) {
           return { actionType: 'werewolf_kill', targetId: leaderAction.targetId };
        }
    }
    
    const prince = potentialTargets.find(p => p.princeRevealed);
    if (prince && Math.random() < 0.7) {
        return { actionType: 'werewolf_kill', targetId: prince.userId };
    }

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
    
    return { actionType: 'seer_check', targetId: randomTarget(uninvestigatedTargets.length > 0 ? uninvestigatedTargets : potentialTargets) };
};

const getProtectorAction = (aiPlayer: Player, game: Game, alivePlayers: Player[], actionType: 'doctor_heal' | 'guardian_protect'): AIActionDecision => {
    const potentialTargets = alivePlayers.filter(p => p.userId !== aiPlayer.userId);
    const healableTargets = potentialTargets.filter(p => p.lastHealedRound !== game.currentRound - 1);
    const seer = healableTargets.find(p => p.role === 'seer');
    if (seer && Math.random() < 0.6) {
         return { actionType, targetId: seer.userId };
    }
    if (actionType === 'guardian_protect' && (aiPlayer.guardianSelfProtects || 0) < 1 && Math.random() < 0.2) {
         return { actionType, targetId: aiPlayer.userId };
    }
    return { actionType, targetId: randomTarget(healableTargets.length > 0 ? healableTargets : potentialTargets) };
};

const getHechiceraAction = (aiPlayer: Player, game: Game, alivePlayers: Player[]): AIActionDecision => {
    const hasPoison = !aiPlayer.potions?.poison;
    if (hasPoison) {
        const potentialTargets = alivePlayers.filter(p => p.userId !== aiPlayer.userId);
        return { actionType: 'hechicera_poison', targetId: randomTarget(potentialTargets) };
    }
    return { actionType: 'NONE', targetId: '' };
};

const getSimpleTargetAction = (actionType: NightActionType, aiPlayer: Player, game: Game, alivePlayers: Player[]): AIActionDecision => {
    const potentialTargets = alivePlayers.filter(p => p.userId !== aiPlayer.userId);
    return { actionType, targetId: randomTarget(potentialTargets) };
};

const getFirstNightAction = (actionType: NightActionType, aiPlayer: Player, game: Game, alivePlayers: Player[], targetCount: number = 1): AIActionDecision => {
    if (game.currentRound === 1) {
        const potentialTargets = alivePlayers.filter(p => p.userId !== aiPlayer.userId);
        return { actionType, targetId: randomTarget(potentialTargets, targetCount) };
    }
    return { actionType: 'NONE', targetId: '' };
};

export const aiNightActionLogic: Partial<Record<PlayerRole, (aiPlayer: Player, game: Game, alivePlayers: Player[], deadPlayers: Player[]) => AIActionDecision>> = {
    'werewolf': (ai, game, alive) => getWolfAction(ai, game, alive),
    'wolf_cub': (ai, game, alive) => getWolfAction(ai, game, alive),
    'seer': (ai, game, alive) => getSeerAction(ai, game, alive),
    'seer_apprentice': (ai, game, alive) => game.seerDied ? getSeerAction(ai, game, alive) : { actionType: 'NONE', targetId: '' },
    'doctor': (ai, game, alive) => getProtectorAction(ai, game, alive, 'doctor_heal'),
    'guardian': (ai, game, alive) => getProtectorAction(ai, game, alive, 'guardian_protect'),
    'hechicera': (ai, game, alive) => getHechiceraAction(ai, game, alive),
    'priest': (ai, game, alive) => {
        if (!ai.priestSelfHealUsed && Math.random() < 0.2) return { actionType: 'priest_bless', targetId: ai.userId };
        return getSimpleTargetAction('priest_bless', ai, game, alive);
    },
    'vampire': (ai, game, alive) => {
        const biteableTargets = alive.filter(p => p.userId !== ai.userId && (p.biteCount || 0) < 3);
        return getSimpleTargetAction('vampire_bite', ai, game, biteableTargets);
    },
    'cult_leader': (ai, game, alive) => {
        const nonCultMembers = alive.filter(p => p.userId !== ai.userId && !p.isCultMember);
        return getSimpleTargetAction('cult_recruit', ai, game, nonCultMembers);
    },
    'fisherman': (ai, game, alive) => {
        const nonBoatTargets = alive.filter(p => p.userId !== ai.userId && !game.boat?.includes(p.userId));
        return getSimpleTargetAction('fisherman_catch', ai, game, nonBoatTargets);
    },
    'silencer': (ai, game, alive) => getSimpleTargetAction('silencer_silence', ai, game, alive),
    'elder_leader': (ai, game, alive) => getSimpleTargetAction('elder_leader_exile', ai, game, alive),
    'witch': (ai, game, alive) => !game.witchFoundSeer ? getSimpleTargetAction('witch_hunt', ai, game, alive) : { actionType: 'NONE', targetId: '' },
    'seeker_fairy': (ai, game, alive) => {
        if (game.fairiesFound) {
            const nonFairies = alive.filter(p => p.role !== 'seeker_fairy' && p.role !== 'sleeping_fairy');
            return { actionType: 'fairy_kill', targetId: randomTarget(nonFairies) };
        }
        return getSimpleTargetAction('fairy_find', ai, game, alive);
    },
    'cupid': (ai, game, alive) => getFirstNightAction('cupid_love', ai, game, alive, 2),
    'shapeshifter': (ai, game, alive) => getFirstNightAction('shapeshifter_select', ai, game, alive),
    'virginia_woolf': (ai, game, alive) => getFirstNightAction('virginia_woolf_link', ai, game, alive),
    'river_siren': (ai, game, alive) => getFirstNightAction('river_siren_charm', ai, game, alive),
    'resurrector_angel': (ai, game, alive, dead) => !ai.resurrectorAngelUsed && dead.length > 0 ? { actionType: 'resurrect', targetId: randomTarget(dead) } : { actionType: 'NONE', targetId: '' },
};

export const aiDayActionLogic = (aiPlayer: Player, game: Game, alivePlayers: Player[]): AIActionDecision => {
    return getVoteAction(aiPlayer, game, alivePlayers);
};

export const aiHunterActionLogic = (aiPlayer: Player, game: Game, alivePlayers: Player[]): AIActionDecision => {
    const potentialTargets = alivePlayers.filter(p => p.userId !== aiPlayer.userId);
    return { actionType: 'SHOOT', targetId: randomTarget(potentialTargets) };
};

