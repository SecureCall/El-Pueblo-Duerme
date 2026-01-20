
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
  experimental: {
    allowedDevOrigins: [
        "https://*.cloudworkstations.dev",
    ],
    // This tells Turbopack where the root of your project is, fixing the workspace error.
    turbopack: {
        rootDir: process.cwd(),
    },
  }
};

export default nextConfig;
