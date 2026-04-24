/** @type {import('next').NextConfig} */
// v3 - PWA + build fix
const nextConfig = {
  trailingSlash: false,
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  devIndicators: { appIsrStatus: false },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'storage.googleapis.com',
        port: '',
        pathname: '/**',
      }
    ],
  },
  async headers() {
    return [
      {
        // ads.txt — must be plain text, no cache so AdSense always reads fresh
        source: '/ads.txt',
        headers: [
          { key: 'Content-Type', value: 'text/plain; charset=utf-8' },
          { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' },
          { key: 'X-Robots-Tag', value: 'noindex' },
        ],
      },
      {
        // Service worker must not be cached by the browser or CDN
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
        ],
      },
      {
        // Web App Manifest
        source: '/manifest.json',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' },
          { key: 'Content-Type', value: 'application/manifest+json; charset=utf-8' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
        ],
      },
      {
        // Web App Origin Association — required for scope_extensions validation
        source: '/.well-known/web-app-origin-association',
        headers: [
          { key: 'Content-Type', value: 'application/json; charset=utf-8' },
          { key: 'Cache-Control', value: 'public, max-age=3600' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
        ],
      },
    ];
  },
};

export default nextConfig;
