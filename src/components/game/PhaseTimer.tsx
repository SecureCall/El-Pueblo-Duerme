
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

export function PhaseTimer({ game, isCreator }: PhaseTimerProps) {
    const { firestore } = useFirebase();
    const getDuration = () => {
        if (!game.phaseEndsAt) return 0;
        const phaseEndMillis = game.phaseEndsAt instanceof Timestamp 
            ? game.phaseEndsAt.toMillis()
            : (game.phaseEndsAt.seconds * 1000 + game.phaseEndsAt.nanoseconds / 1000000);
            
        const now = Date.now();
        const durationSeconds = Math.max(0, Math.ceil((phaseEndMillis - now) / 1000));
        
        return durationSeconds;
    };

    const [duration, setDuration] = useState(getDuration);
    const [timeLeft, setTimeLeft] = useState(duration);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    const onTimerEnd = async () => {
        if (!isCreator || !firestore || !game) return;

        if (game.phase === 'night') {
            await processNight(firestore, game.id);
        } else if (game.phase === 'day') {
            await processVotes(firestore, game.id);
        }
    };

    useEffect(() => {
        const initialDuration = getDuration();
        setDuration(initialDuration);
        setTimeLeft(initialDuration);
        
        if (timerRef.current) {
            clearInterval(timerRef.current);
        }
        
        if (initialDuration <= 0) {
            if (isCreator) {
                // If time is already up on mount, creator should process it.
                onTimerEnd();
            }
            return;
        }

        timerRef.current = setInterval(() => {
            setTimeLeft(prev => {
                const newTimeLeft = prev - 1;
                if (newTimeLeft <= 0) {
                    clearInterval(timerRef.current!);
                    onTimerEnd();
                    return 0;
                }
                return newTimeLeft;
            });
        }, 1000);

        return () => {
            if(timerRef.current) clearInterval(timerRef.current)
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [game.phase, game.currentRound, game.phaseEndsAt, isCreator, firestore]);

    if (duration <= 0) return null;

    const progress = (timeLeft / duration) * 100;

    return (
        <div className="w-3/4 max-w-sm mt-4">
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-center text-muted-foreground mt-1">{timeLeft}s</p>
        </div>
    );
}
