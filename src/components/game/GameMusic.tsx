"use client";

import { useEffect, useRef } from "react";

interface GameMusicProps {
  src: string;
}

// These variables are now module-level and only accessed on the client.
let audio: HTMLAudioElement | null = null;
let currentSrc: string | null = null;

// Initialize audio instance only on the client-side
if (typeof window !== 'undefined') {
  audio = new Audio();
  audio.loop = true;
  audio.volume = 0.3;
}

export function GameMusic({ src }: GameMusicProps) {
  const isPlayingRef = useRef(false);

  useEffect(() => {
    if (!audio) return;

    // Construct full URL to ensure proper comparison
    const newSrcUrl = new URL(src, window.location.origin).href;

    // Function to attempt playing on first user interaction
    const playOnInteraction = async () => {
        // Ensure audio context is resumed
        if (audio && audio.paused) {
          try {
            await audio.play();
            isPlayingRef.current = true;
          } catch (err) {
             console.warn("Audio play on interaction failed.", err);
          }
        }
        // Cleanup listeners after first successful interaction
        window.removeEventListener('click', playOnInteraction, true);
        window.removeEventListener('keydown', playOnInteraction, true);
    };

    const handlePlay = async () => {
      // If the source is different, fade out, change src, and then fade in
      if (currentSrc && currentSrc !== newSrcUrl) {
        // Fade out
        await new Promise<void>(resolve => {
            let fadeOut = setInterval(() => {
                if (audio!.volume > 0.05) {
                    audio!.volume = Math.max(0, audio!.volume - 0.05);
                } else {
                    clearInterval(fadeOut);
                    audio!.pause();
                    audio!.volume = 0.3; // Reset volume for the next track
                    resolve();
                }
            }, 50);
        });
      }
      
      // If the source is new or the audio is currently paused, set src and attempt to play
      if (currentSrc !== newSrcUrl || audio.paused) {
        currentSrc = newSrcUrl;
        audio.src = newSrcUrl;
        
        try {
          // Attempt to play. This might fail on first load.
          await audio.play();
          isPlayingRef.current = true;
        } catch (error) {
          console.warn("Audio play was prevented by the browser. Waiting for user interaction.", error);
          // If autoplay fails, add listeners to try again on the next user interaction.
          window.addEventListener('click', playOnInteraction, true);
          window.addEventListener('keydown', playOnInteraction, true);
        }
      }
    };
    
    handlePlay();

    return () => {
      // Cleanup interaction listeners when the component unmounts or src changes
      window.removeEventListener('click', playOnInteraction, true);
      window.removeEventListener('keydown', playOnInteraction, true);
    };

  }, [src]); // Re-run effect if the src prop changes

  return null; // This component does not render anything to the DOM.
}
