import { useMemo, useState } from 'react';
import { Building2, Plus, Search } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import Modal from '../components/Modal';
import StatusBadge from '../components/StatusBadge';
import type { Client, ClientStatus, Entity, ProjectDomain } from '../types';
import { PROJECT_DOMAINS } from '../constants/domains';

const ADDRESS_OK = /^[a-zA-Z0-9\s,.\-/#]*$/;

const blank = {
  name: '',
  address: '',
  domain: 'FinTech' as ProjectDomain,
  entity: 'US' as Entity,
  status: 'Active' as ClientStatus,
  taxId: '',
};

export default function Clients() {
  const { clients, projects, addClient, updateClient } = useAppContext();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(blank);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return clients;
    return clients.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.clientId.toLowerCase().includes(q) ||
      c.domain.toLowerCase().includes(q) ||
      c.taxId.toLowerCase().includes(q)
    );
  }, [clients, search]);

  function openAdd() {
    setEditId(null);
    setForm(blank);
    setErrors({});
    setOpen(true);
  }

  function openEdit(c: Client) {
    setEditId(c.clientId);
    setForm({
      name: c.name, address: c.address, domain: c.domain,
      entity: c.entity, status: c.status, taxId: c.taxId,
    });
    setErrors({});
    setOpen(true);
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'Client name is required.';
    if (form.address && !ADDRESS_OK.test(form.address)) e.address = 'Address can only include letters, numbers, and , . - / #';
    if (!form.domain) e.domain = 'Domain is required.';
    if (!form.entity) e.entity = 'Entity is required.';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function submit() {
    if (!validate()) return;
    setSaving(true);
    try {
      if (editId) await updateClient(editId, form);
      else await addClient(form);
      setOpen(false);
    } catch (err) {
      setErrors({ form: err instanceof Error ? err.message : 'Could not save client.' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-5 lg:p-8 space-y-6">
      <PageHeader
        icon={Building2}
        title="Clients"
        description="One commercial relationship can hold multiple projects, SOWs, and invoices."
        actions={
          <button onClick={openAdd} className="btn-imanage flex items-center gap-2 px-4 py-2 text-sm">
            <Plus size={15} /> Add Client
          </button>
        }
      />

      {clients.length > 0 && (
        <div className="relative max-w-md">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A7A9C0]" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search clients..." className="fi-input h-10 w-full pl-9 pr-3 text-sm" />
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="glass-card px-6 py-16 flex flex-col items-center text-center">
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-[#7B2CFF] to-[#A855F7] flex items-center justify-center mb-5 shadow-[0_12px_32px_rgba(123,44,255,0.25)]">
            <Building2 size={28} className="text-white" />
          </div>
          <h2 className="text-lg font-semibold tracking-tight text-white">No clients on the books yet</h2>
          <p className="text-sm text-[#A7A9C0] mt-2 max-w-md leading-relaxed">
            Add a client to start grouping projects, statements of work, and billing under one commercial relationship.
          </p>
          <button onClick={openAdd} className="btn-imanage mt-6 flex items-center gap-2 px-5 py-2.5 text-sm">
            <Plus size={16} /> Add Client
          </button>
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] text-[10px] font-semibold uppercase tracking-wider text-[#A7A9C0]">
                <th className="px-4 py-2.5 text-left">Client</th>
                <th className="px-4 py-2.5 text-left">Domain</th>
                <th className="px-4 py-2.5 text-left">Entity</th>
                <th className="px-4 py-2.5 text-left">Tax / GST / VAT</th>
                <th className="px-4 py-2.5 text-left">Projects</th>
                <th className="px-4 py-2.5 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => {
                const count = c.projectCount ?? projects.filter(p => p.clientId === c.clientId).length;
                return (
                  <tr key={c.id} onClick={() => openEdit(c)} className="border-b border-[rgba(255,255,255,0.06)] hover:bg-[rgba(123,44,255,0.08)] cursor-pointer">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-white">{c.name}</p>
                      <p className="text-[11px] text-[#A7A9C0] font-mono">{c.clientId}</p>
                    </td>
                    <td className="px-4 py-3 text-[#D5D7EA]">{c.domain}</td>
                    <td className="px-4 py-3 text-[#D5D7EA]">{c.entity}</td>
                    <td className="px-4 py-3 font-mono text-xs text-[#A7A9C0]">{c.taxId || '—'}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); navigate('/projects', { state: { clientId: c.clientId } }); }}
                        className="text-[#C4B5FD] font-semibold hover:underline"
                      >
                        {count}
                      </button>
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editId ? 'Edit Client' : 'Add Client'} description="Capture the commercial entity. Multiple projects can sit under one client." wide>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-[#BCC5BF] mb-1.5">Client Name <span className="text-[#E2725B]">*</span></label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="fi-input w-full h-10 px-3 text-sm" placeholder="Legal client name" />
            {errors.name && <p className="text-[11px] text-[#E2725B] mt-1">{errors.name}</p>}
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-[#BCC5BF] mb-1.5">Client Address</label>
            <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} className="fi-input w-full h-10 px-3 text-sm" placeholder="Alphanumeric address" />
            {errors.address && <p className="text-[11px] text-[#E2725B] mt-1">{errors.address}</p>}
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#BCC5BF] mb-1.5">Domain <span className="text-[#E2725B]">*</span></label>
            <select value={form.domain} onChange={e => setForm(f => ({ ...f, domain: e.target.value as ProjectDomain }))} className="fi-input w-full h-10 px-3 text-sm">
              {PROJECT_DOMAINS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#BCC5BF] mb-1.5">Entity <span className="text-[#E2725B]">*</span></label>
            <select value={form.entity} onChange={e => setForm(f => ({ ...f, entity: e.target.value as Entity }))} className="fi-input w-full h-10 px-3 text-sm">
              <option value="US">US</option>
              <option value="UK">UK</option>
              <option value="India">India</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#BCC5BF] mb-1.5">Client Status</label>
            <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as ClientStatus }))} className="fi-input w-full h-10 px-3 text-sm">
              <option value="Active">Active</option>
              <option value="On Hold">On-Hold</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#BCC5BF] mb-1.5">Tax ID / GST / VAT ID</label>
            <input value={form.taxId} onChange={e => setForm(f => ({ ...f, taxId: e.target.value }))} className="fi-input w-full h-10 px-3 text-sm" placeholder="EIN / GSTIN / VAT" />
          </div>
          {errors.form && <p className="sm:col-span-2 text-sm text-[#E2725B]">{errors.form}</p>}
          <div className="sm:col-span-2 flex gap-3 pt-3 border-t border-[rgba(255,255,255,0.06)]">
            <button type="button" disabled={saving} onClick={submit} className="btn-imanage flex-1 py-2.5 text-sm">{editId ? 'Save Changes' : 'Add Client'}</button>
            <button type="button" onClick={() => setOpen(false)} className="btn-ghost flex-1 py-2.5 text-sm">Cancel</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
