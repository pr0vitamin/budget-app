import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Allow webpack plugins from next-pwa while using Turbopack
  turbopack: {},
};

// Only use next-pwa in production to avoid Turbopack conflicts
const withPWA = process.env.NODE_ENV === 'production'
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('next-pwa')({
    dest: 'public',
    register: true,
    skipWaiting: true,
    runtimeCaching: [
      {
        urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
        handler: 'NetworkFirst',
        options: {
          cacheName: 'supabase-api',
          expiration: {
            maxEntries: 50,
            maxAgeSeconds: 60 * 60 * 24, // 24 hours
          },
        },
      },
      {
        urlPattern: /\/api\/.*/i,
        handler: 'NetworkFirst',
        options: {
          cacheName: 'api-cache',
          expiration: {
            maxEntries: 100,
            maxAgeSeconds: 60 * 60, // 1 hour
          },
          networkTimeoutSeconds: 10,
        },
      },
    ],
  })
  : (config: NextConfig) => config;

export default withPWA(nextConfig);
