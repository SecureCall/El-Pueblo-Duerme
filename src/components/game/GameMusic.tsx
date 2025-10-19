
"use client";

import { useEffect } from "react";
import { unlockAudio } from "@/lib/sounds";

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
            unlockAudio(); 
        } catch (error) {
            console.warn("Audio playback failed. Waiting for another interaction.", error);
        }
      }
    };
    
    const handleInteraction = () => {
        tryPlay();
        unlockAudio();
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
              audio.src = newSrcUrl; 
              tryPlay();
          }
        }, 50);
      } else if (currentSrc !== newSrcUrl) {
        currentSrc = newSrcUrl;
        audio.src = newSrcUrl;
        tryPlay();
      } else if (audio.paused) {
        tryPlay();
      }
    };

    handlePlay();
    
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
