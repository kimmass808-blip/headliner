/**
 * 관리자 영역(`/admin/*`) 로딩 스켈레톤.
 * 라이트 테마(zinc-50) 기준. 표/목록 자리를 회색 줄로 채운다.
 */
export default function Loading() {
  return (
    <div className="min-h-full bg-zinc-50 p-6 dark:bg-zinc-950">
      <div className="h-8 w-48 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
      <div className="mt-6 space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="h-12 w-full animate-pulse rounded bg-zinc-200 dark:bg-zinc-800"
          />
        ))}
      </div>
    </div>
  );
}
