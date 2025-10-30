
"use client";

let narrationAudio: HTMLAudioElement | null = null;
let musicAudio: HTMLAudioElement | null = null;
let audioUnlocked = false;
let currentMusicSrc: string | null = null;

// This function initializes the audio elements.
const initializeAudio = () => {
    if (typeof window === 'undefined') return;

    if (!narrationAudio) {
        narrationAudio = new Audio();
        narrationAudio.volume = 1.0;
        narrationAudio.onended = () => {
            if (musicAudio) musicAudio.volume = 0.3; // Restore music volume
        };
        narrationAudio.onplay = () => {
            if (musicAudio && !musicAudio.paused) {
                musicAudio.volume = 0.1; // Lower music volume during narration
            }
        };
        narrationAudio.onerror = (e) => console.error(`Failed to load or play narration: ${narrationAudio?.src}`, e);
    }

    if (!musicAudio) {
        musicAudio = new Audio();
        musicAudio.volume = 0.3;
        musicAudio.loop = true;
        musicAudio.onerror = (e) => console.error(`Failed to load music: ${musicAudio?.src}`, e);
    }
};

// Initialize on module load
initializeAudio();

// Function to unlock audio context. This must be called from a user interaction event.
export const unlockAudio = () => {
    if (audioUnlocked || typeof window === 'undefined') return;
    
    console.log("Attempting to unlock audio contexts...");

    const unlockAndPause = (audio: HTMLAudioElement | null) => {
        if (!audio || audio.played.length > 0 || !audio.paused) return;
        
        const promise = audio.play();
        if (promise !== undefined) {
            promise.then(() => {
                audio.pause();
                 if (audio.loop) {
                    audio.currentTime = 0;
                }
            }).catch(error => {
                // NotAllowedError is expected if user hasn't interacted yet.
                if (error.name !== 'NotAllowedError') {
                    console.warn(`Audio unlock for one channel failed unexpectedly.`, error);
                }
            });
        }
    };
    
    unlockAndPause(narrationAudio);
    unlockAndPause(musicAudio);
    
    audioUnlocked = true;
    
    // Once unlocked, immediately try to play the correct music if it was set before.
    if (currentMusicSrc) {
        setMusic(currentMusicSrc);
    }
};

// Function to play a narration file.
export const playNarration = (narrationFile: string) => {
    if (!narrationAudio) return;
    if (!audioUnlocked) {
        // Silently fail if audio not unlocked, as unlockAudio will be called on first interaction.
        return;
    }
    
    const audioSrc = `/audio/voz/${narrationFile}`;
    
    if (narrationAudio.src.endsWith(audioSrc) && !narrationAudio.paused) {
        return;
    }

    if (!narrationAudio.paused) {
        narrationAudio.pause();
        narrationAudio.currentTime = 0;
    }
    
    narrationAudio.src = audioSrc;
    const playPromise = narrationAudio.play();
    if (playPromise !== undefined) {
        playPromise.catch(e => {
            if (e.name !== 'AbortError') {
                console.error(`Could not play narration ${narrationFile}`, e);
            }
        });
    }
};

// Function to play a sound effect.
export const playSoundEffect = (soundFile: string) => {
    if (!audioUnlocked) return;
    
    const effectAudio = new Audio(soundFile);
    effectAudio.volume = 0.5;
    const playPromise = effectAudio.play();
    if (playPromise !== undefined) {
        playPromise.catch(e => console.warn(`Could not play sound effect ${soundFile}`, e));
    }
};

// Function to set and play the background music.
export const setMusic = (musicFile: string | null) => {
    if (!musicAudio) return;

    const newSrc = musicFile ? new URL(musicFile, window.location.origin).href : null;
    
    currentMusicSrc = newSrc;

    if (!audioUnlocked) {
        return;
    }

    if (musicAudio.src === newSrc && newSrc !== null) {
        if (musicAudio.paused) {
             musicAudio.play().catch(e => console.warn(`Could not resume music ${musicFile}`, e));
        }
        return;
    }
    
    if (newSrc) {
        musicAudio.src = newSrc;
        musicAudio.volume = narrationAudio && !narrationAudio.paused ? 0.1 : 0.3;
        const playPromise = musicAudio.play();
        if (playPromise !== undefined) {
            playPromise.catch(e => {
                 if (e.name !== 'AbortError') {
                    console.warn(`Could not play music ${musicFile}`, e);
                 }
            });
        }
    } else {
        musicAudio.pause();
        musicAudio.removeAttribute('src'); 
    }
};

    