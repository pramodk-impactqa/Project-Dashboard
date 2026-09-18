import { useState, useMemo, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { Receipt, Plus, Download, X } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import DataTable from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';
import DateFilterBar from '../components/DateFilterBar';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';
import DatePicker from '../components/DatePicker';
import { formatCurrency, formatDate } from '../utils/format';
import type { Invoice, DateFilter, Entity, Currency, InvoiceStatus } from '../types';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const blankForm = { entity: 'US' as Entity, projectId: '', projectName: '', clientName: '', billingId: '', sowId: '', sowNumber: '', billingPeriod: '', invoiceDate: '', dueDate: '', amount: 0, currency: 'USD' as Currency, taxAmount: 0, totalAmount: 0, status: 'Draft' as InvoiceStatus };

function generateInvoicePDF(inv: Invoice) {
  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();
  let y = 20;
  doc.setFontSize(20); doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 64, 175);
  doc.text('IQA Technologies', 14, y);
  doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(100, 116, 139);
  doc.text('IQA Inc. · 123 Finance Street · New York, NY 10001', 14, y + 7);
  doc.text('Email: finance@iqa.com · Phone: +1 (555) 123-4567', 14, y + 12);
  doc.setFontSize(24); doc.setFont('helvetica', 'bold'); doc.setTextColor(15, 23, 42);
  doc.text('INVOICE', pageW - 14, y, { align: 'right' });
  y += 25;
  doc.setDrawColor(226, 232, 240); doc.line(14, y, pageW - 14, y); y += 10;
  const detailsLeft = [['Invoice Number:', inv.invoiceNumber], ['Invoice Date:', formatDate(inv.invoiceDate)], ['Due Date:', formatDate(inv.dueDate)], ['Payment Terms:', 'Net 30']];
  const detailsRight = [['Entity:', inv.entity], ['Currency:', inv.currency], ['Status:', inv.status], ['Billing Period:', inv.billingPeriod || '—']];
  doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(71, 85, 105);
  detailsLeft.forEach(([label, val], i) => { doc.text(label, 14, y + i * 6); doc.setFont('helvetica', 'bold'); doc.setTextColor(15, 23, 42); doc.text(val, 55, y + i * 6); doc.setFont('helvetica', 'normal'); doc.setTextColor(71, 85, 105); });
  detailsRight.forEach(([label, val], i) => { doc.text(label, pageW / 2 + 10, y + i * 6); doc.setFont('helvetica', 'bold'); doc.setTextColor(15, 23, 42); doc.text(val, pageW / 2 + 50, y + i * 6); doc.setFont('helvetica', 'normal'); doc.setTextColor(71, 85, 105); });
  y += 30;
  doc.setFillColor(241, 245, 249); doc.rect(14, y, pageW - 28, 18, 'F');
  doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 64, 175);
  doc.text('BILL TO', 18, y + 7);
  doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(15, 23, 42);
  doc.text(inv.projectName, 18, y + 13);
  y += 25;
  autoTable(doc, {
    startY: y,
    head: [['Description', 'SOW #', 'Quantity', 'Rate', 'Amount']],
    body: [[`Professional Services — ${inv.billingPeriod || inv.projectName}`, inv.sowNumber || '—', '1', formatCurrency(inv.amount, inv.currency), formatCurrency(inv.amount, inv.currency)]],
    headStyles: { fillColor: [30, 64, 175], textColor: 255, fontStyle: 'bold', fontSize: 9, cellPadding: 4 },
    bodyStyles: { fontSize: 9, cellPadding: 4 },
    columnStyles: { 2: { halign: 'center' }, 3: { halign: 'right' }, 4: { halign: 'right' } },
    theme: 'grid', margin: { left: 14, right: 14 },
  });
  y = (doc as any).lastAutoTable.finalY + 10;
  const summaryX = pageW - 80;
  const summaryItems = [['Subtotal:', formatCurrency(inv.amount, inv.currency)], ['Tax:', formatCurrency(inv.taxAmount, inv.currency)]];
  doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(71, 85, 105);
  summaryItems.forEach(([label, val], i) => { doc.text(label, summaryX, y + i * 7); doc.setFont('helvetica', 'bold'); doc.setTextColor(15, 23, 42); doc.text(val, pageW - 14, y + i * 7, { align: 'right' }); doc.setFont('helvetica', 'normal'); doc.setTextColor(71, 85, 105); });
  y += 17; doc.setDrawColor(30, 64, 175); doc.setLineWidth(0.5); doc.line(summaryX, y, pageW - 14, y); y += 7;
  doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 64, 175);
  doc.text('TOTAL DUE:', summaryX, y); doc.text(formatCurrency(inv.totalAmount, inv.currency), pageW - 14, y, { align: 'right' });
  y += 20;
  doc.setFillColor(241, 245, 249); doc.rect(14, y, pageW - 28, 30, 'F');
  doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 64, 175);
  doc.text('PAYMENT INFORMATION', 18, y + 7);
  doc.setFont('helvetica', 'normal'); doc.setTextColor(71, 85, 105); doc.setFontSize(8);
  doc.text('Bank: HDFC Bank · Account: XXXX-XXXX-1234 · IFSC: HDFC0001234', 18, y + 14);
  doc.text('Payment Reference: ' + inv.invoiceNumber, 18, y + 20);
  y += 40;
  doc.setFontSize(8); doc.setTextColor(148, 163, 184);
  doc.text('Thank you for your business. Payment is due within 30 days of invoice date.', 14, y);
  doc.text('Terms & Conditions apply. For queries, contact finance@iqa.com', 14, y + 5);
  const safeName = inv.projectName.replace(/[^a-zA-Z0-9]/g, '-');
  doc.save(`INV-${inv.invoiceNumber}-${safeName}.pdf`);
}

