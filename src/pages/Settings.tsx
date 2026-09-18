import { Settings as SettingsIcon, Users, Shield, Building2, Globe, CreditCard, Lock } from 'lucide-react';
import StatusBadge from '../components/StatusBadge';

const users = [
  { name: 'Rahul Sharma', email: 'rahul@iqa.com', role: 'Admin', status: 'Active' },
  { name: 'Priya Patel', email: 'priya@iqa.com', role: 'Finance', status: 'Active' },
  { name: 'Amit Kumar', email: 'amit@iqa.com', role: 'Sales', status: 'Active' },
  { name: 'Vikram Singh', email: 'vikram@iqa.com', role: 'Management', status: 'Active' },
  { name: 'Arun Nair', email: 'arun@iqa.com', role: 'Finance', status: 'Active' },
];

const entities = [
  { name: 'IQA Inc. (US)', country: 'United States', currency: 'USD', taxId: 'EIN-XX-XXXXXXX' },
  { name: 'IQA Ltd. (UK)', country: 'United Kingdom', currency: 'GBP', taxId: 'VAT-XXXXXXXXX' },
  { name: 'IQA Pvt. Ltd. (India)', country: 'India', currency: 'INR', taxId: 'GSTIN-XXXXXXXXX' },
];

const exchangeRates = [
  { from: 'USD', to: 'INR', rate: 83.50, updated: '2026-09-01' },
  { from: 'GBP', to: 'INR', rate: 105.80, updated: '2026-09-01' },
  { from: 'GBP', to: 'USD', rate: 1.27, updated: '2026-09-01' },
];

const roleColors: Record<string, string> = {
  Admin: 'bg-[rgba(226,114,91,0.1)] border-[rgba(226,114,91,0.2)] text-[#E2725B]',
  Finance: 'bg-[rgba(212,175,55,0.1)] border-[rgba(212,175,55,0.2)] text-[#D4AF37]',
  Sales: 'bg-[rgba(76,175,135,0.1)] border-[rgba(76,175,135,0.2)] text-[#4CAF87]',
  Management: 'bg-[rgba(139,92,246,0.1)] border-[rgba(139,92,246,0.2)] text-[#a78bfa]',
};

const financeSettings = [
  { label: 'Default Currency', value: 'USD ($)', icon: CreditCard },
  { label: 'Default Payment Terms', value: 'Net 30', icon: CreditCard },
  { label: 'Invoice Prefix', value: 'INV-', icon: CreditCard },
  { label: 'Invoice Number Format', value: 'INV-{YYYY}-{NNNN}', icon: CreditCard },
  { label: 'Default Tax Rate', value: '18% GST', icon: CreditCard },
];

