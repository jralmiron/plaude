import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['@react-pdf/renderer', 'groq-sdk'],
};

export default nextConfig;
