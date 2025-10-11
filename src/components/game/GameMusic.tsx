
"use client";

import { useEffect, useRef } from "react";

interface GameMusicProps {
  src: string;
}

// A global ref to hold the single audio instance
const audioRef = { current: (null as HTMLAudioElement | null) };

export function GameMusic({ src }: GameMusicProps) {
  useEffect(() => {
    // This component only manages the audio source and playback.
    // It doesn't render anything.
    if (typeof window === "undefined") return;

    let audio = audioRef.current;
    
    // Create audio element if it doesn't exist
    if (!audio) {
      audio = new Audio();
      audioRef.current = audio;
      audio.loop = true;
      audio.volume = 0.3;
    }

    const currentAudioSrc = audio.src ? new URL(audio.src).pathname : "";
    const newAudioSrc = src;

    // Change source only if it's different
    if (currentAudioSrc !== newAudioSrc) {
        // Fade out, change source, fade in
        let fadeOut = setInterval(() => {
            if (audio && audio.volume > 0.05) {
                audio.volume -= 0.05;
            } else {
                clearInterval(fadeOut);
                if (audio) {
                    audio.pause();
                    audio.src = newAudioSrc;
                    const playPromise = audio.play();
                    if(playPromise !== undefined) {
                        playPromise.then(() => {
                             // Fade in
                            let fadeIn = setInterval(() => {
                                if (audio && audio.volume < 0.29) {
                                    audio.volume += 0.05;
                                } else {
                                    if(audio) audio.volume = 0.3;
                                    clearInterval(fadeIn);
                                }
                            }, 100);
                        }).catch(error => {
                            console.error("Audio playback failed:", error);
                        });
                    }
                }
            }
        }, 50);
    } else if (audio.paused) {
        // If the source is the same but paused, just play it
        audio.play().catch(error => console.error("Audio playback failed:", error));
    }

    // No cleanup function that stops the music, as it should persist across GameRoom re-renders
  }, [src]);

  return null;
}
