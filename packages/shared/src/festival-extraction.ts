import { z } from 'zod';

/**
 * 페스티벌 라인업 추출 결과 — LLM 출력 스키마
 * AC-4 (Festival + N Show 생성, Festival도 nullable startDate 허용 — v5)
 */
export const FestivalSetSchema = z.object({
  artistNames: z.array(z.string()).min(1).describe('이 set의 아티스트 (라인업의 한 entry)'),
  day: z
    .number()
    .int()
    .min(1)
    .max(7)
    .nullable()
    .optional()
    .describe('Day 1, Day 2 등 (없으면 null)'),
  stage: z.string().nullable().optional().describe('스테이지명 (e.g. Main, Sub)'),
  startTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .nullable()
    .optional(),
  setOrder: z.number().int().nullable().optional(),
});

export type FestivalSet = z.infer<typeof FestivalSetSchema>;

export const FestivalExtractionSchema = z.object({
  name: z.string().nullable().describe('페스티벌 이름'),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .describe('시작일 (없으면 null — v5에서 허용)'),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  locationText: z.string().nullable().optional(),
  officialUrl: z.string().url().nullable().optional(),
  ticketUrl: z.string().url().nullable().optional(),
  ticketOpenAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/, 'YYYY-MM-DD 또는 YYYY-MM-DDTHH:MM 형식')
    .nullable()
    .optional()
    .describe('예매 오픈 일시 (날짜만 또는 날짜+시각). 없으면 null'),
  posterImageUrl: z.string().url().nullable().optional(),
  description: z.string().nullable().optional(),
  sets: z.array(FestivalSetSchema).describe('라인업 set들. 빈 배열 가능'),
  mentionedHandles: z
    .array(z.string())
    .describe('게시물 본문에서 멘션된 @handle 목록 (snowball 시드 확장용)'),
});

export type FestivalExtraction = z.infer<typeof FestivalExtractionSchema>;

/**
 * Festival completeness (AC-4 v5)
 * = (name 있음 ? 1 : 0) + (startDate 있음 ? 1 : 0)
 * Range 0~2. needsReview = completeness < 2.
 */
export function computeFestivalCompleteness(extraction: FestivalExtraction): {
  completeness: 0 | 1 | 2;
  needsReview: boolean;
} {
  const hasName = !!extraction.name && extraction.name.trim().length > 0;
  const hasStartDate = !!extraction.startDate;
  const completeness = ((hasName ? 1 : 0) + (hasStartDate ? 1 : 0)) as 0 | 1 | 2;
  return { completeness, needsReview: completeness < 2 };
}
