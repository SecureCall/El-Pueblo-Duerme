
"use client";

import type { Game } from "@/types";
import { useEffect, useRef } from "react";

interface GameMusicProps {
  game: Game;
}

const getAudioSrc = (game: Game): string | null => {
    if (game.status === 'waiting') {
        return "/audio/lobby-theme.mp3";
    }
    if (game.status === 'in_progress') {
        const isNightPhase = game.phase === 'night' || game.phase === 'role_reveal' || game.phase === 'hunter_shot';
        if (isNightPhase) {
            return "/audio/night-theme.mp3";
        } else {
            return "/audio/day-theme.mp3";
        }
    }
    // Potentially add a sound for 'finished' state
    return null;
}

export function GameMusic({ game }: GameMusicProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentSrcRef = useRef<string | null>(null);

  useEffect(() => {
    // This component will manage a single audio element instance
    if (!audioRef.current) {
      audioRef.current = new Audio();
    }
    const audio = audioRef.current;
    
    const newSrc = getAudioSrc(game);

    const playAudio = () => {
        if (!audio) return;
        const playPromise = audio.play();
        if (playPromise !== undefined) {
            playPromise.catch(error => {
                console.log("Game audio autoplay blocked, will start on user interaction.");
                 const playOnFirstInteraction = () => {
                    if (audio) {
                      audio.play().catch(err => console.error("Error playing game audio on interaction:", err));
                    }
                    window.removeEventListener("click", playOnFirstInteraction);
                    window.removeEventListener("keydown", playOnFirstInteraction);
                    window.removeEventListener("touchstart", playOnFirstInteraction);
                };
                window.addEventListener("click", playOnFirstInteraction, { once: true });
                window.addEventListener("keydown", playOnFirstInteraction, { once: true });
                window.addEventListener("touchstart", playOnFirstInteraction, { once: true });
            });
        }
    }

    if (newSrc && newSrc !== currentSrcRef.current) {
        // Fade out, change src, fade in
        const fadeOut = setInterval(() => {
            if (audio.volume > 0.05) {
                audio.volume -= 0.05;
            } else {
                clearInterval(fadeOut);
                audio.volume = 0;
                audio.pause();
                audio.src = newSrc;
                currentSrcRef.current = newSrc;
                audio.loop = true;
                playAudio();
                const fadeIn = setInterval(() => {
                    if (audio.volume < 0.29) { // Fade to 0.3
                        audio.volume += 0.05;
                    } else {
                        audio.volume = 0.3;
                        clearInterval(fadeIn);
                    }
                }, 50);
            }
        }, 50);

    } else if (!newSrc && !audio.paused) {
        audio.pause();
        audio.src = "";
        currentSrcRef.current = null;
    } else if (newSrc && audio.paused) {
        // If the src is correct but paused (e.g., due to tab change), play it
        playAudio();
    }
    
    return () => {
      // Don't stop music on component unmount, let it transition smoothly
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.status, game.phase]);


  return null; // This component does not render anything
}

    