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
  webpackDevMiddleware: (config) => {
    config.watchOptions = {
      poll: 1000, // Check for changes every second
      aggregateTimeout: 300, // Delay before rebuilding
    };
    return config;
  },
}

module.exports = nextConfig






