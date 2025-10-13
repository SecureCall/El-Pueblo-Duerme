
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

    soundEffectAudio = new Audio();
    soundEffectAudio.volume = 0.8;

    const onNarrationEnd = () => {
        isNarrationPlaying = false;
        narrationQueue.shift()?.resolve();
        playNextNarration();
    };

    narrationAudio.addEventListener('ended', onNarrationEnd);
    narrationAudio.addEventListener('error', (e) => {
        console.error("Narration audio error:", e);
        onNarrationEnd(); // Skip the failing audio and move on
    });

    const unlockAudio = () => {
        if (!isAudioInitialized) {
            isAudioInitialized = true;
            // Play a tiny silent audio file to unlock the audio context
            narrationAudio?.play().catch(() => {});
            narrationAudio?.pause();
            soundEffectAudio?.play().catch(() => {});
            soundEffectAudio?.pause();
            document.removeEventListener('click', unlockAudio, true);
            document.removeEventListener('keydown', unlockAudio, true);
            document.removeEventListener('touchstart', unlockAudio, true);
        }
    };
    
    document.addEventListener('click', unlockAudio, true);
    document.addEventListener('keydown', unlockAudio, true);
    document.addEventListener('touchstart', unlockAudio, true);
};

initializeAudio();

const playNextNarration = () => {
    if (isNarrationPlaying || narrationQueue.length === 0 || !narrationAudio) {
        return;
    }
    isNarrationPlaying = true;
    const { src } = narrationQueue[0];
    
    narrationAudio.src = src;
    narrationAudio.play().catch(e => {
        console.warn(`Narration autoplay was prevented for ${src}:`, e);
        // This will be handled by the 'error' event listener, which calls onNarrationEnd
    });
};

export const playNarration = (narrationFile: string): Promise<void> => {
    return new Promise((resolve) => {
        if (!isAudioInitialized) {
            // If audio is not unlocked yet, we resolve immediately.
            // The sounds might not play, but we don't block the game logic.
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
    return new Promise((resolve) => {
        if (!isAudioInitialized || !soundEffectAudio) {
            console.warn("Audio not initialized. Cannot play sound effect.");
            resolve();
            return;
        }
        // Use a new audio object for each sound effect to allow for overlaps
        const audio = new Audio(`/audio/effects/${soundFile}`);
        audio.volume = 0.8;
        audio.play().catch(e => {
            console.error(`Sound effect ${soundFile} failed to play:`, e)
        });
        // We don't wait for the sound effect to end, so resolve immediately.
        resolve();
    });
};
