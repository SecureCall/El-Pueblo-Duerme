
"use client";

import { useState, useEffect } from 'react';
import type { Game } from '@/types';
import { useGameState } from './use-game-state';


export function useNightActions(gameId: string, round: number, playerId: string) {
    const { game } = useGameState(gameId);
    const [hasSubmitted, setHasSubmitted] = useState(false);

    useEffect(() => {
        if (!game || !playerId || round === 0) {
            setHasSubmitted(false);
            return;
        };

        const submittedAction = game.nightActions?.find(
            action => action.round === round && action.playerId === playerId
        );

        setHasSubmitted(!!submittedAction);

    }, [game, round, playerId]);

    return { hasSubmitted };
}
