// src/lib/sounds.ts
"use client";

let narrationAudio: HTMLAudioElement | null = null;
let soundEffectAudio: HTMLAudioElement | null = null;

if (typeof window !== 'undefined') {
    narrationAudio = new Audio();
    narrationAudio.volume = 1.0;

    soundEffectAudio = new Audio();
    soundEffectAudio.volume = 0.8;
}

const playAudio = (audioElement: HTMLAudioElement | null, src: string) => {
    if (!audioElement || !src) return;

    // Stop current playback before starting a new one
    if (!audioElement.paused) {
        audioElement.pause();
        audioElement.currentTime = 0;
    }
    
    audioElement.src = src;
    const playPromise = audioElement.play();

    if (playPromise !== undefined) {
        playPromise.catch(error => {
            // Autoplay was prevented. This is common, especially on first load.
            // We don't need to log this as it's an expected browser behavior.
        });
    }
};

export const playNarration = (narrationFile: string) => {
    playAudio(narrationAudio, `/audio/voz/${narrationFile}`);
};

export const playSoundEffect = (soundFile: string) => {
    playAudio(soundEffectAudio, `/audio/voz/${soundFile}`);
};
