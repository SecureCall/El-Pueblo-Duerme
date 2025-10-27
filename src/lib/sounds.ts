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
         narrationAudio.onerror = (e) => {
            console.error(`Failed to load or play narration: ${narrationAudio?.src}`, e);
            isNarrationPlaying = false;
            playNextInQueue(); // Skip to the next one
        };
    }

    if (!musicAudio) {
        musicAudio = new Audio();
        musicAudio.volume = 0.3;
        musicAudio.loop = true;
         musicAudio.onerror = (e) => console.error(`Failed to load music: ${musicAudio?.src}`, e);
    }

    if (!soundEffectAudio) {
        soundEffectAudio = new Audio();
        soundEffectAudio.volume = 0.5;
        soundEffectAudio.onerror = (e) => console.error(`Failed to load sound effect: ${soundEffectAudio?.src}`, e);
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
                if(audio.loop) {
                    audio.currentTime = 0;
                }
            }).catch(error => {
                console.warn("Audio unlock failed for one channel. User interaction is needed.", error);
            });
        }
    };
    
    unlockAndPause(narrationAudio);
    unlockAndPause(musicAudio);
    unlockAndPause(soundEffectAudio);
    audioUnlocked = true;
};

const playNextInQueue = () => {
    if (isNarrationPlaying) return;
    if (narrationQueue.length > 0) {
        isNarrationPlaying = true;
        const nextNarration = narrationQueue.shift();
        if (nextNarration && narrationAudio) {
            const audioSrc = `/audio/voz/${nextNarration}`;
            if(narrationAudio.src !== new URL(audioSrc, window.location.origin).href) {
                narrationAudio.src = audioSrc;
                narrationAudio.load();
            }
            narrationAudio.play().catch(e => {
                console.error(`Could not play narration ${nextNarration}`, e);
                isNarrationPlaying = false;
                playNextInQueue(); // Try next one
            });
        }
    } else {
        isNarrationPlaying = false;
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
    if (!soundEffectAudio || !audioUnlocked) return;
    
    soundEffectAudio.src = soundFile;
    soundEffectAudio.play().catch(e => console.warn(`Could not play sound effect ${soundFile}`, e));
};

export const setMusic = (musicFile: string | null) => {
    if (!musicAudio) return;
    if (!audioUnlocked) unlockAudio();

    const newSrc = musicFile ? new URL(musicFile, window.location.origin).href : null;

    if (currentMusicSrc === newSrc && newSrc !== null && !musicAudio.paused) {
        return; 
    }
    
    currentMusicSrc = newSrc;

    if (newSrc) {
        if(musicAudio.src !== newSrc) {
            musicAudio.src = newSrc;
            musicAudio.load();
        }
        if (audioUnlocked) {
            musicAudio.volume = isNarrationPlaying ? 0.1 : 0.3;
            musicAudio.play().catch(e => console.warn(`Could not play music ${musicFile}`, e));
        }
    } else {
        musicAudio.pause();
        musicAudio.removeAttribute('src');
    }
};
