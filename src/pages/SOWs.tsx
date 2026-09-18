import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { FileText, Plus, AlertTriangle, X, Info } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import DataTable from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';
import DateFilterBar from '../components/DateFilterBar';
import Modal from '../components/Modal';
import PageHeader from '../components/PageHeader';
import DatePicker from '../components/DatePicker';
import ManagerSelect from '../components/ManagerSelect';
import FileAttach from '../components/FileAttach';
import { formatCurrency, formatDate } from '../utils/format';
import { fxApi } from '../services/api';
import type { SOW, DateFilter, Currency, SOWStatus, SowType, SowBasis } from '../types';

const blankForm = {
  projectId: '',
  title: '',
  startDate: '',
  endDate: '',
  sowType: 'T&M' as SowType,
  contractValue: 0,
  basis: 'Monthly' as SowBasis,
  currency: 'USD' as Currency,
  status: 'Draft' as SOWStatus,
  remarks: '',
  projectManager: '',
  deliveryManager: '',
  poNumber: '',
  sowOriginalName: '',
  poOriginalName: '',
};

const columns = [
  { key: 'sowNumber', header: 'SOW #', render: (s: SOW) => <span className="font-mono font-semibold text-[#C4B5FD] text-xs">{s.sowNumber}</span> },
  { key: 'projectName', header: 'Project', render: (s: SOW) => <span className="font-medium text-[#F0EDE4]">{s.projectName}</span> },
  { key: 'clientName', header: 'Client', render: (s: SOW) => <span className="text-sm text-[#BCC5BF]">{s.clientName || '—'}</span> },
  { key: 'sowType', header: 'Type', render: (s: SOW) => <span className="text-xs text-[#C7D2E0]">{s.sowType || s.contractType}</span> },
  { key: 'contractValue', header: 'Amount', align: 'right' as const, render: (s: SOW) => <span className="font-semibold tabular-nums text-[#F0EDE4]">{formatCurrency(s.contractValue, s.currency)}</span> },
  { key: 'basis', header: 'Basis', render: (s: SOW) => <span className="text-xs text-[#8FA99E]">{s.basis || '—'}</span> },
  { key: 'startDate', header: 'Start', render: (s: SOW) => <span className="text-[#8FA99E] text-xs">{formatDate(s.startDate)}</span> },
  { key: 'endDate', header: 'End', render: (s: SOW) => <span className="text-[#8FA99E] text-xs">{formatDate(s.endDate)}</span> },
  { key: 'remarks', header: 'Remarks', render: (s: SOW) => <span className="text-xs text-[#8FA99E] line-clamp-1 max-w-[180px]">{s.remarks || '—'}</span> },
  { key: 'status', header: 'Status', render: (s: SOW) => <StatusBadge status={s.status} /> },
];

