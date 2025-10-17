
import type {NextConfig} from 'next';

/** @type {import('next').NextConfig} */
const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
      },
      {
        protocol: 'https',
        hostname: 'storage.googleapis.com',
      }
    ],
  },
  // Add the following to fix the cross-origin issue in development
  experimental: {
    allowedDevOrigins: [
        "https://*.cloudworkstations.dev",
    ]
  }
};

export default nextConfig;
