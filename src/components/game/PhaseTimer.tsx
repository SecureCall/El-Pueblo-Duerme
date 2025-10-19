
"use client";

import * as React from "react"
import { Progress } from '../ui/progress';

interface PhaseTimerProps {
    timeLeft: number;
    phaseDuration: number;
}

export function PhaseTimer({ timeLeft, phaseDuration }: PhaseTimerProps) {
    const progress = (timeLeft / phaseDuration) * 100;

    return (
        <div className="absolute bottom-[-20px] left-1/2 -translate-x-1/2 w-3/4">
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-center text-muted-foreground mt-1">{timeLeft}s</p>
        </div>
    );
}

    