import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Add Supabase storage domain when connected:
      // { protocol: 'https', hostname: '*.supabase.co' },
    ],
  },
  // Prevent accidental exposure of server env vars to the browser
  env: {},
}

export default nextConfig
