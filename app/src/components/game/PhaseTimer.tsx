
"use client";

import * as React from "react"
import { Progress } from '../ui/progress';

const PHASE_DURATION_SECONDS = 45;

interface PhaseTimerProps {
    timeLeft: number;
}

export function PhaseTimer({ timeLeft }: PhaseTimerProps) {
    const progress = (timeLeft / PHASE_DURATION_SECONDS) * 100;

    return (
        <div className="absolute bottom-[-8px] left-1/2 -translate-x-1/2 w-[95%] px-4">
            <Progress value={progress} className="h-2 bg-primary/20" />
            <p className="text-xs text-center text-muted-foreground mt-1 font-mono">{timeLeft}s</p>
        </div>
    );
}
