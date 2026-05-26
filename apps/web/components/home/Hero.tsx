/**
 * 홈 히어로 — home.png 배경 + 그라디언트 스크림 + "당신의 심장이 / 뛰는 순간" 헤드라인.
 */

export function HomeHero() {
  return (
    <div className="relative aspect-[16/10] max-h-[720px] min-h-[420px] w-full overflow-hidden rounded-lg bg-ink-800 sm:aspect-[16/9] lg:aspect-[21/9]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/home.png"
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
        style={{ objectPosition: '50% 38%' }}
      />
      {/* 2겹 스크림 — 좌하단 텍스트 가독성 */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-black/85 via-black/40 to-black/10" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

      <div className="absolute bottom-6 left-5 right-5 sm:bottom-8 sm:left-7 lg:bottom-10 lg:left-10">
        <h1 className="hero-kr text-[8vw] leading-[1.0] text-paper sm:text-[42px] lg:text-[56px]">
          당신의 심장이
        </h1>
        <h1 className="hero-kr mt-0.5 text-[8vw] leading-[1.0] text-paper sm:text-[42px] lg:text-[56px]">
          뛰는 순간
        </h1>
      </div>
    </div>
  );
}
