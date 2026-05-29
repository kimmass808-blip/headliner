'use client';

// Admin console shared UI primitives. Ported 1:1 from the design handoff.
import {
  useEffect,
  useRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react';
import { Icon } from './Icon';
import type { ReviewStatus } from './types';

export function StatusBadge({ status }: { status: ReviewStatus }) {
  const map: Record<ReviewStatus, string> = {
    PENDING: 'bg-amber-50 text-amber-700 ring-amber-600/20',
    APPROVED: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
    REJECTED: 'bg-red-50 text-red-700 ring-red-600/20',
  };
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wider ring-1 ring-inset ${map[status]}`}
    >
      {status}
    </span>
  );
}

export function TypeBadge({ type }: { type: 'SHOW' | 'FESTIVAL' }) {
  const isFest = type === 'FESTIVAL';
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wider ${
        isFest
          ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
          : 'bg-zinc-100 text-zinc-600 ring-1 ring-inset ring-zinc-200'
      }`}
    >
      {type}
    </span>
  );
}

export function CompletenessDots({ value, size = 'sm' }: { value: number; size?: 'sm' | 'md' }) {
  const dot = size === 'sm' ? 'h-1.5 w-1.5' : 'h-2 w-2';
  const color = value >= 3 ? 'bg-emerald-500' : value === 2 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <span className="inline-flex items-center gap-1" title={`완성도 ${value}/3`}>
      {[0, 1, 2].map((i) => (
        <span key={i} className={`${dot} rounded-full ${i < value ? color : 'bg-zinc-200'}`} />
      ))}
    </span>
  );
}

export function MissingPills({ fields }: { fields?: string[] }) {
  if (!fields || !fields.length) return null;
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {fields.map((f) => (
        <span
          key={f}
          className="inline-flex items-center gap-0.5 rounded bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20"
        >
          <Icon name="alert" size={10} strokeWidth={2} />
          {f}
        </span>
      ))}
    </span>
  );
}

export function Poster({
  src,
  alt,
  className = '',
  label = 'NO IMAGE',
}: {
  src?: string | null;
  alt?: string;
  className?: string;
  label?: string;
}) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt || ''} className={`object-cover bg-zinc-100 ${className}`} loading="lazy" />;
  }
  return (
    <div
      className={`flex items-center justify-center bg-zinc-100 text-zinc-400 ${className}`}
      style={{
        backgroundImage:
          'repeating-linear-gradient(45deg, transparent, transparent 6px, rgba(0,0,0,0.035) 6px, rgba(0,0,0,0.035) 12px)',
      }}
    >
      <span className="font-mono text-[9px] tracking-wider">{label}</span>
    </div>
  );
}

type ButtonVariant = 'primary' | 'default' | 'approve' | 'approveGhost' | 'danger' | 'ghost';

export function Button({
  variant = 'default',
  size = 'md',
  children,
  className = '',
  icon,
  ...rest
}: {
  variant?: ButtonVariant;
  size?: 'sm' | 'md';
  children?: ReactNode;
  icon?: string;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  const base =
    'inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1';
  const sizes = { sm: 'h-7 px-2.5 text-[12px]', md: 'h-9 px-3.5 text-[13px]' };
  const variants: Record<ButtonVariant, string> = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 focus-visible:ring-blue-600',
    default:
      'bg-white text-zinc-700 ring-1 ring-inset ring-zinc-200 hover:bg-zinc-50 hover:text-zinc-900 focus-visible:ring-zinc-400',
    approve: 'bg-emerald-600 text-white hover:bg-emerald-700 focus-visible:ring-emerald-600',
    approveGhost:
      'text-emerald-700 ring-1 ring-inset ring-emerald-600/20 bg-emerald-50/50 hover:bg-emerald-50 focus-visible:ring-emerald-600',
    danger: 'text-red-700 ring-1 ring-inset ring-red-600/20 bg-red-50/40 hover:bg-red-50 focus-visible:ring-red-600',
    ghost: 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 focus-visible:ring-zinc-400',
  };
  return (
    <button className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} {...rest}>
      {icon && <Icon name={icon} size={size === 'sm' ? 13 : 15} />}
      {children}
    </button>
  );
}

type IconButtonVariant = 'ghost' | 'approve' | 'danger' | 'blue';

export function IconButton({
  icon,
  title,
  variant = 'ghost',
  onClick,
  size = 15,
}: {
  icon: string;
  title: string;
  variant?: IconButtonVariant;
  onClick?: () => void;
  size?: number;
}) {
  const variants: Record<IconButtonVariant, string> = {
    ghost: 'text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700',
    approve: 'text-emerald-600 hover:bg-emerald-50',
    danger: 'text-red-500 hover:bg-red-50',
    blue: 'text-blue-600 hover:bg-blue-50',
  };
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${variants[variant]}`}
    >
      <Icon name={icon} size={size} />
    </button>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-[20px] items-center justify-center rounded border border-zinc-300 bg-zinc-50 px-1.5 font-mono text-[10px] font-medium text-zinc-500 shadow-[0_1px_0_rgba(0,0,0,0.04)]">
      {children}
    </kbd>
  );
}

export function Field({
  label,
  hint,
  children,
  missing,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  missing?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
        {label}
        {missing && <Icon name="alert" size={11} className="text-amber-500" strokeWidth={2} />}
        {hint && <span className="font-normal normal-case tracking-normal text-zinc-400">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

export const inputCls =
  'w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-[13px] text-zinc-900 placeholder:text-zinc-400 transition focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/15';

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputCls} ${props.className || ''}`} />;
}

export function EmptyState({
  icon = 'check',
  title,
  body,
}: {
  icon?: string;
  title: string;
  body?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 text-zinc-400">
        <Icon name={icon} size={22} />
      </div>
      <p className="text-[14px] font-semibold text-zinc-700">{title}</p>
      {body && <p className="mt-1 max-w-xs text-[13px] text-zinc-400">{body}</p>}
    </div>
  );
}

export function Checkbox({
  checked,
  indeterminate,
  onChange,
  title,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: (next: boolean) => void;
  title?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    // visual-only indeterminate state handled via render below
  }, [indeterminate, checked]);
  return (
    <span
      ref={ref}
      role="checkbox"
      aria-checked={indeterminate ? 'mixed' : checked}
      title={title}
      tabIndex={0}
      onClick={(e) => {
        e.stopPropagation();
        onChange(!checked);
      }}
      onKeyDown={(e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          e.stopPropagation();
          onChange(!checked);
        }
      }}
      className={`flex h-[18px] w-[18px] shrink-0 cursor-pointer items-center justify-center rounded-[5px] border transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
        checked || indeterminate
          ? 'border-blue-600 bg-blue-600 text-white'
          : 'border-zinc-300 bg-white hover:border-zinc-400 dark:bg-zinc-900'
      }`}
    >
      {checked && <Icon name="check" size={12} strokeWidth={3} />}
      {indeterminate && !checked && <span className="h-0.5 w-2 rounded-full bg-white" />}
    </span>
  );
}
