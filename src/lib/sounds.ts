"use client";

let narrationAudio: HTMLAudioElement | null = null;
let soundEffectAudio: HTMLAudioElement | null = null;
let isPlayingNarration = false;
let narrationQueue: string[] = [];

if (typeof window !== 'undefined') {
    narrationAudio = new Audio();
    narrationAudio.volume = 1.0;

    soundEffectAudio = new Audio();
    soundEffectAudio.volume = 0.8;

    narrationAudio.onended = () => {
        isPlayingNarration = false;
        playNextInQueue();
    };
    narrationAudio.onerror = (e) => {
        console.error("Narration audio error:", e);
        isPlayingNarration = false;
        playNextInQueue(); // Try next
    };
}

function playNextInQueue() {
    if (isPlayingNarration || narrationQueue.length === 0 || !narrationAudio) {
        return;
    }
    isPlayingNarration = true;
    const nextSrc = narrationQueue.shift();
    if (nextSrc) {
        narrationAudio.src = nextSrc;
        narrationAudio.play().catch(e => {
            console.warn(`Narration play was prevented for ${nextSrc}:`, e);
            isPlayingNarration = false; // Unblock queue on error
            playNextInQueue();
        });
    } else {
        isPlayingNarration = false;
    }
}

export const playNarration = (narrationFile: string): void => {
    if (!narrationAudio) return;

    narrationQueue.push(`/audio/voz/${narrationFile}`);
    playNextInQueue();
};

export const playSoundEffect = (soundFile: string): void => {
    if (!soundEffectAudio) {
        return;
    }
    
    // Use a separate audio object for effects to allow overlap with narration
    const effectAudio = new Audio(`/audio/effects/${soundFile}`);
    effectAudio.volume = 0.8;
    
    effectAudio.play().catch(e => {
        console.warn(`Sound effect play was prevented for ${soundFile}:`, e);
    });
};