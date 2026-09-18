import { useState, useMemo } from 'react';
import {
  DollarSign, FolderKanban, FileText, Receipt, AlertTriangle,
  Clock, TrendingUp, ArrowUpRight, Inbox, ChevronDown, X, Percent, ShieldCheck,
} from 'lucide-react';
import PageHeader from '../components/PageHeader';
import {
  AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import KPICard from '../components/KPICard';
import StatusBadge from '../components/StatusBadge';
import DateFilterBar from '../components/DateFilterBar';
import { useAppContext } from '../context/AppContext';
import { formatCurrency, formatCurrencyCompact, formatDate, daysOverdue } from '../utils/format';
import type { DateFilter } from '../types';

const CHART = { purple: '#A855F7', deep: '#7B2CFF', green: '#34D399', red: '#F43F5E', amber: '#F59E0B', muted: '#A7A9C0' };

export default function Dashboard() {
  const { projects, sows, invoices, payments, notifications } = useAppContext();
  const [selectedProject, setSelectedProject] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilter | null>(null);
  const [dateResetKey, setDateResetKey] = useState(0);

  function inRange(date?: string) {
    if (!dateFilter) return true;
    if (!date) return false;
    const d = date.slice(0, 10);
    return d >= dateFilter.from && d <= dateFilter.to;
  }

  const filteredInvoices = useMemo(() => {
    let list = selectedProject ? invoices.filter(i => i.projectId === selectedProject) : invoices;
    if (dateFilter) list = list.filter(i => inRange(i.invoiceDate || i.createdAt));
    return list;
  }, [invoices, selectedProject, dateFilter]);
  const filteredSOWs = useMemo(() => {
    let list = selectedProject ? sows.filter(s => s.projectId === selectedProject) : sows;
    if (dateFilter) list = list.filter(s => inRange(s.startDate || s.createdAt));
    return list;
  }, [sows, selectedProject, dateFilter]);
  const filteredPayments = useMemo(() => {
    let list = payments;
    if (selectedProject) {
      const ids = new Set(invoices.filter(i => i.projectId === selectedProject).map(i => i.id));
      list = list.filter(p => p.projectId === selectedProject || ids.has(p.invoiceId));
    }
    if (dateFilter) list = list.filter(p => inRange(p.paymentDate));
    return list;
  }, [payments, invoices, selectedProject, dateFilter]);

  const hasActiveFilters = !!(selectedProject || dateFilter);
  function clearAllFilters() {
    setSelectedProject('');
    setDateFilter(null);
    setDateResetKey(k => k + 1);
  }

  const totalRevenue = filteredInvoices.filter(i => i.status === 'Paid').reduce((s, i) => s + i.totalAmount, 0);
  const totalOutstanding = filteredInvoices.filter(i => ['Sent', 'Overdue', 'Partially Paid'].includes(i.status)).reduce((s, i) => s + i.totalAmount, 0);
  const totalCollected = filteredPayments.reduce((s, p) => s + p.amountReceived, 0);
  const totalInvoiced = filteredInvoices.reduce((s, i) => s + i.totalAmount, 0);
  const activeProjects = selectedProject ? (projects.find(p => p.id === selectedProject)?.status === 'Active' ? 1 : 0) : projects.filter(p => p.status === 'Active').length;
  const activeSows = filteredSOWs.filter(s => s.status === 'Active').length;
  const overdueInvoices = filteredInvoices.filter(i => i.status === 'Overdue');
  const overdueAmount = overdueInvoices.reduce((s, i) => s + i.totalAmount, 0);
  const expiringSows = filteredSOWs.filter(s => s.status === 'Active' && s.endDate && new Date(s.endDate) <= new Date(Date.now() + 180 * 86400000));
  const hasData = projects.length > 0 || invoices.length > 0;
  const selectedProj = projects.find(p => p.id === selectedProject);
  const collectionRate = totalInvoiced > 0 ? (totalCollected / totalInvoiced) * 100 : 0;
  const overdueShare = totalOutstanding > 0 ? (overdueAmount / totalOutstanding) * 100 : 0;

  const monthlyRevenue = useMemo(() => {
    const map: Record<string, { month: string; revenue: number; collected: number }> = {};
    filteredInvoices.filter(i => i.status === 'Paid').forEach(inv => {
      const d = new Date(inv.invoiceDate);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleString('en', { month: 'short', year: '2-digit' });
      if (!map[key]) map[key] = { month: label, revenue: 0, collected: 0 };
      map[key].revenue += inv.totalAmount;
    });
    filteredPayments.forEach(p => {
      if (!p.paymentDate) return;
      const d = new Date(p.paymentDate);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleString('en', { month: 'short', year: '2-digit' });
      if (!map[key]) map[key] = { month: label, revenue: 0, collected: 0 };
      map[key].collected += p.amountReceived;
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v);
  }, [filteredInvoices, filteredPayments]);

  const invoiceStatusData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredInvoices.forEach(i => { counts[i.status] = (counts[i.status] || 0) + 1; });
    const colors: Record<string, string> = { Paid: CHART.green, Sent: CHART.purple, Overdue: CHART.red, 'Partially Paid': CHART.amber, Draft: CHART.muted, Cancelled: '#4a4a6a' };
    return Object.entries(counts).map(([name, value]) => ({ name, value, color: colors[name] || CHART.muted }));
  }, [filteredInvoices]);

  const tooltipStyle = { backgroundColor: 'rgba(17,20,43,0.96)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '12px', color: '#FFFFFF' };

  if (!hasData) {
    return (
      <div className="p-5 lg:p-8">
        <div className="mb-8">
          <PageHeader
            icon={TrendingUp}
            title="Finance Overview"
            description="Monitor projects, SOWs, invoices, and collections from a single source of truth."
          />
        </div>
        <div className="flex flex-col items-center justify-center py-20 max-w-lg mx-auto text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-[rgba(123,44,255,0.16)] text-[#A855F7] mb-5">
            <Inbox size={32} />
          </div>
          <h2 className="text-lg font-bold text-white mb-2">Welcome to IQA-iManage</h2>
          <p className="text-sm text-[#A7A9C0] mb-8 leading-relaxed">
            Add a client and project to start tracking SOWs, invoices, and payments on this finance portal.
          </p>
          <div className="grid grid-cols-3 gap-3 w-full">
            <a href="/clients" className="glass-card p-4 text-center">
              <FolderKanban size={20} className="mx-auto text-[#A855F7] mb-2" />
              <p className="text-xs font-semibold text-[#C4B5FD]">Add Client</p>
            </a>
            <a href="/sows" className="glass-card p-4 text-center">
              <FileText size={20} className="mx-auto text-[#A855F7] mb-2" />
              <p className="text-xs font-semibold text-[#C4B5FD]">Add SOW</p>
            </a>
            <a href="/invoices" className="glass-card p-4 text-center">
              <Receipt size={20} className="mx-auto text-[#A855F7] mb-2" />
              <p className="text-xs font-semibold text-[#C4B5FD]">Add Invoice</p>
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-5 lg:p-8 space-y-6">
      <PageHeader
        icon={TrendingUp}
        title="Finance Overview"
        description={selectedProject ? `Scoped to ${selectedProj?.name}` : 'Live view of revenue, receivables, collections, and delivery risk.'}
        actions={
          <div className="relative">
            <select value={selectedProject} onChange={e => setSelectedProject(e.target.value)} className="fi-input h-11 min-w-[200px] appearance-none pl-3 pr-8 text-sm font-medium">
              <option value="">All Projects</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#A7A9C0] pointer-events-none" />
          </div>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="fi-insight">
          <Percent size={16} className="mt-0.5 text-[#C4B5FD] shrink-0" />
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#A7A9C0]">Collection rate</p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums text-white">{collectionRate.toFixed(1)}%</p>
            <p className="text-[11px] text-[#A7A9C0]">Collected versus invoiced</p>
          </div>
        </div>
        <div className="fi-insight">
          <Clock size={16} className="mt-0.5 text-[#F59E0B] shrink-0" />
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#A7A9C0]">Receivable exposure</p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums text-white">{formatCurrencyCompact(totalOutstanding)}</p>
            <p className="text-[11px] text-[#A7A9C0]">Open invoices awaiting settlement</p>
          </div>
        </div>
        <div className="fi-insight">
          <ShieldCheck size={16} className="mt-0.5 text-[#34D399] shrink-0" />
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#A7A9C0]">Overdue concentration</p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums text-white">{overdueShare.toFixed(0)}%</p>
            <p className="text-[11px] text-[#A7A9C0]">{overdueInvoices.length} invoices past due</p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <DateFilterBar onApply={setDateFilter} resetKey={dateResetKey} />
        {hasActiveFilters && (
          <button type="button" onClick={clearAllFilters} className="flex items-center gap-1.5 text-xs font-semibold text-[#A855F7]">
            <X size={13} /> Clear All Filters
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Total Revenue" value={formatCurrencyCompact(totalRevenue)} subtitle="From paid invoices" icon={DollarSign} color="green" />
        <KPICard title="Outstanding Receivables" value={formatCurrencyCompact(totalOutstanding)} subtitle="Pending collection" icon={Clock} color="amber" />
        <KPICard title="Total Invoiced" value={formatCurrencyCompact(totalInvoiced)} subtitle={`${filteredInvoices.length} invoices`} icon={Receipt} color="purple" />
        <KPICard title="Total Collected" value={formatCurrencyCompact(totalCollected)} subtitle={`${filteredPayments.length} payments`} icon={TrendingUp} color="green" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Active Projects" value={String(activeProjects)} subtitle={`${projects.length} total`} icon={FolderKanban} color="purple" />
        <KPICard title="Active SOWs" value={String(activeSows)} subtitle={`${filteredSOWs.length} total`} icon={FileText} color="indigo" />
        <KPICard title="Overdue Invoices" value={String(overdueInvoices.length)} subtitle={overdueAmount > 0 ? formatCurrencyCompact(overdueAmount) : 'None outstanding'} icon={AlertTriangle} color="red" />
        <KPICard title="Expiring SOWs" value={String(expiringSows.length)} subtitle="Within 6 months" icon={Clock} color="amber" />
      </div>

      {monthlyRevenue.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 glass-card p-5">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h3 className="text-sm font-semibold tracking-tight text-white">Revenue & Collections</h3>
                <p className="text-xs text-[#A7A9C0] mt-0.5">Recognized revenue against cash collected</p>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-[#A7A9C0]">
                <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-[#A855F7]" /> Revenue</span>
                <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-[#34D399]" /> Collections</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={monthlyRevenue}>
                <defs>
                  <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={CHART.purple} stopOpacity={0.25} /><stop offset="95%" stopColor={CHART.purple} stopOpacity={0} /></linearGradient>
                  <linearGradient id="gCol" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={CHART.green} stopOpacity={0.2} /><stop offset="95%" stopColor={CHART.green} stopOpacity={0} /></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#A7A9C0' }} />
                <YAxis tick={{ fontSize: 11, fill: '#A7A9C0' }} tickFormatter={v => formatCurrencyCompact(v as number)} />
                <Tooltip formatter={(v) => [formatCurrency(Number(v)), '']} contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="revenue" stroke={CHART.purple} fill="url(#gRev)" strokeWidth={2} name="Revenue" />
                <Area type="monotone" dataKey="collected" stroke={CHART.green} fill="url(#gCol)" strokeWidth={2} name="Collections" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          {invoiceStatusData.length > 0 && (
            <div className="glass-card p-5">
              <h3 className="text-sm font-semibold tracking-tight text-white mb-1">Invoice Status</h3>
              <p className="text-xs text-[#A7A9C0] mb-3">Pipeline by working status</p>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={invoiceStatusData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2} dataKey="value">
                    {invoiceStatusData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {notifications.length > 0 && (
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-white">Recent Alerts</h3>
            <a href="/notifications" className="flex items-center gap-1 text-xs font-semibold text-[#A855F7]">View all <ArrowUpRight size={13} /></a>
          </div>
          <div className="space-y-2">
            {notifications.slice(0, 4).map(n => (
              <div key={n.id} className="flex items-start gap-3 rounded-lg p-3 bg-white/[0.03]">
                <AlertTriangle size={14} className="mt-0.5 text-[#A855F7]" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-white">{n.title}</p>
                  <p className="text-xs text-[#A7A9C0] truncate">{n.message}</p>
                </div>
                <span className="text-[11px] text-[#A7A9C0]">{formatDate(n.date)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {overdueInvoices.length > 0 && (
        <div className="glass-card p-5">
          <h3 className="text-sm font-bold text-white mb-4">Overdue Invoices</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm fi-table">
              <thead>
                <tr>
                  <th className="px-4 py-2.5 text-left">Invoice #</th>
                  <th className="px-4 py-2.5 text-left">Project</th>
                  <th className="px-4 py-2.5 text-right">Amount</th>
                  <th className="px-4 py-2.5 text-left">Due Date</th>
                  <th className="px-4 py-2.5 text-right">Days Overdue</th>
                </tr>
              </thead>
              <tbody>
                {overdueInvoices.map(inv => (
                  <tr key={inv.id}>
                    <td className="px-4 py-2.5 font-mono font-semibold text-[#A855F7]">{inv.invoiceNumber}</td>
                    <td className="px-4 py-2.5 text-[#D5D7EA]">{inv.projectName}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{formatCurrency(inv.totalAmount, inv.currency)}</td>
                    <td className="px-4 py-2.5 text-[#A7A9C0]">{formatDate(inv.dueDate)}</td>
                    <td className="px-4 py-2.5 text-right text-[#F43F5E] font-semibold">{daysOverdue(inv.dueDate)} days</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
