/** @type {import('next').NextConfig} */
const nextConfig = {
  // Improve hot reloading in development
  reactStrictMode: true,
  
  // Enable faster refresh
  experimental: {
    // This helps with route detection
    optimizePackageImports: ['lucide-react'],
  },
  
  // Improve file watching on Windows
  webpack: (config, { dev, isServer }) => {
    if (dev) {
      config.watchOptions = {
        poll: 1000, // Check for changes every second
        aggregateTimeout: 300, // Delay before rebuilding
      };
    }
    
    // Ensure node_modules resolution works correctly for ESM packages like jose
    if (!config.resolve) {
      config.resolve = {};
    }
    if (!config.resolve.modules) {
      config.resolve.modules = [];
    }
    config.resolve.modules = ['node_modules', ...config.resolve.modules];
    
    return config;
  },
}

module.exports = nextConfig






