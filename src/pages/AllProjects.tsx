import { useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  FolderKanban, Plus, Search, Filter, Download, ChevronDown, X,
  Building2, Calendar, ArrowUpDown, ChevronLeft, ChevronRight, Inbox,
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import StatusBadge from '../components/StatusBadge';
import DateFilterBar from '../components/DateFilterBar';
import PageHeader from '../components/PageHeader';
import { formatCurrency, formatDate } from '../utils/format';
import type { DateFilter, ProjectStatus } from '../types';
import * as XLSX from 'xlsx';

const PAGE_SIZE = 12;

type SortKey = 'name' | 'clientName' | 'projectManager' | 'startDate' | 'status' | 'createdAt';

export default function AllProjects() {
  const { projects, sows, invoices, payments } = useAppContext();
  const navigate = useNavigate();
  const location = useLocation();
  const presetClientId = (location.state as { clientId?: string } | null)?.clientId || '';

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | ''>('');
  const [pmFilter, setPmFilter] = useState('');
  const [dmFilter, setDmFilter] = useState('');
  const [domainFilter, setDomainFilter] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilter | null>(null);
  const [dateResetKey, setDateResetKey] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('createdAt');
  const [sortAsc, setSortAsc] = useState(false);
  const [page, setPage] = useState(0);

  // Unique values for filters
  const pms = useMemo(() => [...new Set(projects.map(p => p.projectManager).filter(Boolean))], [projects]);
  const dms = useMemo(() => [...new Set(projects.map(p => p.deliveryManager).filter(Boolean))], [projects]);
  const domains = useMemo(() => [...new Set(projects.map(p => p.domain).filter(Boolean))], [projects]);

  // Filtered + sorted data
  const filtered = useMemo(() => {
    let list = [...projects];
    if (presetClientId) list = list.filter(p => p.clientId === presetClientId);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.clientName.toLowerCase().includes(q) ||
        p.projectId.toLowerCase().includes(q) ||
        p.clientId.toLowerCase().includes(q) ||
        p.billingId.toLowerCase().includes(q) ||
        p.projectManager.toLowerCase().includes(q) ||
        p.deliveryManager.toLowerCase().includes(q)
      );
    }
    if (statusFilter) list = list.filter(p => p.status === statusFilter);
    if (pmFilter) list = list.filter(p => p.projectManager === pmFilter);
    if (dmFilter) list = list.filter(p => p.deliveryManager === dmFilter);
    if (domainFilter) list = list.filter(p => p.domain === domainFilter);
    if (dateFilter) {
      list = list.filter(p => p.createdAt >= dateFilter.from && p.createdAt <= dateFilter.to);
    }
    list.sort((a, b) => {
      const av = a[sortKey] || '';
      const bv = b[sortKey] || '';
      const cmp = typeof av === 'string' ? av.localeCompare(String(bv)) : 0;
      return sortAsc ? cmp : -cmp;
    });
    return list;
  }, [projects, search, statusFilter, pmFilter, dmFilter, domainFilter, dateFilter, sortKey, sortAsc, presetClientId]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // Financial aggregates per project
  function getProjectFinancials(projectId: string) {
    const projectSows = sows.filter(s => s.projectId === projectId);
    const projectInvoices = invoices.filter(i => i.projectId === projectId);
    const projectPaymentIds = new Set(projectInvoices.map(i => i.id));
    const projectPayments = payments.filter(p => p.projectId === projectId || projectPaymentIds.has(p.invoiceId));

    const sowValue = projectSows.reduce((s, w) => s + w.contractValue, 0);
    const invoiced = projectInvoices.reduce((s, i) => s + i.totalAmount, 0);
    const collected = projectPayments.reduce((s, p) => s + p.amountReceived, 0);
    const outstanding = invoiced - collected;
    const activeSows = projectSows.filter(s => s.status === 'Active').length;
    return { sowValue, invoiced, collected, outstanding, activeSows };
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(true); }
    setPage(0);
  }

  function exportToExcel() {
    const rows = filtered.map(p => {
      const fin = getProjectFinancials(p.projectId);
      return {
        'Project ID': p.projectId, 'Project Name': p.name, 'Client': p.clientName,
        'Industry': p.domain, 'PM': p.projectManager, 'DM': p.deliveryManager,
        'Billing ID': p.billingId, 'Active SOWs': fin.activeSows, 'Currency': p.currency,
        'SOW Value': fin.sowValue, 'Invoiced': fin.invoiced, 'Collected': fin.collected,
        'Outstanding': fin.outstanding, 'Status': p.status, 'Start': p.startDate,
        'End': p.endDate, 'Created': p.createdAt,
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'All Projects');
    XLSX.writeFile(wb, 'All_Projects.xlsx');
  }

  const statusCounts = useMemo(() => ({
    all: projects.length,
    Active: projects.filter(p => p.status === 'Active').length,
    'On Hold': projects.filter(p => p.status === 'On Hold').length,
    Inactive: projects.filter(p => p.status === 'Inactive').length,
  }), [projects]);

  const hasActiveFilters = !!(statusFilter || pmFilter || dmFilter || domainFilter || dateFilter || search);

  function clearAllFilters() {
    setPmFilter('');
    setDmFilter('');
    setDomainFilter('');
    setStatusFilter('');
    setDateFilter(null);
    setSearch('');
    setDateResetKey(k => k + 1);
    setPage(0);
  }

  return (
    <div className="p-5 lg:p-8 space-y-5">
      {/* Header */}
      <PageHeader
        icon={FolderKanban}
        title="Projects"
        description="Each project belongs to a client and can carry multiple SOWs."
        actions={
          <button
            onClick={() => navigate('/projects/new')}
            className="btn-gold flex items-center gap-2 px-4 py-2.5 text-sm font-semibold"
          >
            <Plus size={16} /> Add Project
          </button>
        }
      />

      {/* Status Quick Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        {[
          { label: 'All', value: '', count: statusCounts.all },
          { label: 'Active', value: 'Active' as ProjectStatus, count: statusCounts.Active },
          { label: 'On Hold', value: 'On Hold' as ProjectStatus, count: statusCounts['On Hold'] },
          { label: 'Inactive', value: 'Inactive' as ProjectStatus, count: statusCounts.Inactive },
        ].map(f => (
          <button
            key={f.label}
            onClick={() => { setStatusFilter(f.value as any); setPage(0); }}
            className={statusFilter === f.value ? 'fi-pill-active' : 'fi-pill'}
          >
            {f.label}
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
              statusFilter === f.value ? 'bg-[#1A1F1C]/15 text-[#1A1F1C]' : 'bg-[rgba(255,255,255,0.06)] text-[#8B949E]'
            }`}>{f.count}</span>
          </button>
        ))}
      </div>

      {/* Search + Filter Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8FA99E]" />
          <input
            type="text"
            placeholder="Search by project, client, ID, manager..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0); }}
            className="fi-input h-9 w-full pl-9 pr-3 text-sm"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8FA99E] hover:text-[#F0EDE4]">
              <X size={14} />
            </button>
          )}
        </div>

        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-1.5 px-3 py-2 text-xs ${
            showFilters || hasActiveFilters ? 'fi-pill-active' : 'fi-pill'
          }`}
        >
          <Filter size={14} /> Filters
          {hasActiveFilters && <span className="h-1.5 w-1.5 rounded-full bg-[#D4AF37]" />}
        </button>

        <button
          onClick={exportToExcel}
          className="fi-pill"
        >
          <Download size={14} /> Export
        </button>

        <DateFilterBar onApply={(filter) => { setDateFilter(filter); setPage(0); }} resetKey={dateResetKey} />
        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearAllFilters}
            className="flex items-center gap-1.5 text-xs font-semibold text-[#D4AF37] hover:text-[#F0EDE4] transition-colors"
          >
            <X size={13} /> Clear All Filters
          </button>
        )}
      </div>

      {/* Advanced Filters Panel */}
      {showFilters && (
        <div className="glass-card p-4 grid grid-cols-2 sm:grid-cols-4 gap-3" style={{ animation: 'fade-in-up 0.15s ease-out' }}>
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#8FA99E] mb-1">Project Manager</label>
            <select value={pmFilter} onChange={e => { setPmFilter(e.target.value); setPage(0); }} className="fi-input w-full h-8 px-2 text-xs">
              <option value="">All</option>
              {pms.map(pm => <option key={pm} value={pm}>{pm}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#8FA99E] mb-1">Delivery Manager</label>
            <select value={dmFilter} onChange={e => { setDmFilter(e.target.value); setPage(0); }} className="fi-input w-full h-8 px-2 text-xs">
              <option value="">All</option>
              {dms.map(dm => <option key={dm} value={dm}>{dm}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#8FA99E] mb-1">Industry / Domain</label>
            <select value={domainFilter} onChange={e => { setDomainFilter(e.target.value); setPage(0); }} className="fi-input w-full h-8 px-2 text-xs">
              <option value="">All</option>
              {domains.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div className="flex items-end">
            <button type="button" onClick={clearAllFilters} className="btn-ghost h-8 px-3 text-xs font-medium hover:text-[#E2725B] hover:border-[#E2725B]">
              Clear All Filters
            </button>
          </div>
        </div>
      )}

      {/* Results count */}
      <div className="flex items-center justify-between text-xs text-[#8FA99E]">
        <span>{filtered.length} project{filtered.length !== 1 ? 's' : ''} found</span>
        {hasActiveFilters && (
          <button type="button" onClick={clearAllFilters} className="text-[#D4AF37] font-semibold hover:text-[#e5c04b]">
            Clear all filters
          </button>
        )}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[rgba(212,175,55,0.1)] text-[#D4AF37] mb-4">
            <Inbox size={28} />
          </div>
          <h2 className="text-base font-bold text-[#F0EDE4] mb-1.5">
            {projects.length === 0 ? 'Your project portfolio is empty' : 'No projects match your search criteria.'}
          </h2>
          <p className="text-sm text-[#8FA99E] mb-6 max-w-md">
            {projects.length === 0
              ? 'Create a project under an existing client to track delivery, SOWs, invoices, and cash collection in one place.'
              : 'Try adjusting your filters or search query.'}
          </p>
          {projects.length === 0 && (
            <button
              onClick={() => navigate('/projects/new')}
              className="btn-gold flex items-center gap-2 px-5 py-2.5 text-sm font-semibold"
            >
              <Plus size={16} /> Add Project
            </button>
          )}
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)]">
                  {[
                    { key: 'projectId' as SortKey, label: 'Project ID', sortable: false },
                    { key: 'name' as SortKey, label: 'Project / Client', sortable: true },
                    { key: 'domain' as SortKey, label: 'Industry', sortable: false },
                    { key: 'projectManager' as SortKey, label: 'PM / DM', sortable: false },
                    { key: 'billing' as SortKey, label: 'Billing ID', sortable: false },
                    { key: 'activeSows' as SortKey, label: 'SOWs', sortable: false },
                    { key: 'financial' as SortKey, label: 'SOW Value', sortable: false },
                    { key: 'invoiced' as SortKey, label: 'Invoiced', sortable: false },
                    { key: 'outstanding' as SortKey, label: 'Outstanding', sortable: false },
                    { key: 'status' as SortKey, label: 'Status', sortable: true },
                    { key: 'startDate' as SortKey, label: 'Start', sortable: true },
                  ].map(col => (
                    <th
                      key={col.key}
                      className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-[#8FA99E] whitespace-nowrap"
                    >
                      {col.sortable ? (
                        <button onClick={() => toggleSort(col.key)} className="flex items-center gap-1 hover:text-[#F0EDE4] transition-colors">
                          {col.label}
                          <ArrowUpDown size={11} className="opacity-40" />
                        </button>
                      ) : col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paged.map(p => {
                  const fin = getProjectFinancials(p.projectId);
                  return (
                    <tr
                      key={p.id}
                      onClick={() => navigate(`/projects/${p.id}`)}
                      className="border-b border-[rgba(255,255,255,0.06)] hover:bg-[rgba(212,175,55,0.04)] cursor-pointer transition-colors"
                    >
                      <td className="px-3 py-3">
                        <span className="font-mono text-xs font-semibold text-[#D4AF37]">{p.projectId}</span>
                      </td>
                      <td className="px-3 py-3">
                        <p className="font-semibold text-[#F0EDE4] text-sm leading-tight">{p.name}</p>
                        <p className="text-[11px] text-[#8FA99E] flex items-center gap-1 mt-0.5">
                          <Building2 size={10} /> {p.clientName}
                        </p>
                      </td>
                      <td className="px-3 py-3">
                        <span className="text-xs text-[#BCC5BF]">{p.domain}</span>
                      </td>
                      <td className="px-3 py-3">
                        <p className="text-xs text-[#F0EDE4]">{p.projectManager || '—'}</p>
                        <p className="text-[11px] text-[#BCC5BF]">{p.deliveryManager || '—'}</p>
                      </td>
                      <td className="px-3 py-3">
                        <span className="font-mono text-xs text-[#8FA99E]">{p.billingId}</span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[rgba(212,175,55,0.1)] text-[11px] font-bold text-[#D4AF37]">
                          {fin.activeSows}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <span className="font-semibold tabular-nums text-xs text-[#F0EDE4]">{formatCurrency(fin.sowValue, p.currency)}</span>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <span className="tabular-nums text-xs text-[#BCC5BF]">{formatCurrency(fin.invoiced, p.currency)}</span>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <span className={`tabular-nums text-xs font-semibold ${fin.outstanding > 0 ? 'text-[#E0A84D]' : 'text-[#4CAF87]'}`}>
                          {formatCurrency(fin.outstanding, p.currency)}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <StatusBadge status={p.status} />
                      </td>
                      <td className="px-3 py-3">
                        <span className="text-xs text-[#8FA99E] flex items-center gap-1">
                          <Calendar size={10} /> {formatDate(p.startDate)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-[rgba(255,255,255,0.06)] px-4 py-3">
              <span className="text-xs text-[#8FA99E]">
                Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
              </span>
              <div className="flex items-center gap-1">
                <button
                  disabled={page === 0}
                  onClick={() => setPage(page - 1)}
                  className="flex items-center gap-1 rounded-md border border-[rgba(255,255,255,0.08)] px-2.5 py-1 text-xs font-medium text-[#BCC5BF] disabled:opacity-30 hover:bg-[rgba(255,255,255,0.04)] transition-colors"
                >
                  <ChevronLeft size={13} /> Previous
                </button>
                {Array.from({ length: Math.min(totalPages, 5) }).map((_, i) => {
                  const pg = totalPages <= 5 ? i : Math.max(0, Math.min(page - 2, totalPages - 5)) + i;
                  return (
                    <button
                      key={pg}
                      onClick={() => setPage(pg)}
                      className={`h-7 w-7 rounded-md text-xs font-medium transition-colors ${
                        pg === page ? 'btn-gold' : 'hover:bg-[rgba(255,255,255,0.04)] text-[#8FA99E]'
                      }`}
                    >
                      {pg + 1}
                    </button>
                  );
                })}
                <button
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage(page + 1)}
                  className="flex items-center gap-1 rounded-md border border-[rgba(255,255,255,0.08)] px-2.5 py-1 text-xs font-medium text-[#BCC5BF] disabled:opacity-30 hover:bg-[rgba(255,255,255,0.04)] transition-colors"
                >
                  Next <ChevronRight size={13} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
