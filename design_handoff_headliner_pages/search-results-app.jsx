// Search results page — main app
const { useState } = React;
const R = window.SEARCH_RESULTS;

// ───────────────────── Icons ─────────────────────
function ArrowIcon({className=''}) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14"/><path d="M13 5l7 7-7 7"/>
    </svg>
  );
}
function MutedSearchIcon({className=''}) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7.5"/><path d="M20 20l-4-4"/>
    </svg>
  );
}

// ───────────────────── Shared component placeholders ─────────────────────
// These represent components that already exist in our codebase.

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
          <MutedSearchIcon className="w-4 h-4" />
        </button>
      </div>
      <div className="max-w-[1400px] mx-auto px-6 sm:px-10 pb-2 -mt-1">
        <span className="text-[10px] tracking-[0.3em] uppercase text-dim">⌬ &lt;HomeHeader /&gt; (from codebase)</span>
      </div>
    </div>
  );
}

function SearchBarPlaceholder({ query, onChange }) {
  return (
    <div className="max-w-3xl mx-auto">
      <div className="group relative flex items-center gap-4 border border-white/10 hover:border-white/25 focus-within:border-paper focus-within:bg-ink-800 transition rounded-full bg-ink-850 px-5 sm:px-6 h-[64px] sm:h-[72px]">
        <MutedSearchIcon className="w-5 h-5 text-paper/50 group-focus-within:text-paper transition shrink-0" />
        <input
          type="text"
          value={query}
          onChange={e => onChange(e.target.value)}
          placeholder="아티스트, 공연, 페스티벌, 장소를 검색하세요"
          className="flex-1 bg-transparent outline-none text-paper text-[15px] sm:text-[17px] placeholder:text-dim"
        />
        <button className="hidden sm:inline-flex items-center gap-2 bg-paper text-ink-900 font-semibold text-[13px] tracking-[0.05em] uppercase px-5 h-[44px] rounded-full">
          검색 <ArrowIcon className="w-4 h-4" />
        </button>
      </div>
      <div className="mt-2 text-center text-[10px] tracking-[0.3em] uppercase text-dim">⌬ &lt;HomeSearchBar /&gt; (from codebase)</div>
    </div>
  );
}

function PosterCardPlaceholder({ s }) {
  return (
    <div className="block">
      <div className="ph aspect-[3/4] rounded-md" data-label={s.type}>
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
          <span>{s.city}</span>
          <span className="text-dim">·</span>
          <span className="truncate">{s.venue}</span>
        </div>
      </div>
    </div>
  );
}

// ───────────────────── Page-specific components ─────────────────────

function ResultsBar({ query, filter, setFilter, total }) {
  const tabs = [
    { id: 'all',      label: '전체',       count: total.all },
    { id: 'artist',   label: '아티스트',  count: total.artist },
    { id: 'show',     label: '공연',       count: total.show },
    { id: 'festival', label: '페스티벌',   count: total.festival },
  ];
  return (
    <div className="max-w-[1400px] mx-auto px-6 sm:px-10 mt-12 sm:mt-14">
      <div className="flex items-center gap-3 text-[11px] tracking-[0.3em] uppercase text-paper/50 mb-3">
        <span className="w-1.5 h-1.5 rounded-full bg-paper/60"></span>
        <span>SEARCH RESULTS</span>
      </div>
      <h1 className="text-paper text-[28px] sm:text-[40px] font-bold tracking-[-0.025em] leading-tight">
        <span className="text-paper/55">"</span>{query}<span className="text-paper/55">"</span>
        <span className="text-paper/45 text-[20px] sm:text-[28px] font-medium ml-3 tracking-[-0.01em]">
          결과 {total.all}건
        </span>
      </h1>

      <div className="mt-8 flex flex-wrap gap-1 hairline pb-4">
        {tabs.map(t => {
          const active = t.id === filter;
          return (
            <button
              key={t.id}
              onClick={() => setFilter(t.id)}
              className={
                'group inline-flex items-center gap-2 px-4 h-9 rounded-full transition border ' +
                (active
                  ? 'bg-paper text-ink-900 border-paper'
                  : 'text-paper/70 border-white/10 hover:border-white/30 hover:text-paper')
              }
            >
              <span className="text-[13px] tracking-[-0.01em] font-medium leading-none">{t.label}</span>
              <span className={
                'text-[11px] tabular-nums leading-none ' +
                (active ? 'text-ink-900/60' : 'text-paper/40')
              }>
                {t.count}
              </span>
            </button>
          );
        })}
        <div className="ml-auto flex items-center gap-3 text-[11px] tracking-[0.2em] uppercase text-paper/50 self-center">
          <span>정렬</span>
          <span className="text-paper">관련도</span>
          <span className="text-dim">·</span>
          <span className="hover:text-paper cursor-pointer">날짜 빠른순</span>
        </div>
      </div>
    </div>
  );
}

