/**
 * 홈 히어로 — home(AVIF/WebP) 배경 + 그라디언트 스크림 + "당신의 심장이 / 뛰는 순간" 헤드라인.
 */

export function HomeHero() {
  return (
    <div className="relative aspect-[16/10] max-h-[720px] min-h-[420px] w-full overflow-hidden rounded-lg bg-ink-800 sm:aspect-[16/9] lg:aspect-[21/9]">
      {/* above-the-fold 히어로 — AVIF/WebP 우선, PNG 폴백. 화면 폭에 따라 1280/1920 선택. */}
      <picture>
        <source
          type="image/avif"
          srcSet="/home-1280.avif 1280w, /home-1920.avif 1920w"
          sizes="100vw"
        />
        <source
          type="image/webp"
          srcSet="/home-1280.webp 1280w, /home-1920.webp 1920w"
          sizes="100vw"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/home-1920.webp"
          alt=""
          fetchPriority="high"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover"
          style={{ objectPosition: '50% 38%' }}
        />
      </picture>
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
