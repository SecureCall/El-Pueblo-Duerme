"use client";

import { useState, useEffect } from 'react';
import { Progress } from '../ui/progress';

interface PhaseTimerProps {
    duration: number; // in seconds
    onTimerEnd: () => void;
}

export function PhaseTimer({ duration, onTimerEnd }: PhaseTimerProps) {
    const [timeLeft, setTimeLeft] = useState(duration);
    
    useEffect(() => {
        setTimeLeft(duration); // Reset timer on new phase/round
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
    }, [duration, onTimerEnd]);

    const progress = (timeLeft / duration) * 100;

    return (
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3/4">
            <Progress value={progress} className="h-1" />
            <p className="text-xs text-center text-muted-foreground mt-1">{timeLeft}s</p>
        </div>
    );
}
