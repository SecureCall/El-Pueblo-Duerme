"use client";

let narrationAudio: HTMLAudioElement | null = null;
let soundEffectAudio: HTMLAudioElement | null = null;
let isPlayingNarration = false;
let narrationQueue: string[] = [];

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
                    isPlayingNarration = false;
                    playNextInQueue(); // Try next in queue even if one fails
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
        if (narrationAudio && narrationAudio.paused) {
           narrationAudio.play().catch(()=>{});
           narrationAudio.pause();
        }
        if (soundEffectAudio && soundEffectAudio.paused) {
           soundEffectAudio.play().catch(()=>{});
           soundEffectAudio.pause();
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
    
    if (!isPlayingNarration) {
        // Find the first item in the queue that is not a promise resolver and play it
        const nextSoundIndex = narrationQueue.findIndex(item => typeof item === 'string');
        if (nextSoundIndex !== -1) {
            const nextSound = narrationQueue.splice(nextSoundIndex, 1)[0];
            narrationQueue.unshift(nextSound); // Put it back at the front to be played
            
            const srcToPlay = narrationQueue.shift();
            if (srcToPlay) {
                isPlayingNarration = true;
                narrationAudio.src = srcToPlay;
                narrationAudio.play().catch(e => {
                    console.warn(`Narration play was prevented for ${srcToPlay}:`, e);
                    isPlayingNarration = false;
                    // Attempt to play the next sound if there is one
                    const nextInLine = narrationQueue.shift();
                    if(nextInLine) narrationQueue.unshift(nextInLine);
                });
            }
        }
    }
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
