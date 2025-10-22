
"use client";

let narrationAudio: HTMLAudioElement | null = null;
let musicAudio: HTMLAudioElement | null = null;
let soundEffectAudio: HTMLAudioElement | null = null;
let audioUnlocked = false;
let currentMusicSrc: string | null = null;
let isNarrationPlaying = false;

const initializeAudio = () => {
    if (typeof window === 'undefined') return;

    if (!narrationAudio) {
        narrationAudio = new Audio();
        narrationAudio.volume = 1.0;
        narrationAudio.addEventListener('ended', () => {
            isNarrationPlaying = false;
            if (musicAudio && musicAudio.src && musicAudio.paused) {
                musicAudio.play().catch(e => console.warn("Music resume failed after narration", e));
            }
        });
        narrationAudio.addEventListener('play', () => {
            isNarrationPlaying = true;
            if (musicAudio && !musicAudio.paused) {
                musicAudio.pause();
            }
        });
    }

    if (!musicAudio) {
        musicAudio = new Audio();
        musicAudio.volume = 0.3;
        musicAudio.loop = true;
    }

    if (!soundEffectAudio) {
        soundEffectAudio = new Audio();
        soundEffectAudio.volume = 0.5;
    }
};

// Initialize audio elements on script load in browser environment
initializeAudio();


// This function MUST be called from a user interaction event (e.g., 'click', 'touchstart')
export const unlockAudio = () => {
    if (audioUnlocked || typeof window === 'undefined') return;
    
    const unlockPromise = (audio: HTMLAudioElement | null) => {
        if (audio) {
            // A common trick to unlock audio is to play and immediately pause it.
            const promise = audio.play();
            if (promise !== undefined) {
                promise.then(() => {
                    audio.pause();
                }).catch(() => {
                    // Autoplay was prevented, which is fine. The context is still "unlocked".
                });
            }
        }
    };
    
    unlockPromise(narrationAudio);
    unlockPromise(musicAudio);
    unlockPromise(soundEffectAudio);
    audioUnlocked = true;
};

export const playNarration = (narrationFile: string) => {
    if (!narrationAudio) return;

    if (musicAudio && !musicAudio.paused) {
        musicAudio.pause();
    }
    
    narrationAudio.src = `/audio/voz/${narrationFile}`;
    isNarrationPlaying = true;
    narrationAudio.play().catch(e => {
        console.error(`Could not play narration ${narrationFile}`, e);
        isNarrationPlaying = false;
        // If narration fails, try to resume music
        if (musicAudio && musicAudio.src && musicAudio.paused) {
            musicAudio.play().catch(e => console.warn("Music resume failed after narration error", e));
        }
    });
};

export const playSoundEffect = (soundFile: string) => {
    if (!soundEffectAudio) return;
    
    soundEffectAudio.src = soundFile.startsWith('/') ? soundFile : `/audio/effects/${soundFile}`;
    if(audioUnlocked) {
        soundEffectAudio.play().catch(e => console.warn(`Could not play sound effect ${soundFile}`, e));
    }
};

export const setMusic = (musicFile: string | null) => {
    if (!musicAudio) return;

    const newSrc = musicFile ? new URL(musicFile, window.location.origin).href : null;

    if (currentMusicSrc === newSrc && !musicAudio.paused) {
        return; // Already playing the correct music
    }

    currentMusicSrc = newSrc;

    if (newSrc) {
        musicAudio.src = newSrc;
        if (audioUnlocked && !isNarrationPlaying) {
             musicAudio.play().catch(e => console.warn(`Could not play music ${musicFile}`, e));
        }
    } else {
        musicAudio.pause();
        musicAudio.removeAttribute('src');
    }
};
