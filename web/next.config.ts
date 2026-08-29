import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  /**
   * `core` is a workspace package of untranspiled TypeScript. The capture route
   * imports its FortyGuard client directly rather than duplicating it — the
   * vendor stays confined to one place, per docs/architecture.md.
   */
  transpilePackages: ['core'],
  /**
   * `bun:sqlite` is a Bun runtime built-in, not an npm package — Next must not
   * try to bundle it for a client boundary. See web/lib/db.ts.
   */
  serverExternalPackages: ['bun:sqlite'],
};

export default nextConfig;
