/**
 * 공연 정보 없을 때 표시 — 점선 박스 + 안내문.
 */

export function NoShowsState() {
  return (
    <section className="mx-auto mt-20 max-w-[1400px] px-6 sm:mt-24 sm:px-10">
      <div className="hairline mb-10 pb-6">
        <div className="mb-3 text-[11px] uppercase tracking-[0.3em] text-paper/45">
          SHOWS
        </div>
        <h2 className="text-[26px] font-bold leading-tight tracking-[-0.025em] text-paper sm:text-[32px]">
          공연
        </h2>
      </div>
      <div className="mx-auto max-w-2xl rounded-md border border-dashed border-white/10 py-16 text-center">
        <div className="text-[14px] text-paper/40">등록된 공연 정보가 없습니다.</div>
        <div className="mt-2 text-[12px] text-paper/30">
          새 공연이 확인되면 자동으로 이 페이지에 추가됩니다.
        </div>
      </div>
    </section>
  );
}
