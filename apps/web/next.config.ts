import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@pharmaos/ui', '@pharmaos/types', '@pharmaos/utils'],
  experimental: {
    optimizePackageImports: ['lucide-react', 'recharts'],
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.pharmaos.in',
      },
    ],
  },
};

export default nextConfig;
