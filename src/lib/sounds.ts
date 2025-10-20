
"use client";

let narrationAudio: HTMLAudioElement | null = null;
let soundEffectAudio: HTMLAudioElement | null = null;
let isPlayingNarration = false;
let narrationQueue: string[] = [];
let audioUnlocked = false;

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

export const unlockAudio = () => {
    if (audioUnlocked) return;
    console.log("Audio unlocked by user interaction.");
    audioUnlocked = true;
    if (!isPlayingNarration && narrationQueue.length > 0) {
        playNextInQueue();
    }
    // Also try to play the other audio instances to unlock them
    soundEffectAudio?.play().catch(()=>{});
    soundEffectAudio?.pause();
};

if (typeof window !== 'undefined') {
    narrationAudio = new Audio();
    narrationAudio.volume = 1.0;

    soundEffectAudio = new Audio();
    soundEffectAudio.volume = 0.5;
    
    narrationAudio.addEventListener('ended', () => {
        isPlayingNarration = false;
        playNextInQueue();
    });

    narrationAudio.addEventListener('error', (e) => {
        console.error("Narration audio error:", narrationAudio?.error);
        isPlayingNarration = false;
        playNextInQueue(); 
    });
}

export const playNarration = (narrationFile: string): void => {
    if (!narrationAudio) {
        console.warn("Narration audio not initialized.");
        return;
    }
    
    const fullPath = `/audio/voz/${narrationFile}`;
    
    if (!narrationQueue.includes(fullPath)) {
        narrationQueue.push(fullPath);
    }
    
    if (audioUnlocked && !isPlayingNarration) {
        playNextInQueue();
    }
};

export const playSoundEffect = (soundFile: string): void => {
    if (!audioUnlocked) {
        return;
    }
    if (!soundEffectAudio) {
        return;
    }
    
    soundEffectAudio.src = soundFile;
    soundEffectAudio.play().catch(e => {
        console.warn(`Sound effect play was prevented for ${soundFile}:`, e);
    });
};