export default function Settings() {
  return (
    <div className="p-5 lg:p-8 space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[rgba(255,255,255,0.06)] text-[#8FA99E]"><SettingsIcon size={18} /></div>
        <div><h1 className="text-xl font-bold text-[#F0EDE4]">Settings</h1><p className="text-xs text-[#8FA99E] mt-0.5">User management, legal entities, finance configuration, and security.</p></div>
      </div>

      {/* Users */}
      <div className="glass-card overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3.5 border-b border-[rgba(255,255,255,0.06)]"><Users size={16} className="text-[#D4AF37]" /><h2 className="font-bold text-sm text-[#F0EDE4]">User Management</h2></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm fi-table">
            <thead>
              <tr className="border-b border-[rgba(255,255,255,0.06)]">
                <th className="px-5 py-2.5 text-left">Name</th>
                <th className="px-5 py-2.5 text-left">Email</th>
                <th className="px-5 py-2.5 text-left">Role</th>
                <th className="px-5 py-2.5 text-left">Status</th>
              </tr>
            </thead>
            <tbody>{users.map(u => (
              <tr key={u.email}>
                <td className="px-5 py-3 font-semibold text-[#F0EDE4]">{u.name}</td>
                <td className="px-5 py-3 text-[#8FA99E]">{u.email}</td>
                <td className="px-5 py-3"><span className={`inline-flex items-center rounded-lg border px-2 py-0.5 text-[11px] font-semibold ${roleColors[u.role]}`}>{u.role}</span></td>
                <td className="px-5 py-3"><StatusBadge status={u.status} /></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Entities */}
        <div className="glass-card overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3.5 border-b border-[rgba(255,255,255,0.06)]"><Building2 size={16} className="text-[#D4AF37]" /><h2 className="font-bold text-sm text-[#F0EDE4]">Legal Entities</h2></div>
          <div className="p-4 space-y-2">
            {entities.map(e => (
              <div key={e.name} className="rounded-lg border border-[rgba(255,255,255,0.06)] p-4 hover:bg-[rgba(212,175,55,0.03)] transition-colors">
                <h3 className="font-bold text-sm text-[#F0EDE4] mb-2">{e.name}</h3>
                <div className="grid grid-cols-3 gap-2 text-[11px]">
                  <div><span className="text-[#8FA99E]">Country</span><p className="font-medium mt-0.5 text-[#BCC5BF]">{e.country}</p></div>
                  <div><span className="text-[#8FA99E]">Currency</span><p className="font-mono font-medium mt-0.5 text-[#D4AF37]">{e.currency}</p></div>
                  <div><span className="text-[#8FA99E]">Tax ID</span><p className="font-mono font-medium mt-0.5 text-[#BCC5BF]">{e.taxId}</p></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Exchange Rates */}
        <div className="glass-card overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3.5 border-b border-[rgba(255,255,255,0.06)]"><Globe size={16} className="text-[#D4AF37]" /><h2 className="font-bold text-sm text-[#F0EDE4]">Exchange Rates</h2></div>
          <div className="p-4 space-y-2">
            {exchangeRates.map(r => (
              <div key={`${r.from}-${r.to}`} className="flex items-center justify-between rounded-lg border border-[rgba(255,255,255,0.06)] p-4 hover:bg-[rgba(212,175,55,0.03)] transition-colors">
                <div className="flex items-center gap-2"><span className="font-mono font-bold text-sm text-[#D4AF37]">{r.from}</span><span className="text-[#8FA99E]">→</span><span className="font-mono font-bold text-sm text-[#4CAF87]">{r.to}</span></div>
                <div className="text-right"><p className="font-bold tabular-nums text-[#F0EDE4]">{r.rate}</p><p className="text-[10px] text-[#8FA99E]">Updated: {r.updated}</p></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Finance Settings */}
      <div className="glass-card overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3.5 border-b border-[rgba(255,255,255,0.06)]"><CreditCard size={16} className="text-[#D4AF37]" /><h2 className="font-bold text-sm text-[#F0EDE4]">Finance Configuration</h2></div>
        <div className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {financeSettings.map(s => (
              <div key={s.label} className="rounded-lg border border-[rgba(255,255,255,0.06)] p-4 hover:bg-[rgba(212,175,55,0.03)] transition-colors">
                <p className="text-[11px] font-medium text-[#8FA99E] mb-1">{s.label}</p>
                <p className="text-sm font-bold font-mono text-[#F0EDE4]">{s.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Security note */}
      <div className="glass-card p-5 border-[rgba(212,175,55,0.15)]">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[rgba(212,175,55,0.12)]"><Lock size={16} className="text-[#D4AF37]" /></div>
          <div>
            <h3 className="font-bold text-sm text-[#F0EDE4] mb-1">Role-Based Access Control</h3>
            <div className="text-xs text-[#BCC5BF] space-y-0.5">
              <p><strong className="text-[#D4AF37]">Admin:</strong> Full access to all modules, settings, and user management.</p>
              <p><strong className="text-[#D4AF37]">Finance:</strong> Manage invoices, payments, and financial reports.</p>
              <p><strong className="text-[#D4AF37]">Sales:</strong> Manage clients, projects, and SOWs.</p>
              <p><strong className="text-[#D4AF37]">Management:</strong> Read-only access to dashboards and reports.</p>
            </div>
          </div>
          <Shield size={18} className="text-[#D4AF37] shrink-0 mt-1 opacity-40" />
        </div>
      </div>
    </div>
  );
}
