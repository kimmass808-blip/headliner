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
  // 재적재(re-ingest) 시 페스티벌 레코드가 삭제·재생성되면 ID(URL)가 바뀐다.
  // 구글 등에 이미 색인된 옛 URL이 404가 되지 않도록, 옛 ID → 새 ID 영구(301) 리다이렉트.
  // 새 사례가 생기면 아래 배열에 { old, current } 한 줄씩 추가하면 된다.
  async redirects() {
    const FESTIVAL_ID_MOVES = [
      // 2026 렛츠락 페스티벌 (2026-06-08 재적재로 ID 변경)
      { old: 'cmpzfjwj9000i1279vkip9a5m', current: 'cmq5a4hx80001lpha31bi641t' },
    ];
    return FESTIVAL_ID_MOVES.map(({ old, current }) => ({
      source: `/festivals/${old}`,
      destination: `/festivals/${current}`,
      permanent: true,
    }));
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
