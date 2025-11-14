/** @type {import('next').NextConfig} */
const nextConfig = {
  // Trivial change to invalidate cache and force a clean rebuild.
  swcMinify: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "placehold.co",
      },
      {
        protocol: "https",
        hostname: "picsum.photos",
      },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
  typescript: {
    ignoreBuildErrors: false,
  },
};

module.exports = nextConfig;
