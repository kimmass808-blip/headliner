// LineupSection — 페스티벌 소속 Show 상세 페이지에서 셋리스트 자리에 들어가는 블록.
// 시간·스테이지 정보 없이 아티스트 명단만 표시.
//
// Usage:
//   <LineupSection lineup={show.lineup} festivalName={show.festival.name} />
//
// Data shape:
//   type Lineup = {
//     totalArtists: number;
//     thisArtist?: string;        // 현재 보고 있는 공연의 아티스트
//     days: {
//       label: string;            // "DAY 1"
//       date: string;             // "2026.08.08"
//       dayKr: string;            // "FRI"
//       hereArtist?: string;      // 이 날 출연하는 thisArtist
//       artists: string[];
//     }[];
//   };

function ArrowUpRight({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 17L17 7"/><path d="M8 7h9v9"/>
    </svg>
  );
}

function ArtistChip({ name, here }) {
  const cls = 'inline-flex items-center gap-2 h-9 px-3.5 text-[14px] tracking-[-0.005em] transition ' +
    (here
      ? 'text-lime border border-lime/70 bg-lime/[0.06]'
      : 'text-paper/85 border border-white/15 hover:border-white/40 hover:text-paper');
  return (
    <a href="#" className={cls} style={{ borderRadius: 6 }}>
      {name}
      {here && (
        <span className="text-[9px] tracking-[0.22em] uppercase -mr-1">THIS SET</span>
      )}
    </a>
  );
}

function LineupDayHeader({ day }) {
  return (
    <div className="flex items-baseline gap-4 mb-5 hairline pb-3">
      <span className="text-[11px] tracking-[0.3em] uppercase text-paper/45">{day.label}</span>
      <span className="logo-headliner text-paper text-[22px] leading-none">
        {day.date.split('.')[1]}<span className="text-paper/45">.</span>{day.date.split('.')[2]}
      </span>
      <span className="text-[12px] tracking-[0.18em] uppercase text-paper/55">{day.dayKr}</span>
      {day.hereArtist && (
        <span className="ml-auto inline-flex items-center gap-2 text-[10px] tracking-[0.22em] uppercase text-lime">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-lime"
                style={{ boxShadow: '0 0 0 2px rgba(212,255,77,0.18)' }}></span>
          이 날 공연
        </span>
      )}
    </div>
  );
}

function LineupSection({ lineup, festivalName }) {
  return (
    <section className="max-w-[1400px] mx-auto px-6 sm:px-10 mt-20 sm:mt-28 pb-24">
      {/* heading */}
      <div className="hairline pb-6 mb-8 flex items-end justify-between flex-wrap gap-y-4">
        <div>
          <div className="text-[11px] tracking-[0.3em] uppercase text-paper/45 mb-3">LINEUP</div>
          <div className="flex items-baseline gap-3 flex-wrap">
            <h2 className="text-paper text-[28px] sm:text-[34px] font-bold tracking-[-0.025em] leading-tight">
              라인업
            </h2>
            <span className="text-paper/40 text-[14px] tabular-nums">{lineup.totalArtists}팀</span>
          </div>
        </div>
        <a href="#" className="ext text-[11px] tracking-[0.2em] uppercase text-paper/55">
          페스티벌 전체 보기
          <ArrowUpRight className="arr w-3.5 h-3.5" />
        </a>
      </div>

      {/* day-grouped chip lists */}
      {lineup.days.map((d, di) => (
        <div key={d.label} className={di > 0 ? 'mt-10' : ''}>
          <LineupDayHeader day={d} />
          <div className="flex flex-wrap gap-2">
            {d.artists.map((n) => (
              <ArtistChip key={n} name={n} here={d.hereArtist === n} />
            ))}
          </div>
        </div>
      ))}

      {/* footer note */}
      <div className="mt-10 flex flex-wrap items-center gap-6 text-[10px] tracking-[0.22em] uppercase text-paper/40">
        <span className="inline-flex items-center gap-2">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-lime"
                style={{ boxShadow: '0 0 0 2px rgba(212,255,77,0.18)' }}></span>
          THIS SET — 지금 보는 공연
        </span>
        <span className="ml-auto text-paper/30">라인업은 변경될 수 있습니다.</span>
      </div>
    </section>
  );
}

// ─── Mock data + preview app ────────────────────────────────────────────────
const PENTAPORT_LINEUP = {
  totalArtists: 38,
  thisArtist: '실리카겔',
  days: [
    { label: 'DAY 1', date: '2026.08.08', dayKr: 'FRI',
      artists: [
        'IDLES', 'Wet Leg', '검정치마',
        '잠비나이', '새소년', '안녕바다', '페퍼톤스', '카더가든', '9와 숫자들', '브로콜리너마저',
        '이브이', '실리카 (Korea)', '쏜애플', '아도이', '레인보우99', '이날치',
      ],
    },
    { label: 'DAY 2', date: '2026.08.09', dayKr: 'SAT',
      hereArtist: '실리카겔',
      artists: [
        'Mac DeMarco', 'hyukoh', '잔나비',
        '실리카겔', 'Wave to Earth', '백예린', '죠지', '데이먼스 이어', '적재', '호피폴라',
        '새소년', '오월오일', '나상현씨밴드', '검정치마', '소수빈', '천미지',
      ],
    },
    { label: 'DAY 3', date: '2026.08.10', dayKr: 'SUN',
      artists: [
        'Phoenix', '검정치마', '루시드 폴',
        '새벽과 새', '데이브레이크', '권진아', '짙은', '김사월', '보넥도', '9와 숫자들',
        '실리카겔', '한로로', '신지수', '강아솔', '키라라', '코토바',
      ],
    },
  ],
};

function PreviewApp() {
  return (
    <div className="min-h-screen bg-ink-900 text-paper py-12">
      <LineupSection lineup={PENTAPORT_LINEUP} festivalName="2026 펜타포트 락 페스티벌" />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<PreviewApp />);
