import { useState, useEffect } from 'react';
import { Calendar, X } from 'lucide-react';
import type { DateFilter } from '../types';
import DatePicker from './DatePicker';

interface DateFilterBarProps {
  onApply: (filter: DateFilter | null) => void;
  resetKey?: number;
}

export default function DateFilterBar({ onApply, resetKey = 0 }: DateFilterBarProps) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [applied, setApplied] = useState(false);

  useEffect(() => {
    if (resetKey > 0) {
      setFrom('');
      setTo('');
      setApplied(false);
    }
  }, [resetKey]);

  const canApply = !!(from && to);
  const canClear = !!(from || to || applied);

  function apply() {
    if (!canApply) return;
    onApply({ from, to });
    setApplied(true);
  }

  function clear() {
    setFrom('');
    setTo('');
    onApply(null);
    setApplied(false);
  }

  return (
    <div className="flex items-center gap-2.5 flex-wrap">
      <Calendar size={14} className="text-[#A7A9C0]" />
      <span className="text-[10px] font-semibold uppercase tracking-wider text-[#A7A9C0]">From</span>
      <div className="w-[148px]">
        <DatePicker
          size="sm"
          value={from}
          rangeStart={from}
          rangeEnd={to}
          onChange={v => { setFrom(v); setApplied(false); }}
        />
      </div>
      <span className="text-[10px] font-semibold uppercase tracking-wider text-[#A7A9C0]">To</span>
      <div className="w-[148px]">
        <DatePicker
          size="sm"
          value={to}
          rangeStart={from}
          rangeEnd={to}
          onChange={v => { setTo(v); setApplied(false); }}
        />
      </div>
      <button
        type="button"
        onClick={apply}
        disabled={!canApply}
        className="btn-emerald h-8 px-3 text-xs disabled:opacity-30 disabled:cursor-not-allowed"
      >
        Apply
      </button>
      <button
        type="button"
        onClick={clear}
        disabled={!canClear}
        className="btn-ghost h-8 px-2.5 text-xs flex items-center gap-1 disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <X size={12} /> Clear
      </button>
      {applied && (
        <span className="inline-flex items-center gap-1 rounded-full bg-[rgba(123,44,255,0.12)] border border-[rgba(168,85,247,0.28)] px-2 py-0.5 text-[10px] font-semibold text-[#C4B5FD]">
          Filter active
        </span>
      )}
    </div>
  );
}
