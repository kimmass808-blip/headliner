// Mock data for the search results page.
const RESULTS = {
  artists: [
    {
      id: 'a1',
      name: '실리카겔',
      aliases: 'Silica Gel',
      genres: ['포스트록', '슈게이즈', '인디팝'],
      followers: 142800,
      img: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&q=80&auto=format&fit=crop',
    },
    {
      id: 'a2',
      name: '실리카겔 (Korea)',
      aliases: '동명 밴드 · 부산',
      genres: ['개러지록'],
      followers: 1240,
      img: 'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?w=400&q=80&auto=format&fit=crop',
    },
  ],

  upcoming: [
    {
      id: 1, type: 'SHOW',
      artist: '실리카겔', title: 'LIQUID SUNSHINE TOUR',
      venue: '무신사 개러지', city: '서울',
      date: '2026.06.14', day: 'SAT',
      img: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=900&q=80&auto=format&fit=crop',
    },
    {
      id: 2, type: 'SHOW',
      artist: '실리카겔', title: '여름 단독 — 인천',
      venue: '인천 파라다이스시티', city: '인천',
      date: '2026.07.05', day: 'SUN',
      img: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=900&q=80&auto=format&fit=crop',
    },
    {
      id: 3, type: 'FESTIVAL',
      artist: '인천 펜타포트 락 페스티벌', title: '2026 PENTAPORT (실리카겔 출연)',
      venue: '송도달빛축제공원', city: '인천',
      date: '2026.08.08', day: '3 DAYS',
      img: 'https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?w=900&q=80&auto=format&fit=crop',
    },
    {
      id: 4, type: 'SHOW',
      artist: '실리카겔', title: 'PANDA BEAR INVITATION 게스트',
      venue: '예스24 라이브홀', city: '서울',
      date: '2026.07.03', day: 'FRI',
      img: 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=900&q=80&auto=format&fit=crop',
    },
    {
      id: 5, type: 'FESTIVAL',
      artist: '잔다리 페스타', title: 'ZANDARI FESTA 2026 (실리카겔 출연)',
      venue: '홍대 일대 27개 공연장', city: '서울',
      date: '2026.09.25', day: '3 DAYS',
      img: 'https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?w=900&q=80&auto=format&fit=crop',
    },
    {
      id: 6, type: 'SHOW',
      artist: '실리카겔', title: '연말 단독',
      venue: 'KINTEX 제2전시장', city: '고양',
      date: '2026.12.27', day: 'SUN',
      img: 'https://images.unsplash.com/photo-1574391884720-bbc3740c59d1?w=900&q=80&auto=format&fit=crop',
    },
  ],

  past: [
    {
      id: 101, type: 'SHOW',
      artist: '실리카겔', title: 'POWER ANDRE 99 RELEASE',
      venue: '롤링홀', city: '서울',
      date: '2024.04.12', day: 'FRI',
      img: 'https://images.unsplash.com/photo-1506157786151-b8491531f063?w=900&q=80&auto=format&fit=crop',
    },
    {
      id: 102, type: 'FESTIVAL',
      artist: '인천 펜타포트', title: '2024 PENTAPORT',
      venue: '송도달빛축제공원', city: '인천',
      date: '2024.08.04', day: '3 DAYS',
      img: 'https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?w=900&q=80&auto=format&fit=crop',
    },
    {
      id: 103, type: 'SHOW',
      artist: '실리카겔', title: '봄 투어 — 부산',
      venue: 'BIFF 광장', city: '부산',
      date: '2024.03.16', day: 'SAT',
      img: 'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?w=900&q=80&auto=format&fit=crop',
    },
  ],
};

window.SEARCH_RESULTS = RESULTS;
