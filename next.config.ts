import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['@react-pdf/renderer', 'groq-sdk'],
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
