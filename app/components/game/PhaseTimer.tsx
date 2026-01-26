
"use client";

import * as React from "react"
import { Progress } from '@/components/ui/progress';
import { cn } from "@/lib/utils";

const PHASE_DURATION_SECONDS = 60; // Default fallback

interface PhaseTimerProps {
    timeLeft: number;
    duration?: number;
}

export function PhaseTimer({ timeLeft, duration }: PhaseTimerProps) {
    const totalDuration = duration && duration > 0 ? duration : PHASE_DURATION_SECONDS;
    const progress = (timeLeft / totalDuration) * 100;
    const isUrgent = timeLeft <= 10;

    return (
        <div className="absolute bottom-[-8px] left-1/2 -translate-x-1/2 w-[95%] px-4">
            <Progress 
                value={progress} 
                className={cn(
                    "h-2 bg-primary/20",
                    isUrgent && "bg-destructive/50"
                )}
                indicatorClassName={cn(
                    "transition-all duration-1000 ease-linear",
                    isUrgent ? "bg-destructive" : "bg-primary"
                )}
            />
            <p className={cn(
                "text-xs text-center text-muted-foreground mt-1 font-mono transition-colors duration-500",
                isUrgent && "text-destructive animate-pulse font-bold"
            )}>
                {timeLeft}s
            </p>
        </div>
    );
}

