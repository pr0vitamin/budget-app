import type { NextConfig } from 'next';

// PWA is manifest-only (installable + offline reads via TanStack Query/IndexedDB).
// next-pwa was removed: it's a webpack plugin and never ran under Next 16's
// Turbopack build, so it emitted no service worker. A Turbopack-compatible SW
// (e.g. @serwist/next) can be added later for offline app-shell precaching.
const nextConfig: NextConfig = {};

export default nextConfig;
