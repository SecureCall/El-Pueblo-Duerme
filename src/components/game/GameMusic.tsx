
"use client";

import type { Game } from "@/types";
import { useEffect, useRef } from "react";

interface GameMusicProps {
  game: Game;
}

export function GameMusic({ game }: GameMusicProps) {
  const dayAudioRef = useRef<HTMLAudioElement>(null);
  const nightAudioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const dayAudio = dayAudioRef.current;
    const nightAudio = nightAudioRef.current;

    if (!dayAudio || !nightAudio) return;

    // Set initial properties
    dayAudio.loop = true;
    nightAudio.loop = true;
    dayAudio.volume = 0.3;
    nightAudio.volume = 0.3;

    const playAudio = (audioElement: HTMLAudioElement) => {
      audioElement.play().catch(error => {
        // Autoplay is often blocked by browsers until a user interaction.
        // We catch the error to prevent it from showing in the console.
        // The music will start as soon as the user interacts with the page.
        console.log("Audio autoplay blocked, will start on user interaction.");
      });
    };

    const isNightPhase = game.phase === 'night' || game.phase === 'role_reveal' || game.phase === 'hunter_shot';
    const isDayPhase = game.phase === 'day' || game.phase === 'voting';
    const isFinished = game.status === 'finished' || game.status === 'waiting';

    if (isFinished) {
      dayAudio.pause();
      nightAudio.pause();
    } else if (isNightPhase) {
      if (!dayAudio.paused) dayAudio.pause();
      if (nightAudio.paused) playAudio(nightAudio);
    } else if (isDayPhase) {
      if (!nightAudio.paused) nightAudio.pause();
      if (dayAudio.paused) playAudio(dayAudio);
    }

  }, [game.phase, game.status]);

  return (
    <>
      <audio ref={dayAudioRef} src="/audio/day-theme.mp3" preload="auto" />
      <audio ref={nightAudioRef} src="/audio/night-theme.mprespect>
  );
}
