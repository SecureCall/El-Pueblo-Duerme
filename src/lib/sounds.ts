
"use client";

let narrationAudio: HTMLAudioElement | null = null;
let soundEffectAudio: HTMLAudioElement | null = null;
let isAudioInitialized = false;
let narrationQueue: { src: string; resolve: () => void }[] = [];
let isNarrationPlaying = false;

const initializeAudio = () => {
    if (typeof window === 'undefined' || isAudioInitialized) return;

    narrationAudio = new Audio();
    narrationAudio.volume = 1.0;
    narrationAudio.onended = () => {
        isNarrationPlaying = false;
        playNextNarration();
    };
    narrationAudio.onerror = (e) => {
        console.error("Narration audio error:", e);
        isNarrationPlaying = false;
        narrationQueue.shift()?.resolve(); // Resolve to not block
        playNextNarration();
    };

    soundEffectAudio = new Audio();
    soundEffectAudio.volume = 0.8;

    // Unlock audio on all major browsers
    const unlockAudio = () => {
        if (narrationAudio?.paused) narrationAudio.play().catch(() => {});
        if (soundEffectAudio?.paused) soundEffectAudio.play().catch(() => {});
        document.removeEventListener('click', unlockAudio);
        document.removeEventListener('keydown', unlockAudio);
        document.removeEventListener('touchstart', unlockAudio);
    };

    narrationAudio.src = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";
    soundEffectAudio.src = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";
    
    document.addEventListener('click', unlockAudio);
    document.addEventListener('keydown', unlockAudio);
    document.addEventListener('touchstart', unlockAudio);

    isAudioInitialized = true;
};

initializeAudio();

const playNextNarration = () => {
    if (isNarrationPlaying || narrationQueue.length === 0) {
        return;
    }
    isNarrationPlaying = true;
    const { src, resolve } = narrationQueue[0];
    
    if (narrationAudio) {
        narrationAudio.src = src;
        narrationAudio.onended = () => {
            narrationQueue.shift()?.resolve();
            isNarrationPlaying = false;
            playNextNarration();
        };
        narrationAudio.play().catch(e => {
            console.warn(`Narration autoplay was prevented for ${src}:`, e);
            narrationQueue.shift()?.resolve(); // Unblock queue
            isNarrationPlaying = false;
            playNextNarration();
        });
    }
};

export const playNarration = (narrationFile: string): Promise<void> => {
    return new Promise((resolve) => {
        if (!isAudioInitialized) {
            console.warn("Audio not initialized. Cannot play narration.");
            resolve();
            return;
        }
        narrationQueue.push({ src: `/audio/voz/${narrationFile}`, resolve });
        if (!isNarrationPlaying) {
            playNextNarration();
        }
    });
};

export const playSoundEffect = (soundFile: string): Promise<void> => {
    if (!isAudioInitialized) {
         console.warn("Audio not initialized. Cannot play sound effect.");
        return Promise.resolve();
    }
    return new Promise(resolve => {
        // Use a new audio object for sound effects to allow overlap without a dedicated audio element
        const audio = new Audio(`/audio/effects/${soundFile}`);
        audio.volume = 0.8;
        
        audio.play().catch(e => console.warn(`Sound effect ${soundFile} failed to play:`, e));
        
        // Resolve immediately, don't wait for the sound to end.
        resolve();
    });
};
