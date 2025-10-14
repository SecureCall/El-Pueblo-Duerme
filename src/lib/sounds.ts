"use client";

let narrationAudio: HTMLAudioElement | null = null;
let soundEffectAudio: HTMLAudioElement | null = null;
let isAudioInitialized = false;

// Function to initialize and unlock audio context on user interaction.
const initializeAndUnlockAudio = () => {
    if (typeof window === 'undefined' || isAudioInitialized) return;

    try {
        // Initialize narration audio element
        if (!narrationAudio) {
            narrationAudio = new Audio();
            narrationAudio.volume = 1.0;
        }
        
        // Initialize sound effect audio element
        if (!soundEffectAudio) {
            soundEffectAudio = new Audio();
            soundEffectAudio.volume = 0.8;
        }

        // A tiny silent audio file to unlock the audio context.
        const silentAudio = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";
        narrationAudio.src = silentAudio;
        soundEffectAudio.src = silentAudio;

        // Attempt to play and immediately pause to unlock.
        narrationAudio.play().then(() => narrationAudio?.pause()).catch(() => {});
        soundEffectAudio.play().then(() => soundEffectAudio?.pause()).catch(() => {});
        
        isAudioInitialized = true;
        console.log("Audio context unlocked.");

        // Clean up the event listeners after successful initialization.
        document.removeEventListener('click', initializeAndUnlockAudio, true);
        document.removeEventListener('keydown', initializeAndUnlockAudio, true);
        document.removeEventListener('touchstart', initializeAndUnlockAudio, true);

    } catch (error) {
        console.error("Error initializing audio:", error);
    }
};

// Add event listeners to run the unlock function on the first user interaction.
if (typeof window !== 'undefined') {
    document.addEventListener('click', initializeAndUnlockAudio, { once: true, capture: true });
    document.addEventListener('keydown', initializeAndUnlockAudio, { once: true, capture: true });
    document.addEventListener('touchstart', initializeAndUnlockAudio, { once: true, capture: true });
}


export const playNarration = (narrationFile: string): Promise<void> => {
    return new Promise((resolve) => {
        if (!narrationAudio || !isAudioInitialized) {
            // If audio isn't ready, resolve immediately to not block game logic.
            // It will fail silently. The user needs to interact first.
            resolve();
            return;
        }

        // To allow chaining, we create a new audio element for each narration.
        const narrationPlayer = new Audio(`/audio/voz/${narrationFile}`);
        narrationPlayer.volume = 1.0;

        const onEnd = () => {
            narrationPlayer.removeEventListener('ended', onEnd);
            narrationPlayer.removeEventListener('error', onError);
            resolve();
        };

        const onError = (e: Event) => {
            console.error(`Narration audio error for ${narrationFile}:`, e);
            onEnd(); // Resolve promise even on error
        };
        
        narrationPlayer.addEventListener('ended', onEnd);
        narrationPlayer.addEventListener('error', onError);

        narrationPlayer.play().catch(e => {
            // This might still happen if called before interaction, despite our best efforts.
            console.warn(`Narration play was prevented for ${narrationFile}:`, e);
            onError(e as Event);
        });
    });
};

export const playSoundEffect = (soundFile: string): Promise<void> => {
    return new Promise((resolve) => {
        if (!soundEffectAudio || !isAudioInitialized) {
            resolve();
            return;
        }
        
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
            console.warn(`Sound effect play was prevented for ${soundFile}:`, e);
            onError(e as Event);
        });
    });
};
