const webpack = require('webpack');

/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // 添加 Node.js 内置模块的 polyfills
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        buffer: require.resolve('buffer/'),
        stream: require.resolve('stream-browserify'),
        util: require.resolve('util/'),
        crypto: require.resolve('crypto-browserify'),
        path: require.resolve('path-browserify'),
        process: require.resolve('process/browser'),
        zlib: require.resolve('browserify-zlib'),
        http: require.resolve('stream-http'),
        https: require.resolve('https-browserify'),
        os: require.resolve('os-browserify/browser'),
      };

      // 添加全局 polyfills
      config.plugins.push(
        new webpack.ProvidePlugin({
          process: 'process/browser',
          Buffer: ['buffer', 'Buffer'],
        })
      );

      // 处理 node: 协议导入
      config.resolve.alias = {
        ...config.resolve.alias,
        'node:buffer': 'buffer',
        'node:stream': 'stream-browserify',
        'node:util': 'util',
        'node:crypto': 'crypto-browserify',
        'node:path': 'path-browserify',
        'node:process': 'process/browser',
        'node:zlib': 'browserify-zlib',
        'node:http': 'stream-http',
        'node:https': 'https-browserify',
        'node:os': 'os-browserify/browser',
      };

      // 添加额外的 webpack 配置
      config.module.rules.push({
        test: /\.m?js$/,
        resolve: {
          fullySpecified: false,
        },
      });
    }

    // 优化PDF处理相关的webpack配置
    config.optimization = {
      ...config.optimization,
      moduleIds: 'deterministic',
      splitChunks: {
        chunks: 'all',
        cacheGroups: {
          pdfLib: {
            test: /[\\/]node_modules[\\/](pdf-lib|@pdf-lib)[\\/]/,
            name: 'pdf-lib',
            priority: 10,
            reuseExistingChunk: true,
          },
        },
      },
    };

    return config;
  },
  experimental: {
    esmExternals: true,
    serverActions: {
      bodySizeLimit: '50mb', // 增加服务器操作的大小限制
    },
    optimizePackageImports: ['pdf-lib'], // 优化PDF库的导入
  },
  // 添加调试配置
  webpackDevMiddleware: (config) => {
    config.watchOptions = {
      poll: 1000,
      aggregateTimeout: 300,
    };
    return config;
  },
  // 启用服务器端调试
  serverRuntimeConfig: {
    debug: true,
  },
  api: {
    bodyParser: {
      sizeLimit: '50mb', // 增加请求体大小限制
    },
    responseLimit: '50mb', // 增加响应大小限制
  },
};

module.exports = nextConfig; 