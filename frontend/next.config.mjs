/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Menu photos live in /public/images and are served as-is.
  images: { unoptimized: true },
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
