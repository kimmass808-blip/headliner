/**
 * Artist 소개 (bio) — 문단별 분리해서 첫 문단만 살짝 크게.
 */

export function BioSection({ paragraphs }: { paragraphs: string[] }) {
  if (!paragraphs || paragraphs.length === 0) return null;
  return (
    <section className="mx-auto mt-20 max-w-[1400px] px-6 sm:mt-24 sm:px-10">
      <div className="hairline mb-8 pb-5">
        <div className="mb-2 text-[11px] uppercase tracking-[0.3em] text-paper/45">
          BIO
        </div>
        <h2 className="text-[24px] font-bold leading-tight tracking-[-0.025em] text-paper sm:text-[28px]">
          소개
        </h2>
      </div>
      <div className="max-w-3xl">
        {paragraphs.map((p, i) => (
          <p
            key={i}
            className={
              'leading-[1.7] ' +
              (i === 0
                ? 'text-[17px] text-paper/80 sm:text-[19px]'
                : 'mt-5 text-[15px] text-paper/70 sm:text-[16px]')
            }
          >
            {p}
          </p>
        ))}
      </div>
    </section>
  );
}