export default function SOWs() {
  const { sows, addSOW, updateSOW, projects, clients } = useAppContext();
  const location = useLocation();
  const initialProjectId = (location.state as { projectId?: string } | null)?.projectId || '';
  const [showForm, setShowForm] = useState(false);
  const [editNumber, setEditNumber] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<DateFilter | null>(null);
  const [statusFilter, setStatusFilter] = useState<SOWStatus | ''>('');
  const [dateResetKey, setDateResetKey] = useState(0);
  const [form, setForm] = useState({ ...blankForm, projectId: initialProjectId });
  const [rates, setRates] = useState<Record<string, number>>({ USD: 1 });
  const [rateDate, setRateDate] = useState('');
  const [fxError, setFxError] = useState('');

  useEffect(() => {
    let cancelled = false;
    fxApi.rates(form.currency).then(data => {
      if (cancelled) return;
      setRates(data.rates || { [form.currency]: 1 });
      setRateDate(data.date || '');
      setFxError('');
    }).catch(() => {
      if (!cancelled) setFxError('Live rates unavailable');
    });
    return () => { cancelled = true; };
  }, [form.currency]);

  const filtered = useMemo(() => {
    let list = sows;
    if (statusFilter) list = list.filter(s => s.status === statusFilter);
    if (dateFilter) list = list.filter(s => s.createdAt >= dateFilter.from && s.createdAt <= dateFilter.to);
    return list;
  }, [sows, statusFilter, dateFilter]);

  const hasActiveFilters = !!(dateFilter || statusFilter);
  const clearAllFilters = useCallback(() => {
    setDateFilter(null);
    setStatusFilter('');
    setDateResetKey(k => k + 1);
  }, []);

  const totalValue = filtered.filter(s => s.status === 'Active').reduce((sum, s) => sum + s.contractValue, 0);
  const expiring = filtered.filter(s => s.status === 'Active' && s.endDate && new Date(s.endDate) <= new Date(Date.now() + 180 * 86400000));

  function updateForm(key: string, value: string | number) {
    setForm(prev => {
      const next = { ...prev, [key]: value };
      if (key === 'projectId') {
        const p = projects.find(pr => pr.projectId === value || pr.id === value);
        if (p) {
          next.projectManager = next.projectManager || p.projectManager;
          next.deliveryManager = next.deliveryManager || p.deliveryManager;
        }
      }
      return next;
    });
  }

  function resolveProjectId(raw: string) {
    const p = projects.find(pr => pr.projectId === raw || pr.id === raw);
    return p?.projectId || raw;
  }

  function openAdd() {
    const resolved = resolveProjectId(initialProjectId);
    const p = projects.find(pr => pr.projectId === resolved);
    setEditNumber(null);
    setForm({
      ...blankForm,
      projectId: resolved,
      projectManager: p?.projectManager || '',
      deliveryManager: p?.deliveryManager || '',
    });
    setShowForm(true);
  }

  function openEdit(item: Record<string, unknown>) {
    const s = item as unknown as SOW;
    setEditNumber(s.sowNumber);
    setForm({
      projectId: s.projectId,
      title: s.title || '',
      startDate: s.startDate,
      endDate: s.endDate,
      sowType: s.sowType || 'T&M',
      contractValue: s.contractValue,
      basis: s.basis || 'Monthly',
      currency: s.currency,
      status: s.status,
      remarks: s.remarks || '',
      projectManager: s.projectManager || '',
      deliveryManager: s.deliveryManager || '',
      poNumber: s.poNumber || '',
      sowOriginalName: s.sowOriginalName || '',
      poOriginalName: s.poOriginalName || '',
    });
    setShowForm(true);
  }

  async function handleSubmit() {
    if (!form.projectId || !form.startDate || !form.endDate) return;
    const project = projects.find(p => p.projectId === form.projectId || p.id === form.projectId);
    const payload = {
      ...form,
      projectId: project?.projectId || form.projectId,
      title: form.title || `SOW — ${project?.name || 'Project'}`,
      contractType: (form.sowType === 'Fixed' ? 'Fixed' : form.sowType) as SOW['contractType'],
      contractValue: Number(form.contractValue),
      billingFrequency: form.basis === 'Hourly' ? 'Monthly' : form.basis,
    };
    if (editNumber) await updateSOW(editNumber, payload);
    else await addSOW(payload as Partial<SOW>);
    setForm(blankForm);
    setEditNumber(null);
    setShowForm(false);
  }

  const selectedProject = projects.find(p => p.projectId === form.projectId || p.id === form.projectId);
  const selectedClient = clients.find(c => c.clientId === selectedProject?.clientId);
  const amount = Number(form.contractValue) || 0;
  const fxLines = (['USD', 'INR', 'GBP'] as Currency[])
    .filter(c => c !== form.currency)
    .map(c => {
      const fromRate = rates[form.currency] || 1;
      const toRate = rates[c];
      if (!toRate) return `${c}: —`;
      const converted = amount * (toRate / fromRate);
      return `${c} ${converted.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
    });

  return (
    <div className="p-5 lg:p-8 space-y-6">
      <PageHeader
        icon={FileText}
        title="SOWs"
        description="Linked to clients and projects. Remarks stay visible on the register."
        actions={
          <button onClick={openAdd} className="btn-imanage flex items-center gap-2 px-4 py-2 text-sm"><Plus size={15} /> Add SOW</button>
        }
      />

      <div className="flex items-center gap-2 flex-wrap">
        {([
          { label: 'All', value: '' },
          { label: 'Active', value: 'Active' },
          { label: 'Draft', value: 'Draft' },
          { label: 'Expired', value: 'Expired' },
          { label: 'Cancelled', value: 'Cancelled' },
        ] as { label: string; value: SOWStatus | '' }[]).map(f => (
          <button key={f.label} onClick={() => setStatusFilter(f.value)} className={statusFilter === f.value ? 'fi-pill-active' : 'fi-pill'}>
            {f.label}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <DateFilterBar onApply={setDateFilter} resetKey={dateResetKey} />
        {hasActiveFilters && (
          <button type="button" onClick={clearAllFilters} className="flex items-center gap-1.5 text-xs font-semibold text-[#7EB6FF] hover:text-[#F0EDE4]">
            <X size={13} /> Clear All Filters
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="glass-card p-4"><p className="text-[10px] font-semibold uppercase tracking-wider text-[#8FA99E]">Active</p><p className="text-2xl font-bold mt-1 text-[#4CAF87]">{filtered.filter(s => s.status === 'Active').length}</p></div>
        <div className="glass-card p-4"><p className="text-[10px] font-semibold uppercase tracking-wider text-[#8FA99E]">Total Value</p><p className="text-2xl font-bold mt-1 text-[#F0EDE4]">{formatCurrency(totalValue)}</p></div>
        <div className="glass-card p-4 border-[rgba(224,168,77,0.15)]"><div className="flex items-center gap-1.5"><AlertTriangle size={13} className="text-[#E0A84D]" /><p className="text-[10px] font-semibold uppercase tracking-wider text-[#8FA99E]">Expiring Soon</p></div><p className="text-2xl font-bold mt-1 text-[#E0A84D]">{expiring.length}</p></div>
        <div className="glass-card p-4"><p className="text-[10px] font-semibold uppercase tracking-wider text-[#8FA99E]">Cancelled</p><p className="text-2xl font-bold mt-1 text-[#E2725B]">{filtered.filter(s => s.status === 'Cancelled').length}</p></div>
      </div>

      <DataTable
        data={filtered as unknown as Record<string, unknown>[]}
        columns={columns as any}
        title="SOW Register"
        subtitle={`${filtered.length} statements of work`}
        exportFilename="SOW_Register"
        onEdit={openEdit}
        onDelete={() => undefined}
        emptyMessage="No statements of work yet. Add an SOW to bind a commercial agreement to a project and client."
      />

      <Modal open={showForm} onClose={() => { setShowForm(false); setEditNumber(null); }} title={editNumber ? 'Edit SOW' : 'Add SOW'} description="SOW details stay linked to the selected project and its client." wide>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-[#BCC5BF] mb-1.5">SOW Number</label>
            <input disabled value={editNumber || 'SOW-XXXXXX (generated on save)'} className="fi-input w-full h-10 px-3 text-sm opacity-60 font-mono" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#BCC5BF] mb-1.5">Project Name <span className="text-[#E2725B]">*</span></label>
            <select value={form.projectId} onChange={e => updateForm('projectId', e.target.value)} className="fi-input w-full h-10 px-3 text-sm">
              <option value="">Select project...</option>
              {projects.map(p => <option key={p.projectId} value={p.projectId}>{p.name} · {p.clientName}</option>)}
            </select>
            {selectedClient && <p className="text-[11px] text-[#8FA99E] mt-1">Client: {selectedClient.name} ({selectedClient.clientId})</p>}
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-[#BCC5BF] mb-1.5">SOW Title</label>
            <input value={form.title} onChange={e => updateForm('title', e.target.value)} placeholder="Optional working title" className="fi-input w-full h-10 px-3 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#BCC5BF] mb-1.5">SOW Start Date</label>
            <DatePicker value={form.startDate} rangeStart={form.startDate} rangeEnd={form.endDate} onChange={v => updateForm('startDate', v)} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#BCC5BF] mb-1.5">End Date</label>
            <DatePicker value={form.endDate} rangeStart={form.startDate} rangeEnd={form.endDate} onChange={v => updateForm('endDate', v)} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#BCC5BF] mb-1.5">SOW Type</label>
            <select value={form.sowType} onChange={e => updateForm('sowType', e.target.value)} className="fi-input w-full h-10 px-3 text-sm">
              <option value="T&M">T&M</option>
              <option value="FTE">FTE</option>
              <option value="Fixed">Fixed</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#BCC5BF] mb-1.5">Basis</label>
            <select value={form.basis} onChange={e => updateForm('basis', e.target.value)} className="fi-input w-full h-10 px-3 text-sm">
              <option value="Hourly">Hourly</option>
              <option value="Monthly">Monthly</option>
              <option value="Milestone">Milestone</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#BCC5BF] mb-1.5">Currency</label>
            <select value={form.currency} onChange={e => updateForm('currency', e.target.value)} className="fi-input w-full h-10 px-3 text-sm">
              <option value="USD">USD</option>
              <option value="INR">INR</option>
              <option value="GBP">GBP</option>
            </select>
            {fxError && <p className="text-[11px] text-[#E0A84D] mt-1">{fxError}</p>}
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#BCC5BF] mb-1.5">SOW Amount</label>
            <div className="relative">
              <input type="number" value={form.contractValue || ''} onChange={e => updateForm('contractValue', e.target.value)} className="fi-input w-full h-10 px-3 pr-9 text-sm" placeholder="0" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 group">
                <Info size={15} className="text-[#7EB6FF] cursor-help" />
                <span className="pointer-events-none absolute right-0 top-6 z-10 hidden w-56 rounded-lg border border-[rgba(126,182,255,0.2)] bg-[#121820] px-3 py-2 text-[11px] text-[#C7D2E0] shadow-xl group-hover:block">
                  <p className="font-semibold text-[#F0EDE4] mb-1">{formatCurrency(amount, form.currency)}</p>
                  {fxLines.map(line => <p key={line}>{line}</p>)}
                  {rateDate && <p className="mt-1 text-[#8FA99E]">ECB rates · {rateDate}</p>}
                </span>
              </span>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#BCC5BF] mb-1.5">Project Manager</label>
            <ManagerSelect type="Project Manager" value={form.projectManager} onChange={v => updateForm('projectManager', v)} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#BCC5BF] mb-1.5">Delivery Manager</label>
            <ManagerSelect type="Delivery Manager" value={form.deliveryManager} onChange={v => updateForm('deliveryManager', v)} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#BCC5BF] mb-1.5">Purchase Order Number</label>
            <input value={form.poNumber} onChange={e => updateForm('poNumber', e.target.value)} className="fi-input w-full h-10 px-3 text-sm" placeholder="PO-..." />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#BCC5BF] mb-1.5">Status</label>
            <select value={form.status} onChange={e => updateForm('status', e.target.value)} className="fi-input w-full h-10 px-3 text-sm">
              <option value="Draft">Draft</option>
              <option value="In Review">In Review</option>
              <option value="Approved">Approved</option>
              <option value="Active">Active</option>
              <option value="Expired">Expired</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-[#BCC5BF] mb-1.5">Remarks</label>
            <textarea value={form.remarks} onChange={e => updateForm('remarks', e.target.value)} rows={3} className="fi-input w-full px-3 py-2 text-sm" placeholder="Visible comment on this SOW" />
          </div>
          <FileAttach label="SOW attachment" value={form.sowOriginalName} onChange={v => updateForm('sowOriginalName', v)} hint="Signed SOW document" />
          <FileAttach label="PO attachment" value={form.poOriginalName} onChange={v => updateForm('poOriginalName', v)} hint="Purchase order document" />
          <div className="sm:col-span-2 flex gap-3 pt-4 border-t border-[rgba(255,255,255,0.06)]">
            <button onClick={handleSubmit} disabled={!form.projectId} className="btn-imanage flex-1 py-2.5 text-sm">{editNumber ? 'Save Changes' : 'Add SOW'}</button>
            <button onClick={() => { setShowForm(false); setEditNumber(null); setForm(blankForm); }} className="btn-ghost flex-1 py-2.5 text-sm">Cancel</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