function ArtistRow({ artist }) {
  const followers = artist.followers >= 1000
    ? (artist.followers / 1000).toFixed(artist.followers >= 10000 ? 0 : 1) + 'K'
    : artist.followers;
  return (
    <a href="#" className="artist-row group block">
      <div className="flex items-center gap-5 sm:gap-6 py-5 sm:py-6 hairline">
        {/* avatar */}
        <div className="ph rounded-full shrink-0 overflow-hidden" data-label="" style={{width:72, height:72, padding:0}}>
          <img src={artist.img} alt={artist.name} className="absolute inset-0 w-full h-full object-cover opacity-90 group-hover:opacity-100 transition" />
        </div>

        {/* name + aliases */}
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-3 flex-wrap">
            <h3 className="artist-name text-paper text-[22px] sm:text-[26px] font-semibold tracking-[-0.02em] leading-none">
              {artist.name}
            </h3>
            <span className="text-paper/45 text-[13px] tracking-[-0.005em]">{artist.aliases}</span>
          </div>
        </div>

        {/* arrow */}
        <div className="hidden md:flex w-10 h-10 rounded-full border border-white/10 items-center justify-center text-paper/70 group-hover:border-white/30 group-hover:text-paper transition shrink-0">
          <ArrowIcon className="w-4 h-4 group-hover:translate-x-0.5 transition" />
        </div>
      </div>
    </a>
  );
}

function ArtistSection({ artists }) {
  if (!artists.length) return null;
  return (
    <section className="max-w-[1400px] mx-auto px-6 sm:px-10 mt-10 sm:mt-12">
      <div className="flex items-baseline justify-between mb-2">
        <div className="flex items-baseline gap-3">
          <h2 className="text-paper text-[18px] sm:text-[20px] font-semibold tracking-[-0.015em]">아티스트</h2>
          <span className="text-paper/40 text-[12px] tabular-nums">{artists.length}</span>
        </div>
        {artists.length > 2 && (
          <a href="#" className="text-[11px] tracking-[0.2em] uppercase text-paper/60 hover:text-paper transition flex items-center gap-2 group">
            전체 보기 <ArrowIcon className="w-3.5 h-3.5 group-hover:translate-x-1 transition" />
          </a>
        )}
      </div>
      <div className="hairline-t">
        {artists.map(a => <ArtistRow key={a.id} artist={a} />)}
      </div>
    </section>
  );
}

function PosterGrid({ items, title, kicker, count }) {
  if (!items.length) return null;
  return (
    <section className="max-w-[1400px] mx-auto px-6 sm:px-10 mt-16 sm:mt-20">
      <div className="flex items-end justify-between mb-10 hairline pb-6">
        <div>
          <div className="text-[11px] tracking-[0.3em] uppercase text-paper/45 mb-3">{kicker}</div>
          <div className="flex items-baseline gap-3">
            <h2 className="text-paper text-[28px] sm:text-[34px] font-bold tracking-[-0.025em] leading-tight">{title}</h2>
            <span className="text-paper/40 text-[14px] tabular-nums">{count}</span>
          </div>
        </div>
        <a href="#" className="hidden sm:inline-flex items-center gap-2 text-[12px] tracking-[0.18em] uppercase text-paper/70 hover:text-paper transition group">
          더 보기 <ArrowIcon className="w-4 h-4 group-hover:translate-x-1 transition" />
        </a>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-12">
        {items.map(s => <PosterCardPlaceholder key={s.id} s={s} />)}
      </div>
    </section>
  );
}

