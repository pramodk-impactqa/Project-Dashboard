import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

interface PageHeaderProps {
  icon?: LucideIcon;
  kicker?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}

export default function PageHeader({
  icon: Icon,
  kicker = 'Finance operations',
  title,
  description,
  actions,
}: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between flex-wrap gap-4">
      <div className="flex items-start gap-3.5 min-w-0">
        {Icon && (
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.035] text-[#C4B5FD] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
            <Icon size={18} />
          </div>
        )}
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#A7A9C0]">{kicker}</p>
          <h1 className="mt-1 text-[22px] font-semibold tracking-tight text-white">{title}</h1>
          {description && <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[#A7A9C0]">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
  );
}
