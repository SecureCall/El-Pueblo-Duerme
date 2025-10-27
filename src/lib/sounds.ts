
"use client";

let narrationAudio: HTMLAudioElement | null = null;
let musicAudio: HTMLAudioElement | null = null;
let soundEffectAudio: HTMLAudioElement | null = null;
let audioUnlocked = false;
let currentMusicSrc: string | null = null;

const narrationQueue: string[] = [];
let isNarrationPlaying = false;

const initializeAudio = () => {
    if (typeof window === 'undefined') return;

    if (!narrationAudio) {
        narrationAudio = new Audio();
        narrationAudio.volume = 1.0;
        narrationAudio.addEventListener('ended', () => {
            isNarrationPlaying = false;
            playNextInQueue();
        });
        narrationAudio.addEventListener('play', () => {
            isNarrationPlaying = true;
            if (musicAudio && !musicAudio.paused) {
                musicAudio.volume = 0.05; // Lower music volume during narration
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

initializeAudio();

export const unlockAudio = () => {
    if (audioUnlocked || typeof window === 'undefined') return;
    
    const unlockPromise = (audio: HTMLAudioElement | null) => {
        if (audio) {
            const promise = audio.play();
            if (promise !== undefined) {
                promise.then(() => {
                    audio.pause();
                }).catch(() => {});
            }
        }
    };
    
    unlockPromise(narrationAudio);
    unlockPromise(musicAudio);
    unlockPromise(soundEffectAudio);
    audioUnlocked = true;
};

const playNextInQueue = () => {
    if (narrationQueue.length > 0) {
        const nextNarration = narrationQueue.shift();
        if (nextNarration && narrationAudio) {
            narrationAudio.src = `/audio/voz/${nextNarration}`;
            isNarrationPlaying = true;
            narrationAudio.play().catch(e => {
                console.error(`Could not play narration ${nextNarration}`, e);
                isNarrationPlaying = false;
                playNextInQueue(); // Try next one
            });
        }
    } else {
        // Queue is empty, restore music volume
        if (musicAudio && !musicAudio.paused) {
            musicAudio.volume = 0.3;
        }
    }
};

export const playNarration = (narrationFileOrFiles: string | string[]) => {
    const files = Array.isArray(narrationFileOrFiles) ? narrationFileOrFiles : [narrationFileOrFiles];
    narrationQueue.push(...files);
    
    if (!isNarrationPlaying) {
        playNextInQueue();
    }
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
        return;
    }

    currentMusicSrc = newSrc;

    if (newSrc) {
        musicAudio.src = newSrc;
        if (audioUnlocked && !isNarrationPlaying) {
            musicAudio.volume = 0.3; // Ensure volume is normal
            musicAudio.play().catch(e => console.warn(`Could not play music ${musicFile}`, e));
        }
    } else {
        musicAudio.pause();
        musicAudio.removeAttribute('src');
    }
};
