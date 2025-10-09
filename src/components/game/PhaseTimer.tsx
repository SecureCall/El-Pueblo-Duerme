
"use client";

import { useState, useEffect } from 'react';
import { Progress } from '../ui/progress';

interface PhaseTimerProps {
    duration: number; // in seconds
    onTimerEnd: () => void;
    gameId: string;
    round: number;
}

export function PhaseTimer({ duration, onTimerEnd, gameId, round }: PhaseTimerProps) {
    const [timeLeft, setTimeLeft] = useState(duration);
    
    useEffect(() => {
        setTimeLeft(duration);
        const interval = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    clearInterval(interval);
                    onTimerEnd();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [duration, onTimerEnd, gameId, round]);

    const progress = (timeLeft / duration) * 100;

    return (
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3/4">
            <Progress value={progress} className="h-1" />
            <p className="text-xs text-center text-muted-foreground mt-1">{timeLeft}s</p>
        </div>
    );
}

    