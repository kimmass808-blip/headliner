// Show detail page
const { useState } = React;

// ───────────────────── Mock data ─────────────────────
const SHOW = {
  artists: ['실리카겔'],
  title: 'LIQUID SUNSHINE TOUR',
  date: '2026.06.14',
  day: 'SAT',
  dayKr: '토요일',
  time: '19:00',
  venue: '무신사 개러지',
  city: '서울',
  // festival: when present, this show is part of a festival
  festival: null, // example: { name: '2026 펜타포트 락 페스티벌', stage: '메인 스테이지', id: 'pentaport-2026' },
  poster: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=900&q=85&auto=format&fit=crop',
  ticket: 'https://yes24.com/ticket/silicagel',
  ticketLabel: 'YES24 티켓',
  source: 'https://instagram.com/p/abc123',
  sourceLabel: '@silicagel.official',
  missing: [], // e.g. ['time'] if start time isn't published yet
  setlist: [
    { n: 1,  title: 'Tik Tak Tok' },
    { n: 2,  title: 'Desert Eagle' },
    { n: 3,  title: 'Andromeda' },
    { n: 4,  title: 'Kyo181' },
    { n: 5,  title: 'NO PAIN' },
    { n: 6,  title: '청춘' },
    { n: 7,  title: '아 그러세요' },
    { n: 8,  title: 'Bicycle' },
    { n: 9,  title: 'Realize' },
    { n: 10, title: 'Last Christmas', cover: 'Wham!' },
    { encore: true, n: 1, title: 'NEO SOUL' },
    { encore: true, n: 2, title: '백야' },
  ],
};

// ───────────────────── Icons ─────────────────────
function ArrowUpRight({className=''}) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 17L17 7"/><path d="M8 7h9v9"/>
    </svg>
  );
}
function ArrowLeft({className=''}) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/>
    </svg>
  );
}
function SearchIcon({className=''}) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7.5"/><path d="M20 20l-4-4"/>
    </svg>
  );
}

// ───────────────────── Shared component placeholder ─────────────────────
function HeaderPlaceholder() {
  return (
    <div className="w-full hairline">
      <div className="max-w-[1400px] mx-auto px-6 sm:px-10 h-[72px] flex items-center justify-between">
        <div className="logo-headliner text-paper text-[28px] sm:text-[32px]">HEADLINER</div>
        <nav className="hidden md:flex items-center gap-8 text-[13px] tracking-[0.02em] text-paper/70">
          <span className="hover:text-paper cursor-pointer">공연</span>
          <span className="hover:text-paper cursor-pointer">페스티벌</span>
          <span className="hover:text-paper cursor-pointer">아티스트</span>
          <span className="hover:text-paper cursor-pointer">아카이브</span>
        </nav>
        <button aria-label="search" className="w-9 h-9 rounded-full border border-white/10 flex items-center justify-center text-paper/80">
          <SearchIcon className="w-4 h-4" />
        </button>
      </div>
      <div className="max-w-[1400px] mx-auto px-6 sm:px-10 pb-2 -mt-1">
        <span className="text-[10px] tracking-[0.3em] uppercase text-dim">⌬ &lt;HomeHeader /&gt; (from codebase)</span>
      </div>
    </div>
  );
}

// ───────────────────── Page components ─────────────────────

function BackLink() {
  return (
    <a href="#" className="inline-flex items-center gap-2 text-[12px] tracking-[0.2em] uppercase text-paper/55 hover:text-paper transition group">
      <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition" />
      검색으로
    </a>
  );
}

function FestivalBanner({ fest }) {
  if (!fest) return null;
  return (
    <a href="#" className="ext block mb-6 group">
      <div className="flex items-center gap-3 text-[11px] tracking-[0.3em] uppercase text-paper/55 mb-1.5">
        <span className="w-1 h-1 rounded-full bg-paper/40"></span>
        PART OF FESTIVAL
      </div>
      <div className="flex items-baseline gap-3 flex-wrap">
        <span className="text-paper text-[18px] font-semibold tracking-[-0.015em] group-hover:underline underline-offset-4 decoration-paper/40">
          {fest.name}
        </span>
        {fest.stage && (
          <>
            <span className="text-dim">·</span>
            <span className="text-paper/65 text-[14px]">{fest.stage}</span>
          </>
        )}
        <ArrowUpRight className="arr w-4 h-4 text-paper/55" />
      </div>
    </a>
  );
}

function MissingFieldsBadge({ missing }) {
  if (!missing || !missing.length) return null;
  const labels = { time:'시작 시간', date:'날짜', venue:'장소', city:'지역', artist:'아티스트', ticket:'예매', poster:'포스터' };
  return (
    <div className="mt-6 inline-flex items-center gap-2 px-3 h-7 rounded-full border border-dashed border-white/15 text-[11px] tracking-[0.12em] text-paper/55">
      <span className="text-paper/40">·</span>
      누락:&nbsp;{missing.map(m => labels[m] || m).join(', ')}
    </div>
  );
}

