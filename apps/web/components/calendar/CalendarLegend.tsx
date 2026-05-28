/**
 * 캘린더 하단 범례 — SHOW / FEST / 투어 / 오늘 dot.
 */

export function CalendarLegend() {
  return (
    <div className="mt-8 flex flex-wrap items-center gap-6 text-[10px] uppercase tracking-[0.22em] text-paper/45">
      <span className="inline-flex items-center gap-2">
        <span
          className="inline-block bg-white/[0.08] px-1.5 py-0.5 text-[9px] text-paper"
          style={{ borderRadius: 2 }}
        >
          SHOW
        </span>
        단독공연
      </span>
      <span className="inline-flex items-center gap-2">
        <span
          className="inline-block border border-paper/40 px-1.5 py-0.5 text-[9px] text-paper"
          style={{ borderRadius: 2 }}
        >
          FEST
        </span>
        페스티벌 — 다일 가로 span
      </span>
      <span className="inline-flex items-center gap-2">
        <span
          className="px-1.5 py-0.5 text-[9px] uppercase tracking-[0.12em] text-paper/55"
          style={{ boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.10)', borderRadius: 2 }}
        >
          1/3
        </span>
        투어 (도시 N개)
      </span>
      <span className="inline-flex items-center gap-2">
        <span
          className="inline-block h-1.5 w-1.5 rounded-full bg-lime"
          style={{ boxShadow: '0 0 0 2px rgba(212,255,77,0.18)' }}
        />
        오늘
      </span>
    </div>
  );
}
