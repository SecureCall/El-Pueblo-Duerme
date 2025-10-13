
"use client";

import { useEffect, useRef } from "react";

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
  const isPlayingRef = useRef(false);

  useEffect(() => {
    if (!audio) return;

    const newSrcUrl = new URL(src, window.location.origin).href;

    const playOnInteraction = async () => {
        if (audio && audio.paused) {
          try {
            await audio.play();
            isPlayingRef.current = true;
          } catch (err) {
             console.warn("Audio play on interaction failed.", err);
          }
        }
        // Always remove the listeners after the first successful interaction
        window.removeEventListener('click', playOnInteraction);
        window.removeEventListener('keydown', playOnInteraction);
    };

    const handlePlay = async () => {
      // If the source is different, fade out, change src, and fade in
      if (currentSrc && currentSrc !== newSrcUrl) {
        // Fade out
        await new Promise(resolve => {
            let fadeOut = setInterval(() => {
                if (audio!.volume > 0.05) {
                    audio!.volume = Math.max(0, audio!.volume - 0.05);
                } else {
                    clearInterval(fadeOut);
                    audio!.pause();
                    audio!.volume = 0.3; // Reset volume for next track
                    resolve(true);
                }
            }, 50);
        });
      }
      
      // If src is new or audio is not playing, set src and play
      if (currentSrc !== newSrcUrl || audio.paused) {
        currentSrc = newSrcUrl;
        audio.src = newSrcUrl;
        
        try {
          await audio.play();
          isPlayingRef.current = true;
        } catch (error) {
          console.warn("Audio play was prevented by the browser.", error);
          // If autoplay fails, we add listeners to try again on interaction
          window.addEventListener('click', playOnInteraction);
          window.addEventListener('keydown', playOnInteraction);
        }
      }
    };
    
    handlePlay();

    return () => {
      // Clean up interaction listeners when the component unmounts or src changes
      window.removeEventListener('click', playOnInteraction);
      window.removeEventListener('keydown', playOnInteraction);
    };

  }, [src]);

  return null; // This component does not render anything to the DOM.
}
