
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

    // This robustly gets milliseconds from either a Timestamp object, a plain serialized object, or a Date object.
    const getMillis = (timestamp: any): number => {
        if (!timestamp) return 0;
        if (timestamp instanceof Timestamp) {
            return timestamp.toMillis();
        }
        if (typeof timestamp.toDate === 'function') { // Another check for Firebase-like objects
            return timestamp.toDate().getTime();
        }
        if (typeof timestamp.seconds === 'number' && typeof timestamp.nanoseconds === 'number') {
            return timestamp.seconds * 1000 + timestamp.nanoseconds / 1000000;
        }
        if (timestamp instanceof Date) {
            return timestamp.getTime();
        }
        return 0; // Fallback for unknown formats
    };

    const getRemainingSeconds = useCallback(() => {
        const phaseEndMillis = getMillis(game.phaseEndsAt);
        if (phaseEndMillis === 0) return 0;
        
        const now = Date.now();
        const remaining = Math.max(0, Math.floor((phaseEndMillis - now) / 1000));
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
        timerProcessedRef.current = false;
        
        const interval = setInterval(() => {
            const remaining = getRemainingSeconds();
            setTimeLeft(remaining);

            if (remaining <= 0 && isCreator && !timerProcessedRef.current && firestore) {
                if (game.phase === 'night' || game.phase === 'day') {
                    timerProcessedRef.current = true; // Prevent multiple executions
                    
                    if (game.phase === 'night') {
                        processNight(firestore, game.id);
                    } else if (game.phase === 'day') {
                        processVotes(firestore, game.id);
                    }
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
