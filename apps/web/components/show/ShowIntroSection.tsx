/**
 * 공연 소개 섹션 — 공연 상세에서 셋리스트 위에 표시.
 * 인스타 게시글 원문 발췌(rawTextExcerpt)를 공연 소개 텍스트로 보여준다.
 * text가 비어있으면 섹션 자체를 렌더하지 않음. 디자인: SetlistSection 톤과 동일.
 */

export function ShowIntroSection({ text }: { text: string | null }) {
  const body = text?.trim();
  if (!body) return null;

  return (
    <section className="mx-auto mt-20 max-w-[1400px] px-6 sm:mt-28 sm:px-10">
      <div className="hairline mb-8 flex items-end justify-between pb-6">
        <div>
          <div className="mb-3 text-[11px] uppercase tracking-[0.3em] text-paper/45">
            INTRO
          </div>
          <h2 className="text-[28px] font-bold leading-tight tracking-[-0.025em] text-paper sm:text-[34px]">
            공연 소개
          </h2>
        </div>
      </div>

      <p className="max-w-3xl whitespace-pre-line text-[15px] leading-relaxed text-paper/75">
        {body}
      </p>
    </section>
  );
}
