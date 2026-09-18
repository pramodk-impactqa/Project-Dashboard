import { clsx } from 'clsx';
import type { LucideIcon } from 'lucide-react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface KPICardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: LucideIcon;
  trend?: number;
  color: 'blue' | 'green' | 'amber' | 'red' | 'purple' | 'indigo' | 'gold' | 'emerald';
}

const colorMap: Record<string, { iconBg: string; iconText: string }> = {
  blue:    { iconBg: 'bg-[rgba(56,189,248,0.12)]', iconText: 'text-[#38BDF8]' },
  green:   { iconBg: 'bg-[rgba(52,211,153,0.12)]', iconText: 'text-[#34D399]' },
  emerald: { iconBg: 'bg-[rgba(52,211,153,0.12)]', iconText: 'text-[#34D399]' },
  gold:    { iconBg: 'bg-[rgba(168,85,247,0.14)]', iconText: 'text-[#C4B5FD]' },
  amber:   { iconBg: 'bg-[rgba(245,158,11,0.12)]', iconText: 'text-[#F59E0B]' },
  red:     { iconBg: 'bg-[rgba(244,63,94,0.12)]', iconText: 'text-[#F43F5E]' },
  purple:  { iconBg: 'bg-[rgba(123,44,255,0.16)]', iconText: 'text-[#C4B5FD]' },
  indigo:  { iconBg: 'bg-[rgba(168,85,247,0.14)]', iconText: 'text-[#C4B5FD]' },
};

export default function KPICard({ title, value, subtitle, icon: Icon, trend, color }: KPICardProps) {
  const c = colorMap[color] || colorMap.purple;
  return (
    <div className="glass-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1.5 min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#A7A9C0]">{title}</p>
          <p className="text-[26px] font-semibold tracking-tight text-white tabular-nums truncate">{value}</p>
          {subtitle && <p className="text-xs text-[#A7A9C0] leading-relaxed">{subtitle}</p>}
          {trend !== undefined && (
            <div className={clsx('flex items-center gap-1 text-xs font-semibold', trend >= 0 ? 'text-[#34D399]' : 'text-[#F43F5E]')}>
              {trend >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
              <span>{Math.abs(trend).toFixed(1)}% vs last period</span>
            </div>
          )}
        </div>
        <div className={clsx('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/5', c.iconBg)}>
          <Icon size={18} className={c.iconText} />
        </div>
      </div>
    </div>
  );
}
