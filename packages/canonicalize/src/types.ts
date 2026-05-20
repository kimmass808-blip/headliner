export interface Canonicalized {
  key: string;     // dedup·lookup용 안정 key
  display: string; // 원본 보존 (UI 표시용)
}
