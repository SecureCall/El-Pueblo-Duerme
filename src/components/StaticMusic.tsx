
"use client";

import { useEffect, useRef } from "react";

interface StaticMusicProps {
  src: string;
}

export function StaticMusic({ src }: StaticMusicProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.loop = true;
    audio.volume = 0.3;

    const playPromise = audio.play();

    if (playPromise !== undefined) {
      playPromise.catch(error => {
        console.log("Autoplay was prevented. Waiting for user interaction.");
        const playOnFirstInteraction = () => {
          audio.play().catch(err => console.error("Error playing audio on interaction:", err));
          window.removeEventListener("click", playOnFirstInteraction);
          window.removeEventListener("keydown", playOnFirstInteraction);
          window.removeEventListener("touchstart", playOnFirstInteraction);
        };
        window.addEventListener("click", playOnFirstInteraction);
        window.addEventListener("keydown", playOnFirstInteraction);
        window.addEventListener("touchstart", playOnFirstInteraction);
      });
    }

    return () => {
        if (audio) {
            audio.pause();
        }
    }
  }, [src]);


  return <audio ref={audioRef} src={src} preload="auto" />;
}

    