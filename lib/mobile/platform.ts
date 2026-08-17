import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Network } from '@capacitor/network';

export type RuntimePlatform = 'web' | 'android' | 'ios';

export const getRuntimePlatform = (): RuntimePlatform => {
  const platform = Capacitor.getPlatform();
  return platform === 'android' || platform === 'ios' ? platform : 'web';
};

export const isNativeApp = (): boolean => Capacitor.isNativePlatform();

export async function impact(style: ImpactStyle = ImpactStyle.Medium) {
  if (!isNativeApp()) return;
  try { await Haptics.impact({ style }); } catch {}
}

export async function watchConnectivity(onChange: (online: boolean) => void) {
  if (!isNativeApp()) {
    const handler = () => onChange(navigator.onLine);
    window.addEventListener('online', handler);
    window.addEventListener('offline', handler);
    handler();
    return () => { window.removeEventListener('online', handler); window.removeEventListener('offline', handler); };
  }
  const listener = await Network.addListener('networkStatusChange', status => onChange(status.connected));
  const status = await Network.getStatus();
  onChange(status.connected);
  return () => listener.remove();
}
