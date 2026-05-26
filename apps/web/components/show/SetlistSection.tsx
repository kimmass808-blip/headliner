/**
 * 셋리스트 섹션 — 본편 ol + 앙코르 디바이더 + 앙코르 ol. 빈 상태는 점선 박스.
 */

import { SongRow, type SongRowData } from './SongRow';

export function SetlistSection({ songs }: { songs: SongRowData[] }) {
  if (!songs || songs.length === 0) {
    return (
      <section className="mx-auto mt-20 max-w-[1400px] px-6 pb-24 sm:mt-28 sm:px-10">
        <div className="hairline mb-10 pb-6">
          <div className="mb-3 text-[11px] uppercase tracking-[0.3em] text-paper/45">
            SETLIST
          </div>
          <h2 className="text-[28px] font-bold leading-tight tracking-[-0.025em] text-paper sm:text-[34px]">
            셋리스트
          </h2>
        </div>
        <div className="rounded-md border border-dashed border-white/10 py-16 text-center">
          <div className="text-[14px] text-paper/40">셋리스트 미등록</div>
          <div className="mt-2 text-[12px] text-paper/30">
            공연이 끝난 뒤 사용자 또는 큐레이터에 의해 등록됩니다.
          </div>
        </div>
      </section>
    );
  }

  const main = songs.filter((s) => !s.encore);
  const encore = songs.filter((s) => s.encore);
  const total = songs.length;

  return (
    <section className="mx-auto mt-20 max-w-[1400px] px-6 pb-24 sm:mt-28 sm:px-10">
      <div className="hairline mb-8 flex items-end justify-between pb-6">
        <div>
          <div className="mb-3 text-[11px] uppercase tracking-[0.3em] text-paper/45">
            SETLIST
          </div>
          <div className="flex items-baseline gap-3">
            <h2 className="text-[28px] font-bold leading-tight tracking-[-0.025em] text-paper sm:text-[34px]">
              셋리스트
            </h2>
            <span className="text-[14px] tabular-nums text-paper/40">{total}곡</span>
          </div>
        </div>
        {encore.length > 0 ? (
          <div className="hidden text-[11px] uppercase tracking-[0.2em] text-paper/45 sm:block">
            앙코르 {encore.length}곡 포함
          </div>
        ) : null}
      </div>

      <ol className="max-w-3xl">
        {main.map((s) => (
          <SongRow key={`m-${s.n}`} song={s} />
        ))}
      </ol>

      {encore.length > 0 ? (
        <>
          <div className="mb-2 mt-10 flex max-w-3xl items-center gap-4">
            <span className="text-[11px] uppercase tracking-[0.4em] text-paper/55">
              ENCORE
            </span>
            <span className="h-px flex-1 bg-white/10" />
            <span className="text-[11px] tabular-nums text-paper/40">
              {encore.length}곡
            </span>
          </div>
          <ol className="max-w-3xl">
            {encore.map((s) => (
              <SongRow key={`e-${s.n}`} song={s} />
            ))}
          </ol>
        </>
      ) : null}
    </section>
  );
}
