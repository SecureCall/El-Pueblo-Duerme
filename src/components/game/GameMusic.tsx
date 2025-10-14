
"use client";

import { useEffect, useRef } from "react";

interface GameMusicProps {
  src: string;
}

// These variables are module-level and only accessed on the client.
let audio: HTMLAudioElement | null = null;
let currentSrc: string | null = null;

// Initialize audio instance only on the client-side
if (typeof window !== 'undefined') {
  audio = new Audio();
  audio.loop = true;
  audio.volume = 0.3;
}

export function GameMusic({ src }: GameMusicProps) {
  useEffect(() => {
    if (!audio) return;

    // Construct full URL to ensure proper comparison
    const newSrcUrl = new URL(src, window.location.origin).href;

    const tryPlay = async () => {
      if (audio && audio.paused && newSrcUrl) {
        // If the source is different, change it before playing
        if (audio.src !== newSrcUrl) {
            audio.src = newSrcUrl;
        }
        try {
            await audio.play();
        } catch (error) {
            console.warn("Audio playback failed. Waiting for another interaction.", error);
        }
      }
    };
    
    // Add a one-time event listener for the first user interaction
    const unlockAudio = () => {
        tryPlay();
        window.removeEventListener('click', unlockAudio);
        window.removeEventListener('keydown', unlockAudio);
    };

    const handlePlay = async () => {
      // If the source is different, fade out, change src, and then fade in
      if (currentSrc && currentSrc !== newSrcUrl) {
        // Fade out
        let fadeOut = setInterval(() => {
          if (!audio) {
              clearInterval(fadeOut);
              return;
          }
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
         // If it's the first track or the audio is just paused with the same src
        currentSrc = newSrcUrl;
        audio.src = newSrcUrl;
        tryPlay();
      }
    };

    handlePlay();
    
    // Set up listeners to handle autoplay restrictions
    window.addEventListener('click', unlockAudio, { once: true });
    window.addEventListener('keydown', unlockAudio, { once: true });

    return () => {
      // Cleanup interaction listeners
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };

  }, [src]); // Re-run effect if the src prop changes

  return null; // This component does not render anything to the DOM.
}

