"use client";

import { useState, useEffect, useRef } from 'react';
import { Progress } from '../ui/progress';
import type { Game } from '@/types';
import { Timestamp } from 'firebase/firestore';

interface PhaseTimerProps {
    game: Game;
    onTimerEnd: () => void;
    // Add key to force re-mount
    timerKey: string;
}

// Helper to safely get milliseconds from either a Timestamp object or a plain object
const getMillis = (timestamp: any): number => {
  if (!timestamp) return 0;
  if (timestamp instanceof Timestamp) {
    return timestamp.toMillis();
  }
  // It's a plain object from JSON serialization
  if (typeof timestamp === 'object' && timestamp.seconds !== undefined && timestamp.nanoseconds !== undefined) {
    return timestamp.seconds * 1000 + timestamp.nanoseconds / 1000000;
  }
  // It might be a Date object already if converted somewhere
  if (timestamp instanceof Date) {
      return timestamp.getTime();
  }
  // It might be an ISO string
  if (typeof timestamp === 'string') {
      const date = new Date(timestamp);
      if (!isNaN(date.getTime())) {
          return date.getTime();
      }
  }
  return 0; // Return 0 for any other invalid format
};


const getTotalDuration = (phase: Game['phase']): number => {
    switch (phase) {
        case 'day': return 45;
        case 'night': return 45;
        case 'role_reveal': return 15;
        default: return 0;
    }
};

export function PhaseTimer({ game, onTimerEnd, timerKey }: PhaseTimerProps) {
    const onTimerEndRef = useRef(onTimerEnd);

    const calculateTimeLeft = () => {
        const phaseEndMillis = getMillis(game.phaseEndsAt);
        if (phaseEndMillis === 0) return 0;
        const now = Date.now();
        return Math.max(0, Math.floor((phaseEndMillis - now) / 1000));
    };
    
    const [timeLeft, setTimeLeft] = useState(calculateTimeLeft);
    
    // Keep the onTimerEnd callback fresh without causing re-renders.
    useEffect(() => {
        onTimerEndRef.current = onTimerEnd;
    }, [onTimerEnd]);

    useEffect(() => {
        // Reset timeLeft when the key changes (new phase/round starts)
        setTimeLeft(calculateTimeLeft());
        
        const totalDuration = getTotalDuration(game.phase);
        if (totalDuration <= 0) return;

        const interval = setInterval(() => {
            setTimeLeft(prev => {
                const newTimeLeft = calculateTimeLeft();
                if (newTimeLeft <= 0) {
                    clearInterval(interval);
                    onTimerEndRef.current();
                    return 0;
                }
                return newTimeLeft;
            });
        }, 1000);

        // Cleanup function to clear the interval when the component unmounts or the key changes.
        return () => clearInterval(interval);
    }, [timerKey, game.phaseEndsAt]); 

    const totalDuration = getTotalDuration(game.phase);
    if (totalDuration <= 0 || !game.phaseEndsAt) return null;

    const progress = (timeLeft / totalDuration) * 100;

    return (
        <div className="w-3/4 max-w-sm mt-2">
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-center text-muted-foreground mt-1">{timeLeft}s</p>
        </div>
    );
}