const columns = [
  { key: 'invoiceNumber', header: 'Invoice #', render: (i: Invoice) => <span className="font-mono font-semibold text-[#C4B5FD] text-xs">{i.invoiceNumber}</span> },
  { key: 'projectName', header: 'Project', render: (i: Invoice) => <span className="font-medium text-[#F0EDE4]">{i.projectName}</span> },
  { key: 'entity', header: 'Entity', render: (i: Invoice) => <span className={`inline-flex rounded-lg border px-1.5 py-0.5 text-[11px] font-medium ${i.entity === 'US' ? 'border-[rgba(212,175,55,0.2)] bg-[rgba(212,175,55,0.08)] text-[#D4AF37]' : i.entity === 'UK' ? 'border-[rgba(139,92,246,0.2)] bg-[rgba(139,92,246,0.08)] text-[#a78bfa]' : 'border-[rgba(224,168,77,0.2)] bg-[rgba(224,168,77,0.08)] text-[#E0A84D]'}`}>{i.entity}</span> },
  { key: 'invoiceDate', header: 'Invoice Date', render: (i: Invoice) => <span className="text-[#8FA99E] text-xs">{formatDate(i.invoiceDate)}</span> },
  { key: 'dueDate', header: 'Due Date', render: (i: Invoice) => <span className="text-[#8FA99E] text-xs">{formatDate(i.dueDate)}</span> },
  { key: 'totalAmount', header: 'Amount Due', align: 'right' as const, render: (i: Invoice) => <span className="font-semibold tabular-nums text-[#F0EDE4]">{formatCurrency(i.totalAmount, i.currency)}</span> },
  { key: 'status', header: 'Status', render: (i: Invoice) => <StatusBadge status={i.status} /> },
  { key: '_download', header: '', sortable: false, render: (i: Invoice) => <button onClick={(e) => { e.stopPropagation(); generateInvoicePDF(i); }} className="p-1.5 rounded-lg text-[#8FA99E] hover:text-[#D4AF37] hover:bg-[rgba(212,175,55,0.08)] transition-colors" title="Download PDF"><Download size={14} /></button> },
];

