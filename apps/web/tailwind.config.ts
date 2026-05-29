import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // 다크 무드 토큰 (design_handoff_headliner_home/README.md 기준)
        ink: {
          900: '#0a0a0a', // 페이지 배경
          850: '#101010', // 인풋 배경
          800: '#141414', // 카드/스카프 배경
          700: '#1c1c1c', // 카드 fallback
          600: '#262626',
          500: '#3a3a3a',
        },
        paper: '#fafafa', // 메인 텍스트 / 모노톤 액센트(하이라이트)
        muted: '#8a8a8a', // 보조 텍스트
        dim: '#5a5a5a',   // 비활성 / 플레이스홀더

        // 라이트 모드용 (검색 결과·상세·admin 페이지)
        accent: {
          DEFAULT: '#2563eb',
          subtle: '#dbeafe',
          ink: '#1e40af',
        },
      },
      fontFamily: {
        sans: [
          '"Pretendard Variable"',
          'Pretendard',
          '-apple-system',
          'BlinkMacSystemFont',
          'system-ui',
          'Roboto',
          '"Apple SD Gothic Neo"',
          '"Noto Sans KR"',
          'sans-serif',
        ],
        // 로고 / 카드 날짜용 — globals.css의 @import로 로드
        display: ['"Big Shoulders Display"', '"Pretendard Variable"', 'sans-serif'],
      },
      letterSpacing: {
        tightest: '-0.04em',
      },
    },
  },
  plugins: [],
};

export default config;
