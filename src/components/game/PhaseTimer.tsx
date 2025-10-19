
"use client";

import * as React from "react"
import { Progress } from '../ui/progress';

interface PhaseTimerProps {
    phaseEndsAt?: { seconds: number; nanoseconds: number; } | null;
    phaseDuration: number;
}

export function PhaseTimer({ phaseEndsAt, phaseDuration }: PhaseTimerProps) {
    const [timeLeft, setTimeLeft] = React.useState(phaseDuration);

    React.useEffect(() => {
        if (!phaseEndsAt) {
            setTimeLeft(phaseDuration);
            return;
        }

        const endTime = new Date(phaseEndsAt.seconds * 1000 + phaseEndsAt.nanoseconds / 1000000);
        
        const interval = setInterval(() => {
            const now = new Date();
            const remaining = Math.max(0, Math.round((endTime.getTime() - now.getTime()) / 1000));
            setTimeLeft(remaining);
        }, 1000);

        return () => clearInterval(interval);
    }, [phaseEndsAt, phaseDuration]);

    const progress = (timeLeft / phaseDuration) * 100;

    return (
        <div className="w-full">
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-center text-muted-foreground mt-1">{timeLeft}s</p>
        </div>
    );
}
