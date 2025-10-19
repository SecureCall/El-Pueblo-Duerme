
"use client";

import { useState, useEffect, useRef } from 'react';
import { Progress } from '../ui/progress';

interface PhaseTimerProps {
    onTimerEnd: () => void;
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
        setTimeLeft(duration);
        
        if (duration <= 0) return;

        const interval = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    clearInterval(interval);
                    // Prevent multiple rapid calls
                    if (timeLeft > 0) { 
                        onTimerEndRef.current();
                    }
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [timerKey, duration, timeLeft]); 

    if (duration <= 0) return null;

    const progress = (timeLeft / duration) * 100;

    return (
        <div className="w-full">
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-center text-muted-foreground mt-1">{timeLeft}s</p>
        </div>
    );
}
