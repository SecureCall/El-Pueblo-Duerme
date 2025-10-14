"use client";

let narrationAudio: HTMLAudioElement | null = null;
let soundEffectAudio: HTMLAudioElement | null = null;
let narrationQueue: string[] = [];
let isPlayingNarration = false;

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
        console.error("Narration audio error:", e);
        isPlayingNarration = false;
        playNextInQueue(); // Try to play next even if current one fails
    });
}

function playNextInQueue() {
    if (isPlayingNarration || narrationQueue.length === 0 || !narrationAudio) {
        return;
    }
    
    isPlayingNarration = true;
    const nextNarration = narrationQueue.shift();
    
    if (nextNarration) {
        narrationAudio.src = `/audio/voz/${nextNarration}`;
        narrationAudio.play().catch(e => {
            console.warn(`Narration play was prevented for ${nextNarration}:`, e);
            // If play fails, we still consider it "finished" to unblock the queue
            isPlayingNarration = false;
            playNextInQueue();
        });
    } else {
        isPlayingNarration = false;
    }
}

export const playNarration = (narrationFile: string): void => {
    if (!narrationAudio) return;
    narrationQueue.push(narrationFile);
    playNextInQueue();
};


export const playSoundEffect = (soundFile: string): void => {
    if (!soundEffectAudio) {
        return;
    }
    
    // Clone the node to play multiple effects simultaneously if needed without interrupting each other.
    const audio = soundEffectAudio.cloneNode(true) as HTMLAudioElement;
    audio.src = `/audio/effects/${soundFile}`;
    
    audio.play().catch(e => {
        console.warn(`Sound effect play was prevented for ${soundFile}:`, e);
    });
};
