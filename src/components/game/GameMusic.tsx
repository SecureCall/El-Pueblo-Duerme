"use client";

import { useEffect } from "react";
import { setMusic, unlockAudio } from "@/lib/sounds";

interface GameMusicProps {
  src: string;
}

export function GameMusic({ src }: GameMusicProps) {
  useEffect(() => {
    // This function will be attached to the first user interaction
    const handleInteraction = () => {
      unlockAudio();
      // Once unlocked, immediately try to set and play the correct music
      setMusic(src);
      // Clean up listeners after the first interaction to avoid re-triggering
      window.removeEventListener('click', handleInteraction);
      window.removeEventListener('keydown', handleInteraction);
      window.removeEventListener('touchstart', handleInteraction);
    };

    // Attempt to set the music immediately. It will only play if audio is already unlocked.
    setMusic(src);

    // Add listeners for the first user interaction
    window.addEventListener('click', handleInteraction, { once: true });
    window.addEventListener('keydown', handleInteraction, { once: true });
    window.addEventListener('touchstart', handleInteraction, { once: true });

    // Cleanup function to remove listeners if the component unmounts before interaction
    return () => {
      window.removeEventListener('click', handleInteraction);
      window.removeEventListener('keydown', handleInteraction);
      window.removeEventListener('touchstart', handleInteraction);
    };

  }, [src]); // Re-run effect if the music source changes

  return null;
}
