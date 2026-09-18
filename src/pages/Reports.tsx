import { useMemo, useState } from 'react';
import { BarChart3, Download, FileSpreadsheet, X } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import * as XLSX from 'xlsx';
import { useAppContext } from '../context/AppContext';
import DateFilterBar from '../components/DateFilterBar';
import PageHeader from '../components/PageHeader';
import { formatCurrency, formatCurrencyCompact, formatDate } from '../utils/format';
import type { DateFilter } from '../types';

const CHART_COLORS = { purple: '#A855F7', deep: '#7B2CFF', green: '#34D399', amber: '#F59E0B', red: '#F43F5E' };

const reportCards = [
  { title: 'Revenue Report', desc: 'Total revenue across all entities', color: 'bg-[rgba(123,44,255,0.14)] text-[#C4B5FD]' },
  { title: 'Outstanding Receivables', desc: 'Pending and overdue amounts', color: 'bg-[rgba(245,158,11,0.12)] text-[#F59E0B]' },
  { title: 'Invoice Register', desc: 'Complete invoice listing', color: 'bg-[rgba(168,85,247,0.14)] text-[#C4B5FD]' },
  { title: 'SOW Expiry Report', desc: 'SOWs approaching expiration', color: 'bg-[rgba(244,63,94,0.12)] text-[#F43F5E]' },
  { title: 'Payment Register', desc: 'All recorded payments', color: 'bg-[rgba(52,211,153,0.12)] text-[#34D399]' },
  { title: 'Aging Analysis', desc: 'Receivables by age bucket', color: 'bg-[rgba(56,189,248,0.12)] text-[#38BDF8]' },
];

