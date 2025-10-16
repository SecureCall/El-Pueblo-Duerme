"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { Progress } from '../ui/progress';
import type { Game } from '@/types';
import { Timestamp } from 'firebase/firestore';
import { useFirebase } from '@/firebase';
import { processNight, processVotes } from '@/lib/firebase-actions';

interface PhaseTimerProps {
    game: Game;
    isCreator: boolean;
}

export function PhaseTimer({ game, isCreator }: PhaseTimerProps) {
    const { firestore } = useFirebase();
    const timerProcessedRef = useRef(false);

    const getRemainingSeconds = useCallback(() => {
        if (!game.phaseEndsAt) return 0;
        
        const phaseEndMillis = game.phaseEndsAt instanceof Timestamp
            ? game.phaseEndsAt.toMillis()
            : (game.phaseEndsAt.seconds * 1000 + (game.phaseEndsAt.nanoseconds || 0) / 1000000);
        
        const now = Date.now();
        const remaining = Math.max(0, Math.ceil((phaseEndMillis - now) / 1000));
        return remaining;
    }, [game.phaseEndsAt]);

    const getTotalDuration = () => {
        switch (game.phase) {
            case 'day': return 45;
            case 'night': return 45;
            case 'role_reveal': return 15;
            default: return 0;
        }
    };

    const [timeLeft, setTimeLeft] = useState(getRemainingSeconds);
    const totalDuration = getTotalDuration();

    useEffect(() => {
        // Reset the processed flag when the phase or round changes, ensuring the creator can trigger the next phase.
        timerProcessedRef.current = false;
        
        // Update the time left immediately when the component re-renders due to game state changes.
        setTimeLeft(getRemainingSeconds());

        const interval = setInterval(() => {
            const remaining = getRemainingSeconds();
            setTimeLeft(remaining);

            if (remaining <= 0 && isCreator && !timerProcessedRef.current) {
                timerProcessedRef.current = true; // Prevent multiple executions
                
                if (game.phase === 'night') {
                    processNight(firestore, game.id);
                } else if (game.phase === 'day') {
                    processVotes(firestore, game.id);
                }
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [game.phase, game.currentRound, game.id, getRemainingSeconds, isCreator, firestore]);

    if (totalDuration <= 0) return null;

    const progress = totalDuration > 0 ? (timeLeft / totalDuration) * 100 : 0;

    return (
        <div className="w-3/4 max-w-sm mt-2">
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-center text-muted-foreground mt-1">{timeLeft}s</p>
        </div>
    );
}
