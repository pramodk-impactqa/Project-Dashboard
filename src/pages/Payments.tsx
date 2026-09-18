import { useState, useMemo, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { CreditCard, Plus, ChevronDown, X } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import DataTable from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';
import DateFilterBar from '../components/DateFilterBar';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';
import DatePicker from '../components/DatePicker';
import { formatCurrency, formatDate } from '../utils/format';
import type { Payment, DateFilter, Currency, PaymentStatus } from '../types';

const emptyForm = { invoiceId: '', invoiceNumber: '', projectId: '', projectName: '', amountReceived: 0, paymentDate: '', currency: 'USD' as Currency, exchangeRate: 1, bank: '', tdsWithholding: 0, shortPayment: 0, outstandingBalance: 0, remarks: '', status: 'Received' as PaymentStatus };

const columns = [
  { key: 'invoiceNumber', header: 'Invoice #', render: (p: Payment) => <span className="font-mono font-semibold text-[#C4B5FD] text-xs">{p.invoiceNumber}</span> },
  { key: 'projectName', header: 'Project', render: (p: Payment) => <span className="font-medium text-[#F0EDE4]">{p.projectName}</span> },
  { key: 'amountReceived', header: 'Amount Received', align: 'right' as const, render: (p: Payment) => <span className="font-semibold text-[#4CAF87] tabular-nums">{formatCurrency(p.amountReceived, p.currency)}</span> },
  { key: 'paymentDate', header: 'Payment Date', render: (p: Payment) => <span className="text-[#8FA99E] text-xs">{formatDate(p.paymentDate)}</span> },
  { key: 'bank', header: 'Bank', render: (p: Payment) => <span className="text-[#BCC5BF]">{p.bank || '—'}</span> },
  { key: 'tdsWithholding', header: 'TDS/WHT', align: 'right' as const, render: (p: Payment) => p.tdsWithholding > 0 ? <span className="text-[#E0A84D] tabular-nums">{formatCurrency(p.tdsWithholding, p.currency)}</span> : <span className="text-[#8FA99E]">—</span> },
  { key: 'outstandingBalance', header: 'Balance Due', align: 'right' as const, render: (p: Payment) => p.outstandingBalance > 0 ? <span className="font-semibold text-[#E2725B] tabular-nums">{formatCurrency(p.outstandingBalance, p.currency)}</span> : <span className="text-[#4CAF87] text-xs">Nil</span> },
  { key: 'status', header: 'Status', render: (p: Payment) => <StatusBadge status={p.status} /> },
];

export default function Payments() {
  const { payments, addPayment, projects, invoices } = useAppContext();
  const location = useLocation();
  const initialProjectId = (location.state as any)?.projectId || '';
  const [dateFilter, setDateFilter] = useState<DateFilter | null>(null);
  const [projectFilter, setProjectFilter] = useState(initialProjectId);
  const [statusFilter, setStatusFilter] = useState<PaymentStatus | ''>('');
  const [dateResetKey, setDateResetKey] = useState(0);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const filtered = useMemo(() => {
    let list = payments;
    if (projectFilter) list = list.filter(p => p.projectId === projectFilter);
    if (statusFilter) list = list.filter(p => p.status === statusFilter);
    if (dateFilter) list = list.filter(p => p.paymentDate >= dateFilter.from && p.paymentDate <= dateFilter.to);
    return list;
  }, [payments, projectFilter, statusFilter, dateFilter]);

  const hasActiveFilters = !!(dateFilter || projectFilter || statusFilter);

  const clearAllFilters = useCallback(() => {
    setDateFilter(null);
    setProjectFilter('');
    setStatusFilter('');
    setDateResetKey(k => k + 1);
  }, []);

  const totalReceived = filtered.reduce((s, p) => s + p.amountReceived, 0);
  const totalOutstanding = filtered.reduce((s, p) => s + p.outstandingBalance, 0);
  const totalTDS = filtered.reduce((s, p) => s + p.tdsWithholding, 0);

  const monthlyHistory = useMemo(() => {
    const map: Record<string, { month: string; total: number; count: number }> = {};
    filtered.forEach(p => { if (!p.paymentDate) return; const d = new Date(p.paymentDate); const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; const label = d.toLocaleString('en', { month: 'short', year: 'numeric' }); if (!map[key]) map[key] = { month: label, total: 0, count: 0 }; map[key].total += p.amountReceived; map[key].count++; });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v);
  }, [filtered]);

  function updateForm(key: string, value: string | number) { setForm(prev => { const next = { ...prev, [key]: value }; if (key === 'invoiceId') { const inv = invoices.find(i => i.id === value); if (inv) { next.invoiceNumber = inv.invoiceNumber; next.projectId = inv.projectId; next.projectName = inv.projectName; next.currency = inv.currency; } } return next; }); }
  function handleSubmit() { if (!form.invoiceId || !form.amountReceived) return; addPayment({ ...form, amountReceived: Number(form.amountReceived), exchangeRate: Number(form.exchangeRate), tdsWithholding: Number(form.tdsWithholding), shortPayment: Number(form.shortPayment), outstandingBalance: Number(form.outstandingBalance) }); setForm(emptyForm); setShowAdd(false); }

  return (
    <div className="p-5 lg:p-8 space-y-6">
      <PageHeader
        icon={CreditCard}
        title="Payments"
        description="Track collections, withholdings, and outstanding balances."
        actions={
          <button onClick={() => setShowAdd(true)} className="btn-gold flex items-center gap-2 px-4 py-2 text-sm"><Plus size={15} /> Record Payment</button>
        }
      />

      {/* Status Quick Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        {([
          { label: 'All', value: '' },
          { label: 'Received', value: 'Received' },
          { label: 'Partial', value: 'Partial' },
          { label: 'Pending', value: 'Pending' },
        ] as { label: string; value: PaymentStatus | '' }[]).map(f => (
          <button
            key={f.label}
            onClick={() => setStatusFilter(f.value)}
            className={statusFilter === f.value ? 'fi-pill-active' : 'fi-pill'}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Project + Date Filter */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-[10px] font-semibold text-[#8FA99E] uppercase tracking-wider">Project</label>
          <div className="relative">
            <select value={projectFilter} onChange={e => setProjectFilter(e.target.value)} className="fi-input h-8 appearance-none pl-3 pr-7 text-xs font-medium min-w-[180px]">
              <option value="">All Projects</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#8FA99E] pointer-events-none" />
          </div>
          {projectFilter && <button type="button" onClick={() => setProjectFilter('')} className="text-[11px] text-[#D4AF37] font-semibold hover:text-[#F0EDE4] transition-colors">Clear</button>}
        </div>
        <DateFilterBar onApply={setDateFilter} resetKey={dateResetKey} />
        {hasActiveFilters && (
          <button type="button" onClick={clearAllFilters} className="flex items-center gap-1.5 text-xs font-semibold text-[#D4AF37] hover:text-[#F0EDE4] transition-colors ml-auto">
            <X size={13} /> Clear All Filters
          </button>
        )}
      </div>

      {/* Results count when filters active */}
      {hasActiveFilters && (
        <div className="text-xs text-[#8FA99E]">
          {filtered.length} result{filtered.length !== 1 ? 's' : ''} found
          {projectFilter && <span className="ml-1">• Project: <span className="text-[#D4AF37]">{projects.find(p => p.id === projectFilter)?.name}</span></span>}
          {statusFilter && <span className="ml-1">• Status: <span className="text-[#D4AF37]">{statusFilter}</span></span>}
          {dateFilter && <span className="ml-1">• Date: <span className="text-[#D4AF37]">{dateFilter.from} → {dateFilter.to}</span></span>}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="glass-card p-4"><p className="text-[10px] font-semibold uppercase tracking-wider text-[#8FA99E]">Payments</p><p className="text-2xl font-bold mt-1 text-[#F0EDE4]">{filtered.length}</p></div>
        <div className="glass-card p-4"><p className="text-[10px] font-semibold uppercase tracking-wider text-[#8FA99E]">Total Collected</p><p className="text-2xl font-bold mt-1 text-[#4CAF87]">{formatCurrency(totalReceived)}</p></div>
        <div className="glass-card p-4 border-[rgba(226,114,91,0.15)]"><p className="text-[10px] font-semibold uppercase tracking-wider text-[#8FA99E]">Outstanding</p><p className="text-2xl font-bold mt-1 text-[#E2725B]">{formatCurrency(totalOutstanding)}</p></div>
        <div className="glass-card p-4"><p className="text-[10px] font-semibold uppercase tracking-wider text-[#8FA99E]">TDS / WHT</p><p className="text-2xl font-bold mt-1 text-[#E0A84D]">{formatCurrency(totalTDS)}</p></div>
      </div>

      {monthlyHistory.length > 0 && (
        <div className="glass-card p-5">
          <h3 className="text-sm font-bold text-[#F0EDE4] mb-1">Monthly Collection History</h3>
          <p className="text-xs text-[#8FA99E] mb-4">Payment collections aggregated by month</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm fi-table">
              <thead>
                <tr className="border-b border-[rgba(255,255,255,0.06)]">
                  <th className="px-3 py-2.5 text-left">Month</th>
                  <th className="px-3 py-2.5 text-center">Payments</th>
                  <th className="px-3 py-2.5 text-right">Total Collected</th>
                </tr>
              </thead>
              <tbody>
                {monthlyHistory.map(m => (
                  <tr key={m.month}>
                    <td className="px-3 py-2.5 font-medium text-sm text-[#F0EDE4]">{m.month}</td>
                    <td className="px-3 py-2.5 text-center tabular-nums text-[#BCC5BF]">{m.count}</td>
                    <td className="px-3 py-2.5 text-right font-semibold text-[#4CAF87] tabular-nums">{formatCurrency(m.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <DataTable data={filtered as unknown as Record<string, unknown>[]} columns={columns as any} title="Payment Register" subtitle={`${filtered.length} payments`} exportFilename="Payment_Register" emptyMessage="No payments have been recorded yet." />

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Record Payment" description="Record a payment against an existing invoice." wide>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2"><label className="block text-xs font-semibold text-[#BCC5BF] mb-1.5">Invoice <span className="text-[#E2725B]">*</span></label><select value={form.invoiceId} onChange={e => updateForm('invoiceId', e.target.value)} className="fi-input w-full h-10 px-3 text-sm"><option value="">Select invoice...</option>{invoices.filter(i => i.status !== 'Cancelled').map(i => (<option key={i.id} value={i.id}>{i.invoiceNumber} — {i.projectName} ({formatCurrency(i.totalAmount, i.currency)})</option>))}</select></div>
          <div><label className="block text-xs font-semibold text-[#BCC5BF] mb-1.5">Amount Received <span className="text-[#E2725B]">*</span></label><input type="number" value={form.amountReceived || ''} onChange={e => updateForm('amountReceived', e.target.value)} placeholder="0" className="fi-input w-full h-10 px-3 text-sm" /></div>
          <div><label className="block text-xs font-semibold text-[#BCC5BF] mb-1.5">Payment Date <span className="text-[#E2725B]">*</span></label><DatePicker value={form.paymentDate} onChange={v => updateForm('paymentDate', v)} /></div>
          <div><label className="block text-xs font-semibold text-[#BCC5BF] mb-1.5">Bank</label><input type="text" value={form.bank} onChange={e => updateForm('bank', e.target.value)} placeholder="HDFC Bank" className="fi-input w-full h-10 px-3 text-sm" /></div>
          <div><label className="block text-xs font-semibold text-[#BCC5BF] mb-1.5">Exchange Rate</label><input type="number" step="0.01" value={form.exchangeRate} onChange={e => updateForm('exchangeRate', e.target.value)} className="fi-input w-full h-10 px-3 text-sm" /></div>
          <div><label className="block text-xs font-semibold text-[#BCC5BF] mb-1.5">TDS / WHT</label><input type="number" value={form.tdsWithholding || ''} onChange={e => updateForm('tdsWithholding', e.target.value)} placeholder="0" className="fi-input w-full h-10 px-3 text-sm" /></div>
          <div><label className="block text-xs font-semibold text-[#BCC5BF] mb-1.5">Balance Due</label><input type="number" value={form.outstandingBalance || ''} onChange={e => updateForm('outstandingBalance', e.target.value)} placeholder="0" className="fi-input w-full h-10 px-3 text-sm" /></div>
          <div><label className="block text-xs font-semibold text-[#BCC5BF] mb-1.5">Status</label><select value={form.status} onChange={e => updateForm('status', e.target.value)} className="fi-input w-full h-10 px-3 text-sm"><option value="Received">Received</option><option value="Partial">Partial</option><option value="Pending">Pending</option></select></div>
          <div className="sm:col-span-2"><label className="block text-xs font-semibold text-[#BCC5BF] mb-1.5">Remarks</label><input type="text" value={form.remarks} onChange={e => updateForm('remarks', e.target.value)} placeholder="Optional notes" className="fi-input w-full h-10 px-3 text-sm" /></div>
          <div className="sm:col-span-2 flex gap-3 pt-4 border-t border-[rgba(255,255,255,0.06)] mt-2">
            <button onClick={handleSubmit} disabled={!form.invoiceId || !form.amountReceived} className="btn-gold flex-1 py-2.5 text-sm">Record Payment</button>
            <button onClick={() => { setShowAdd(false); setForm(emptyForm); }} className="btn-ghost flex-1 py-2.5 text-sm">Cancel</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
