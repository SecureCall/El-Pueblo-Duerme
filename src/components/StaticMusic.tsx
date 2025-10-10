
"use client";

import { useEffect, useRef, useCallback } from "react";

interface StaticMusicProps {
  src: string;
}

export function StaticMusic({ src }: StaticMusicProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const hasPlayed = useRef(false);

  const playAudio = useCallback(() => {
    const audio = audioRef.current;
    if (audio && audio.paused && !hasPlayed.current) {
      audio.play().then(() => {
        hasPlayed.current = true;
      }).catch(error => {
        console.log("Audio autoplay failed, waiting for user interaction.", error);
      });
    }
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.loop = true;
    audio.volume = 0.3;

    // Try to play immediately
    playAudio();

    // Add event listeners to play on first user interaction
    const handleFirstInteraction = () => {
      playAudio();
      // Clean up listeners after first interaction
      window.removeEventListener('click', handleFirstInteraction);
      window.removeEventListener('keydown', handleFirstInteraction);
      window.removeEventListener('touchstart', handleFirstInteraction);
    };

    window.addEventListener('click', handleFirstInteraction);
    window.addEventListener('keydown', handleFirstInteraction);
    window.addEventListener('touchstart', handleFirstInteraction);

    // Cleanup on component unmount
    return () => {
      if (audio) {
        audio.pause();
      }
      window.removeEventListener('click', handleFirstInteraction);
      window.removeEventListener('keydown', handleFirstInteraction);
      window.removeEventListener('touchstart', handleFirstInteraction);
    };
  }, [src, playAudio]);

  return (
    <audio ref={audioRef} src={src} preload="auto" />
  );
}
