
"use client";

import type { Game } from "@/types";
import { useEffect, useRef } from "react";

interface GameMusicProps {
  game: Game;
}

// Helper to fade out audio
const fadeOut = (audio: HTMLAudioElement, duration: number = 500) => {
    if (audio.paused) return;
    const startVolume = audio.volume;
    const steps = 20;
    const stepDuration = duration / steps;
    let currentStep = 0;

    const fadeInterval = setInterval(() => {
        currentStep++;
        const newVolume = startVolume * (1 - currentStep / steps);
        if (newVolume >= 0) {
            audio.volume = newVolume;
        } else {
            audio.volume = 0;
            audio.pause();
            clearInterval(fadeInterval);
             // Reset volume for next play
            audio.volume = startVolume;
        }
    }, stepDuration);
};


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
    
    // Ensure all audio elements are initialized properly
    audioElements.forEach(audio => {
        if(audio) {
            audio.loop = true;
            audio.volume = 0.3; // Default volume
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
        const playPromise = audioElement.play();
        if (playPromise !== undefined) {
            playPromise.catch(error => {
                console.log("Game audio autoplay blocked, will start on user interaction.");
                 const playOnFirstInteraction = () => {
                    audioElement.play().catch(err => console.error("Error playing game audio on interaction:", err));
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
    };
    
    const stopAllAudio = () => {
        audioElements.forEach(audio => {
            if (audio) fadeOut(audio);
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
    
    // Cleanup on unmount
    return () => {
        stopAllAudio();
    }
    
  }, [game.status, game.phase]);

  return (
    <>
      <audio ref={dayAudioRef} src="/audio/day-theme.mp3" preload="auto" />
      <audio ref={nightAudioRef} src="/audio/night-theme.mp3" preload="auto" />
      <audio ref={lobbyAudioRef} src="/audio/lobby-theme.mp3" preload="auto" />
    </>
  );
}
