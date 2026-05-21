import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['@react-pdf/renderer', 'groq-sdk'],
  allowedDevOrigins: ['192.168.0.16'],
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