function MetaRow({ label, children }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-4 py-4 hairline">
      <dt className="text-[11px] tracking-[0.25em] uppercase text-paper/45 self-center">{label}</dt>
      <dd className="text-paper text-[15px] leading-snug">{children}</dd>
    </div>
  );
}

function InfoColumn({ show }) {
  return (
    <div className="flex flex-col">
      <FestivalBanner fest={show.festival} />

      {/* date kicker */}
      <div className="flex items-center gap-3 text-[11px] tracking-[0.3em] uppercase text-paper/50">
        <span className="logo-headliner text-paper text-[14px] leading-none tabular-nums">
          {show.date.split('.')[1]}<span className="text-paper/60">/</span>{show.date.split('.')[2]}
        </span>
        <span className="text-dim">·</span>
        <span>{show.day}</span>
        <span className="text-dim">·</span>
        <span>{show.dayKr}</span>
        {show.time && (
          <>
            <span className="text-dim">·</span>
            <span className="font-mono text-paper/80">{show.time}</span>
          </>
        )}
      </div>

      {/* artists — primary headline */}
      <h1 className="mt-5 text-paper font-bold tracking-[-0.035em] leading-[0.95] text-[44px] sm:text-[52px] lg:text-[60px]">
        {show.artists.join(' · ')}
      </h1>

      {/* show title — second line, italic-feel via weight diff */}
      <div className="mt-3 text-paper/70 text-[20px] sm:text-[22px] font-medium tracking-[-0.015em] leading-tight">
        {show.title}
      </div>

      {/* meta dl */}
      <dl className="mt-10 hairline-t">
        <MetaRow label="DATE">
          {show.date}
          <span className="text-paper/45"> · {show.dayKr}</span>
          {show.time && <span className="text-paper/45 font-mono"> · {show.time} 시작</span>}
        </MetaRow>
        <MetaRow label="VENUE">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-paper">{show.venue}</span>
            {show.city && <span className="text-paper/50">— {show.city}</span>}
          </div>
        </MetaRow>
        <MetaRow label="ARTIST">
          <div className="flex flex-wrap gap-x-3 gap-y-1.5">
            {show.artists.map(a => (
              <a key={a} href="#" className="text-paper hover:text-paper underline underline-offset-4 decoration-paper/30 hover:decoration-paper transition">
                {a}
              </a>
            ))}
          </div>
        </MetaRow>
        {show.ticket && (
          <MetaRow label="TICKET">
            <a href={show.ticket} target="_blank" rel="noreferrer" className="ext text-paper/85">
              {show.ticketLabel}
              <ArrowUpRight className="arr w-4 h-4" />
            </a>
          </MetaRow>
        )}
        {show.source && (
          <MetaRow label="SOURCE">
            <a href={show.source} target="_blank" rel="noreferrer" className="ext text-paper/65 text-[13px]">
              <span className="font-mono">Instagram</span>
              <span className="text-dim">·</span>
              <span>{show.sourceLabel}</span>
              <ArrowUpRight className="arr w-3.5 h-3.5" />
            </a>
          </MetaRow>
        )}
      </dl>

      <MissingFieldsBadge missing={show.missing} />
    </div>
  );
}

function PosterColumn({ show }) {
  return (
    <div className="w-full">
      <div className="relative w-full max-h-[70vh] aspect-[3/4] sm:aspect-auto sm:h-[70vh] bg-ink-800 rounded-md overflow-hidden flex items-center justify-center">
        <img
          src={show.poster}
          alt={`${show.artists.join(', ')} — ${show.title}`}
          className="w-full h-full object-contain"
        />
      </div>
      <div className="mt-3 flex items-center justify-between text-[10px] tracking-[0.22em] uppercase text-dim">
        <span>POSTER · 원본 비율 유지</span>
        <span>{show.date}</span>
      </div>
    </div>
  );
}

