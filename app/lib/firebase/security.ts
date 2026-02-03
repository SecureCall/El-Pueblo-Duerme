import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import { getApp } from 'firebase/app';

export function initSecurity() {
  if (typeof window === 'undefined') return;
  
  const app = getApp();
  const siteKey = '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI'; // TEST KEY
  
  try {
    initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(siteKey),
      isTokenAutoRefreshEnabled: true,
    });
    console.log('✅ Seguridad Firebase activada');
  } catch (error) {
    console.error('❌ Error seguridad:', error);
  }
}
