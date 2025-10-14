"use client";

let narrationAudio: HTMLAudioElement | null = null;
let soundEffectAudio: HTMLAudioElement | null = null;

if (typeof window !== 'undefined') {
    narrationAudio = new Audio();
    narrationAudio.volume = 1.0;

    soundEffectAudio = new Audio();
    soundEffectAudio.volume = 0.8;
}

export const playNarration = (narrationFile: string): Promise<void> => {
    return new Promise((resolve) => {
        if (!narrationAudio) {
            resolve();
            return;
        }

        const narrationPlayer = new Audio(`/audio/voz/${narrationFile}`);
        narrationPlayer.volume = 1.0;

        const onEnd = () => {
            narrationPlayer.removeEventListener('ended', onEnd);
            narrationPlayer.removeEventListener('error', onError);
            resolve();
        };

        const onError = (e: Event) => {
            console.error(`Narration audio error for ${narrationFile}:`, e);
            onEnd(); 
        };
        
        narrationPlayer.addEventListener('ended', onEnd);
        narrationPlayer.addEventListener('error', onError);

        narrationPlayer.play().catch(e => {
            console.warn(`Narration play was prevented for ${narrationFile}:`, e);
            onError(e as Event);
        });
    });
};

export const playSoundEffect = (soundFile: string): Promise<void> => {
    return new Promise((resolve) => {
        if (!soundEffectAudio) {
            resolve();
            return;
        }
        
        const audio = soundEffectAudio.cloneNode(true) as HTMLAudioElement;
        audio.src = `/audio/effects/${soundFile}`;
        
        const onEnd = () => {
            audio.removeEventListener('ended', onEnd);
            audio.removeEventListener('error', onError);
            resolve();
        };

        const onError = (e: Event) => {
            console.error(`Sound effect ${soundFile} failed to play.`, e);
            onEnd();
        };

        audio.addEventListener('ended', onEnd);
        audio.addEventListener('error', onError);

        audio.play().catch(e => {
            console.warn(`Sound effect play was prevented for ${soundFile}:`, e);
            onError(e as Event);
        });
    });
};
