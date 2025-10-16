
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

// Helper function to reliably get milliseconds from various Timestamp formats
const getMillis = (timestamp: any): number => {
    if (!timestamp) return 0;
    // Check for Firebase Timestamp object
    if (timestamp instanceof Timestamp) {
        return timestamp.toMillis();
    }
    // Check for serialized object { seconds, nanoseconds }
    if (typeof timestamp === 'object' && timestamp.seconds !== undefined && timestamp.nanoseconds !== undefined) {
        return timestamp.seconds * 1000 + timestamp.nanoseconds / 1000000;
    }
    // Check for Date object
    if (timestamp instanceof Date) {
        return timestamp.getTime();
    }
    // Check for ISO date string
    if (typeof timestamp === 'string') {
        const date = new Date(timestamp);
        if (!isNaN(date.getTime())) {
            return date.getTime();
        }
    }
    return 0; // Fallback for any other case
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
    const [timeLeft, setTimeLeft] = useState<number>(0);

    useEffect(() => {
        // Function to calculate remaining time
        const calculateRemainingTime = () => {
            const phaseEndMillis = getMillis(game.phaseEndsAt);
            if (phaseEndMillis === 0) return 0;
            const now = Date.now();
            return Math.max(0, Math.floor((phaseEndMillis - now) / 1000));
        };
        
        // Set initial time
        setTimeLeft(calculateRemainingTime());
        
        // Reset the processed flag whenever the phase changes
        timerProcessedRef.current = false;

        // Set up the interval
        const interval = setInterval(() => {
            const remaining = calculateRemainingTime();
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

        // Cleanup interval on component unmount or when dependencies change
        return () => clearInterval(interval);

    }, [game.phase, game.phaseEndsAt, game.currentRound, game.id, isCreator, firestore]);

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
