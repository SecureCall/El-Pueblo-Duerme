import { audioRuntime } from './audio-runtime';
import { audioMixer } from './audio-mixer';

let installed = false;
let wasHidden = false;

export function installAudioLifecycle(): () => void {
  if (installed || typeof window === 'undefined') return () => undefined;
  installed = true;

  const unlock = () => { void audioRuntime.unlock(); };
  const onVisibility = () => {
    if (document.visibilityState === 'hidden') {
      wasHidden = true;
      return;
    }
    if (wasHidden) {
      wasHidden = false;
      audioMixer.reset();
      void audioRuntime.unlock();
    }
  };
  const onPageShow = () => { void audioRuntime.unlock(); };

  window.addEventListener('pointerdown', unlock, { passive: true });
  window.addEventListener('touchstart', unlock, { passive: true });
  window.addEventListener('keydown', unlock, { passive: true });
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pageshow', onPageShow);

  return () => {
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('touchstart', unlock);
    window.removeEventListener('keydown', unlock);
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('pageshow', onPageShow);
    installed = false;
  };
}
