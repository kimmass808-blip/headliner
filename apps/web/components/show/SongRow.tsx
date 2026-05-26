/**
 * 셋리스트 한 줄: 번호 + 제목 + (cover of XX) + (앙코르 뱃지).
 * 앙코르 번호는 'E1', 본편은 '01' zero-padded.
 */

export interface SongRowData {
  /** 본편/앙코르 각각 1부터 다시 번호 */
  n: number;
  title: string;
  cover?: string | null;
  encore?: boolean;
}

export function SongRow({ song }: { song: SongRowData }) {
  const numberLabel = song.encore ? `E${song.n}` : String(song.n).padStart(2, '0');
  return (
    <li className="group hairline grid grid-cols-[44px_1fr_auto] items-baseline gap-4 rounded-sm px-2 py-3.5 sm:px-3 sm:py-4">
      <span className="font-mono text-[13px] tabular-nums text-paper/45">
        {numberLabel}
      </span>
      <div className="min-w-0">
        <span className="text-[16px] tracking-[-0.005em] text-paper/85 transition group-hover:text-paper sm:text-[17px]">
          {song.title}
        </span>
        {song.cover ? (
          <span className="ml-3 text-[11px] tracking-[0.04em] text-paper/45">
            cover of <span className="text-paper/65">{song.cover}</span>
          </span>
        ) : null}
      </div>
      {song.encore ? (
        <span className="justify-self-end rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.22em] text-paper/45">
          앙코르
        </span>
      ) : null}
    </li>
  );
}
