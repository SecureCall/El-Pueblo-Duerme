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
                        key: 'X-Content-Type-Options',
                        value: 'nosniff',
                    },
                    {
                        key: 'X-Frame-Options',
                        value: 'DENY',
                    },
                    {
                        key: 'X-XSS-Protection',
                        value: '1; mode=block',
                    },
                     {
                        key: 'Content-Security-Policy',
                        value: "default-src 'self'; script-src 'self' 'unsafe-inline' https://www.google.com https://www.gstatic.com; style-src 'self' 'unsafe-inline';"
                    }
                ],
            },
        ];
    },
};

export default nextConfig;
