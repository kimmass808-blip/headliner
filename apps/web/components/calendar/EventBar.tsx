/**
 * 한 주의 한 lane에 그려지는 이벤트 바.
 * SHOW = 채움 / FESTIVAL = 아웃라인. 다일·투어·잘림 라벨 포함.
 */

import Link from 'next/link';
import type { WeekBlock } from '../../lib/calendar';

export interface EventBarProps {
  weekBlock: WeekBlock;
  /** 절대 위치 props — 상위 grid에서 계산해 주입 */
  style: React.CSSProperties;
}

export function EventBar({ weekBlock, style }: EventBarProps) {
  const { block, seg } = weekBlock;
  const ev = block.event;
  const isFestival = ev.kind === 'FESTIVAL';
  const isMultiDay = block.span > 1;
  const href = ev.kind === 'FESTIVAL' ? `/festivals/${ev.id}` : `/shows/${ev.id}`;

  return (
    <Link href={href} className="absolute group cursor-pointer" style={style}>
      <div
        className={
          'flex h-full w-full items-center gap-1.5 px-2 transition ' +
          (isFestival
            ? 'border border-paper/40 bg-black/20 text-paper group-hover:border-paper/80'
            : 'bg-white/[0.08] text-paper group-hover:bg-white/[0.14]')
        }
        style={{
          borderTopLeftRadius: seg.leftClipped ? 0 : 3,
          borderBottomLeftRadius: seg.leftClipped ? 0 : 3,
          borderTopRightRadius: seg.rightClipped ? 0 : 3,
          borderBottomRightRadius: seg.rightClipped ? 0 : 3,
        }}
      >
        <span
          className={
            'inline-block h-1 w-1 shrink-0 ' +
            (isFestival ? 'bg-paper/80' : 'bg-paper/60')
          }
          style={{ borderRadius: 1 }}
        />
        <span className="truncate text-[11px] font-medium leading-none">
          {ev.primaryName}
        </span>
        {isMultiDay && !seg.leftClipped ? (
          <span className="shrink-0 text-[9px] uppercase leading-none tracking-[0.12em] text-paper/55">
            {block.span}일
          </span>
        ) : null}
        {block.seq && !seg.leftClipped ? (
          <span className="shrink-0 text-[9px] uppercase leading-none tracking-[0.12em] text-paper/55">
            {block.seq.i}/{block.seq.total}
          </span>
        ) : null}
        {seg.leftClipped ? (
          <span className="shrink-0 text-[9px] uppercase leading-none tracking-[0.12em] text-paper/40">
            ...
          </span>
        ) : null}
      </div>
    </Link>
  );
}
