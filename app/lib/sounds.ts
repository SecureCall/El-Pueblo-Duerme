
"use client";

let narrationAudio: HTMLAudioElement | null = null;
let musicAudio: HTMLAudioElement | null = null;
let audioUnlocked = false;
let currentMusicSrc: string | null = null;

const initializeAudio = () => {
    if (typeof window === 'undefined') return;

    if (!narrationAudio) {
        narrationAudio = new Audio();
        narrationAudio.volume = 1.0;
        narrationAudio.onended = () => {
            if (musicAudio) musicAudio.volume = 0.3; 
        };
        narrationAudio.onplay = () => {
            if (musicAudio && !musicAudio.paused) {
                musicAudio.volume = 0.1; 
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

initializeAudio();

export const unlockAudio = () => {
    if (audioUnlocked || typeof window === 'undefined') return;
    
    const unlock = (audio: HTMLAudioElement | null) => {
        if (!audio) return;
        const promise = audio.play();
        if (promise !== undefined) {
            promise.then(() => {
                audio.pause();
                if (audio.loop) audio.currentTime = 0;
            }).catch(error => {
                if (error.name !== 'NotAllowedError' && error.name !== 'AbortError') {
                    console.warn(`Audio unlock failed:`, error);
                }
            });
        }
    };
    
    unlock(narrationAudio);
    unlock(musicAudio);
    
    audioUnlocked = true;
    
    if (currentMusicSrc) {
        setMusic(currentMusicSrc);
    }
};

export const playNarration = (narrationFile: string) => {
    if (!narrationAudio || !audioUnlocked) return;
    
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

export const playSoundEffect = (soundFile: string) => {
    if (!audioUnlocked) return;
    
    const effectAudio = new Audio(soundFile);
    effectAudio.volume = 0.5;
    const playPromise = effectAudio.play();
    if (playPromise !== undefined) {
        playPromise.catch(e => console.warn(`Could not play sound effect ${soundFile}`, e));
    }
};

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
