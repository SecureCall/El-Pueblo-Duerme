
"use client";

import { useEffect, useRef } from "react";

interface StaticMusicProps {
  src: string;
}

export function StaticMusic({ src }: StaticMusicProps) {
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.loop = true;
    audio.volume = 0.3;

    const playAudio = () => {
      audio.play().catch(error => {
        console.log("Audio autoplay blocked, will start on user interaction.");
      });
    };

    playAudio();

    // Cleanup on component unmount
    return () => {
      audio.pause();
    };
  }, [src]);

  return (
    <audio ref={audioRef} src={src} preload="auto" />
  );
}
