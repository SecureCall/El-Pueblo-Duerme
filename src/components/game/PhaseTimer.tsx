
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
        if (duration <= 0) return;

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
    }, [duration, onTimerEnd]);

    if (duration <= 0) return null;

    const progress = (timeLeft / duration) * 100;

    return (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-3/4 max-w-sm">
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-center text-muted-foreground mt-1">{timeLeft}s</p>
        </div>
    );
}
