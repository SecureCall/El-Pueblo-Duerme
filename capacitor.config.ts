import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.securecall.elpuebloduerme',
  appName: 'El Pueblo Duerme',
  webDir: 'out',
  server: {
    url: process.env.CAP_SERVER_URL || 'https://elpuebloduerme.vercel.app',
    cleartext: false,
    allowNavigation: ['elpuebloduerme.vercel.app'],
  },
  ios: {
    contentInset: 'automatic',
    preferredContentMode: 'mobile',
  },
  android: {
    backgroundColor: '#080808',
  },
};

export default config;
