
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
      window.removeEventListener('click', handleInteraction);
      window.removeEventListener('keydown', handleInteraction);
      window.removeEventListener('touchstart', handleInteraction);
    };
    
    setMusic(src);

    window.addEventListener('click', handleInteraction, { once: true });
    window.addEventListener('keydown', handleInteraction, { once: true });
    window.addEventListener('touchstart', handleInteraction, { once: true });

    return () => {
      window.removeEventListener('click', handleInteraction);
      window.removeEventListener('keydown', handleInteraction);
      window.removeEventListener('touchstart', handleInteraction);
    };

  }, [src]);

  return null;
}
