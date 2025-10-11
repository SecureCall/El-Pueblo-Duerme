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

const playAudio = (audioElement: HTMLAudioElement | null, src: string): Promise<void> => {
    return new Promise((resolve, reject) => {
        if (!audioElement || !src) {
            resolve();
            return;
        }

        // Stop current playback if any
        if (!audioElement.paused) {
            audioElement.pause();
            audioElement.currentTime = 0;
        }

        audioElement.src = src;

        // Clear previous listeners to avoid memory leaks
        audioElement.onended = null;
        audioElement.onerror = null;

        audioElement.onended = () => resolve();
        audioElement.onerror = (e) => {
            console.error("Error playing audio:", e);
            // Resolve even on error to not block the audio sequence
            resolve();
        };
        
        const playPromise = audioElement.play();

        if (playPromise !== undefined) {
            playPromise.catch(error => {
                console.warn("Audio autoplay was prevented:", error);
                // Autoplay was prevented. Resolve to not block the sequence.
                resolve();
            });
        }
    });
};

export const playNarration = (narrationFile: string): Promise<void> => {
    return playAudio(narrationAudio, `/audio/voz/${narrationFile}`);
};

export const playSoundEffect = (soundFile: string): Promise<void> => {
    return playAudio(soundEffectAudio, `/audio/voz/${soundFile}`);
};
