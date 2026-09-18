import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { clsx } from 'clsx';

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const PANEL_MS = 160;
const MONTH_MS = 220;
const SELECT_MS = 160;

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function toISO(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseISO(value: string) {
  if (!value) return null;
  const [y, m, d] = value.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function between(iso: string, start?: string, end?: string) {
  if (!start || !end) return false;
  const a = start < end ? start : end;
  const b = start < end ? end : start;
  return iso > a && iso < b;
}

type DayCell = { date: Date; inMonth: boolean };

interface DatePickerProps {
  value: string;
  onChange: (iso: string) => void;
  placeholder?: string;
  disabled?: boolean;
  size?: 'sm' | 'md';
  rangeStart?: string;
  rangeEnd?: string;
}

export default function DatePicker({
  value,
  onChange,
  placeholder = 'Select date',
  disabled,
  size = 'md',
  rangeStart,
  rangeEnd,
}: DatePickerProps) {
  const selected = parseISO(value);
  const [cursor, setCursor] = useState(() => selected || new Date());
  const [mounted, setMounted] = useState(false);
  const [panel, setPanel] = useState<'open' | 'closing'>('open');
  const [exitCells, setExitCells] = useState<DayCell[] | null>(null);
  const [dir, setDir] = useState<1 | -1>(1);
  const [justSelected, setJustSelected] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<number | undefined>(undefined);
  const monthTimer = useRef<number | undefined>(undefined);
  const pickTimer = useRef<number | undefined>(undefined);

  const cells = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const first = new Date(year, month, 1);
    const startPad = first.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const items: DayCell[] = [];
    for (let i = startPad - 1; i >= 0; i--) {
      items.push({ date: new Date(year, month, -i), inMonth: false });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      items.push({ date: new Date(year, month, d), inMonth: true });
    }
    while (items.length % 7 !== 0) {
      const last = items[items.length - 1].date;
      items.push({ date: new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1), inMonth: false });
    }
    return items;
  }, [cursor]);

  useEffect(() => () => {
    window.clearTimeout(closeTimer.current);
    window.clearTimeout(monthTimer.current);
    window.clearTimeout(pickTimer.current);
  }, []);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) closePanel();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') closePanel();
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [mounted, panel]);

  function openPanel() {
    if (disabled) return;
    window.clearTimeout(closeTimer.current);
    setExitCells(null);
    setJustSelected('');
    setCursor(selected || new Date());
    setMounted(true);
    setPanel('open');
  }

  function closePanel() {
    if (!mounted || panel === 'closing') return;
    setPanel('closing');
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => {
      setMounted(false);
      setJustSelected('');
      setExitCells(null);
    }, PANEL_MS);
  }

  function toggle() {
    if (mounted && panel === 'open') closePanel();
    else openPanel();
  }

  function changeMonth(next: Date, direction: 1 | -1) {
    if (exitCells) return;
    setDir(direction);
    setExitCells(cells);
    setCursor(next);
    window.clearTimeout(monthTimer.current);
    monthTimer.current = window.setTimeout(() => setExitCells(null), MONTH_MS);
  }

  function pick(iso: string) {
    setJustSelected(iso);
    onChange(iso);
    window.clearTimeout(pickTimer.current);
    pickTimer.current = window.setTimeout(() => closePanel(), SELECT_MS);
  }

  const todayISO = toISO(new Date());
  const selectedISO = value;
  const startISO = rangeStart || (rangeEnd ? value : '');
  const endISO = rangeEnd || (rangeStart ? value : '');
  const hasRange = !!(startISO && endISO);

  function renderDays(list: DayCell[]) {
    return list.map(({ date, inMonth }) => {
      const iso = toISO(date);
      const isSelected = iso === selectedISO;
      const isToday = iso === todayISO;
      const isStart = hasRange && iso === startISO;
      const isEnd = hasRange && iso === endISO;
      const isMid = hasRange && between(iso, startISO, endISO);
      return (
        <div
          key={iso + String(inMonth)}
          className={clsx(
            'dp-day-wrap',
            isMid && 'dp-range-mid',
            isStart && hasRange && 'dp-range-from',
            isEnd && hasRange && 'dp-range-to',
          )}
        >
          <button
            type="button"
            onClick={() => pick(iso)}
            className={clsx(
              'h-9 w-full rounded-lg text-sm transition-colors',
              !inMonth && 'text-[#4A5564]',
              inMonth && !isSelected && 'text-[#E8EEF5] hover:bg-[rgba(126,182,255,0.12)]',
              isToday && !isSelected && 'ring-1 ring-[rgba(192,207,224,0.45)]',
              isSelected && 'bg-gradient-to-br from-[#C9D6E5] to-[#4B8CFF] text-[#0B1220] font-bold',
              justSelected === iso && 'dp-day-pop',
            )}
          >
            {date.getDate()}
          </button>
        </div>
      );
    });
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={toggle}
        className={clsx(
          'fi-input w-full text-left flex items-center justify-between',
          size === 'sm' ? 'h-8 px-2 text-xs' : 'h-10 px-3 text-sm',
        )}
      >
        <span className={selectedISO ? 'text-[#F0EDE4]' : 'text-[#7A8E84]'}>
          {selectedISO ? selected?.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : placeholder}
        </span>
        <CalendarDays size={size === 'sm' ? 14 : 16} className="text-[#7EB6FF] shrink-0" />
      </button>

      {mounted && (
        <div
          className={clsx(
            'dp-panel absolute z-[80] mt-2 w-[320px] rounded-2xl border border-[rgba(126,182,255,0.18)] bg-[#121820] p-4 shadow-[0_24px_60px_rgba(0,0,0,0.55)]',
            panel === 'open' ? 'dp-panel-open' : 'dp-panel-closing',
          )}
        >
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              className="p-1.5 rounded-lg text-[#C7D2E0] hover:bg-[rgba(126,182,255,0.1)]"
              onClick={() => changeMonth(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1), -1)}
            >
              <ChevronLeft size={16} />
            </button>
            <div className="flex items-center gap-2">
              <select
                value={cursor.getMonth()}
                onChange={e => {
                  const nextMonth = Number(e.target.value);
                  const direction = nextMonth >= cursor.getMonth() ? 1 : -1;
                  changeMonth(new Date(cursor.getFullYear(), nextMonth, 1), direction);
                }}
                className="bg-transparent text-sm font-semibold text-[#F0EDE4] outline-none"
              >
                {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
              </select>
              <select
                value={cursor.getFullYear()}
                onChange={e => {
                  const nextYear = Number(e.target.value);
                  const direction = nextYear >= cursor.getFullYear() ? 1 : -1;
                  changeMonth(new Date(nextYear, cursor.getMonth(), 1), direction);
                }}
                className="bg-transparent text-sm font-semibold text-[#C9D4E0] outline-none"
              >
                {Array.from({ length: 16 }, (_, i) => new Date().getFullYear() - 8 + i).map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <button
              type="button"
              className="p-1.5 rounded-lg text-[#C7D2E0] hover:bg-[rgba(126,182,255,0.1)]"
              onClick={() => changeMonth(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1), 1)}
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="grid grid-cols-7 mb-1">
            {WEEKDAYS.map(d => (
              <div key={d} className="h-8 text-[11px] font-semibold text-[#8FA3B8] flex items-center justify-center">{d}</div>
            ))}
          </div>
          <div className="relative overflow-hidden min-h-[216px]">
            {exitCells && (
              <div
                className={clsx(
                  'absolute inset-x-0 top-0 grid grid-cols-7',
                  dir === 1 ? 'dp-month-exit-left' : 'dp-month-exit-right',
                )}
                aria-hidden="true"
              >
                {renderDays(exitCells)}
              </div>
            )}
            <div
              className={clsx(
                'grid grid-cols-7',
                exitCells && (dir === 1 ? 'dp-month-enter-right' : 'dp-month-enter-left'),
              )}
            >
              {renderDays(cells)}
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <button type="button" className="text-xs font-semibold text-[#7EB6FF] hover:text-[#F0EDE4]" onClick={() => pick(todayISO)}>
              Today
            </button>
            <button type="button" className="text-xs text-[#8FA3B8] hover:text-[#F0EDE4]" onClick={() => pick('')}>
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
