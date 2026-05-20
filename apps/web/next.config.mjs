/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    '@mft/db',
    '@mft/canonicalize',
    '@mft/shared',
    '@mft/search',
    '@mft/normalizer',
    '@mft/crawler',
  ],
  experimental: {
    serverActions: { bodySizeLimit: '1mb' },
  },
  webpack: (config) => {
    // 워크스페이스 패키지의 ESM 스타일 .js 확장자 import를 .ts로 풀도록 매핑.
    // (TypeScript moduleResolution: bundler와 동등한 동작.)
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    };
    return config;
  },
};

export default nextConfig;
