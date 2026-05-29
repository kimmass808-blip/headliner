import { prisma } from '@mft/db';
import { AdminShell } from '../../components/admin/AdminShell';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const [pendingShows, pendingFestivals] = await Promise.all([
    prisma.show.count({ where: { status: 'PENDING' } }),
    prisma.festival.count({ where: { status: 'PENDING' } }),
  ]);
  return <AdminShell pendingCount={pendingShows + pendingFestivals}>{children}</AdminShell>;
}
