
"use client";

import * as React from "react"
import { Progress } from '../ui/progress';

interface PhaseTimerProps {
    timeLeft: number;
}

const getPhaseDuration = (phase: string) => {
    switch(phase) {
        case 'day': return 60;
        case 'night': return 30;
        default: return 45;
    }
}

export function PhaseTimer({ timeLeft, phase }: PhaseTimerProps & { phase: string }) {
    const phaseDuration = getPhaseDuration(phase);
    const progress = (timeLeft / phaseDuration) * 100;

    return (
        <div className="absolute bottom-[-8px] left-1/2 -translate-x-1/2 w-[95%] px-4">
            <Progress value={progress} className="h-2 bg-primary/20" />
            <p className="text-xs text-center text-muted-foreground mt-1 font-mono">{timeLeft}s</p>
        </div>
    );
}

    
