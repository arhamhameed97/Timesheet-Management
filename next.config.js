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
    
    // Ensure jose is properly resolved (ESM-only package)
    // Don't externalize it - we want it bundled, but webpack needs to find it
    if (isServer) {
      config.resolve.extensionAlias = {
        '.js': ['.js', '.ts', '.tsx'],
        '.jsx': ['.jsx', '.tsx'],
      };
    }
    
    return config;
  },
}

module.exports = nextConfig






