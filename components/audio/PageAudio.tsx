'use client';

import { useEffect, useRef } from 'react';
import { useAudio } from '@/app/providers/AudioProvider';
import { MusicTrack } from '@/lib/audio/sounds';

interface PageAudioProps {
  track: MusicTrack;
}

export function PageAudio({ track }: PageAudioProps) {
  const { playMusic } = useAudio();
  const started = useRef(false);

  useEffect(() => {
    const tryPlay = () => {
      playMusic(track);
      started.current = true;
    };

    tryPlay();

    if (!started.current) {
      const events = ['click', 'keydown', 'touchstart'];
      const handler = () => {
        tryPlay();
        events.forEach(e => document.removeEventListener(e, handler));
      };
      events.forEach(e => document.addEventListener(e, handler, { once: true, passive: true }));
      return () => events.forEach(e => document.removeEventListener(e, handler));
    }
  }, [track, playMusic]);

  return null;
}
