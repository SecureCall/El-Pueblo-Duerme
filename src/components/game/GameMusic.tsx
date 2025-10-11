
"use client";

import { useEffect } from "react";

interface GameMusicProps {
  src: string;
}

// A global ref to hold the single audio instance. This ensures the same audio element is used across re-renders.
let audio: HTMLAudioElement | null = null;
if (typeof window !== 'undefined') {
  audio = new Audio();
  audio.loop = true;
  audio.volume = 0.3;
}

export function GameMusic({ src }: GameMusicProps) {
  useEffect(() => {
    if (!audio) return;

    // Check if the new source is different from the current one.
    // We compare the full URL to avoid issues with relative paths.
    const newSrcUrl = new URL(src, window.location.origin).href;

    if (audio.src !== newSrcUrl) {
      audio.src = newSrcUrl;
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          // This catch block handles cases where autoplay is blocked by the browser.
          // We don't need to log it as an error unless it's for debugging.
          // The audio will likely play on the next user interaction anyway.
        });
      }
    } else if (audio.paused) {
      // If the source is the same but the audio is paused, play it.
       const playPromise = audio.play();
        if (playPromise !== undefined) {
            playPromise.catch(error => {});
        }
    }

    // There is no cleanup function here. The music should persist and only change
    // when the `src` prop changes in a subsequent render.
  }, [src]);

  return null; // This component does not render anything to the DOM.
}
