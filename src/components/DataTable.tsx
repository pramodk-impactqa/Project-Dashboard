import { useState, useMemo } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown, Download, Upload, Search, Pencil, Trash2, X } from 'lucide-react';
import { clsx } from 'clsx';
import * as XLSX from 'xlsx';

interface Column<T> {
  key: string;
  header: string;
  render?: (item: T) => React.ReactNode;
  sortable?: boolean;
  align?: 'left' | 'right' | 'center';
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  title: string;
  subtitle?: string;
  exportFilename?: string;
  emptyMessage?: string;
  onEdit?: (item: T) => void;
  onDelete?: (item: T) => void;
}

export default function DataTable<T extends Record<string, unknown>>({
  data, columns, title, subtitle, exportFilename, emptyMessage, onEdit, onDelete,
}: DataTableProps<T>) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(0);
  const [delId, setDelId] = useState<string | null>(null);
  const perPage = 10;

  const filtered = useMemo(() => {
    if (!search) return data;
    const q = search.toLowerCase();
    return data.filter(item =>
      columns.some(col => {
        const val = item[col.key];
        return val != null && String(val).toLowerCase().includes(q);
      })
    );
  }, [data, search, columns]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    return [...filtered].sort((a, b) => {
      const aVal = a[sortKey]; const bVal = b[sortKey];
      if (aVal == null || bVal == null) return 0;
      const cmp = String(aVal).localeCompare(String(bVal), undefined, { numeric: true });
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.ceil(sorted.length / perPage);
  const paged = sorted.slice(page * perPage, (page + 1) * perPage);
  const hasActions = !!onEdit || !!onDelete;

  function handleSort(key: string) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  }

  function handleExport() {
    const rows = sorted.map(item => {
      const row: Record<string, unknown> = {};
      columns.forEach(col => { row[col.header] = item[col.key]; });
      return row;
    });
    if (rows.length === 0) rows.push({ Note: 'No data available' });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Data');
    XLSX.writeFile(wb, `${exportFilename || title}.xlsx`);
  }

  function SortIcon({ colKey }: { colKey: string }) {
    if (sortKey !== colKey) return <ChevronsUpDown size={13} className="text-[rgba(255,255,255,0.15)]" />;
    return sortDir === 'asc' ? <ChevronUp size={13} className="text-[#A855F7]" /> : <ChevronDown size={13} className="text-[#A855F7]" />;
  }

  return (
    <div className="glass-card overflow-hidden">
      {/* Header */}
      <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between border-b border-[rgba(255,255,255,0.06)]">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-white">{title}</h2>
          {subtitle && <p className="text-xs text-[#A7A9C0] mt-0.5">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#A7A9C0]" />
            <input
              type="text"
              placeholder="Search records..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(0); }}
              className="fi-input h-8 w-44 pl-8 pr-3 text-xs"
            />
          </div>
          {search && (
            <button onClick={() => { setSearch(''); setPage(0); }} className="btn-ghost h-8 px-2.5 text-xs flex items-center gap-1">
              <X size={12} /> Clear
            </button>
          )}
          <button onClick={handleExport} className="btn-ghost h-8 px-3 text-xs font-medium flex items-center gap-1.5">
            <Download size={13} /> Export
          </button>
          <button className="btn-ghost h-8 px-3 text-xs flex items-center gap-1.5">
            <Upload size={13} /> Import
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm fi-table">
          <thead>
            <tr className="border-b border-[rgba(255,255,255,0.06)]">
              {columns.map(col => (
                <th
                  key={col.key}
                  className={clsx(
                    'px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-[#A7A9C0]',
                    col.align === 'right' ? 'text-right' : 'text-left',
                    (col.sortable !== false) && 'cursor-pointer select-none hover:text-[#C4B5FD]',
                  )}
                  onClick={() => col.sortable !== false && handleSort(col.key)}
                >
                  <div className={clsx('flex items-center gap-1', col.align === 'right' && 'justify-end')}>
                    {col.header}
                    {col.sortable !== false && <SortIcon colKey={col.key} />}
                  </div>
                </th>
              ))}
              {hasActions && (
                <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-[#A7A9C0] text-right w-24">Actions</th>
              )}
            </tr>
          </thead>
          <tbody>
            {paged.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (hasActions ? 1 : 0)} className="px-4 py-16 text-center">
                  <p className="text-sm text-[#A7A9C0] font-medium">{emptyMessage || (data.length === 0 ? `No ${title.toLowerCase()} have been added yet.` : 'No matching records found.')}</p>
                </td>
              </tr>
            ) : (
              paged.map((item, i) => (
                <tr key={i}>
                  {columns.map(col => (
                    <td key={col.key} className={clsx('px-4 py-3 whitespace-nowrap text-sm', col.align === 'right' ? 'text-right tabular-nums' : '')}>
                      {col.render ? col.render(item) : <span className="text-[#D5D7EA]">{String(item[col.key] ?? '—')}</span>}
                    </td>
                  ))}
                  {hasActions && (
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-0.5">
                        {onEdit && (
                          <button onClick={() => onEdit(item)} className="p-1.5 rounded-lg text-[#A7A9C0] hover:text-[#C4B5FD] hover:bg-[rgba(123,44,255,0.1)] transition-colors" title="Edit" aria-label="Edit record">
                            <Pencil size={14} />
                          </button>
                        )}
                        {onDelete && (
                          delId === String(item.id) ? (
                            <div className="flex items-center gap-1">
                              <button onClick={() => { onDelete(item); setDelId(null); }} className="btn-danger px-2 py-1 text-[11px]">
                                Confirm
                              </button>
                              <button onClick={() => setDelId(null)} className="btn-ghost px-2 py-1 text-[11px]">
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button onClick={() => setDelId(String(item.id))} className="p-1.5 rounded-lg text-[#A7A9C0] hover:text-[#F43F5E] hover:bg-[rgba(244,63,94,0.08)] transition-colors" title="Delete" aria-label="Delete record">
                              <Trash2 size={14} />
                            </button>
                          )
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {sorted.length > 0 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-[rgba(255,255,255,0.06)]">
          <p className="text-xs text-[#A7A9C0]">
            Showing {page * perPage + 1}–{Math.min((page + 1) * perPage, sorted.length)} of {sorted.length}
          </p>
          <div className="flex gap-1">
            <button disabled={page === 0} onClick={() => setPage(p => p - 1)} className="btn-ghost px-2.5 py-1 text-xs disabled:opacity-30">
              Previous
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => (
              <button key={i} onClick={() => setPage(i)} className={clsx('rounded-lg px-2.5 py-1 text-xs transition-colors', page === i ? 'btn-gold' : 'btn-ghost')}>
                {i + 1}
              </button>
            ))}
            <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)} className="btn-ghost px-2.5 py-1 text-xs disabled:opacity-30">
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
