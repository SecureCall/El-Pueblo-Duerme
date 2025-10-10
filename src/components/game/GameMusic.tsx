
"use client";

import type { Game } from "@/types";
import { useEffect, useRef } from "react";

interface GameMusicProps {
  game: Game;
}

export function GameMusic({ game }: GameMusicProps) {
  const dayAudioRef = useRef<HTMLAudioElement>(null);
  const nightAudioRef = useRef<HTMLAudioElement>(null);
  const lobbyAudioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const dayAudio = dayAudioRef.current;
    const nightAudio = nightAudioRef.current;
    const lobbyAudio = lobbyAudioRef.current;

    const audioElements = [dayAudio, nightAudio, lobbyAudio];
    if (audioElements.some(el => !el)) return;

    // Set initial properties for all audio elements
    audioElements.forEach(audio => {
        if (audio) {
            audio.loop = true;
            audio.volume = 0.3;
        }
    });

    const playAudio = (audioElement: HTMLAudioElement) => {
      // Pause all other audio elements first
      audioElements.forEach(audio => {
        if (audio && audio !== audioElement && !audio.paused) {
          audio.pause();
        }
      });
      // Play the target audio
      if (audioElement.paused) {
        audioElement.play().catch(error => {
          // Autoplay is often blocked by browsers until a user interaction.
          console.log("Audio autoplay blocked, will start on user interaction.");
        });
      }
    };
    
    const stopAllAudio = () => {
        audioElements.forEach(audio => {
            if (audio && !audio.paused) {
                audio.pause();
            }
        });
    }

    if (game.status === 'waiting') {
        playAudio(lobbyAudio!);
    } else if (game.status === 'in_progress') {
        const isNightPhase = game.phase === 'night' || game.phase === 'role_reveal' || game.phase === 'hunter_shot';
        if (isNightPhase) {
            playAudio(nightAudio!);
        } else { // Day and voting phases
            playAudio(dayAudio!);
        }
    } else if (game.status === 'finished') {
        stopAllAudio();
    }
    
  }, [game.phase, game.status]);

  return (
    <>
      <audio ref={dayAudioRef} src="/audio/day-theme.mp3" preload="auto" />
      <audio ref={nightAudioRef} src="/audio/night-theme.mp3" preload="auto" />
      <audio ref={lobbyAudioRef} src="/audio/lobby-theme.mp3" preload="auto" />
    </>
  );
}
