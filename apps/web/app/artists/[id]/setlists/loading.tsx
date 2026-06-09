/** `/artists/[id]/setlists` 로딩 스켈레톤 (셋리스트 공연 1그리드). */
import { ArtistPageSkeleton } from '../../../../components/common/ArtistPageSkeleton';

export default function Loading() {
  return <ArtistPageSkeleton grids={1} />;
}
