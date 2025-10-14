
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

    // This function will be called on the first user interaction
    const unlockAudio = () => {
        if (audioUnlocked || typeof window === 'undefined') return;
        audioUnlocked = true;
        
        // Mute and play a dummy sound on both audio contexts to unlock them.
        // This is a common and reliable trick.
        if (narrationAudio) {
            narrationAudio.muted = true;
            narrationAudio.play().then(() => {
                narrationAudio!.pause();
                narrationAudio!.currentTime = 0;
                narrationAudio!.muted = false;
                // Now that we're unlocked, try playing the queue
                if (!isPlayingNarration && narrationQueue.length > 0) {
                    playNextInQueue();
                }
            }).catch(() => {});
        }

        if (soundEffectAudio) {
             soundEffectAudio.muted = true;
             soundEffectAudio.play().then(() => {
                soundEffectAudio!.pause();
                soundEffectAudio!.currentTime = 0;
                soundEffectAudio!.muted = false;
             }).catch(() => {});
        }
        
        // Remove the listeners after the first interaction
        window.removeEventListener('click', unlockAudio);
        window.removeEventListener('keydown', unlockAudio);
        window.removeEventListener('touchstart', unlockAudio);
    };

     // Set up listeners for the first user interaction
    if (typeof window !== 'undefined') {
        window.addEventListener('click', unlockAudio, { once: true });
        window.addEventListener('keydown', unlockAudio, { once: true });
        window.addEventListener('touchstart', unlockAudio, { once: true });
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
    if (!soundEffectAudio) {
        return;
    }
    if (!audioUnlocked) {
        // We don't queue sound effects, they are time-sensitive.
        // If audio is locked, we just skip it.
        return;
    }
    
    // Use a separate audio object for effects to allow overlap with narration
    const effectAudio = new Audio(`/audio/effects/${soundFile}`);
    effectAudio.volume = 0.8;
    
    effectAudio.play().catch(e => {
        // This can still fail in some edge cases, so we just log a warning.
        console.warn(`Sound effect play was prevented for ${soundFile}:`, e);
    });
};
