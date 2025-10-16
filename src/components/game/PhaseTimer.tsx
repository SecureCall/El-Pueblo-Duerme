
"use client";

import { useState, useEffect, useRef } from 'react';
import { Progress } from '../ui/progress';
import type { Game } from '@/types';
import { Timestamp } from 'firebase/firestore';
import { useFirebase } from '@/firebase';
import { processNight, processVotes } from '@/lib/firebase-actions';

interface PhaseTimerProps {
    game: Game;
    isCreator: boolean;
}

const getMillis = (timestamp: any): number => {
    if (!timestamp) return 0;
    if (timestamp instanceof Timestamp) {
        return timestamp.toMillis();
    }
    if (typeof timestamp === 'object' && timestamp.seconds !== undefined && timestamp.nanoseconds !== undefined) {
        return timestamp.seconds * 1000 + timestamp.nanoseconds / 1000000;
    }
    if (timestamp instanceof Date) {
        return timestamp.getTime();
    }
    if (typeof timestamp === 'string') {
        const date = new Date(timestamp);
        if (!isNaN(date.getTime())) {
            return date.getTime();
        }
    }
    return 0;
};

const getTotalDuration = (phase: Game['phase']): number => {
    switch (phase) {
        case 'day': return 45;
        case 'night': return 45;
        case 'role_reveal': return 15;
        default: return 0;
    }
};

export function PhaseTimer({ game, isCreator }: PhaseTimerProps) {
    const { firestore } = useFirebase();
    const timerProcessedRef = useRef(false);
    
    const calculateTimeLeft = () => {
        const phaseEndMillis = getMillis(game.phaseEndsAt);
        if (phaseEndMillis === 0) return 0;
        const now = Date.now();
        return Math.max(0, Math.floor((phaseEndMillis - now) / 1000));
    };

    const [timeLeft, setTimeLeft] = useState(calculateTimeLeft);

    useEffect(() => {
        // Reset the processed flag whenever the phase or phase-end-time changes, ensuring the timer logic can run again for the new phase.
        timerProcessedRef.current = false;
        
        // Immediately set the time left based on the new game state.
        setTimeLeft(calculateTimeLeft());

        const interval = setInterval(() => {
            const remaining = calculateTimeLeft();
            setTimeLeft(remaining);

            // This logic will run on the creator's client when the timer hits zero.
            if (remaining <= 0 && isCreator && !timerProcessedRef.current && firestore) {
                 if (game.phase === 'night' || game.phase === 'day') {
                    // Mark as processed to prevent multiple executions.
                    timerProcessedRef.current = true; 

                    // Call the appropriate function to advance the game state.
                    if (game.phase === 'night') {
                        processNight(firestore, game.id);
                    } else if (game.phase === 'day') {
                        processVotes(firestore, game.id);
                    }
                }
            }
        }, 1000);

        return () => clearInterval(interval);

    }, [game.phase, game.currentRound, game.phaseEndsAt, game.id, isCreator, firestore]);

    const totalDuration = getTotalDuration(game.phase);
    if (totalDuration <= 0) return null;

    const progress = (timeLeft / totalDuration) * 100;

    return (
        <div className="w-3/4 max-w-sm mt-2">
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-center text-muted-foreground mt-1">{timeLeft}s</p>
        </div>
    );
}
