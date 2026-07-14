import type { NextConfig } from 'next';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

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
  // Proxy all /api/* requests to the Express backend
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${API_BASE}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
