
"use client";

let narrationAudio: HTMLAudioElement | null = null;
let soundEffectAudio: HTMLAudioElement | null = null;
let isPlayingNarration = false;
let narrationQueue: string[] = [];
let audioUnlocked = false;

// Function to be called by an external component (like GameMusic) once interaction has happened.
export const unlockAudio = () => {
    if (audioUnlocked) return;
    audioUnlocked = true;
    // Try to play the first item in the queue now that we are unlocked
    if (!isPlayingNarration && narrationQueue.length > 0) {
        playNextInQueue();
    }
};

// Initialize audio instances only on the client side
if (typeof window !== 'undefined') {
    narrationAudio = new Audio();
    narrationAudio.volume = 1.0;

    soundEffectAudio = new Audio();
    soundEffectAudio.volume = 0.8;

    const playNextInQueue = () => {
        if (narrationQueue.length > 0) {
            const nextSrc = narrationQueue.shift();
            if (nextSrc && narrationAudio) {
                isPlayingNarration = true;
                narrationAudio.src = nextSrc;
                narrationAudio.play().catch(e => {
                    console.warn(`Narration play was prevented for ${nextSrc}:`, e);
                    // If it failed even after unlock attempt, stop trying for this chain
                    isPlayingNarration = false;
                });
            } else {
                 isPlayingNarration = false;
            }
        } else {
            isPlayingNarration = false;
        }
    };
    
    if(narrationAudio) {
        narrationAudio.addEventListener('ended', () => {
            isPlayingNarration = false;
            playNextInQueue();
        });

        narrationAudio.addEventListener('error', (e) => {
            console.error("Narration audio error:", narrationAudio?.error);
            isPlayingNarration = false;
            playNextInQueue(); // Skip to the next sound on error
        });
    }
}

export const playNarration = (narrationFile: string): void => {
    if (!narrationAudio) {
        console.warn("Narration audio not initialized.");
        return;
    }
    
    narrationQueue.push(`/audio/voz/${narrationFile}`);
    
    // Only try to play immediately if audio is unlocked and nothing is currently playing.
    if (audioUnlocked && !isPlayingNarration) {
        playNextInQueue();
    }
};

export const playSoundEffect = (soundFile: string): void => {
    if (!soundEffectAudio) {
        return;
    }
    if (!audioUnlocked) {
        return;
    }
    
    const effectAudio = new Audio(`/audio/effects/${soundFile}`);
    effectAudio.volume = 0.8;
    
    effectAudio.play().catch(e => {
        console.warn(`Sound effect play was prevented for ${soundFile}:`, e);
    });
};
