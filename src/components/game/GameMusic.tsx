
"use client";

import { useEffect } from "react";
import { unlockAudio as unlockNarration } from "@/lib/sounds";

interface GameMusicProps {
  src: string;
}

let audio: HTMLAudioElement | null = null;
let currentSrc: string | null = null;

if (typeof window !== 'undefined') {
  audio = new Audio();
  audio.loop = true;
  audio.volume = 0.3;
}

export function GameMusic({ src }: GameMusicProps) {
  useEffect(() => {
    if (!audio) return;

    const newSrcUrl = new URL(src, window.location.origin).href;

    const tryPlay = async () => {
      if (audio && audio.paused) {
        if (audio.src !== newSrcUrl) {
            audio.src = newSrcUrl;
        }
        try {
            await audio.play();
            // If play is successful, we know the user has interacted. Unlock narration.
            unlockNarration(); 
        } catch (error) {
            console.warn("Audio playback failed. Waiting for another interaction.", error);
        }
      }
    };
    
    const handleInteraction = () => {
        tryPlay();
        // Once interaction happens, also unlock the narration system globally.
        unlockNarration();
        window.removeEventListener('click', handleInteraction);
        window.removeEventListener('keydown', handleInteraction);
        window.removeEventListener('touchstart', handleInteraction);
    };

    const handlePlay = () => {
      if (currentSrc && currentSrc !== newSrcUrl) {
        let fadeOut = setInterval(() => {
          if (!audio) { clearInterval(fadeOut); return; }
          if (audio.volume > 0.05) {
              audio.volume = Math.max(0, audio.volume - 0.05);
          } else {
              clearInterval(fadeOut);
              audio.pause();
              audio.volume = 0.3; // Reset volume
              currentSrc = newSrcUrl;
              audio.src = newSrcUrl; // Set new source before playing
              tryPlay();
          }
        }, 50);
      } else if (currentSrc !== newSrcUrl) {
        currentSrc = newSrcUrl;
        audio.src = newSrcUrl;
        tryPlay();
      } else if (audio.paused) {
        // If the source is the same but audio is paused (e.g. returning to tab)
        tryPlay();
      }
    };

    handlePlay();
    
    // Always listen for the first interaction.
    window.addEventListener('click', handleInteraction, { once: true });
    window.addEventListener('keydown', handleInteraction, { once: true });
    window.addEventListener('touchstart', handleInteraction, { once: true });

    return () => {
      // It's good practice to clean up, though `once: true` does it automatically.
      window.removeEventListener('click', handleInteraction);
      window.removeEventListener('keydown', handleInteraction);
      window.removeEventListener('touchstart', handleInteraction);
    };

  }, [src]);

  return null;
}
