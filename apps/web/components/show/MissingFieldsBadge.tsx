/**
 * 누락된 필드 표시 — 점선 outline pill. completeness<3 Show에서 사용.
 */

const LABELS: Record<string, string> = {
  time: '시작 시간',
  startTime: '시작 시간',
  date: '날짜',
  venue: '장소',
  city: '지역',
  artist: '아티스트',
  artists: '아티스트',
  ticket: '예매',
  poster: '포스터',
};

export function MissingFieldsBadge({ missing }: { missing: string[] }) {
  if (!missing || missing.length === 0) return null;
  return (
    <div className="mt-6 inline-flex h-7 items-center gap-2 rounded-full border border-dashed border-white/15 px-3 text-[11px] tracking-[0.12em] text-paper/55">
      <span className="text-paper/40">·</span>
      누락:&nbsp;{missing.map((m) => LABELS[m] ?? m).join(', ')}
    </div>
  );
}
