
"use client";

import * as React from "react"
import { Progress } from '../ui/progress';
import { cn } from "@/lib/utils";

const PHASE_DURATION_SECONDS = 60;

interface PhaseTimerProps {
    timeLeft: number;
}

export function PhaseTimer({ timeLeft }: PhaseTimerProps) {
    const progress = (timeLeft / PHASE_DURATION_SECONDS) * 100;
    const isUrgent = timeLeft <= 10;

    return (
        <div className="absolute bottom-[-8px] left-1/2 -translate-x-1/2 w-[95%] px-4">
            <Progress 
                value={progress} 
                className={cn(
                    "h-2 bg-primary/20 transition-all duration-1000",
                    isUrgent && "bg-destructive/50"
                )}
                indicatorClassName={cn(
                    isUrgent && "bg-destructive"
                )}
            />
            <p className={cn(
                "text-xs text-center text-muted-foreground mt-1 font-mono",
                isUrgent && "text-destructive animate-pulse font-bold"
            )}>
                {timeLeft}s
            </p>
        </div>
    );
}

    