function EmptyState({ query }) {
  const suggestions = ['실리카겔', '새소년', 'hyukoh', '검정치마', '잔다리', '펜타포트'];
  return (
    <section className="max-w-[1400px] mx-auto px-6 sm:px-10 mt-16 sm:mt-24 pb-24">
      <div className="max-w-2xl mx-auto text-center py-16 sm:py-24">
        {/* big stylized empty mark */}
        <div className="inline-flex flex-col items-center mb-10">
          <div className="text-paper/15 logo-headliner text-[120px] sm:text-[160px] leading-none tracking-[-0.02em] select-none">
            0
          </div>
          <div className="mt-3 text-[11px] tracking-[0.4em] uppercase text-paper/40">NO RESULTS</div>
        </div>

        <h2 className="text-paper text-[26px] sm:text-[34px] font-bold tracking-[-0.025em]">
          <span className="text-paper/50">"</span>{query}<span className="text-paper/50">"</span>
          <span className="text-paper/60"> 에 대한 결과가 없어요.</span>
        </h2>

        <p className="mt-5 text-paper/55 text-[15px] leading-relaxed">
          철자를 확인하거나, 더 짧은 단어로 검색해보세요.<br className="hidden sm:block"/>
          공연·페스티벌·아티스트 이름, 장소 이름으로 찾을 수 있어요.
        </p>

        <div className="mt-12">
          <div className="text-[11px] tracking-[0.3em] uppercase text-paper/40 mb-4">자주 찾는 검색어</div>
          <div className="flex flex-wrap justify-center gap-2">
            {suggestions.map(s => (
              <button key={s} className="text-[13px] text-paper/80 border border-white/12 hover:border-white/30 hover:text-paper rounded-full px-3.5 h-9 transition">
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-12 flex flex-wrap justify-center gap-6 text-[12px] tracking-[0.18em] uppercase text-paper/55">
          <a href="#" className="hover:text-paper transition flex items-center gap-2 group">
            오늘의 공연 둘러보기 <ArrowIcon className="w-3.5 h-3.5 group-hover:translate-x-1 transition" />
          </a>
          <a href="#" className="hover:text-paper transition flex items-center gap-2 group">
            2026 페스티벌 라인업 <ArrowIcon className="w-3.5 h-3.5 group-hover:translate-x-1 transition" />
          </a>
        </div>
      </div>
    </section>
  );
}

// ───────────────────── App ─────────────────────
function App() {
  const [query, setQuery] = useState('실리카겔');
  const [filter, setFilter] = useState('all');
  const [demoMode, setDemoMode] = useState('with-results'); // or 'empty'

  // pretend the query maps to data
  const has = demoMode === 'with-results';
  const artists = has ? R.artists : [];
  const upcoming = has ? R.upcoming : [];
  const past = has ? R.past : [];

  const total = {
    artist:   artists.length,
    show:     upcoming.filter(s => s.type === 'SHOW').length + past.filter(s => s.type === 'SHOW').length,
    festival: upcoming.filter(s => s.type === 'FESTIVAL').length + past.filter(s => s.type === 'FESTIVAL').length,
    all:      artists.length + upcoming.length + past.length,
  };

  const filteredUpcoming = filter === 'all'
    ? upcoming
    : filter === 'show'     ? upcoming.filter(s => s.type === 'SHOW')
    : filter === 'festival' ? upcoming.filter(s => s.type === 'FESTIVAL')
    : [];
  const filteredPast = filter === 'all'
    ? past
    : filter === 'show'     ? past.filter(s => s.type === 'SHOW')
    : filter === 'festival' ? past.filter(s => s.type === 'FESTIVAL')
    : [];
  const showArtistSection = filter === 'all' || filter === 'artist';

  return (
    <div className="min-h-screen bg-ink-900 text-paper">
      <HeaderPlaceholder />

      {/* search bar zone — same vertical breathing room as home, but compact */}
      <section className="max-w-[1400px] mx-auto px-6 sm:px-10 pt-10 sm:pt-12">
        <SearchBarPlaceholder query={query} onChange={setQuery} />
      </section>

      {/* demo mode toggle (page-local; not part of the design) */}
      <div className="max-w-[1400px] mx-auto px-6 sm:px-10 mt-6 flex justify-center gap-2">
        <button
          onClick={() => setDemoMode('with-results')}
          className={'text-[11px] tracking-[0.2em] uppercase px-3 h-7 rounded-full border ' +
            (demoMode === 'with-results' ? 'bg-paper text-ink-900 border-paper' : 'text-paper/50 border-white/10 hover:text-paper hover:border-white/30')}
        >
          ✓ 결과 있음
        </button>
        <button
          onClick={() => setDemoMode('empty')}
          className={'text-[11px] tracking-[0.2em] uppercase px-3 h-7 rounded-full border ' +
            (demoMode === 'empty' ? 'bg-paper text-ink-900 border-paper' : 'text-paper/50 border-white/10 hover:text-paper hover:border-white/30')}
        >
          빈 상태
        </button>
        <span className="ml-2 self-center text-[10px] tracking-[0.22em] uppercase text-dim">
          (시안 미리보기용 토글 — 실제 페이지엔 없음)
        </span>
      </div>

      <main className="pb-24">
        {has ? (
          <>
            <ResultsBar query={query} filter={filter} setFilter={setFilter} total={total} />
            {showArtistSection && <ArtistSection artists={artists} />}
            <PosterGrid items={filteredUpcoming} kicker="UPCOMING / 2026" title="다가오는 공연" count={filteredUpcoming.length} />
            <PosterGrid items={filteredPast}     kicker="ARCHIVE"          title="지난 공연"      count={filteredPast.length} />
          </>
        ) : (
          <EmptyState query={query} />
        )}
      </main>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
