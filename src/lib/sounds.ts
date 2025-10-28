
"use client";

let narrationAudio: HTMLAudioElement | null = null;
let musicAudio: HTMLAudioElement | null = null;
let soundEffectAudio: HTMLAudioElement | null = null;
let audioUnlocked = false;
let currentMusicSrc: string | null = null;

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
         narrationAudio.onerror = (e) => {
            console.error(`Failed to load or play narration: ${narrationAudio?.src}`, e);
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

// Initialize audio elements as soon as this module is loaded on the client
initializeAudio();

export const unlockAudio = () => {
    if (audioUnlocked || typeof window === 'undefined') return;
    
    const unlockAndPause = (audio: HTMLAudioElement | null) => {
        if (!audio) return;
        const promise = audio.play();
        if (promise !== undefined) {
            promise.then(() => {
                audio.pause();
                // If it's loopable, reset it to the beginning
                if(audio.loop) {
                    audio.currentTime = 0;
                }
            }).catch(error => {
                // This error is expected if the user hasn't interacted yet.
                // We are simply trying to unlock it.
                if (error.name !== 'NotAllowedError') {
                    console.warn("Audio unlock failed for one channel.", error);
                }
            });
        }
    };
    
    console.log("Attempting to unlock audio contexts...");
    unlockAndPause(narrationAudio);
    unlockAndPause(musicAudio);
    unlockAndPause(soundEffectAudio);
    audioUnlocked = true;
    
    // Once unlocked, immediately try to play the correct music if it was set before.
    if (currentMusicSrc) {
        setMusic(currentMusicSrc);
    }
};


export const playNarration = (narrationFile: string) => {
    if (!narrationAudio || !audioUnlocked) {
        if(!audioUnlocked) console.warn("Audio not unlocked. User interaction required to play sounds.");
        return;
    }
    
    const audioSrc = `/audio/voz/${narrationFile}`;
    
    // If the same narration is requested, don't restart it unless it's finished.
    if (narrationAudio.src.endsWith(audioSrc) && !narrationAudio.paused) {
        return;
    }

    if (!narrationAudio.paused) {
        narrationAudio.pause();
        narrationAudio.currentTime = 0;
    }
    
    narrationAudio.src = audioSrc;
    narrationAudio.load();
    const playPromise = narrationAudio.play();
    if(playPromise !== undefined){
        playPromise.catch(e => {
            if (e.name !== 'AbortError') {
                console.error(`Could not play narration ${narrationFile}`, e);
            }
        });
    }
};

export const playSoundEffect = (soundFile: string) => {
     if (!audioUnlocked) return;
    
    // Create a new instance for each effect to allow overlaps
    const effectAudio = new Audio(soundFile);
    effectAudio.volume = 0.5;
    const playPromise = effectAudio.play();
    if(playPromise !== undefined){
        playPromise.catch(e => console.warn(`Could not play sound effect ${soundFile}`, e));
    }
};

export const setMusic = (musicFile: string | null) => {
    if (!musicAudio) return;

    const newSrc = musicFile ? new URL(musicFile, window.location.origin).href : null;

    // Avoid unnecessary reloads if the source is the same and it's already playing
    if (currentMusicSrc === newSrc && newSrc !== null && !musicAudio.paused) {
        return; 
    }
    
    currentMusicSrc = newSrc;

    if (!audioUnlocked) {
        // If audio is not unlocked, we just store the desired music file.
        // It will be played once unlockAudio is called.
        return;
    }

    if (newSrc) {
        if(musicAudio.src !== newSrc) {
            musicAudio.src = newSrc;
            musicAudio.load();
        }
        musicAudio.volume = narrationAudio && !narrationAudio.paused ? 0.1 : 0.3;
        const playPromise = musicAudio.play();
        if(playPromise !== undefined){
            playPromise.catch(e => {
                 if (e.name !== 'AbortError') {
                    console.warn(`Could not play music ${musicFile}`, e)
                 }
            });
        }
    } else {
        musicAudio.pause();
        currentMusicSrc = null;
        musicAudio.removeAttribute('src'); // Clean up src
    }
};
