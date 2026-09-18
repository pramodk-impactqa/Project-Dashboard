import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Edit3, Plus, Receipt, CreditCard, AlertTriangle, FileText,
  Building2, User, Calendar, DollarSign, Clock, ChevronDown,
  FolderKanban, Ban, PlayCircle, PauseCircle, Inbox, Hash,
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import StatusBadge from '../components/StatusBadge';
import KPICard from '../components/KPICard';
import Modal from '../components/Modal';
import { formatCurrency, formatDate } from '../utils/format';
import type { ProjectStatus } from '../types';

const tabs = ['Overview', 'Client', 'Billing', 'SOWs', 'Invoices', 'Payments', 'Financial Summary', 'Activity'] as const;
type Tab = typeof tabs[number];

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { projects, sows, invoices, payments, updateProject, auditLog } = useAppContext();
  const [activeTab, setActiveTab] = useState<Tab>('Overview');
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [newStatus, setNewStatus] = useState<ProjectStatus>('Active');
  const [statusReason, setStatusReason] = useState('');

  const project = projects.find(p => p.id === id || p.projectId === id);
  const projectSows = useMemo(() => sows.filter(s => s.projectId === project?.projectId || s.projectId === id), [sows, id, project?.projectId]);
  const projectInvoices = useMemo(() => invoices.filter(i => i.projectId === project?.projectId || i.projectId === id), [invoices, id, project?.projectId]);
  const projectPayments = useMemo(() => {
    const invIds = new Set(projectInvoices.map(i => i.id));
    return payments.filter(p => p.projectId === project?.projectId || p.projectId === id || invIds.has(p.invoiceId));
  }, [payments, projectInvoices, id, project?.projectId]);
  const projectAudit = useMemo(() => auditLog.filter(a => a.entityId === project?.projectId), [auditLog, project?.projectId]);

  if (!project) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-lg font-bold text-[#F0EDE4]">Project not found</h2>
        <p className="text-sm text-[#8FA99E] mt-2">The project you're looking for does not exist or has been removed.</p>
        <button onClick={() => navigate('/projects')} className="mt-4 text-sm font-semibold text-[#8FA99E] hover:text-[#D4AF37] transition-colors">← Back to All Projects</button>
      </div>
    );
  }

  // Financial calculations
  const totalSowValue = projectSows.reduce((s, w) => s + w.contractValue, 0);
  const totalInvoiced = projectInvoices.reduce((s, i) => s + i.totalAmount, 0);
  const totalPaid = projectPayments.reduce((s, p) => s + p.amountReceived, 0);
  const outstanding = totalInvoiced - totalPaid;
  const overdue = projectInvoices.filter(i => i.status === 'Overdue').reduce((s, i) => s + i.totalAmount, 0);

  function handleStatusChange() {
    updateProject(project!.id, { status: newStatus });
    setShowStatusModal(false);
    setStatusReason('');
  }

  const allowedStatusTransitions: Record<ProjectStatus, ProjectStatus[]> = {
    'Active': ['On Hold', 'Inactive'],
    'On Hold': ['Active', 'Inactive'],
    'Inactive': ['Active'],
  };

  return (
    <div className="p-5 lg:p-8 space-y-5">
      {/* Breadcrumb + Back */}
      <button onClick={() => navigate('/projects')} className="flex items-center gap-1.5 text-xs font-semibold text-[#8FA99E] hover:text-[#D4AF37] transition-colors">
        <ArrowLeft size={14} /> Back to All Projects
      </button>

      {/* Project Header */}
      <div className="glass-card p-5">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-[#F0EDE4]">{project.name}</h1>
              <StatusBadge status={project.status} />
            </div>
            <div className="flex items-center gap-4 text-xs text-[#8FA99E] flex-wrap">
              <span className="flex items-center gap-1"><Hash size={11} /><span className="font-mono font-semibold text-[#D4AF37]">{project.projectId}</span></span>
              <span className="flex items-center gap-1"><Building2 size={11} /> {project.clientName}</span>
              <span className="flex items-center gap-1"><span className="font-mono text-[#BCC5BF]">{project.clientId}</span></span>
            </div>
            {project.description && <p className="text-sm text-[#8FA99E] mt-1">{project.description}</p>}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => navigate(`/projects/${id}/edit`)} className="btn-ghost flex items-center gap-1.5 text-xs">
              <Edit3 size={13} /> Edit Project
            </button>
            <div className="relative group">
              <button className="btn-ghost flex items-center gap-1.5 text-xs">
                Change Status <ChevronDown size={12} />
              </button>
              <div className="absolute right-0 top-full mt-1 w-44 rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#1a2a22] shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-20">
                {allowedStatusTransitions[project.status].map(s => (
                  <button key={s} onClick={() => { setNewStatus(s); setShowStatusModal(true); }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-xs font-medium text-[#BCC5BF] hover:bg-[rgba(212,175,55,0.08)] hover:text-[#D4AF37] transition-colors first:rounded-t-lg last:rounded-b-lg"
                  >
                    {s === 'Active' && <PlayCircle size={13} className="text-[#4CAF87]" />}
                    {s === 'On Hold' && <PauseCircle size={13} className="text-[#E0A84D]" />}
                    {s === 'Inactive' && <Ban size={13} className="text-[#8FA99E]" />}
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <button onClick={() => navigate('/sows', { state: { projectId: project.projectId } })} className="btn-emerald flex items-center gap-1.5 text-xs">
              <Plus size={13} /> Add SOW
            </button>
            <button onClick={() => navigate('/invoices', { state: { projectId: id } })} className="btn-gold flex items-center gap-1.5 text-xs">
              <Receipt size={13} /> Create Invoice
            </button>
            <button onClick={() => navigate('/payments', { state: { projectId: id } })} className="btn-emerald flex items-center gap-1.5 text-xs">
              <CreditCard size={13} /> Record Payment
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {tabs.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={activeTab === tab ? 'fi-pill-active' : 'fi-pill'}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="min-h-[300px]">
        {activeTab === 'Overview' && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              <KPICard title="Contract Value" value={formatCurrency(totalSowValue, project.currency)} icon={DollarSign} color="gold" />
              <KPICard title="SOW Value" value={formatCurrency(totalSowValue, project.currency)} subtitle={`${projectSows.length} SOWs`} icon={FileText} color="emerald" />
              <KPICard title="Total Invoiced" value={formatCurrency(totalInvoiced, project.currency)} subtitle={`${projectInvoices.length} invoices`} icon={Receipt} color="gold" />
              <KPICard title="Total Collected" value={formatCurrency(totalPaid, project.currency)} icon={CreditCard} color="green" />
              <KPICard title="Outstanding" value={formatCurrency(outstanding, project.currency)} icon={Clock} color="amber" />
              <KPICard title="Overdue" value={formatCurrency(overdue, project.currency)} icon={AlertTriangle} color="red" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="glass-card p-5">
                <h3 className="text-sm font-bold text-[#F0EDE4] mb-4 flex items-center gap-2"><FolderKanban size={15} className="text-[#D4AF37]" /> Project Information</h3>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                  <div><dt className="text-[10px] font-semibold uppercase tracking-wider text-[#8FA99E]">Project ID</dt><dd className="font-mono font-semibold text-[#D4AF37]">{project.projectId}</dd></div>
                  <div><dt className="text-[10px] font-semibold uppercase tracking-wider text-[#8FA99E]">Status</dt><dd><StatusBadge status={project.status} /></dd></div>
                  <div><dt className="text-[10px] font-semibold uppercase tracking-wider text-[#8FA99E]">Industry</dt><dd className="text-[#BCC5BF]">{project.domain}</dd></div>
                  <div><dt className="text-[10px] font-semibold uppercase tracking-wider text-[#8FA99E]">Entity</dt><dd className="text-[#BCC5BF]">{project.entity}</dd></div>
                  <div><dt className="text-[10px] font-semibold uppercase tracking-wider text-[#8FA99E]">Currency</dt><dd className="text-[#BCC5BF]">{project.currency}</dd></div>
                  <div><dt className="text-[10px] font-semibold uppercase tracking-wider text-[#8FA99E]">Department</dt><dd className="text-[#BCC5BF]">{project.department}</dd></div>
                  <div><dt className="text-[10px] font-semibold uppercase tracking-wider text-[#8FA99E]">Start Date</dt><dd className="text-[#BCC5BF]">{formatDate(project.startDate)}</dd></div>
                  <div><dt className="text-[10px] font-semibold uppercase tracking-wider text-[#8FA99E]">End Date</dt><dd className="text-[#BCC5BF]">{formatDate(project.endDate)}</dd></div>
                </dl>
              </div>
              <div className="glass-card p-5">
                <h3 className="text-sm font-bold text-[#F0EDE4] mb-4 flex items-center gap-2"><User size={15} className="text-[#D4AF37]" /> Ownership</h3>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                  <div><dt className="text-[10px] font-semibold uppercase tracking-wider text-[#8FA99E]">Project Manager</dt><dd className="text-[#BCC5BF]">{project.projectManager || '—'}</dd></div>
                  <div><dt className="text-[10px] font-semibold uppercase tracking-wider text-[#8FA99E]">Delivery Manager</dt><dd className="text-[#BCC5BF]">{project.deliveryManager || '—'}</dd></div>
                  <div><dt className="text-[10px] font-semibold uppercase tracking-wider text-[#8FA99E]">Client</dt><dd className="text-[#BCC5BF]">{project.clientName}</dd></div>
                  <div><dt className="text-[10px] font-semibold uppercase tracking-wider text-[#8FA99E]">Client ID</dt><dd className="font-mono text-xs text-[#BCC5BF]">{project.clientId}</dd></div>
                </dl>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'Client' && (
          <div className="glass-card p-5">
            <h3 className="text-sm font-bold text-[#F0EDE4] mb-4 flex items-center gap-2"><Building2 size={15} className="text-[#D4AF37]" /> Client Information</h3>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 text-sm">
              <div><dt className="text-[10px] font-semibold uppercase tracking-wider text-[#8FA99E]">Client Name</dt><dd className="font-semibold text-[#F0EDE4]">{project.clientName}</dd></div>
              <div><dt className="text-[10px] font-semibold uppercase tracking-wider text-[#8FA99E]">Client ID</dt><dd className="font-mono text-[#D4AF37]">{project.clientId}</dd></div>
              <div><dt className="text-[10px] font-semibold uppercase tracking-wider text-[#8FA99E]">Address</dt><dd className="text-[#BCC5BF]">{project.clientAddress || '—'}</dd></div>
              <div><dt className="text-[10px] font-semibold uppercase tracking-wider text-[#8FA99E]">Tax ID / GST / VAT</dt><dd className="text-[#BCC5BF]">{project.clientTaxId || '—'}</dd></div>
              <div><dt className="text-[10px] font-semibold uppercase tracking-wider text-[#8FA99E]">Industry</dt><dd className="text-[#BCC5BF]">{project.domain}</dd></div>
              <div><dt className="text-[10px] font-semibold uppercase tracking-wider text-[#8FA99E]">Entity</dt><dd className="text-[#BCC5BF]">{project.entity}</dd></div>
              <div><dt className="text-[10px] font-semibold uppercase tracking-wider text-[#8FA99E]">Currency</dt><dd className="text-[#BCC5BF]">{project.currency}</dd></div>
              <div><dt className="text-[10px] font-semibold uppercase tracking-wider text-[#8FA99E]">MSA</dt><dd className="text-[#BCC5BF]">{project.msaOriginalName || 'No MSA attached'}</dd></div>
            </dl>
          </div>
        )}

        {activeTab === 'Billing' && (
          <div className="glass-card p-5">
            <h3 className="text-sm font-bold text-[#F0EDE4] mb-4 flex items-center gap-2"><DollarSign size={15} className="text-[#D4AF37]" /> Billing Configuration</h3>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 text-sm">
              <div><dt className="text-[10px] font-semibold uppercase tracking-wider text-[#8FA99E]">Billing ID</dt><dd className="font-mono font-semibold text-[#D4AF37]">{project.billingId}</dd></div>
              <div><dt className="text-[10px] font-semibold uppercase tracking-wider text-[#8FA99E]">Billing Model</dt><dd className="text-[#BCC5BF]">{project.billingModel}</dd></div>
              <div><dt className="text-[10px] font-semibold uppercase tracking-wider text-[#8FA99E]">Payment Terms</dt><dd className="text-[#BCC5BF]">{project.paymentTerms}</dd></div>
              <div><dt className="text-[10px] font-semibold uppercase tracking-wider text-[#8FA99E]">Billing Frequency</dt><dd className="text-[#BCC5BF]">{project.billingFrequency}</dd></div>
              <div><dt className="text-[10px] font-semibold uppercase tracking-wider text-[#8FA99E]">Billing Contact</dt><dd className="text-[#BCC5BF]">{project.billingContact || '—'}</dd></div>
              <div className="sm:col-span-2"><dt className="text-[10px] font-semibold uppercase tracking-wider text-[#8FA99E]">Billing Address</dt><dd className="text-[#BCC5BF]">{project.billingAddress || '—'}</dd></div>
            </dl>
          </div>
        )}

        {activeTab === 'SOWs' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#F0EDE4]">Statements of Work</h3>
              <span className="text-[11px] text-[#8FA99E]">Read-only on the project. Manage SOWs from the SOWs tab.</span>
            </div>
            {projectSows.length === 0 ? (
              <div className="text-center py-12 text-[#8FA99E]">
                <Inbox size={28} className="mx-auto mb-2 text-[#8FA99E]" />
                <p className="text-sm font-medium">No SOWs have been created for this project.</p>
              </div>
            ) : (
              <div className="rounded-lg border border-[rgba(255,255,255,0.08)] overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] text-[10px] font-semibold uppercase tracking-wider text-[#8FA99E]">
                      <th className="px-3 py-2.5 text-left">SOW #</th>
                      <th className="px-3 py-2.5 text-left">Title</th>
                      <th className="px-3 py-2.5 text-left">Type</th>
                      <th className="px-3 py-2.5 text-right">Value</th>
                      <th className="px-3 py-2.5 text-left">Start</th>
                      <th className="px-3 py-2.5 text-left">End</th>
                      <th className="px-3 py-2.5 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projectSows.map(s => (
                      <tr key={s.id} className="border-b border-[rgba(255,255,255,0.06)] hover:bg-[rgba(212,175,55,0.04)]">
                        <td className="px-3 py-2.5 font-mono font-semibold text-[#D4AF37] text-xs">{s.sowNumber}</td>
                        <td className="px-3 py-2.5 font-medium text-[#F0EDE4]">{s.title || s.sowNumber}</td>
                        <td className="px-3 py-2.5"><span className={`inline-flex rounded-md border px-1.5 py-0.5 text-[11px] font-medium ${s.contractType === 'T&M' ? 'border-[rgba(212,175,55,0.3)] bg-[rgba(212,175,55,0.08)] text-[#D4AF37]' : 'border-[rgba(30,138,110,0.3)] bg-[rgba(30,138,110,0.08)] text-[#1E8A6E]'}`}>{s.contractType}</span></td>
                        <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-[#F0EDE4]">{formatCurrency(s.contractValue, s.currency)}</td>
                        <td className="px-3 py-2.5 text-xs text-[#8FA99E]">{formatDate(s.startDate)}</td>
                        <td className="px-3 py-2.5 text-xs text-[#8FA99E]">{formatDate(s.endDate)}</td>
                        <td className="px-3 py-2.5"><StatusBadge status={s.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'Invoices' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#F0EDE4]">Invoices</h3>
              <button onClick={() => navigate('/invoices', { state: { projectId: id } })} className="btn-gold flex items-center gap-1.5 text-xs">
                <Plus size={13} /> Create Invoice
              </button>
            </div>
            {projectInvoices.length === 0 ? (
              <div className="text-center py-12 text-[#8FA99E]">
                <Inbox size={28} className="mx-auto mb-2 text-[#8FA99E]" />
                <p className="text-sm font-medium">No invoices have been generated for this project.</p>
              </div>
            ) : (
              <div className="rounded-lg border border-[rgba(255,255,255,0.08)] overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] text-[10px] font-semibold uppercase tracking-wider text-[#8FA99E]">
                      <th className="px-3 py-2.5 text-left">Invoice #</th>
                      <th className="px-3 py-2.5 text-left">SOW</th>
                      <th className="px-3 py-2.5 text-left">Period</th>
                      <th className="px-3 py-2.5 text-right">Amount</th>
                      <th className="px-3 py-2.5 text-left">Date</th>
                      <th className="px-3 py-2.5 text-left">Due</th>
                      <th className="px-3 py-2.5 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projectInvoices.map(inv => (
                      <tr key={inv.id} className="border-b border-[rgba(255,255,255,0.06)] hover:bg-[rgba(212,175,55,0.04)]">
                        <td className="px-3 py-2.5 font-mono font-semibold text-[#D4AF37] text-xs">{inv.invoiceNumber}</td>
                        <td className="px-3 py-2.5 font-mono text-xs text-[#8FA99E]">{inv.sowNumber || '—'}</td>
                        <td className="px-3 py-2.5 text-xs text-[#BCC5BF]">{inv.billingPeriod || '—'}</td>
                        <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-[#F0EDE4]">{formatCurrency(inv.totalAmount, inv.currency)}</td>
                        <td className="px-3 py-2.5 text-xs text-[#8FA99E]">{formatDate(inv.invoiceDate)}</td>
                        <td className="px-3 py-2.5 text-xs text-[#8FA99E]">{formatDate(inv.dueDate)}</td>
                        <td className="px-3 py-2.5"><StatusBadge status={inv.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'Payments' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#F0EDE4]">Payment History</h3>
              <button onClick={() => navigate('/payments', { state: { projectId: id } })} className="btn-emerald flex items-center gap-1.5 text-xs">
                <Plus size={13} /> Record Payment
              </button>
            </div>
            {projectPayments.length === 0 ? (
              <div className="text-center py-12 text-[#8FA99E]">
                <Inbox size={28} className="mx-auto mb-2 text-[#8FA99E]" />
                <p className="text-sm font-medium">No payments have been recorded for this project.</p>
              </div>
            ) : (
              <div className="rounded-lg border border-[rgba(255,255,255,0.08)] overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] text-[10px] font-semibold uppercase tracking-wider text-[#8FA99E]">
                      <th className="px-3 py-2.5 text-left">Invoice #</th>
                      <th className="px-3 py-2.5 text-right">Amount</th>
                      <th className="px-3 py-2.5 text-left">Date</th>
                      <th className="px-3 py-2.5 text-left">Bank</th>
                      <th className="px-3 py-2.5 text-right">Outstanding</th>
                      <th className="px-3 py-2.5 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projectPayments.map(p => (
                      <tr key={p.id} className="border-b border-[rgba(255,255,255,0.06)] hover:bg-[rgba(212,175,55,0.04)]">
                        <td className="px-3 py-2.5 font-mono text-xs text-[#D4AF37]">{p.invoiceNumber}</td>
                        <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-[#4CAF87]">{formatCurrency(p.amountReceived, p.currency)}</td>
                        <td className="px-3 py-2.5 text-xs text-[#8FA99E]">{formatDate(p.paymentDate)}</td>
                        <td className="px-3 py-2.5 text-xs text-[#BCC5BF]">{p.bank || '—'}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-xs text-[#E0A84D]">{formatCurrency(p.outstandingBalance, p.currency)}</td>
                        <td className="px-3 py-2.5"><StatusBadge status={p.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'Financial Summary' && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KPICard title="Total SOW Value" value={formatCurrency(totalSowValue, project.currency)} icon={FileText} color="emerald" />
              <KPICard title="Total Invoiced" value={formatCurrency(totalInvoiced, project.currency)} icon={Receipt} color="gold" />
              <KPICard title="Total Collected" value={formatCurrency(totalPaid, project.currency)} icon={CreditCard} color="green" />
              <KPICard title="Outstanding" value={formatCurrency(outstanding, project.currency)} icon={AlertTriangle} color={outstanding > 0 ? 'amber' : 'green'} />
            </div>
            <div className="glass-card p-5">
              <h3 className="text-sm font-bold text-[#F0EDE4] mb-3">Invoice Breakdown</h3>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 text-center">
                {(['Draft', 'Sent', 'Paid', 'Partially Paid', 'Overdue', 'Cancelled'] as const).map(status => {
                  const count = projectInvoices.filter(i => i.status === status).length;
                  const amount = projectInvoices.filter(i => i.status === status).reduce((s, i) => s + i.totalAmount, 0);
                  return (
                    <div key={status} className="rounded-md border border-[rgba(255,255,255,0.08)] p-3 bg-[rgba(255,255,255,0.02)]">
                      <StatusBadge status={status} />
                      <p className="text-lg font-bold mt-2 text-[#F0EDE4]">{count}</p>
                      <p className="text-[11px] text-[#8FA99E]">{formatCurrency(amount, project.currency)}</p>
                    </div>
                  );
                })}
              </div>
            </div>
            {/* Collection ratio bar */}
            <div className="glass-card p-5">
              <h3 className="text-sm font-bold text-[#F0EDE4] mb-3">Collection Ratio</h3>
              <div className="h-4 w-full rounded-full bg-[rgba(255,255,255,0.06)] overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#D4AF37] to-[#4CAF87] transition-all"
                  style={{ width: `${totalInvoiced > 0 ? Math.min(100, (totalPaid / totalInvoiced) * 100) : 0}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-[#8FA99E] mt-2">
                <span>Collected: {totalInvoiced > 0 ? ((totalPaid / totalInvoiced) * 100).toFixed(1) : 0}%</span>
                <span>{formatCurrency(totalPaid, project.currency)} of {formatCurrency(totalInvoiced, project.currency)}</span>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'Activity' && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-[#F0EDE4]">Activity / Audit History</h3>
            {projectAudit.length === 0 ? (
              <div className="text-center py-12 text-[#8FA99E]">
                <Clock size={28} className="mx-auto mb-2 text-[#8FA99E]" />
                <p className="text-sm font-medium">No activity recorded for this project.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {projectAudit.map(entry => (
                  <div key={entry.id} className="glass-card flex items-start gap-3 p-3">
                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[rgba(212,175,55,0.1)] text-[#D4AF37]">
                      <Calendar size={13} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-[#F0EDE4]">{entry.action}</p>
                      <p className="text-xs text-[#8FA99E] mt-0.5">{entry.details}</p>
                      {entry.previousValue && (
                        <p className="text-xs text-[#8FA99E] mt-0.5">
                          <span className="line-through text-[#E2725B]">{entry.previousValue}</span> → <span className="text-[#4CAF87] font-semibold">{entry.newValue}</span>
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[11px] text-[#8FA99E]">{formatDate(entry.timestamp.slice(0, 10))}</p>
                      <p className="text-[10px] text-[#8FA99E]">{entry.user}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Status Change Modal */}
      <Modal
        open={showStatusModal}
        onClose={() => setShowStatusModal(false)}
        title="Change Project Status?"
        description={`Changing "${project.name}" from ${project.status} to ${newStatus}.`}
        destructive={newStatus === 'Inactive'}
      >
        <div className="space-y-4">
          <div className="rounded-md border border-[rgba(224,168,77,0.3)] bg-[rgba(224,168,77,0.08)] p-3">
            <p className="text-xs text-[#E0A84D] flex items-center gap-1.5">
              <AlertTriangle size={13} />
              {newStatus === 'On Hold' && 'Changing this project to On Hold may affect active billing and operational activities.'}
              {newStatus === 'Inactive' && 'Setting this project as Inactive will restrict new SOW, Invoice, and Payment creation.'}
              {newStatus === 'Active' && 'This will reactivate the project and allow new operational activities.'}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div>
              <p className="text-[10px] font-semibold uppercase text-[#8FA99E]">Current</p>
              <StatusBadge status={project.status} />
            </div>
            <span className="text-[#8FA99E]">→</span>
            <div>
              <p className="text-[10px] font-semibold uppercase text-[#8FA99E]">New</p>
              <StatusBadge status={newStatus} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#BCC5BF] mb-1.5">Reason (optional)</label>
            <input type="text" value={statusReason} onChange={e => setStatusReason(e.target.value)} placeholder="Reason for status change..." className="fi-input w-full" />
          </div>
          <div className="flex gap-3 pt-2 border-t border-[rgba(255,255,255,0.08)]">
            <button onClick={handleStatusChange} className={`flex-1 rounded-md py-2.5 text-sm font-semibold transition-colors ${newStatus === 'Inactive' ? 'btn-danger' : 'btn-gold'}`}>
              Confirm Status Change
            </button>
            <button onClick={() => setShowStatusModal(false)} className="btn-ghost flex-1 py-2.5 text-sm">
              Cancel
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