function SetlistSection({ setlist }) {
  if (!setlist || !setlist.length) {
    return (
      <section className="max-w-[1400px] mx-auto px-6 sm:px-10 mt-20 sm:mt-28 pb-24">
        <div className="hairline pb-6 mb-10">
          <div className="text-[11px] tracking-[0.3em] uppercase text-paper/45 mb-3">SETLIST</div>
          <h2 className="text-paper text-[28px] sm:text-[34px] font-bold tracking-[-0.025em] leading-tight">셋리스트</h2>
        </div>
        <div className="border border-dashed border-white/10 rounded-md py-16 text-center">
          <div className="text-paper/40 text-[14px]">셋리스트 미등록</div>
          <div className="mt-2 text-paper/30 text-[12px]">공연이 끝난 뒤 사용자 또는 큐레이터에 의해 등록됩니다.</div>
        </div>
      </section>
    );
  }

  const main = setlist.filter(s => !s.encore);
  const encore = setlist.filter(s => s.encore);
  const totalCount = setlist.length;

  return (
    <section className="max-w-[1400px] mx-auto px-6 sm:px-10 mt-20 sm:mt-28 pb-24">
      <div className="hairline pb-6 mb-8 flex items-end justify-between">
        <div>
          <div className="text-[11px] tracking-[0.3em] uppercase text-paper/45 mb-3">SETLIST</div>
          <div className="flex items-baseline gap-3">
            <h2 className="text-paper text-[28px] sm:text-[34px] font-bold tracking-[-0.025em] leading-tight">셋리스트</h2>
            <span className="text-paper/40 text-[14px] tabular-nums">{totalCount}곡</span>
          </div>
        </div>
        <div className="hidden sm:block text-[11px] tracking-[0.2em] uppercase text-paper/45">
          앙코르 {encore.length}곡 포함
        </div>
      </div>

      {/* setlist — main */}
      <ol className="max-w-3xl">
        {main.map(s => <SongRow key={'m'+s.n} song={s} />)}
      </ol>

      {/* encore divider */}
      {encore.length > 0 && (
        <>
          <div className="max-w-3xl mt-10 mb-2 flex items-center gap-4">
            <span className="text-[11px] tracking-[0.4em] uppercase text-paper/55">ENCORE</span>
            <span className="flex-1 h-px bg-white/10"></span>
            <span className="text-[11px] tabular-nums text-paper/40">{encore.length}곡</span>
          </div>
          <ol className="max-w-3xl">
            {encore.map(s => <SongRow key={'e'+s.n} song={s} encore />)}
          </ol>
        </>
      )}
    </section>
  );
}

function SongRow({ song, encore = false }) {
  return (
    <li className="song-row hairline grid grid-cols-[44px_1fr_auto] items-baseline gap-4 px-2 sm:px-3 py-3.5 sm:py-4 rounded-sm">
      <span className="font-mono text-paper/45 text-[13px] tabular-nums">
        {encore ? `E${song.n}` : String(song.n).padStart(2, '0')}
      </span>
      <div className="min-w-0">
        <span className="song-title text-paper/85 text-[16px] sm:text-[17px] tracking-[-0.005em]">
          {song.title}
        </span>
        {song.cover && (
          <span className="ml-3 text-[11px] tracking-[0.04em] text-paper/45">
            cover of <span className="text-paper/65">{song.cover}</span>
          </span>
        )}
      </div>
      {encore && (
        <span className="text-[10px] tracking-[0.22em] uppercase text-paper/45 border border-white/10 rounded-full px-2 py-0.5 justify-self-end">
          앙코르
        </span>
      )}
    </li>
  );
}

// ───────────────────── App ─────────────────────
function App() {
  const [demoMode, setDemoMode] = useState('standalone'); // 'standalone' | 'festival' | 'no-setlist'

  const show = { ...SHOW };
  if (demoMode === 'festival') {
    show.festival = { name: '2026 펜타포트 락 페스티벌', stage: '메인 스테이지', id: 'pentaport-2026' };
    show.venue = '송도달빛축제공원';
    show.city = '인천';
  } else if (demoMode === 'no-setlist') {
    show.setlist = [];
    show.missing = ['time'];
    show.time = null;
  }

  return (
    <div className="min-h-screen bg-ink-900 text-paper">
      <HeaderPlaceholder />

      {/* demo toggle — not part of design */}
      <div className="max-w-[1400px] mx-auto px-6 sm:px-10 mt-6 flex justify-center gap-2 flex-wrap">
        {[
          ['standalone', '단독 공연'],
          ['festival',   '페스티벌 소속'],
          ['no-setlist', '셋리스트 미등록 + 시간 누락'],
        ].map(([id, label]) => (
          <button key={id}
            onClick={() => setDemoMode(id)}
            className={'text-[11px] tracking-[0.18em] uppercase px-3 h-7 rounded-full border ' +
              (demoMode === id ? 'bg-paper text-ink-900 border-paper' : 'text-paper/50 border-white/10 hover:text-paper hover:border-white/30')}>
            {label}
          </button>
        ))}
        <span className="ml-2 self-center text-[10px] tracking-[0.22em] uppercase text-dim">
          (시안 미리보기용 토글)
        </span>
      </div>

      <main>
        <section className="max-w-[1400px] mx-auto px-6 sm:px-10 pt-8 sm:pt-10">
          <BackLink />
        </section>

        <section className="max-w-[1400px] mx-auto px-6 sm:px-10 mt-6 sm:mt-8">
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,520px),1fr] gap-10 lg:gap-16">
            <PosterColumn show={show} />
            <InfoColumn show={show} />
          </div>
        </section>

        <SetlistSection setlist={show.setlist} />
      </main>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
