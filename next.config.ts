
import type { NextConfig } from 'next';

/** @type {import('next').NextConfig} */
const nextConfig: NextConfig = {
  // Optimization for Firebase Hosting (Web Frameworks) to reduce cold starts and size
  output: 'standalone',
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
        hostname: 'firebasestorage.googleapis.com',
      },
      {
        protocol: 'https',
        hostname: 'storage.googleapis.com',
      }
    ],
  },
  // swcMinify is true by default in Next.js 14, but keeping it is harmless
  swcMinify: true,
  // Fixes potential ESM/CJS interop issues with these packages
  transpilePackages: ['lucide-react', 'recharts'],
  // Optimizes imports for large icon/utility libraries
  experimental: {
    optimizePackageImports: ['lucide-react', 'date-fns', 'recharts', '@radix-ui/react-icons'],
  },
};

export default nextConfig;
