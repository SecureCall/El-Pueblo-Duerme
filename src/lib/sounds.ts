
// src/lib/sounds.ts
"use client";

let narrationAudio: HTMLAudioElement | null = null;
let soundEffectAudio: HTMLAudioElement | null = null;
let isAudioInitialized = false;

// Function to initialize audio on first user interaction
const initializeAudio = () => {
    if (isAudioInitialized || typeof window === 'undefined') return;

    narrationAudio = new Audio();
    narrationAudio.volume = 1.0;

    soundEffectAudio = new Audio();
    soundEffectAudio.volume = 0.8;
    
    // Play a tiny silent sound to unlock audio playback
    narrationAudio.src = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";
    soundEffectAudio.src = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";

    isAudioInitialized = true;
    window.removeEventListener('click', initializeAudio);
    window.removeEventListener('keydown', initializeAudio);
};

if (typeof window !== 'undefined') {
    window.addEventListener('click', initializeAudio);
    window.addEventListener('keydown', initializeAudio);
}


const playAudio = (audioElement: HTMLAudioElement | null, src: string): Promise<void> => {
    return new Promise((resolve) => {
        if (!audioElement || !src) {
            resolve();
            return;
        }

        // Function to play the audio
        const play = () => {
            audioElement.src = src;
            audioElement.onended = () => resolve();
            audioElement.onerror = (e) => {
                console.error(`Error playing audio: ${src}`, e);
                resolve(); // Resolve even on error to not block game flow
            };

            const playPromise = audioElement.play();
            if (playPromise !== undefined) {
                playPromise.catch(error => {
                    console.warn(`Audio autoplay was prevented for ${src}:`, error);
                    // If play fails, it means we still need user interaction.
                    // The main listeners should handle this. We resolve to not block.
                    resolve();
                });
            } else {
                 resolve();
            }
        };

        if (!audioElement.paused) {
            audioElement.pause();
            // Wait for pause to complete before playing next
            audioElement.onpause = () => {
                audioElement.onpause = null; // Clean up listener
                play();
            };
        } else {
            play();
        }
    });
};

export const playNarration = (narrationFile: string): Promise<void> => {
    return playAudio(narrationAudio, `/audio/voz/${narrationFile}`);
};

export const playSoundEffect = (soundFile: string): Promise<void> => {
    if (typeof window === 'undefined') return Promise.resolve();
    
    return new Promise(resolve => {
        // Use a new audio object for sound effects to allow overlap
        const audio = new Audio(`/audio/effects/${soundFile}`);
        audio.volume = 0.8;
        
        audio.play().catch(e => console.warn(`Sound effect ${soundFile} failed to play:`, e));
        
        // Resolve immediately, don't wait for the sound to end.
        resolve();
    });
};
