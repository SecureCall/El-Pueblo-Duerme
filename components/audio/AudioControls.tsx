'use client';

import { Volume2, VolumeX } from 'lucide-react';
import { useAudio } from '@/app/providers/AudioProvider';

export function AudioControls() {
  const { toggleMute, isMuted } = useAudio();

  return (
    <button
      onClick={toggleMute}
      title={isMuted ? 'Activar sonido' : 'Silenciar'}
      className="text-white/50 hover:text-white transition-colors p-1"
    >
      {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
    </button>
  );
}
