
"use client";

let narrationAudio: HTMLAudioElement | null = null;
let soundEffectAudio: HTMLAudioElement | null = null;
let isPlayingNarration = false;
let narrationQueue: string[] = [];
let audioUnlocked = false;

// This function needs to be accessible globally within the module.
const playNextInQueue = () => {
    if (narrationQueue.length > 0) {
        const nextSrc = narrationQueue.shift();
        if (nextSrc && narrationAudio) {
            isPlayingNarration = true;
            narrationAudio.src = nextSrc;
            narrationAudio.play().catch(e => {
                console.warn(`Narration play was prevented for ${nextSrc}:`, e);
                isPlayingNarration = false;
                playNextInQueue(); // Try next sound
            });
        } else {
             isPlayingNarration = false;
        }
    } else {
        isPlayingNarration = false;
    }
};

// Function to be called by an external component (like GameMusic) once interaction has happened.
export const unlockAudio = () => {
    if (audioUnlocked) return;
    console.log("Audio unlocked by user interaction.");
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

export const playNarration = (narrationFile: string): void => {
    if (!narrationAudio) {
        console.warn("Narration audio not initialized.");
        return;
    }
    
    const fullPath = `/audio/voz/${narrationFile}`;
    
    // Avoid adding duplicates to the queue if it's already there
    if (!narrationQueue.includes(fullPath)) {
        narrationQueue.push(fullPath);
    }
    
    // Only try to play immediately if audio is unlocked and nothing is currently playing.
    if (audioUnlocked && !isPlayingNarration) {
        playNextInQueue();
    }
};

export const playSoundEffect = (soundFile: string): void => {
    if (!audioUnlocked) {
        return;
    }
    if (!soundEffectAudio) {
        soundEffectAudio = new Audio();
        soundEffectAudio.volume = 0.8;
    }
    
    soundEffectAudio.src = `/audio/effects/${soundFile}`;
    soundEffectAudio.play().catch(e => {
        console.warn(`Sound effect play was prevented for ${soundFile}:`, e);
    });
};
