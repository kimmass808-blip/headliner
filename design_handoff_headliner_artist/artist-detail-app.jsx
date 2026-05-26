// Artist detail page
const { useState } = React;

// ───────────────────── Mock data ─────────────────────
const ARTIST = {
  id: 'silicagel',
  canonicalName: '실리카겔',
  aliases: ['Silica Gel', 'SILICA GEL'],
  photo: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=720&q=85&auto=format&fit=crop',
  bio: [
    '2014년 결성, 서울을 기반으로 활동하는 4인조 밴드. 김춘추(보컬, 기타), 최웅희(베이스), 김건재(기타), 김민수(드럼)로 구성되어 있다.',
    '데뷔 EP 〈Silica Gel〉 이후 〈POWER ANDRE 99〉, 〈Liquid Sunshine〉 등을 발표하며 한국 인디 록 씬에서 가장 주목받는 밴드 중 하나로 자리잡았다. 사이키델릭, 슈게이즈, 포스트록 사이를 자유롭게 오가는 사운드와 폭발적인 라이브로 알려져 있다.',
    '2026년 〈LIQUID SUNSHINE TOUR〉로 전국 5개 도시를 돈다.',
  ],
  links: [
    { kind: 'instagram', label: '@silicagel.official', url: 'https://instagram.com/silicagel.official' },
    { kind: 'website',   label: 'silicagel.kr',        url: 'https://silicagel.kr' },
    { kind: 'youtube',   label: 'YouTube',              url: 'https://youtube.com/@silicagel' },
    { kind: 'spotify',   label: 'Spotify',              url: 'https://open.spotify.com/artist/...' },
  ],
  upcoming: [
    { id: 1, type: 'SHOW',     artist:'실리카겔', title:'LIQUID SUNSHINE TOUR', venue:'무신사 개러지',     city:'서울', date:'2026.06.14', day:'SAT' },
    { id: 2, type: 'SHOW',     artist:'실리카겔', title:'여름 단독 — 인천',     venue:'인천 파라다이스시티', city:'인천', date:'2026.07.05', day:'SUN' },
    { id: 3, type: 'FESTIVAL', artist:'2026 PENTAPORT', title:'실리카겔 출연',   venue:'송도달빛축제공원',   city:'인천', date:'2026.08.08', day:'3 DAYS' },
    { id: 4, type: 'SHOW',     artist:'실리카겔', title:'부산 단독',             venue:'부산 락음악감상실',   city:'부산', date:'2026.09.13', day:'SUN' },
  ],
  past: [
    { id: 101, type: 'SHOW',     artist:'실리카겔',     title:'POWER ANDRE 99 RELEASE', venue:'롤링홀',           city:'서울', date:'2024.04.12', day:'FRI' },
    { id: 102, type: 'FESTIVAL', artist:'2024 PENTAPORT',title:'실리카겔 출연',          venue:'송도달빛축제공원',  city:'인천', date:'2024.08.04', day:'3 DAYS' },
    { id: 103, type: 'SHOW',     artist:'실리카겔',     title:'봄 투어 — 부산',         venue:'BIFF 광장',        city:'부산', date:'2024.03.16', day:'SAT' },
    { id: 104, type: 'SHOW',     artist:'실리카겔',     title:'단독 — 대구',            venue:'클럽 헤비',         city:'대구', date:'2024.05.18', day:'SAT' },
    { id: 105, type: 'FESTIVAL', artist:'2023 잔다리',  title:'실리카겔 출연',          venue:'홍대 일대',         city:'서울', date:'2023.09.23', day:'3 DAYS' },
    { id: 106, type: 'SHOW',     artist:'실리카겔',     title:'겨울 단독',              venue:'예스24 라이브홀',   city:'서울', date:'2023.12.30', day:'SAT' },
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

// platform icons (simple line marks)
function IconInstagram({className=''}) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="5"/>
      <circle cx="12" cy="12" r="4"/>
      <circle cx="17.5" cy="6.5" r="0.6" fill="currentColor"/>
    </svg>
  );
}
function IconWebsite({className=''}) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9"/>
      <path d="M3 12h18"/>
      <path d="M12 3a14 14 0 010 18"/>
      <path d="M12 3a14 14 0 000 18"/>
    </svg>
  );
}
function IconYouTube({className=''}) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="6" width="20" height="12" rx="3"/>
      <polygon points="10,9 16,12 10,15" fill="currentColor" stroke="none"/>
    </svg>
  );
}
function IconSpotify({className=''}) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9"/>
      <path d="M7 10.5c3-1 7-1 10 0.5"/>
      <path d="M7.5 13.5c2.5-0.8 5.5-0.6 8 0.7"/>
      <path d="M8 16.3c2-0.6 4-0.4 6 0.4"/>
    </svg>
  );
}
function IconGeneric({className=''}) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 007 0l3-3a5 5 0 00-7-7l-1 1"/>
      <path d="M14 11a5 5 0 00-7 0l-3 3a5 5 0 007 7l1-1"/>
    </svg>
  );
}
const PLATFORM_ICONS = {
  instagram: IconInstagram,
  website:   IconWebsite,
  youtube:   IconYouTube,
  spotify:   IconSpotify,
  bandcamp:  IconGeneric,
  twitter:   IconGeneric,
};
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

