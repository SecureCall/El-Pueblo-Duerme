
"use client";

let narrationAudio: HTMLAudioElement | null = null;
let soundEffectAudio: HTMLAudioElement | null = null;
let isAudioInitialized = false;
let narrationQueue: { src: string; resolve: () => void }[] = [];
let isNarrationPlaying = false;

const initializeAudio = () => {
    if (typeof window === 'undefined' || isAudioInitialized) return;

    const unlockAudio = () => {
        if (isAudioInitialized) return;
        
        try {
            if (!narrationAudio) {
                narrationAudio = new Audio();
                narrationAudio.volume = 1.0;
                narrationAudio.addEventListener('ended', onNarrationEnd);
                narrationAudio.addEventListener('error', (e) => {
                    console.error("Narration audio error:", e);
                    onNarrationEnd(); 
                });
            }
             if (!soundEffectAudio) {
                soundEffectAudio = new Audio();
                soundEffectAudio.volume = 0.8;
            }

            // Play a tiny silent audio to unlock the context
            narrationAudio.play().catch(() => {});
            narrationAudio.pause();
            soundEffectAudio.play().catch(() => {});
            soundEffectAudio.pause();
            
            isAudioInitialized = true;
            console.log("Audio context unlocked.");
            
            document.removeEventListener('click', unlockAudio, true);
            document.removeEventListener('keydown', unlockAudio, true);
            document.removeEventListener('touchstart', unlockAudio, true);

            // Start playing any queued narration
            playNextNarration();

        } catch (error) {
            console.error("Error initializing audio:", error);
        }
    };
    
    document.addEventListener('click', unlockAudio, true);
    document.addEventListener('keydown', unlockAudio, true);
    document.addEventListener('touchstart', unlockAudio, true);
};

const onNarrationEnd = () => {
    isNarrationPlaying = false;
    if (narrationQueue.length > 0) {
        narrationQueue.shift()?.resolve();
    }
    playNextNarration();
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
            console.warn("Audio not initialized. Queuing narration.");
        }
        narrationQueue.push({ src: `/audio/voz/${narrationFile}`, resolve });
        if (!isNarrationPlaying && isAudioInitialized) {
            playNextNarration();
        } else if (!isAudioInitialized) {
            // If not initialized, we can't play, but we've queued it.
            // We resolve immediately so game logic doesn't hang.
            // The audio will play once the user interacts.
            // This is a trade-off: audio might be delayed, but the app isn't stuck.
             resolve();
        } else {
             // It's initialized and playing, so just wait for the queue.
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
        audio.addEventListener('ended', () => resolve());
        audio.addEventListener('error', () => resolve());
    });
};
