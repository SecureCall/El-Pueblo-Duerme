
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
        narrationAudio.onended = () => {
            isNarrationPlaying = false;
            playNextInQueue();
        };
        narrationAudio.onplay = () => {
            isNarrationPlaying = true;
            if (musicAudio && !musicAudio.paused) {
                musicAudio.volume = 0.1; // Lower music volume during narration
            }
        };
         narrationAudio.onerror = () => {
            console.error(`Failed to load narration: ${narrationAudio?.src}`);
            isNarrationPlaying = false;
            playNextInQueue(); // Skip to the next one
        };
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
    
    const unlockAndPause = (audio: HTMLAudioElement | null) => {
        if (!audio) return;
        const promise = audio.play();
        if (promise !== undefined) {
            promise.then(() => {
                audio.pause();
                // For looping audio, reset to the beginning after the silent play
                if(audio.loop) {
                    audio.currentTime = 0;
                }
            }).catch(error => {
                // Autoplay was prevented.
                console.warn("Audio unlock failed for one of the channels. User interaction might be needed.", error);
            });
        }
    };
    
    unlockAndPause(narrationAudio);
    unlockAndPause(musicAudio);
    unlockAndPause(soundEffectAudio);
    audioUnlocked = true;
};

const playNextInQueue = () => {
    if (narrationQueue.length > 0) {
        const nextNarration = narrationQueue.shift();
        if (nextNarration && narrationAudio) {
            const audioSrc = `/audio/voz/${nextNarration}`;
            if(narrationAudio.src !== new URL(audioSrc, window.location.origin).href) {
                narrationAudio.src = audioSrc;
            }
            narrationAudio.play().catch(e => {
                console.error(`Could not play narration ${nextNarration}`, e);
                isNarrationPlaying = false;
                playNextInQueue(); // Try next one
            });
        }
    } else {
        isNarrationPlaying = false;
        // Queue is empty, restore music volume
        if (musicAudio && !musicAudio.paused) {
            musicAudio.volume = 0.3;
        }
    }
};

export const playNarration = (narrationFileOrFiles: string | string[]) => {
    if (!audioUnlocked) unlockAudio();
    const files = Array.isArray(narrationFileOrFiles) ? narrationFileOrFiles : [narrationFileOrFiles];
    narrationQueue.push(...files);
    
    if (!isNarrationPlaying) {
        playNextInQueue();
    }
};

export const playSoundEffect = (soundFile: string) => {
    if (!soundEffectAudio) return;
    if (!audioUnlocked) unlockAudio();
    
    soundEffectAudio.src = soundFile;
    soundEffectAudio.play().catch(e => console.warn(`Could not play sound effect ${soundFile}`, e));
};

export const setMusic = (musicFile: string | null) => {
    if (!musicAudio) return;
     if (!audioUnlocked) unlockAudio();

    const newSrc = musicFile ? new URL(musicFile, window.location.origin).href : null;

    if (currentMusicSrc === newSrc && !musicAudio.paused) {
        return;
    }

    currentMusicSrc = newSrc;

    if (newSrc) {
        musicAudio.src = newSrc;
        if (audioUnlocked) {
            if (!isNarrationPlaying) {
                 musicAudio.volume = 0.3;
            } else {
                 musicAudio.volume = 0.1;
            }
            musicAudio.play().catch(e => console.warn(`Could not play music ${musicFile}`, e));
        }
    } else {
        musicAudio.pause();
        musicAudio.removeAttribute('src');
    }
};
