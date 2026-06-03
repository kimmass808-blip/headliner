// Admin console view models. Server loaders shape Prisma rows into these so the
// client screens stay close to the design handoff; the EditDrawer produces the
// same shape back, and server actions map it to Prisma writes.

export type ReviewStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface SessionVM {
  /** YYYY.MM.DD */
  date: string;
  /** weekday abbrev (SAT/SUN…) — derived for display, recomputed on save */
  day: string;
}

export interface ShowVM {
  id: string;
  type: 'SHOW';
  status: ReviewStatus;
  title: string;
  artists: string[];
  venue: string;
  city: string;
  sessions: SessionVM[];
  festival: string | null;
  festivalId: string | null;
  poster: string | null;
  igHandle: string | null;
  igUrl: string;
  dupOf: string | null;
  completeness: number;
  rejectReason?: string | null;
}

export interface FestivalVM {
  id: string;
  type: 'FESTIVAL';
  status: ReviewStatus;
  name: string;
  /** YYYY.MM.DD */
  startDate: string;
  /** YYYY.MM.DD | '' */
  endDate: string;
  location: string;
  city: string;
  linkedShows: number;
  poster: string | null;
  igHandle: string | null;
  igUrl: string;
  missing: string[];
  dupOf: string | null;
  completeness: number;
  rejectReason?: string | null;
}

export type FestivalInfoCategory =
  | 'MAP'
  | 'TIMETABLE'
  | 'ACCESS'
  | 'RULES'
  | 'FAQ'
  | 'GOODS'
  | 'AMENITY'
  | 'TICKET'
  | 'PROMO'
  | 'NOTICE';

export interface FestivalInfoVM {
  id: string;
  type: 'FESTIVAL_INFO';
  status: ReviewStatus;
  festivalName: string;
  category: FestivalInfoCategory;
  title: string;
  imageUrls: string[];
  sourcePostUrl: string;
  postedAt: string;
  completeness?: number;
  rejectReason?: string;
}

// ItemVM은 EditDrawer/키보드 내비게이션이 다루는 Show/Festival 한정 유니온.
// FestivalInfo는 카테고리 보정만 필요하므로 별도 리스트로 취급한다.
export type ItemVM = ShowVM | FestivalVM;

export interface FestivalOption {
  id: string;
  name: string;
}

export interface CrawlRunVM {
  id: string;
  source: string;
  startedAt: string;
  duration: string;
  status: 'success' | 'partial' | 'failed' | 'running';
  found: number;
  created: number;
  note?: string;
}
