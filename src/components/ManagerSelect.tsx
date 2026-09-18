import { useState } from 'react';
import { Plus, Check } from 'lucide-react';
import { useAppContext } from '../context/AppContext';

interface ManagerSelectProps {
  type: 'Project Manager' | 'Delivery Manager';
  value: string;
  onChange: (name: string) => void;
}

export default function ManagerSelect({ type, value, onChange }: ManagerSelectProps) {
  const { managers, addManager } = useAppContext();
  const list = managers.filter(m => m.type === type);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    if (!name.trim()) { setError('Name is required'); return; }
    setSaving(true);
    setError('');
    try {
      await addManager({ name: name.trim(), type });
      onChange(name.trim());
      setName('');
      setAdding(false);
    } catch {
      setError('Could not add manager.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <select value={value} onChange={e => onChange(e.target.value)} className="fi-input w-full h-10 px-3 text-sm">
        <option value="">Select {type.toLowerCase()}...</option>
        {list.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
        {value && !list.some(m => m.name === value) && <option value={value}>{value}</option>}
      </select>
      {list.length === 0 && !adding && (
        <p className="text-[11px] text-[#8FA3B8] mt-1.5">No {type.toLowerCase()}s listed yet.</p>
      )}
      {!adding ? (
        <button type="button" onClick={() => setAdding(true)} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[#7EB6FF] hover:text-[#F0EDE4]">
          <Plus size={12} /> Add {type}
        </button>
      ) : (
        <div className="mt-2 flex items-center gap-2">
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder={`${type} name`}
            className="fi-input h-9 flex-1 px-3 text-sm"
          />
          <button type="button" disabled={saving} onClick={save} className="btn-imanage h-9 px-3 text-xs inline-flex items-center gap-1">
            <Check size={13} /> Save
          </button>
          <button type="button" onClick={() => { setAdding(false); setError(''); }} className="btn-ghost h-9 px-3 text-xs">Cancel</button>
        </div>
      )}
      {error && <p className="text-[11px] text-[#E2725B] mt-1">{error}</p>}
    </div>
  );
}
