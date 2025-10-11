"use client";

import { useEffect, useRef } from "react";

export function HomePageAudio() {
  const musicAudioRef = useRef<HTMLAudioElement | null>(null);
  const narrationAudioRef = useRef<HTMLAudioElement | null>(null);
  const hasPlayedNarrationRef = useRef(false);

  useEffect(() => {
    // Ensure this only runs on the client
    if (typeof window === 'undefined') return;

    // --- Initialize Audio Elements ---
    if (!musicAudioRef.current) {
        musicAudioRef.current = new Audio('/audio/menu-theme.mp3');
        musicAudioRef.current.loop = true;
        musicAudioEfuserele.current.volume = 0.3;
    }
    if (!narrationAudioRef.current) {
        narrationAudioRef.current = new Audio();
        narrationAudioRef.current.volume = 1.0;
    }

    const musicAudio = musicAudioRef.current;
    const narrationAudio = narrationAudioRef.current;

    // --- Narration Sequence Logic ---
    const playNarrationSequence = () => {
        if (hasPlayedNarrationRef.current) return;
        hasPlayedNarrationRef.current = true; // Prevent re-playing

        narrationAudio.src = '/audio/voz/Que comience el juego..mp3';
        
        narrationAudio.onended = () => {
            // When the first narration ends, play the second one.
            narrationAudio.src = '/audio/voz/salas.mp3';
            narrationAudio.onended = null; // Clear the listener
            narrationAudio.play().catch(e => console.warn("Could not play second narration:", e));
        };

        narrationAudio.play().catch(e => console.warn("Could not play first narration:", e));
    };

    // --- Autoplay Logic ---
    const startAudio = () => {
        // Try to play music first
        const musicPromise = musicAudio.play();
        
        if (musicPromise !== undefined) {
            musicPromise.then(() => {
                // If music starts, narration can probably start too.
                playNarrationSequence();
            }).catch(error => {
                // Autoplay was prevented for music.
                // Add a one-time event listener for the first user interaction.
                const playOnFirstInteraction = () => {
                    if (musicAudio.paused) {
                        musicAudio.play().catch(err => console.error("Error playing music on interaction:", err));
                    }
                    // Try narration on interaction as well
                    if (narrationAudio.paused) {
                        playNarrationSequence();
                    }
                    // Clean up the event listeners
                    window.removeEventListener("click", playOnFirstInteraction);
                    window.removeEventListener("keydown", playOnFirstInteraction);
                    window.removeEventListener("touchstart", playOnFirstInteraction);
                };
                window.addEventListener("click", playOnFirstInteraction, { once: true });
                window.addEventListener("keydown", playOnFirstInteraction, { once: true });
                window.addEventListener("touchstart", playOnFirstInteraction, { once: true });
            });
        }
    };
    
    startAudio();

    // --- Cleanup on component unmount ---
    return () => {
        // Stop both audio tracks when navigating away
        if (musicAudio) {
            musicAudio.pause();
            musicAudio.currentTime = 0;
        }
        if (narrationAudio) {
            narrationAudio.pause();
            narrationAudio.currentTime = 0;
        }
    }
  }, []);

  return null; // This component does not render anything
}
