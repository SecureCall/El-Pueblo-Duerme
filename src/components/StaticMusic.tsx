
"use client";

import { useEffect, useRef } from "react";

interface StaticMusicProps {
  src: string;
}

export function StaticMusic({ src }: StaticMusicProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Ensure this only runs on the client
    if (typeof window === 'undefined') return;

    let audio = audioRef.current;
    if (!audio) {
      audio = new Audio(src);
      audioRef.current = audio;
    } else if (audio.src !== window.location.origin + src) {
      audio.src = src;
    }
    
    audio.loop = true;
    audio.volume = 0.3;

    const playPromise = audio.play();

    if (playPromise !== undefined) {
      playPromise.catch(error => {
        // Autoplay was prevented.
        // We'll add a one-time event listener for the first user interaction.
        const playOnFirstInteraction = () => {
          if (audio?.paused) {
            audio.play().catch(err => console.error("Error playing audio on interaction:", err));
          }
          // Clean up the event listener
          window.removeEventListener("click", playOnFirstInteraction);
          window.removeEventListener("keydown", playOnFirstInteraction);
          window.removeEventListener("touchstart", playOnFirstInteraction);
        };
        window.addEventListener("click", playOnFirstInteraction, { once: true });
        window.addEventListener("keydown", playOnFirstInteraction, { once: true });
        window.addEventListener("touchstart", playOnFirstInteraction, { once: true });
      });
    }

    return () => {
        if (audio) {
            // Fade out before pausing
            const fadeOut = setInterval(() => {
                if (audio.volume > 0.05) {
                    audio.volume -= 0.05;
                } else {
                    clearInterval(fadeOut);
                    audio.volume = 0;
                    audio.pause();
                }
            }, 50);
        }
    }
  }, [src]);


  return null; // The Audio object is handled in the effect, no need to render an element
}
