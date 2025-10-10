
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
    return null;
}

export function GameMusic({ game }: GameMusicProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const currentSrcRef = useRef<string | null>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const newSrc = getAudioSrc(game);

    const playAudio = () => {
        const playPromise = audio.play();
        if (playPromise !== undefined) {
            playPromise.catch(error => {
                console.log("Game audio autoplay blocked, will start on user interaction.");
                 const playOnFirstInteraction = () => {
                    audio.play().catch(err => console.error("Error playing game audio on interaction:", err));
                    window.removeEventListener("click", playOnFirstInteraction);
                    window.removeEventListener("keydown", playOnFirstInteraction);
                    window.removeEventListener("touchstart", playOnFirstInteraction);
                };
                window.addEventListener("click", playOnFirstInteraction);
                window.addEventListener("keydown", playOnFirstInteraction);
                window.addEventListener("touchstart", playOnFirstInteraction);
            });
        }
    }

    if (newSrc && newSrc !== currentSrcRef.current) {
        // Fade out, change src, fade in
        audio.volume = 0;
        setTimeout(() => {
            audio.src = newSrc;
            currentSrcRef.current = newSrc;
            audio.loop = true;
            playAudio();
            audio.volume = 0.3;
        }, 300); // 300ms fade time

    } else if (!newSrc && !audio.paused) {
        audio.pause();
        audio.src = "";
        currentSrcRef.current = null;
    }
    
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.status, game.phase]);

  return <audio ref={audioRef} preload="auto" />;
}
