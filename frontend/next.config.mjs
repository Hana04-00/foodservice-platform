/** @type {import('next').NextConfig} */

// Where the Next.js server forwards /api/* calls. The browser never sees this —
// it only ever calls the site's own origin, so the app works unchanged behind
// localhost, a LAN IP, or an ngrok / reverse-proxy tunnel.
const BACKEND_ORIGIN = process.env.BACKEND_ORIGIN || "http://localhost:8000";

const nextConfig = {
  reactStrictMode: true,
  // Menu photos live in /public/images and are served as-is.
  images: { unoptimized: true },
  eslint: { ignoreDuringBuilds: true },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${BACKEND_ORIGIN}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
