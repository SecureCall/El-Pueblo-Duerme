'use client';

import { createContext, useContext, useCallback, useState, ReactNode } from 'react';
import { getAudioManager } from '@/lib/audio/AudioManager';
import { MusicTrack, VoiceLine } from '@/lib/audio/sounds';

interface AudioContextValue {
  playMusic: (track: MusicTrack) => void;
  stopMusic: () => void;
  playVoice: (line: VoiceLine, onEnd?: () => void) => void;
  stopVoice: () => void;
  nightSequence: () => void;
  daySequence: () => void;
  gameStartSequence: () => void;
  playVoiceThenMusic: (line: VoiceLine, track: MusicTrack) => void;
  toggleMute: () => void;
  setMusicVolume: (v: number) => void;
  setVoiceVolume: (v: number) => void;
  isMuted: boolean;
}

const AudioContext = createContext<AudioContextValue | null>(null);

export function AudioProvider({ children }: { children: ReactNode }) {
  const [isMuted, setIsMuted] = useState(false);

  const mgr = getAudioManager();

  const playMusic = useCallback((track: MusicTrack) => mgr?.playMusic(track), [mgr]);
  const stopMusic = useCallback(() => mgr?.stopMusic(), [mgr]);
  const playVoice = useCallback((line: VoiceLine, onEnd?: () => void) => mgr?.playVoice(line, onEnd), [mgr]);
  const stopVoice = useCallback(() => mgr?.stopVoice(), [mgr]);
  const nightSequence = useCallback(() => mgr?.nightSequence(), [mgr]);
  const daySequence = useCallback(() => mgr?.daySequence(), [mgr]);
  const gameStartSequence = useCallback(() => mgr?.gameStartSequence(), [mgr]);
  const playVoiceThenMusic = useCallback((line: VoiceLine, track: MusicTrack) => mgr?.playVoiceThenMusic(line, track), [mgr]);
  const setMusicVolume = useCallback((v: number) => mgr?.setMusicVolume(v), [mgr]);
  const setVoiceVolume = useCallback((v: number) => mgr?.setVoiceVolume(v), [mgr]);
  const toggleMute = useCallback(() => {
    const muted = mgr?.toggleMute() ?? false;
    setIsMuted(muted);
  }, [mgr]);

  return (
    <AudioContext.Provider value={{
      playMusic, stopMusic, playVoice, stopVoice,
      nightSequence, daySequence, gameStartSequence, playVoiceThenMusic,
      toggleMute, setMusicVolume, setVoiceVolume, isMuted,
    }}>
      {children}
    </AudioContext.Provider>
  );
}

export function useAudio(): AudioContextValue {
  const ctx = useContext(AudioContext);
  if (!ctx) throw new Error('useAudio must be used within AudioProvider');
  return ctx;
}
