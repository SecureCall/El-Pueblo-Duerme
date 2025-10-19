
"use client";

import * as React from "react"
import { Progress } from '../ui/progress';
import type { Timestamp } from "firebase/firestore";

const PHASE_DURATION_SECONDS = 45;

interface PhaseTimerProps {
    phaseEndsAt: Timestamp;
}

export function PhaseTimer({ phaseEndsAt }: PhaseTimerProps) {
    const [timeLeft, setTimeLeft] = React.useState(PHASE_DURATION_SECONDS);

    React.useEffect(() => {
        const interval = setInterval(() => {
            const endTime = phaseEndsAt.toMillis();
            const now = Date.now();
            const remaining = Math.max(0, Math.round((endTime - now) / 1000));
            setTimeLeft(remaining);
        }, 1000);

        return () => clearInterval(interval);
    }, [phaseEndsAt]);

    const progress = (timeLeft / PHASE_DURATION_SECONDS) * 100;

    return (
        <div className="absolute bottom-[-20px] left-1/2 -translate-x-1/2 w-3/4">
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-center text-muted-foreground mt-1">{timeLeft}s</p>
        </div>
    );
}
