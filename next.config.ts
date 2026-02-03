import type { NextConfig } from 'next';

/** @type {import('next').NextConfig} */
const nextConfig: NextConfig = {
    reactStrictMode: true,
    webpack: (config) => {
        // This is to suppress a benign warning from a dependency of Genkit (OpenTelemetry).
        // The 'require-in-the-middle' package uses dynamic requires that Webpack can't statically analyze.
        config.ignoreWarnings = [
            ...(config.ignoreWarnings || []),
            { module: /require-in-the-middle/ }
        ];
        return config;
    },
    async headers() {
        return [
            {
                source: '/:path*',
                headers: [
                    {
                        key: 'X-DNS-Prefetch-Control',
                        value: 'on'
                    },
                    {
                        key: 'Strict-Transport-Security',
                        value: 'max-age=63072000; includeSubDomains; preload'
                    },
                    {
                        key: 'X-XSS-Protection',
                        value: '1; mode=block'
                    },
                    {
                        key: 'X-Frame-Options',
                        value: 'DENY'
                    },
                    {
                        key: 'X-Content-Type-Options',
                        value: 'nosniff'
                    },
                    {
                        key: 'Referrer-Policy',
                        value: 'origin-when-cross-origin'
                    },
                    {
                        key: 'Content-Security-Policy',
                        value: "default-src 'self'; script-src 'self' 'unsafe-inline' https://www.google.com https://www.gstatic.com; frame-src 'self' https://www.google.com;"
                    }
                ],
            },
        ];
    },
    async redirects() {
    return [
      {
        source: '/privacidad',
        destination: '/privacy',
        permanent: true
      },
      {
        source: '/terminos',
        destination: '/terms',
        permanent: true
      },
      {
        source: '/eliminar-datos',
        destination: '/delete-data',
        permanent: true
      }
    ]
  },
};

export default nextConfig;
