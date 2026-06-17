import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['chat', '@novu/chat-sdk-adapter'],
};

export default nextConfig;