const tooltipStyle = { backgroundColor: 'rgba(17,20,43,0.96)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '12px', color: '#FFFFFF', backdropFilter: 'blur(12px)', boxShadow: '0 8px 24px rgba(0,0,0,0.3)' };

export default function Reports() {
  const { invoices, payments, sows } = useAppContext();
  const [dateFilter, setDateFilter] = useState<DateFilter | null>(null);
  const [dateResetKey, setDateResetKey] = useState(0);

  function inRange(date?: string) {
    if (!dateFilter) return true;
    if (!date) return false;
    const d = date.slice(0, 10);
    return d >= dateFilter.from && d <= dateFilter.to;
  }

  const scopedInvoices = useMemo(() => dateFilter ? invoices.filter(i => inRange(i.invoiceDate || i.createdAt)) : invoices, [invoices, dateFilter]);
  const scopedPayments = useMemo(() => dateFilter ? payments.filter(p => inRange(p.paymentDate)) : payments, [payments, dateFilter]);
  const scopedSows = useMemo(() => dateFilter ? sows.filter(s => inRange(s.startDate || s.createdAt)) : sows, [sows, dateFilter]);

  const projectRevenue = useMemo(() => {
    const map: Record<string, { name: string; revenue: number }> = {};
    scopedInvoices.filter(i => i.status === 'Paid').forEach(i => { if (!map[i.projectId]) map[i.projectId] = { name: i.projectName, revenue: 0 }; map[i.projectId].revenue += i.totalAmount; });
    return Object.values(map).sort((a, b) => b.revenue - a.revenue);
  }, [scopedInvoices]);

  const entityData = useMemo(() => {
    const map: Record<string, number> = { US: 0, UK: 0, India: 0 };
    scopedInvoices.filter(i => i.status === 'Paid').forEach(i => { map[i.entity] += i.totalAmount; });
    return [
      { name: 'US', revenue: map.US, cost: Math.round(map.US * 0.7), profit: Math.round(map.US * 0.3) },
      { name: 'UK', revenue: map.UK, cost: Math.round(map.UK * 0.67), profit: Math.round(map.UK * 0.33) },
      { name: 'India', revenue: map.India, cost: Math.round(map.India * 0.65), profit: Math.round(map.India * 0.35) },
    ];
  }, [scopedInvoices]);

  function exportReport(type: string) {
    let data: Record<string, unknown>[] = [];
    let filename = type;
    switch (type) {
      case 'Revenue Report': data = scopedInvoices.filter(i => i.status === 'Paid').map(i => ({ 'Invoice #': i.invoiceNumber, Project: i.projectName, Entity: i.entity, Amount: i.totalAmount, Currency: i.currency, 'Invoice Date': formatDate(i.invoiceDate) })); filename = 'Revenue_Report'; break;
      case 'Outstanding Receivables': data = scopedInvoices.filter(i => ['Sent', 'Overdue', 'Partially Paid'].includes(i.status)).map(i => ({ 'Invoice #': i.invoiceNumber, Project: i.projectName, Amount: i.totalAmount, 'Due Date': formatDate(i.dueDate), Status: i.status })); filename = 'Outstanding_Receivables'; break;
      case 'Invoice Register': data = scopedInvoices.map(i => ({ 'Invoice #': i.invoiceNumber, Project: i.projectName, Entity: i.entity, Amount: i.totalAmount, Currency: i.currency, 'Invoice Date': formatDate(i.invoiceDate), 'Due Date': formatDate(i.dueDate), Status: i.status })); filename = 'Invoice_Register'; break;
      case 'Payment Register': data = scopedPayments.map(p => ({ 'Invoice #': p.invoiceNumber, Project: p.projectName, 'Amount Received': p.amountReceived, 'Payment Date': formatDate(p.paymentDate), Bank: p.bank, TDS: p.tdsWithholding, Outstanding: p.outstandingBalance, Status: p.status })); filename = 'Payment_Register'; break;
      case 'SOW Expiry Report': data = scopedSows.map(s => ({ 'SOW #': s.sowNumber, Project: s.projectName, 'Start Date': formatDate(s.startDate), 'End Date': formatDate(s.endDate), Value: s.contractValue, Status: s.status })); filename = 'SOW_Expiry_Report'; break;
      case 'Aging Analysis': { const now = Date.now(); const buckets = [{ bucket: '0–30 days', amount: 0, count: 0 }, { bucket: '31–60 days', amount: 0, count: 0 }, { bucket: '61–90 days', amount: 0, count: 0 }, { bucket: '90+ days', amount: 0, count: 0 }]; scopedInvoices.filter(i => ['Sent', 'Overdue', 'Partially Paid'].includes(i.status)).forEach(i => { const days = Math.floor((now - new Date(i.dueDate).getTime()) / 86400000); const idx = days <= 30 ? 0 : days <= 60 ? 1 : days <= 90 ? 2 : 3; buckets[idx].amount += i.totalAmount; buckets[idx].count++; }); data = buckets.map(b => ({ Bucket: b.bucket, Amount: b.amount, Count: b.count })); filename = 'Aging_Analysis'; break; }
    }
    if (data.length === 0) data = [{ Note: 'No data available.' }];
    const ws = XLSX.utils.json_to_sheet(data); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Report'); XLSX.writeFile(wb, `${filename}.xlsx`);
  }

  const hasData = scopedInvoices.length > 0;

  return (
    <div className="p-5 lg:p-8 space-y-6">
      <PageHeader
        icon={BarChart3}
        title="Reports"
        description="Export registers and review revenue, receivables, and aging."
      />

      <div className="flex items-center justify-between flex-wrap gap-3">
        <DateFilterBar onApply={setDateFilter} resetKey={dateResetKey} />
        {dateFilter && (
          <button
            type="button"
            onClick={() => { setDateFilter(null); setDateResetKey(k => k + 1); }}
            className="flex items-center gap-1.5 text-xs font-semibold text-[#A855F7] hover:text-white transition-colors"
          >
            <X size={13} /> Clear All Filters
          </button>
        )}
      </div>
      {dateFilter && (
        <div className="text-xs text-[#A7A9C0]">
          Showing reports for <span className="text-[#C4B5FD]">{dateFilter.from} → {dateFilter.to}</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {reportCards.map(r => (
          <div key={r.title} className="glass-card p-5">
            <div className="flex items-start justify-between">
              <div>
                <div className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${r.color} mb-3`}><FileSpreadsheet size={15} /></div>
                <h3 className="font-semibold text-sm text-white">{r.title}</h3>
                <p className="text-[11px] text-[#A7A9C0] mt-0.5">{r.desc}</p>
              </div>
              <button onClick={() => exportReport(r.title)} className="btn-ghost flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium">
                <Download size={12} /> Export
              </button>
            </div>
          </div>
        ))}
      </div>

      {hasData && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {projectRevenue.length > 0 && (
              <div className="glass-card p-5">
                <h3 className="text-sm font-semibold tracking-tight text-white mb-1">Project-wise Revenue</h3>
                <p className="text-xs text-[#A7A9C0] mb-4">Revenue from paid invoices by project</p>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={projectRevenue} layout="vertical" barSize={18}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis type="number" tick={{ fontSize: 11, fill: '#A7A9C0' }} stroke="rgba(255,255,255,0.06)" tickFormatter={v => formatCurrencyCompact(v as number)} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#D5D7EA' }} stroke="rgba(255,255,255,0.06)" width={120} />
                    <Tooltip formatter={(v) => [formatCurrency(Number(v)), 'Revenue']} contentStyle={tooltipStyle} />
                    <Bar dataKey="revenue" fill={CHART_COLORS.purple} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            <div className="glass-card p-5">
              <h3 className="text-sm font-semibold tracking-tight text-white mb-1">Entity-wise Revenue</h3>
              <p className="text-xs text-[#A7A9C0] mb-4">Revenue distribution across entities</p>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={entityData.filter(e => e.revenue > 0)} cx="50%" cy="50%" outerRadius={95} dataKey="revenue" label={(props) => `${props.name ?? ''} ${((props.percent ?? 0) * 100).toFixed(0)}%`}>
                    <Cell fill={CHART_COLORS.purple} /><Cell fill={CHART_COLORS.green} /><Cell fill={CHART_COLORS.amber} />
                  </Pie>
                  <Tooltip formatter={(v) => [formatCurrency(Number(v)), '']} contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold tracking-tight text-white mb-1">Profitability by Entity</h3>
            <p className="text-xs text-[#A7A9C0] mb-4">Revenue, cost, and profit breakdown</p>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={entityData} barSize={32}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#D5D7EA' }} stroke="rgba(255,255,255,0.06)" />
                <YAxis tick={{ fontSize: 11, fill: '#A7A9C0' }} stroke="rgba(255,255,255,0.06)" tickFormatter={v => formatCurrencyCompact(v as number)} />
                <Tooltip formatter={(v) => [formatCurrency(Number(v)), '']} contentStyle={tooltipStyle} />
                <Legend />
                <Bar dataKey="revenue" fill={CHART_COLORS.purple} radius={[3, 3, 0, 0]} name="Revenue" />
                <Bar dataKey="cost" fill={CHART_COLORS.amber} radius={[3, 3, 0, 0]} name="Cost" />
                <Bar dataKey="profit" fill={CHART_COLORS.green} radius={[3, 3, 0, 0]} name="Profit" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
      {!hasData && (
        <div className="glass-card p-16 text-center border-dashed border-[rgba(255,255,255,0.1)]">
          <BarChart3 size={32} className="mx-auto text-[#A7A9C0] mb-3" />
          <p className="text-sm text-[#D5D7EA] font-medium">No data available for reporting.</p>
          <p className="text-xs text-[#A7A9C0] mt-1">Add projects, invoices, and payments to generate reports.</p>
        </div>
      )}
    </div>
  );
}
