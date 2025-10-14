
"use client";

let narrationAudio: HTMLAudioElement | null = null;
let soundEffectAudio: HTMLAudioElement | null = null;
let isPlayingNarration = false;
let narrationQueue: string[] = [];
let audioUnlocked = false;

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
                    // If it failed because it's not unlocked, put it back in the queue
                    if (e.name === 'NotAllowedError') {
                        narrationQueue.unshift(nextSrc);
                    }
                    isPlayingNarration = false;
                    // Don't automatically play next if this one failed due to interaction
                    // It will be retried on the next interaction.
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

    // Export a function to be called by the UI to kickstart the audio
    const unlockAudio = () => {
        if (audioUnlocked) return;
        audioUnlocked = true;

        if (narrationAudio && narrationAudio.paused) {
           narrationAudio.play().catch(()=>{});
           narrationAudio.pause();
        }
        if (soundEffectAudio && soundEffectAudio.paused) {
           soundEffectAudio.play().catch(()=>{});
           soundEffectAudio.pause();
        }
        // After unlocking, if there's something in the queue and we're not playing, start it.
        if (!isPlayingNarration && narrationQueue.length > 0) {
            playNextInQueue();
        }
    };
     if (typeof document !== 'undefined') {
        document.addEventListener('click', unlockAudio, { once: true });
        document.addEventListener('keydown', unlockAudio, { once: true });
    }
}

export const playNarration = (narrationFile: string): void => {
    if (!narrationAudio) {
        console.warn("Narration audio not initialized.");
        return;
    }
    
    narrationQueue.push(`/audio/voz/${narrationFile}`);
    
    if (!isPlayingNarration && audioUnlocked) {
        playNextInQueue();
    }
};


export const playSoundEffect = (soundFile: string): void => {
    if (!soundEffectAudio || !audioUnlocked) {
        return;
    }
    
    // Use a separate audio object for effects to allow overlap with narration
    const effectAudio = new Audio(`/audio/effects/${soundFile}`);
    effectAudio.volume = 0.8;
    
    effectAudio.play().catch(e => {
        console.warn(`Sound effect play was prevented for ${soundFile}:`, e);
    });
};

