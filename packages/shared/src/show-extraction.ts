import { z } from 'zod';

/**
 * 단독공연 추출 결과 — LLM 출력 스키마
 * AC-3, AC-3b (Model A — 1필드 컷오프, partial Show 허용)
 *
 * 모든 필드 nullable: LLM이 추출 실패한 필드는 null로 표기.
 * 호출 측에서 completeness 계산 (date·venue·artists≥1 → 0~3).
 */
export const ShowExtractionSchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD 형식')
    .nullable()
    .describe('공연 날짜 (없으면 null)'),
  startTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, 'HH:MM 형식')
    .nullable()
    .optional()
    .describe('시작 시간 (없으면 null)'),
  venueText: z
    .string()
    .nullable()
    .describe('공연장 원문 텍스트 (canonicalize 미적용 상태)'),
  artistNames: z
    .array(z.string())
    .describe('아티스트명 배열 (canonicalize 미적용). 빈 배열 가능'),
  title: z.string().nullable().optional().describe('공연 제목 (있으면)'),
  ticketUrl: z.string().url().nullable().optional(),
  ticketOpenAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/, 'YYYY-MM-DD 또는 YYYY-MM-DDTHH:MM 형식')
    .nullable()
    .optional()
    .describe('예매 오픈 일시 (날짜만 또는 날짜+시각). 없으면 null'),
  imageUrl: z.string().url().nullable().optional(),
});

export type ShowExtraction = z.infer<typeof ShowExtractionSchema>;

/**
 * completeness 계산 (AC-3b)
 * = (date 있음 ? 1 : 0) + (venueText 있음 ? 1 : 0) + (artistNames.length >= 1 ? 1 : 0)
 *
 * V1 trade-off: artistNames cardinality collapse — 1/50 라인업과 1/1 단독공연이 같은 점수.
 * V2 follow-up: artistsExpected + artistsCompletenessRatio 도입.
 */
export function computeShowCompleteness(extraction: ShowExtraction): {
  completeness: 0 | 1 | 2 | 3;
  missingFields: Array<'date' | 'venue' | 'artists'>;
} {
  const hasDate = !!extraction.date;
  const hasVenue = !!extraction.venueText && extraction.venueText.trim().length > 0;
  const hasArtists = extraction.artistNames.length >= 1;

  const missingFields: Array<'date' | 'venue' | 'artists'> = [];
  if (!hasDate) missingFields.push('date');
  if (!hasVenue) missingFields.push('venue');
  if (!hasArtists) missingFields.push('artists');

  const completeness = ((hasDate ? 1 : 0) + (hasVenue ? 1 : 0) + (hasArtists ? 1 : 0)) as
    | 0
    | 1
    | 2
    | 3;

  return { completeness, missingFields };
}
