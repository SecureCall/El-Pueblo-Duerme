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
};

export default nextConfig;
