
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
            const silentAudio = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";
            
            if (narrationAudio.src !== silentAudio) narrationAudio.src = silentAudio;
            if (soundEffectAudio.src !== silentAudio) soundEffectAudio.src = silentAudio;

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
    const finishedNarration = narrationQueue.shift();
    if (finishedNarration) {
        finishedNarration.resolve();
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
        onNarrationEnd();
    });
};

export const playNarration = (narrationFile: string): Promise<void> => {
    return new Promise((resolve, reject) => {
        if (!isAudioInitialized) {
            console.warn("Audio not initialized. Queuing narration.");
        }
        narrationQueue.push({ src: `/audio/voz/${narrationFile}`, resolve });
        if (!isNarrationPlaying && isAudioInitialized) {
            playNextNarration();
        } else if (!isAudioInitialized) {
             // Resolve immediately so game logic doesn't hang.
             // Audio will attempt to play once user interacts.
             resolve();
        }
    });
};

export const playSoundEffect = (soundFile: string): Promise<void> => {
    return new Promise((resolve) => {
        if (!soundEffectAudio || !isAudioInitialized) {
            console.warn("Audio not initialized. Cannot play sound effect.");
            resolve();
            return;
        }
        
        // Clone the main audio element to allow for overlapping sounds
        const audio = soundEffectAudio.cloneNode(true) as HTMLAudioElement;
        audio.src = `/audio/effects/${soundFile}`;
        
        const onEnd = () => {
            audio.removeEventListener('ended', onEnd);
            audio.removeEventListener('error', onError);
            resolve();
        };

        const onError = (e: Event) => {
            console.error(`Sound effect ${soundFile} failed to play.`, e);
            onEnd();
        };

        audio.addEventListener('ended', onEnd);
        audio.addEventListener('error', onError);

        audio.play().catch(e => {
            // This catch block will handle browser autoplay restrictions
            console.error(`Error playing sound effect ${soundFile}:`, e);
            onError(e as Event);
        });
    });
};
