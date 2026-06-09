'use client';

// Admin console shell — sidebar nav + route mapping + theme toggle + toast.
// Ported from the design handoff's <App>, but screen-state routing is replaced
// by real App Router routes (usePathname drives the active nav item). The dark
// class is toggled on <html> only while the console is mounted so the public
// site theme is untouched; preference persists in localStorage.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from './Icon';

const ToastContext = createContext<(msg: string) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

function NavItem({
  href,
  icon,
  label,
  active,
  badge,
}: {
  href: string;
  icon: string;
  label: string;
  active: boolean;
  badge?: number;
}) {
  return (
    <Link
      href={href}
      className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition ${
        active ? 'bg-zinc-100 text-zinc-900' : 'text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800'
      }`}
    >
      <span className={active ? 'text-blue-600' : 'text-zinc-400'}>
        <Icon name={icon} size={17} />
      </span>
      <span className="flex-1 text-left">{label}</span>
      {badge != null && badge > 0 && (
        <span
          className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
            active ? 'bg-blue-600 text-white' : 'bg-amber-100 text-amber-700'
          }`}
        >
          {badge}
        </span>
      )}
    </Link>
  );
}

function Toast({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return (
    <div className="pointer-events-none fixed bottom-5 left-1/2 z-[60] -translate-x-1/2">
      <div className="flex items-center gap-2 rounded-lg bg-zinc-900 px-3.5 py-2 text-[13px] font-medium text-white shadow-lg">
        <Icon name="check" size={15} className="text-emerald-400" strokeWidth={2.2} />
        {msg}
      </div>
    </div>
  );
}

export function AdminShell({
  children,
  pendingCount = 0,
}: {
  children: ReactNode;
  pendingCount?: number;
}) {
  const pathname = usePathname();
  const isLogin = pathname === '/admin/login';

  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToastMsg(null), 2400);
  }, []);

  const [dark, setDark] = useState(true);
  useEffect(() => {
    const stored = localStorage.getItem('hl-admin-theme');
    const next = stored ? stored === 'dark' : true;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    return () => document.documentElement.classList.remove('dark');
  }, []);

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('hl-admin-theme', next ? 'dark' : 'light');
  };

  // Login screen renders bare — no sidebar chrome.
  if (isLogin) return <>{children}</>;

  const navActive = (href: string) =>
    href === '/admin' ? pathname === '/admin' : pathname.startsWith(href);

  return (
    <ToastContext.Provider value={toast}>
      <div className="flex h-screen w-screen overflow-hidden bg-zinc-50 text-zinc-900 dark:bg-zinc-950">
        <nav className="flex w-[224px] shrink-0 flex-col border-r border-zinc-200 bg-white">
          <div className="flex h-14 items-center gap-2 border-b border-zinc-200 px-4">
            <span className="font-display text-[20px] font-black tracking-tight text-zinc-900">HEADLINER</span>
            <span className="rounded bg-zinc-900 px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-white dark:bg-zinc-100 dark:text-zinc-900">
              ADMIN
            </span>
          </div>
          <div className="flex-1 space-y-0.5 p-2.5">
            <p className="px-2.5 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">운영</p>
            <NavItem href="/admin" icon="dashboard" label="대시보드" active={navActive('/admin')} />
            <NavItem
              href="/admin/review"
              icon="inbox"
              label="검수 큐"
              active={navActive('/admin/review')}
              badge={pendingCount}
            />
            <NavItem href="/admin/data" icon="table" label="데이터 관리" active={navActive('/admin/data')} />
            <NavItem href="/admin/ingest" icon="refresh" label="적재 대기열" active={navActive('/admin/ingest')} />
          </div>
          <div className="border-t border-zinc-200 p-3">
            <button
              onClick={toggleTheme}
              className="mb-2 flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium text-zinc-500 transition hover:bg-zinc-50 hover:text-zinc-800"
            >
              <span className="text-zinc-400">
                <Icon name={dark ? 'sun' : 'moon'} size={17} />
              </span>
              <span className="flex-1 text-left">{dark ? '라이트 모드' : '다크 모드'}</span>
              <span className="flex h-4 w-7 items-center rounded-full bg-zinc-200 px-0.5 transition dark:bg-blue-600">
                <span className={`h-3 w-3 rounded-full bg-white shadow transition ${dark ? 'translate-x-3' : ''}`} />
              </span>
            </button>
            <div className="flex items-center gap-2 px-1">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-900 text-[11px] font-bold text-white dark:bg-zinc-100 dark:text-zinc-900">
                운
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12px] font-medium text-zinc-700">운영자</div>
                <div className="truncate text-[10px] text-zinc-400">editor@headliner.kr</div>
              </div>
            </div>
          </div>
        </nav>

        <main className="flex min-w-0 flex-1 flex-col">{children}</main>

        <Toast msg={toastMsg} />
      </div>
    </ToastContext.Provider>
  );
}
