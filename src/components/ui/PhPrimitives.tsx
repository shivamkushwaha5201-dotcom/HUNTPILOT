import React, { useState } from 'react';
import { motion } from 'motion/react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

/**
 * HuntPilot AI Logo Mark
 * Independent launch-navigation monogram using HuntPilot's primary coral-orange (#FF6154).
 */
export function HuntPilotLogo({
  size = 'md',
  showSubtitle = false,
}: {
  size?: 'sm' | 'md' | 'lg';
  showSubtitle?: boolean;
}) {
  const boxClass =
    size === 'sm'
      ? 'w-7 h-7 rounded-lg'
      : size === 'lg'
      ? 'w-10 h-10 rounded-xl'
      : 'w-8 h-8 rounded-lg';

  const textClass =
    size === 'sm'
      ? 'text-base'
      : size === 'lg'
      ? 'text-xl'
      : 'text-[17px]';

  return (
    <span className="inline-flex items-center gap-2.5 select-none">
      <span
        className={`${boxClass} bg-[#FF6154] text-white flex items-center justify-center shrink-0 shadow-[0_1px_2px_rgba(255,97,84,0.25)]`}
        aria-hidden="true"
      >
        <svg
          viewBox="0 0 24 24"
          className={size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-5 h-5' : 'w-[18px] h-[18px]'}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 17V7" />
          <path d="M18 17V7" />
          <path d="M6 12h12" />
          <path d="M12 4l2.5 3h-5L12 4z" fill="currentColor" stroke="none" />
        </svg>
      </span>
      <span className="flex flex-col leading-none">
        <span className={`${textClass} font-bold tracking-tight text-[#202020] whitespace-nowrap`}>
          HuntPilot AI
        </span>
        {showSubtitle && (
          <span className="text-[11px] font-medium text-[#777777] mt-0.5 whitespace-nowrap">
            Launch Workspace
          </span>
        )}
      </span>
    </span>
  );
}

/**
 * Product Hunt-inspired Vote / Points Counter Box
 */
export function PhVoteBox({
  points,
  hiddenLabel = 'Hidden',
  onClick,
  active = false,
  compact = false,
}: {
  points: number | null;
  hiddenLabel?: string;
  onClick?: () => void;
  active?: boolean;
  compact?: boolean;
}) {
  const baseClass = `inline-flex flex-col items-center justify-center rounded-lg border transition-colors tabular-nums shrink-0 ${
    compact ? 'min-w-[46px] px-2 py-1.5' : 'min-w-[54px] px-2.5 py-2'
  } ${
    active
      ? 'border-[#FF6154] bg-[#FFF1F0] text-[#FF6154]'
      : 'border-[#EAEAEA] bg-white hover:border-[#FF6154] text-[#202020]'
  }`;

  const content = (
    <>
      <span
        className={`text-[10px] leading-none ${
          active || points !== null ? 'text-[#FF6154]' : 'text-[#999999]'
        }`}
        aria-hidden="true"
      >
        ▲
      </span>
      <span
        className={`mt-1 font-mono font-bold leading-none ${
          points === null ? 'text-[10px] text-[#777777]' : compact ? 'text-xs' : 'text-[13px]'
        }`}
      >
        {points !== null ? points.toLocaleString() : hiddenLabel}
      </span>
    </>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`${baseClass} cursor-pointer`}>
        {content}
      </button>
    );
  }
  return <div className={baseClass}>{content}</div>;
}

/**
 * Product Thumbnail with clean styled monogram fallback (zero broken images).
 */
