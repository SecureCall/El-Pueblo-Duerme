
"use client";

import { useState, useEffect, useRef } from 'react';
import { Progress } from '../ui/progress';
import type { Game } from '@/types';

interface PhaseTimerProps {
    onTimerEnd: () => void;
    // Add key to force re-mount
    timerKey: string;
}

export function PhaseTimer({ onTimerEnd, timerKey }: PhaseTimerProps) {
    const duration = 45; // Day and Night are both 45s

    const [timeLeft, setTimeLeft] = useState(duration);
    const onTimerEndRef = useRef(onTimerEnd);

    // Keep the onTimerEnd callback fresh without causing re-renders.
    useEffect(() => {
        onTimerEndRef.current = onTimerEnd;
    }, [onTimerEnd]);

    useEffect(() => {
        // Reset timeLeft when the key changes (new phase/round starts)
        setTimeLeft(duration);
        
        if (duration <= 0) return;

        const interval = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    clearInterval(interval);
                    onTimerEndRef.current();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        // Cleanup function to clear the interval when the component unmounts or the key changes.
        return () => clearInterval(interval);
    }, [timerKey, duration]); 

    if (duration <= 0) return null;

    const progress = (timeLeft / duration) * 100;

    return (
        <div className="w-full">
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-center text-muted-foreground mt-1">{timeLeft}s</p>
        </div>
    );
}