export default function Invoices() {
  const { invoices, addInvoice, updateInvoice, projects, sows } = useAppContext();
  const location = useLocation();
  const initialProjectId = (location.state as any)?.projectId || '';
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<DateFilter | null>(null);
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | ''>('');
  const [dateResetKey, setDateResetKey] = useState(0);
  const [form, setForm] = useState({ ...blankForm, projectId: initialProjectId });

  const filtered = useMemo(() => {
    let list = invoices;
    if (statusFilter) list = list.filter(i => i.status === statusFilter);
    if (dateFilter) list = list.filter(i => i.createdAt >= dateFilter.from && i.createdAt <= dateFilter.to);
    return list;
  }, [invoices, statusFilter, dateFilter]);

  const hasActiveFilters = !!(dateFilter || statusFilter);

  const clearAllFilters = useCallback(() => {
    setDateFilter(null);
    setStatusFilter('');
    setDateResetKey(k => k + 1);
  }, []);

  function updateForm(key: string, value: string | number) {
    setForm(prev => {
      const next = { ...prev, [key]: value };
      if (key === 'projectId') { const p = projects.find(pr => pr.id === value); next.projectName = p?.name || ''; next.clientName = p?.clientName || ''; next.billingId = p?.billingId || ''; next.entity = p?.entity || 'US'; next.currency = p?.currency || 'USD'; next.sowId = ''; next.sowNumber = ''; }
      if (key === 'sowId') { const sw = sows.find(s => s.id === value); next.sowNumber = sw?.sowNumber || ''; if (sw) next.currency = sw.currency; }
      if (key === 'amount' || key === 'taxAmount') { const amt = key === 'amount' ? Number(value) : Number(next.amount); const tax = key === 'taxAmount' ? Number(value) : Number(next.taxAmount); next.totalAmount = amt + tax; }
      return next;
    });
  }
  const projectSows = sows.filter(s => s.projectId === form.projectId);
  function openAdd() { const p = initialProjectId ? projects.find(pr => pr.id === initialProjectId) : null; setEditId(null); setForm({ ...blankForm, projectId: initialProjectId, projectName: p?.name || '', clientName: p?.clientName || '' }); setShowForm(true); }
  function openEdit(item: Record<string, unknown>) { const i = item as unknown as Invoice; setEditId(i.id); setForm({ entity: i.entity, projectId: i.projectId, projectName: i.projectName, clientName: i.clientName || '', billingId: i.billingId || '', sowId: i.sowId, sowNumber: i.sowNumber, billingPeriod: i.billingPeriod, invoiceDate: i.invoiceDate, dueDate: i.dueDate, amount: i.amount, currency: i.currency, taxAmount: i.taxAmount, totalAmount: i.totalAmount, status: i.status }); setShowForm(true); }
  function handleSubmit() { if (!form.projectId) return; const data = { ...form, amount: Number(form.amount), taxAmount: Number(form.taxAmount), totalAmount: Number(form.amount) + Number(form.taxAmount) }; if (editId) updateInvoice(editId, data); else addInvoice(data as any); setForm(blankForm); setEditId(null); setShowForm(false); }
  function handleDelete(_item: Record<string, unknown>) { /* Invoice deletion handled via cancel/status change */ }

  return (
    <div className="p-5 lg:p-8 space-y-6">
      <PageHeader
        icon={Receipt}
        title="Invoices"
        description="Issue, track, and download invoices against project billing."
        actions={
          <button onClick={openAdd} className="btn-gold flex items-center gap-2 px-4 py-2 text-sm"><Plus size={15} /> Create Invoice</button>
        }
      />
      {/* Status Quick Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        {([
          { label: 'All', value: '' },
          { label: 'Draft', value: 'Draft' },
          { label: 'Issued', value: 'Sent' },
          { label: 'Paid', value: 'Paid' },
          { label: 'Overdue', value: 'Overdue' },
          { label: 'Cancelled', value: 'Cancelled' },
        ] as { label: string; value: InvoiceStatus | '' }[]).map(f => (
          <button
            key={f.label}
            onClick={() => setStatusFilter(f.value)}
            className={statusFilter === f.value ? 'fi-pill-active' : 'fi-pill'}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Date Filter + Clear All */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <DateFilterBar onApply={setDateFilter} resetKey={dateResetKey} />
        {hasActiveFilters && (
          <button type="button" onClick={clearAllFilters} className="flex items-center gap-1.5 text-xs font-semibold text-[#D4AF37] hover:text-[#F0EDE4] transition-colors">
            <X size={13} /> Clear All Filters
          </button>
        )}
      </div>

      {/* Results count when filters active */}
      {hasActiveFilters && (
        <div className="text-xs text-[#8FA99E]">
          {filtered.length} result{filtered.length !== 1 ? 's' : ''} found
          {statusFilter && <span className="ml-1">• Status: <span className="text-[#D4AF37]">{statusFilter === 'Sent' ? 'Issued' : statusFilter}</span></span>}
          {dateFilter && <span className="ml-1">• Date: <span className="text-[#D4AF37]">{dateFilter.from} → {dateFilter.to}</span></span>}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <div className="glass-card p-4"><p className="text-[10px] font-semibold uppercase tracking-wider text-[#8FA99E]">Total</p><p className="text-2xl font-bold mt-1 text-[#F0EDE4]">{filtered.length}</p></div>
        <div className="glass-card p-4"><p className="text-[10px] font-semibold uppercase tracking-wider text-[#8FA99E]">Paid</p><p className="text-2xl font-bold mt-1 text-[#4CAF87]">{filtered.filter(i => i.status === 'Paid').length}</p></div>
        <div className="glass-card p-4"><p className="text-[10px] font-semibold uppercase tracking-wider text-[#8FA99E]">Issued</p><p className="text-2xl font-bold mt-1 text-[#D4AF37]">{filtered.filter(i => i.status === 'Sent').length}</p></div>
        <div className="glass-card p-4 border-[rgba(226,114,91,0.15)]"><p className="text-[10px] font-semibold uppercase tracking-wider text-[#8FA99E]">Overdue</p><p className="text-2xl font-bold mt-1 text-[#E2725B]">{filtered.filter(i => i.status === 'Overdue').length}</p></div>
        <div className="glass-card p-4"><p className="text-[10px] font-semibold uppercase tracking-wider text-[#8FA99E]">Total Amount</p><p className="text-xl font-bold mt-1 text-[#F0EDE4]">{formatCurrency(filtered.reduce((s, i) => s + i.totalAmount, 0))}</p></div>
      </div>
      <DataTable data={filtered as unknown as Record<string, unknown>[]} columns={columns as any} title="Invoice Register" subtitle={`${filtered.length} invoices`} exportFilename="Invoice_Register" onEdit={openEdit} onDelete={handleDelete} emptyMessage="No invoices have been created yet." />

      <Modal open={showForm} onClose={() => { setShowForm(false); setEditId(null); }} title={editId ? 'Edit Invoice' : 'Create Invoice'} description="Enter invoice details. Tax is auto-calculated." wide>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div><label className="block text-xs font-semibold text-[#BCC5BF] mb-1.5">Invoice Number <span className="text-[10px] text-[#8FA99E] font-normal">{editId ? '' : '[AUTO-GENERATED]'}</span></label><input type="text" value={editId ? (invoices.find(i => i.id === editId)?.invoiceNumber || '') : 'Auto-generated on save'} disabled className="fi-input w-full h-10 px-3 text-sm opacity-50 cursor-not-allowed" /></div>
          <div><label className="block text-xs font-semibold text-[#BCC5BF] mb-1.5">Project <span className="text-[#E2725B]">*</span></label><select value={form.projectId} onChange={e => updateForm('projectId', e.target.value)} className="fi-input w-full h-10 px-3 text-sm"><option value="">Select project...</option>{projects.map(p => <option key={p.id} value={p.id}>{p.name} ({p.projectId})</option>)}</select></div>
          <div><label className="block text-xs font-semibold text-[#BCC5BF] mb-1.5">SOW</label><select value={form.sowId} onChange={e => updateForm('sowId', e.target.value)} className="fi-input w-full h-10 px-3 text-sm" disabled={!form.projectId}><option value="">Select SOW...</option>{projectSows.map(s => <option key={s.id} value={s.id}>{s.sowNumber}</option>)}</select></div>
          <div><label className="block text-xs font-semibold text-[#BCC5BF] mb-1.5">Entity</label><select value={form.entity} onChange={e => updateForm('entity', e.target.value)} className="fi-input w-full h-10 px-3 text-sm"><option value="US">US</option><option value="UK">UK</option><option value="India">India</option></select></div>
          <div><label className="block text-xs font-semibold text-[#BCC5BF] mb-1.5">Billing Period</label><input type="text" value={form.billingPeriod} onChange={e => updateForm('billingPeriod', e.target.value)} placeholder="Sep 2026" className="fi-input w-full h-10 px-3 text-sm" /></div>
          <div><label className="block text-xs font-semibold text-[#BCC5BF] mb-1.5">Invoice Date <span className="text-[#E2725B]">*</span></label><DatePicker value={form.invoiceDate} rangeStart={form.invoiceDate} rangeEnd={form.dueDate} onChange={v => updateForm('invoiceDate', v)} /></div>
          <div><label className="block text-xs font-semibold text-[#BCC5BF] mb-1.5">Due Date <span className="text-[#E2725B]">*</span></label><DatePicker value={form.dueDate} rangeStart={form.invoiceDate} rangeEnd={form.dueDate} onChange={v => updateForm('dueDate', v)} /></div>
          <div><label className="block text-xs font-semibold text-[#BCC5BF] mb-1.5">Net Amount <span className="text-[#E2725B]">*</span></label><input type="number" value={form.amount || ''} onChange={e => updateForm('amount', e.target.value)} placeholder="0" className="fi-input w-full h-10 px-3 text-sm" /></div>
          <div><label className="block text-xs font-semibold text-[#BCC5BF] mb-1.5">Tax / GST</label><input type="number" value={form.taxAmount || ''} onChange={e => updateForm('taxAmount', e.target.value)} placeholder="0" className="fi-input w-full h-10 px-3 text-sm" /></div>
          <div><label className="block text-xs font-semibold text-[#BCC5BF] mb-1.5">Gross Amount</label><input type="text" value={formatCurrency(Number(form.amount) + Number(form.taxAmount), form.currency)} readOnly className="fi-input w-full h-10 px-3 text-sm font-bold opacity-60 cursor-not-allowed" /></div>
          <div><label className="block text-xs font-semibold text-[#BCC5BF] mb-1.5">Status</label><select value={form.status} onChange={e => updateForm('status', e.target.value)} className="fi-input w-full h-10 px-3 text-sm"><option value="Draft">Draft</option><option value="Sent">Issued</option><option value="Paid">Paid</option><option value="Partially Paid">Partially Paid</option><option value="Overdue">Overdue</option><option value="Cancelled">Cancelled</option></select></div>
          <div className="sm:col-span-2 flex gap-3 pt-4 border-t border-[rgba(255,255,255,0.06)] mt-2">
            <button onClick={handleSubmit} disabled={!form.projectId} className="btn-gold flex-1 py-2.5 text-sm">{editId ? 'Save Changes' : 'Create Invoice'}</button>
            <button onClick={() => { setShowForm(false); setEditId(null); setForm(blankForm); }} className="btn-ghost flex-1 py-2.5 text-sm">Cancel</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