export function PhProductThumbnail({
  src,
  name,
  size = 'md',
}: {
  src?: string | null;
  name: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const [failed, setFailed] = useState(false);
  const dim =
    size === 'sm' ? 'w-9 h-9 rounded-lg text-xs' : size === 'lg' ? 'w-14 h-14 rounded-xl text-base' : 'w-11 h-11 rounded-xl text-sm';

  const initial = (name.trim()[0] || 'P').toUpperCase();

  if (!src || failed) {
    return (
      <div
        className={`${dim} bg-[#FFF1F0] border border-[#FFD6D2] text-[#FF6154] font-bold flex items-center justify-center shrink-0 select-none`}
        aria-hidden="true"
      >
        {initial}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={name}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`${dim} object-cover border border-[#EAEAEA] bg-[#F7F7F7] shrink-0`}
    />
  );
}

/**
 * Clean Surface Card with Product Hunt's 1px #EAEAEA border
 */
export function PhCard({
  children,
  className = '',
  padding = 'p-6',
  hoverable = false,
}: {
  children: React.ReactNode;
  className?: string;
  padding?: string;
  hoverable?: boolean;
}) {
  return (
    <div
      className={`bg-white border border-[#EAEAEA] rounded-xl ${padding} ${
        hoverable ? 'transition-colors duration-150 hover:border-[#D4D4D4]' : ''
      } ${className}`}
    >
      {children}
    </div>
  );
}

/**
 * Subtle Entrance Container for tab/page switches
 */
export function PhPageSection({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/**
 * Clean Status Banner (Error / Success / Info / Warning)
 */
export function PhBanner({
  tone,
  children,
  className = '',
}: {
  tone: 'error' | 'success' | 'warning' | 'info';
  children: React.ReactNode;
  className?: string;
}) {
  const styles =
    tone === 'error'
      ? 'bg-[#FEF2F2] border-[#FECACA] text-[#B91C1C]'
      : tone === 'success'
      ? 'bg-[#F0FDF4] border-[#BBF7D0] text-[#15803D]'
      : tone === 'warning'
      ? 'bg-[#FFFBEB] border-[#FDE68A] text-[#92400E]'
      : 'bg-[#F7F7F7] border-[#EAEAEA] text-[#444444]';

  const Icon = tone === 'success' ? CheckCircle2 : tone === 'info' ? Info : AlertCircle;
  const iconColor =
    tone === 'error'
      ? 'text-[#DC2626]'
      : tone === 'success'
      ? 'text-[#16A34A]'
      : tone === 'warning'
      ? 'text-[#D97706]'
      : 'text-[#FF6154]';

  return (
    <div className={`border rounded-xl px-4 py-3 text-xs flex items-start gap-2.5 ${styles} ${className}`}>
      <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${iconColor}`} />
      <div className="min-w-0 flex-1 leading-relaxed">{children}</div>
    </div>
  );
}

/**
 * Clean Empty State Card
 */
export function PhEmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="py-10 px-6 text-center border border-dashed border-[#DCDCDC] rounded-xl bg-[#FAFAFA]">
      <div className="w-10 h-10 rounded-xl bg-white border border-[#EAEAEA] text-[#777777] flex items-center justify-center mx-auto mb-3">
        {icon}
      </div>
      <p className="text-sm font-semibold text-[#202020] mb-1">{title}</p>
      <p className="text-xs text-[#777777] max-w-sm mx-auto leading-relaxed">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/**
 * Skeleton Loading Block
 */
export function PhSkeletonRows({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading content">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center justify-between gap-4 p-3.5 rounded-xl border border-[#EAEAEA] bg-white"
        >
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-10 h-10 rounded-xl ph-skeleton shrink-0" />
            <div className="space-y-2 flex-1 min-w-0">
              <div className="h-3.5 w-40 rounded ph-skeleton" />
              <div className="h-2.5 w-64 max-w-full rounded ph-skeleton" />
            </div>
          </div>
          <div className="w-12 h-11 rounded-lg ph-skeleton shrink-0" />
        </div>
      ))}
    </div>
  );
}

/**
 * Accessible Modal Wrapper
 */
export function PhModal({
  title,
  subtitle,
  icon,
  onClose,
  maxWidth = 'max-w-lg',
  children,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  onClose: () => void;
  maxWidth?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.98, y: 6 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.16, ease: 'easeOut' }}
        className={`bg-white border border-[#EAEAEA] rounded-2xl ${maxWidth} w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto`}
      >
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-[#EAEAEA]">
          <div className="flex items-center gap-3 min-w-0">
            {icon}
            <div className="min-w-0">
              <h3 className="text-base font-bold text-[#202020]">{title}</h3>
              {subtitle && <p className="text-xs text-[#777777] mt-0.5">{subtitle}</p>}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 rounded-lg text-[#777777] hover:text-[#202020] hover:bg-[#F3F3F3] transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="mt-5">{children}</div>
      </motion.div>
    </div>
  );
}
