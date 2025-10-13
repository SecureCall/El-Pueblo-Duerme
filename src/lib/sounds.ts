
// src/lib/sounds.ts
"use client";

let narrationAudio: HTMLAudioElement | null = null;
let soundEffectAudio: HTMLAudioElement | null = null;

if (typeof window !== 'undefined') {
    narrationAudio = new Audio();
    narrationAudio.volume = 1.0;

    soundEffectAudio = new Audio();
    soundEffectAudio.volume = 0.8;
}

const playOnInteraction = async () => {
    try {
        if(narrationAudio && narrationAudio.paused) await narrationAudio.play().catch(()=>{});
        if(soundEffectAudio && soundEffectAudio.paused) await soundEffectAudio.play().catch(()=>{});
    } catch(err) {
        console.warn("Audio play on interaction failed.", err);
    } finally {
        window.removeEventListener('click', playOnInteraction);
        window.removeEventListener('keydown', playOnInteraction);
    }
}

if (typeof window !== 'undefined') {
    window.addEventListener('click', playOnInteraction);
    window.addEventListener('keydown', playOnInteraction);
}

const playAudio = (audioElement: HTMLAudioElement | null, src: string): Promise<void> => {
    return new Promise((resolve) => {
        if (!audioElement || !src) {
            resolve();
            return;
        }

        if (!audioElement.paused) {
            audioElement.pause();
            audioElement.currentTime = 0;
        }

        audioElement.src = src;
        audioElement.onended = () => resolve();
        audioElement.onerror = (e) => {
            console.error("Error playing audio:", e);
            resolve();
        };
        
        const playPromise = audioElement.play();

        if (playPromise !== undefined) {
            playPromise.catch(error => {
                console.warn(`Audio autoplay was prevented: ${error}`);
                // Resolve anyway so game doesn't get stuck.
                // The interaction listener will hopefully pick it up.
                resolve();
            });
        } else {
            resolve();
        }
    });
};

export const playNarration = (narrationFile: string): Promise<void> => {
    return playAudio(narrationAudio, `/audio/voz/${narrationFile}`);
};

export const playSoundEffect = (soundFile: string): Promise<void> => {
    if (typeof window === 'undefined') return Promise.resolve();
    
    return new Promise(resolve => {
        const audio = new Audio(`/audio/effects/${soundFile}`);
        audio.volume = 0.8;
        audio.play().catch(e => console.warn("Sound effect failed to play", e));
        // We resolve immediately, not waiting for the sound to end.
        resolve();
    });
};