// ───────────────────── Shared component placeholders ─────────────────────
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
function BackLinkPlaceholder() {
  return (
    <a href="#" className="inline-flex items-center gap-2 text-[12px] tracking-[0.2em] uppercase text-paper/55 hover:text-paper transition group">
      <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition" />
      검색으로
      <span className="ml-2 text-dim normal-case tracking-normal">⌬ &lt;BackLink /&gt;</span>
    </a>
  );
}
function PosterCardPlaceholder({ s }) {
  return (
    <div className="block">
      <div className="ph aspect-[3/4] rounded-md">
        <span className="lbl">{s.type}</span>
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
          <span className={
            'text-[10px] tracking-[0.22em] uppercase px-2 py-1 rounded-sm ' +
            (s.type === 'FESTIVAL'
              ? 'border border-paper/80 text-paper bg-black/30 backdrop-blur-sm font-semibold'
              : 'bg-white/10 text-paper/90 backdrop-blur-sm')
          }>
            {s.type}
          </span>
          <span className="text-[10px] tracking-[0.22em] uppercase text-paper/80 bg-black/40 backdrop-blur-sm px-2 py-1 rounded-sm">
            {s.day}
          </span>
        </div>
        <div className="absolute left-3 right-3 bottom-3 flex items-end justify-between">
          <div className="logo-headliner text-paper text-[28px] sm:text-[30px] leading-none">
            {s.date.split('.')[1]}<span className="text-paper/60">/</span>{s.date.split('.')[2]}
          </div>
        </div>
        <span className="sub">&lt;PosterCard /&gt;</span>
      </div>
      <div className="mt-4 pr-2">
        <h3 className="text-paper text-[17px] font-semibold tracking-[-0.01em] leading-tight">{s.artist}</h3>
        <p className="mt-1 text-paper/55 text-[13px] leading-tight line-clamp-1">{s.title}</p>
        <div className="mt-3 flex items-center gap-2 text-[11px] tracking-[0.08em] text-paper/45">
          <span>{s.city}</span><span className="text-dim">·</span><span className="truncate">{s.venue}</span>
        </div>
      </div>
    </div>
  );
}

// ───────────────────── Page-specific ─────────────────────

const LINK_LABELS = {
  instagram: 'Instagram',
  website:   'Website',
  youtube:   'YouTube',
  spotify:   'Spotify',
  bandcamp:  'Bandcamp',
  twitter:   'X (Twitter)',
};

function ExternalLinks({ links }) {
  if (!links || !links.length) return null;
  return (
    <div className="mt-7 flex flex-wrap items-center gap-2">
      {links.map(l => {
        const Icon = PLATFORM_ICONS[l.kind] || IconGeneric;
        return (
          <a
            key={l.kind + l.url}
            href={l.url}
            target="_blank"
            rel="noreferrer"
            aria-label={`${LINK_LABELS[l.kind] || l.kind} — ${l.label}`}
            title={`${LINK_LABELS[l.kind] || l.kind} · ${l.label}`}
            className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center text-paper/70 hover:border-white/30 hover:text-paper transition"
          >
            <Icon className="w-[18px] h-[18px]" />
          </a>
        );
      })}
    </div>
  );
}

function ArtistPortrait({ photo, name }) {
  return (
    <div className="w-full">
      <div className="ph w-full aspect-square rounded-md overflow-hidden bg-ink-800" style={{borderStyle: photo ? 'none' : 'dashed'}}>
        {photo ? (
          <img src={photo} alt={name} className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="flex flex-col items-center gap-2">
            <span className="lbl">No Photo</span>
            <span className="text-[10px] tracking-[0.2em] uppercase text-paper/30">사진 미등록</span>
          </div>
        )}
      </div>
    </div>
  );
}

function HeroSection({ artist }) {
  return (
    <section className="max-w-[1400px] mx-auto px-6 sm:px-10 mt-6 sm:mt-8">
      <div className="grid grid-cols-[112px,1fr] sm:grid-cols-[180px,1fr] lg:grid-cols-[280px,1fr] gap-6 sm:gap-10 lg:gap-14 items-start">
        <ArtistPortrait photo={artist.photo} name={artist.canonicalName} />

        <div className="min-w-0">
          {/* kicker */}
          <div className="flex items-center gap-3 text-[11px] tracking-[0.3em] uppercase text-paper/50">
            <span className="w-1 h-1 rounded-full bg-paper/40"></span>
            ARTIST
          </div>

          {/* name */}
          <h1 className="mt-3 sm:mt-5 text-paper font-bold tracking-[-0.035em] leading-[0.95] text-[32px] sm:text-[56px] lg:text-[72px] break-keep">
            {artist.canonicalName}
          </h1>

          {/* aliases */}
          {artist.aliases && artist.aliases.length > 0 && (
            <div className="mt-3 sm:mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-paper/55 text-[14px]">
              {artist.aliases.map((a, i) => (
                <React.Fragment key={a}>
                  <span>{a}</span>
                  {i < artist.aliases.length - 1 && <span className="text-dim">·</span>}
                </React.Fragment>
              ))}
            </div>
          )}

          <ExternalLinks links={artist.links} />
        </div>
      </div>
    </section>
  );
}

