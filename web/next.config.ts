import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [{ source: '/preview', destination: '/', permanent: true }];
  },
  /**
   * `core` is a workspace package of untranspiled TypeScript. The capture route
   * imports its FortyGuard client directly rather than duplicating it — the
   * vendor stays confined to one place, per docs/architecture.md.
   */
  transpilePackages: ['core'],
};

export default nextConfig;
