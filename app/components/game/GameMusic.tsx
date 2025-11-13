
"use client";

import { useEffect } from "react";
import { setMusic, unlockAudio } from "@/lib/sounds";

interface GameMusicProps {
  src: string;
}

export function GameMusic({ src }: GameMusicProps) {
  useEffect(() => {
    // This function will be attached to the first user interaction
    const handleFirstInteraction = () => {
      unlockAudio();
    };

    // Attempt to set the music immediately. It will only play if audio is already unlocked.
    setMusic(src);

    // Add listeners for the first user interaction, with { once: true } to auto-cleanup
    window.addEventListener('click', handleFirstInteraction, { once: true });
    window.addEventListener('keydown', handleFirstInteraction, { once: true });
    window.addEventListener('touchstart', handleFirstInteraction, { once: true });

    // Cleanup function to remove listeners if the component unmounts before interaction
    return () => {
      window.removeEventListener('click', handleFirstInteraction);
      window.removeEventListener('keydown', handleFirstInteraction);
      window.removeEventListener('touchstart', handleFirstInteraction);
    };

  }, [src]); // Re-run effect if the music source changes

  return null;
}
