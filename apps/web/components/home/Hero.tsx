/**
 * 홈 히어로 — home(AVIF/WebP) 배경 + 그라디언트 스크림 + "당신의 심장이 / 뛰는 순간" 헤드라인.
 *
 * ⚠️ 원본 이미지(1920×1072, 비율 1.79) 우하단에 Gemini 워터마크(✦)가 있어 object-cover의
 *    세로 크롭으로 가린다. 세로 크롭은 컨테이너 비율 > 이미지 비율(1.79)일 때만 생기므로,
 *    모든 폭에서 비율을 그보다 넓게(21/10·21/9) 유지하고 min-height를 두지 않는다.
 *    (min-height가 있으면 좁은 폭에서 박스가 세로로 길어져 크롭이 풀리고 워터마크가 드러남.)
 *    object-position Y=38%로 하단을 더 잘라낸다.
 */

export function HomeHero() {
  return (
    <div className="relative aspect-[21/10] max-h-[720px] w-full overflow-hidden rounded-lg bg-ink-800 lg:aspect-[21/9]">
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
