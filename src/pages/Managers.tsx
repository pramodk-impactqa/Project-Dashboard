import { useState } from 'react';
import { UserCog, Plus, Trash2, Users, Briefcase } from 'lucide-react';
import { clsx } from 'clsx';
import { useAppContext } from '../context/AppContext';
import Modal from '../components/Modal';

export default function Managers() {
  const { managers, addManager, deleteManager } = useAppContext();
  const [showAdd, setShowAdd] = useState(false);
  const [tab, setTab] = useState<'Project Manager' | 'Delivery Manager'>('Project Manager');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [type, setType] = useState<'Project Manager' | 'Delivery Manager'>('Project Manager');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const pms = managers.filter(m => m.type === 'Project Manager');
  const dms = managers.filter(m => m.type === 'Delivery Manager');
  const currentList = tab === 'Project Manager' ? pms : dms;

  function handleAdd() { if (!name.trim()) return; addManager({ name: name.trim(), type, email: email.trim() || undefined }); setName(''); setEmail(''); setShowAdd(false); }
  function handleDelete(id: string) { deleteManager(id); setConfirmDelete(null); }

  return (
    <div className="p-5 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[rgba(212,175,55,0.12)] text-[#D4AF37]"><UserCog size={18} /></div>
          <div><h1 className="text-xl font-bold text-[#F0EDE4]">Manager Administration</h1><p className="text-xs text-[#8FA99E] mt-0.5">Manage Project Managers and Delivery Managers.</p></div>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-gold flex items-center gap-2 px-4 py-2 text-sm"><Plus size={15} /> Add Manager</button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="glass-card p-4"><p className="text-[10px] font-semibold uppercase tracking-wider text-[#8FA99E]">Total</p><p className="text-2xl font-bold mt-1 text-[#F0EDE4]">{managers.length}</p></div>
        <div className="glass-card p-4"><div className="flex items-center gap-1.5"><Briefcase size={13} className="text-[#D4AF37]" /><p className="text-[10px] font-semibold uppercase tracking-wider text-[#8FA99E]">Project Managers</p></div><p className="text-2xl font-bold mt-1 text-[#D4AF37]">{pms.length}</p></div>
        <div className="glass-card p-4"><div className="flex items-center gap-1.5"><Users size={13} className="text-[#1E8A6E]" /><p className="text-[10px] font-semibold uppercase tracking-wider text-[#8FA99E]">Delivery Managers</p></div><p className="text-2xl font-bold mt-1 text-[#1E8A6E]">{dms.length}</p></div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="flex border-b border-[rgba(255,255,255,0.06)]">
          {(['Project Manager', 'Delivery Manager'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} className={clsx('flex-1 px-4 py-3 text-sm font-medium transition-colors relative', tab === t ? 'text-[#D4AF37]' : 'text-[#8FA99E] hover:text-[#BCC5BF] hover:bg-[rgba(255,255,255,0.02)]')}>
              {t}s
              <span className={clsx('ml-2 inline-flex items-center rounded-lg border px-1.5 py-0.5 text-[10px] font-bold', tab === t ? 'border-[rgba(212,175,55,0.2)] bg-[rgba(212,175,55,0.08)] text-[#D4AF37]' : 'border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] text-[#8FA99E]')}>
                {t === 'Project Manager' ? pms.length : dms.length}
              </span>
              {tab === t && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#D4AF37]" />}
            </button>
          ))}
        </div>
        <div className="p-4">
          {currentList.length === 0 ? (
            <div className="py-16 text-center"><UserCog size={32} className="mx-auto text-[#8FA99E] mb-3" /><p className="text-sm text-[#BCC5BF] font-medium">No {tab.toLowerCase()}s have been added yet.</p></div>
          ) : (
            <div className="space-y-2">
              {currentList.map(m => (
                <div key={m.id} className="flex items-center justify-between rounded-lg border border-[rgba(255,255,255,0.06)] p-4 hover:bg-[rgba(212,175,55,0.03)] transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={clsx('flex h-9 w-9 items-center justify-center rounded-lg text-xs font-bold', m.type === 'Project Manager' ? 'bg-gradient-to-br from-[#D4AF37] to-[#B8860B] text-[#12241E]' : 'bg-gradient-to-br from-[#1E8A6E] to-[#0F5C46] text-[#F0EDE4]')}>
                      {m.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div><p className="font-semibold text-sm text-[#F0EDE4]">{m.name}</p><p className="text-[11px] text-[#8FA99E]">{m.type}{m.email ? ` · ${m.email}` : ''}</p></div>
                  </div>
                  {confirmDelete === m.id ? (
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-[#E2725B] font-medium">Remove this manager?</span>
                      <button onClick={() => handleDelete(m.id)} className="btn-danger px-2.5 py-1 text-[11px]">Confirm</button>
                      <button onClick={() => setConfirmDelete(null)} className="btn-ghost px-2.5 py-1 text-[11px]">Cancel</button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmDelete(m.id)} className="p-1.5 rounded-lg text-[#8FA99E] hover:text-[#E2725B] hover:bg-[rgba(226,114,91,0.08)] transition-colors" title="Remove"><Trash2 size={15} /></button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Manager" description="Add a new Project Manager or Delivery Manager.">
        <div className="space-y-4">
          <div><label className="block text-xs font-semibold text-[#BCC5BF] mb-1.5">Role <span className="text-[#E2725B]">*</span></label><select value={type} onChange={e => setType(e.target.value as typeof type)} className="fi-input w-full h-10 px-3 text-sm"><option value="Project Manager">Project Manager</option><option value="Delivery Manager">Delivery Manager</option></select></div>
          <div><label className="block text-xs font-semibold text-[#BCC5BF] mb-1.5">Full Name <span className="text-[#E2725B]">*</span></label><input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Enter full name" className="fi-input w-full h-10 px-3 text-sm" /></div>
          <div><label className="block text-xs font-semibold text-[#BCC5BF] mb-1.5">Email <span className="text-[10px] text-[#8FA99E] font-normal">(optional)</span></label><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@company.com" className="fi-input w-full h-10 px-3 text-sm" /></div>
          <div className="flex gap-3 pt-2">
            <button onClick={handleAdd} disabled={!name.trim()} className="btn-gold flex-1 py-2.5 text-sm">Add Manager</button>
            <button onClick={() => setShowAdd(false)} className="btn-ghost flex-1 py-2.5 text-sm">Cancel</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
