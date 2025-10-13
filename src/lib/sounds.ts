
// src/lib/sounds.ts
"use client";

let narrationAudio: HTMLAudioElement | null = null;
let soundEffectAudio: HTMLAudioElement | null = null;

if (typeof window !== 'undefined') {
    narrationAudio = new Audio();
    narrationAudio.volume = 1.0;

    soundEffectAudio = new Audio();
    soundEffectAudio.volume = 0.8; // Increased volume for sound effects
}

const playAudio = (audioElement: HTMLAudioElement | null, src: string): Promise<void> => {
    return new Promise((resolve, reject) => {
        if (!audioElement || !src) {
            resolve();
            return;
        }

        // For narration and sound effects, use the single instance to prevent overlap
        if (!audioElement.paused) {
            // If it's already playing something, let it finish, or decide to interrupt.
            // For now, we will interrupt.
            audioElement.pause();
            audioElement.currentTime = 0;
        }

        audioElement.src = src;
        audioElement.onended = () => resolve();
        audioElement.onerror = (e) => {
            console.error("Error playing audio:", e);
            resolve();
        };
        
        const playPromise = audioElement.play();

        if (playPromise !== undefined) {
            playPromise.then(() => {
                // Autoplay started!
            }).catch(error => {
                console.warn("Audio autoplay was prevented:", error);
                // We resolve anyway, so the game doesn't get stuck.
                resolve();
            });
        } else {
            resolve();
        }
    });
};

export const playNarration = (narrationFile: string): Promise<void> => {
    return playAudio(narrationAudio, `/audio/voz/${narrationFile}`);
};

export const playSoundEffect = (soundFile: string): Promise<void> => {
    // For sound effects, we create a new audio object each time
    // to allow multiple sounds to play, even overlapping.
    if (typeof window === 'undefined') return Promise.resolve();
    
    return new Promise(resolve => {
        const audio = new Audio(`/audio/effects/${soundFile}`);
        audio.volume = 0.8; // Effects volume
        audio.play().catch(e => console.warn("Sound effect failed to play", e));
        // We resolve immediately, not waiting for the sound to end.
        resolve();
    });
};

