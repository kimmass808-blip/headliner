/** `/artists/[id]` 상세 로딩 스켈레톤 (다가오는·지난 공연 2그리드). */
import { ArtistPageSkeleton } from '../../../components/common/ArtistPageSkeleton';

export default function Loading() {
  return <ArtistPageSkeleton grids={2} />;
}