function BioSection({ bio }) {
  if (!bio || !bio.length) return null;
  return (
    <section className="max-w-[1400px] mx-auto px-6 sm:px-10 mt-20 sm:mt-24">
      <div className="hairline pb-5 mb-8">
        <div className="text-[11px] tracking-[0.3em] uppercase text-paper/45 mb-2">BIO</div>
        <h2 className="text-paper text-[24px] sm:text-[28px] font-bold tracking-[-0.025em] leading-tight">소개</h2>
      </div>
      <div className="max-w-3xl">
        {bio.map((p, i) => (
          <p key={i} className={
            'text-paper/80 leading-[1.7] ' +
            (i === 0 ? 'text-[17px] sm:text-[19px]' : 'text-[15px] sm:text-[16px] text-paper/70') +
            (i > 0 ? ' mt-5' : '')
          }>
            {p}
          </p>
        ))}
      </div>
    </section>
  );
}

function ShowsGrid({ items, kicker, title, emptyHint }) {
  if (!items || !items.length) return null;
  return (
    <section className="max-w-[1400px] mx-auto px-6 sm:px-10 mt-20 sm:mt-24">
      <div className="hairline pb-6 mb-10 flex items-end justify-between">
        <div>
          <div className="text-[11px] tracking-[0.3em] uppercase text-paper/45 mb-3">{kicker}</div>
          <div className="flex items-baseline gap-3">
            <h2 className="text-paper text-[26px] sm:text-[32px] font-bold tracking-[-0.025em] leading-tight">{title}</h2>
            <span className="text-paper/40 text-[14px] tabular-nums">{items.length}건</span>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-12">
        {items.map(s => <PosterCardPlaceholder key={s.id} s={s} />)}
      </div>
    </section>
  );
}

function NoShowsState() {
  return (
    <section className="max-w-[1400px] mx-auto px-6 sm:px-10 mt-20 sm:mt-24">
      <div className="hairline pb-6 mb-10">
        <div className="text-[11px] tracking-[0.3em] uppercase text-paper/45 mb-3">SHOWS</div>
        <h2 className="text-paper text-[26px] sm:text-[32px] font-bold tracking-[-0.025em] leading-tight">공연</h2>
      </div>
      <div className="border border-dashed border-white/10 rounded-md py-16 text-center max-w-2xl mx-auto">
        <div className="text-paper/40 text-[14px]">등록된 공연 정보가 없습니다.</div>
        <div className="mt-2 text-paper/30 text-[12px]">새 공연이 확인되면 자동으로 이 페이지에 추가됩니다.</div>
      </div>
    </section>
  );
}

// ───────────────────── App ─────────────────────
function App() {
  const [demo, setDemo] = useState('full'); // 'full' | 'no-bio' | 'no-shows' | 'minimal'

  let artist = { ...ARTIST };
  if (demo === 'no-bio') {
    artist = { ...artist, bio: null };
  } else if (demo === 'no-shows') {
    artist = { ...artist, upcoming: [], past: [] };
  } else if (demo === 'minimal') {
    artist = { ...artist, bio: null, aliases: null, links: null, photo: null, upcoming: [], past: [] };
  }

  const noShows = (!artist.upcoming || artist.upcoming.length === 0) && (!artist.past || artist.past.length === 0);

  return (
    <div className="min-h-screen bg-ink-900 text-paper pb-24">
      <HeaderPlaceholder />

      {/* demo toggle — not part of design */}
      <div className="max-w-[1400px] mx-auto px-6 sm:px-10 mt-6 flex justify-center gap-2 flex-wrap">
        {[
          ['full',     '전체'],
          ['no-bio',   'BIO 없음'],
          ['no-shows', '공연 없음'],
          ['minimal',  '최소(필드 거의 없음)'],
        ].map(([id, label]) => (
          <button key={id}
            onClick={() => setDemo(id)}
            className={'text-[11px] tracking-[0.18em] uppercase px-3 h-7 rounded-full border ' +
              (demo === id ? 'bg-paper text-ink-900 border-paper' : 'text-paper/50 border-white/10 hover:text-paper hover:border-white/30')}>
            {label}
          </button>
        ))}
        <span className="ml-2 self-center text-[10px] tracking-[0.22em] uppercase text-dim">(시안 미리보기용 토글)</span>
      </div>

      <main>
        <section className="max-w-[1400px] mx-auto px-6 sm:px-10 pt-8 sm:pt-10">
          <BackLinkPlaceholder />
        </section>

        <HeroSection artist={artist} />

        {noShows
          ? <NoShowsState />
          : <>
              <ShowsGrid items={artist.upcoming} kicker="UPCOMING / 2026" title="다가오는 공연" />
              <ShowsGrid items={artist.past}     kicker="ARCHIVE"          title="지난 공연" />
            </>
        }
      </main>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
