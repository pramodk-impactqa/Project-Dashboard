import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, AlertCircle, CheckCircle2, FileText } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import DatePicker from '../components/DatePicker';
import ManagerSelect from '../components/ManagerSelect';
import FileAttach from '../components/FileAttach';
import type { ProjectStatus } from '../types';

interface FormState {
  clientId: string;
  name: string;
  status: ProjectStatus;
  startDate: string;
  endDate: string;
  projectManager: string;
  deliveryManager: string;
  msaOriginalName: string;
}

const blank: FormState = {
  clientId: '', name: '', status: 'Active', startDate: '', endDate: '',
  projectManager: '', deliveryManager: '', msaOriginalName: '',
};

export default function AddProject() {
  const { id: editId } = useParams<{ id: string }>();
  const isEdit = !!editId;
  const navigate = useNavigate();
  const { clients, projects, sows, addProject, updateProject } = useAppContext();
  const [form, setForm] = useState<FormState>(blank);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  const project = projects.find(p => p.id === editId || p.projectId === editId);
  const linkedSows = project ? sows.filter(s => s.projectId === project.projectId || s.projectId === project.id) : [];

  useEffect(() => {
    if (isEdit && project) {
      setForm({
        clientId: project.clientId,
        name: project.name,
        status: project.status,
        startDate: project.startDate,
        endDate: project.endDate,
        projectManager: project.projectManager,
        deliveryManager: project.deliveryManager,
        msaOriginalName: project.msaOriginalName || '',
      });
    }
  }, [isEdit, project]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors(prev => { const n = { ...prev }; delete n[key]; return n; });
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!form.clientId) e.clientId = 'Select a client.';
    if (!form.name.trim()) e.name = 'Project name is required.';
    if (!form.startDate) e.startDate = 'Start date is required.';
    if (form.status !== 'Active' && !form.endDate) e.endDate = 'End date is required when the project is On Hold or Inactive.';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function submit() {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = {
        ...form,
        endDate: form.status === 'Active' ? '' : form.endDate,
        currency: 'USD' as const,
      };
      if (isEdit && project) {
        await updateProject(project.projectId, payload);
        setSuccess('Project updated.');
      } else {
        const created = await addProject(payload);
        setSuccess(`Project created as ${created.projectId}.`);
        setTimeout(() => navigate(`/projects/${created.id}`), 700);
        return;
      }
      setTimeout(() => navigate(project ? `/projects/${project.id}` : '/projects'), 700);
    } catch (err) {
      setErrors({ form: err instanceof Error ? err.message : 'Could not save project.' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-5 lg:p-8 max-w-4xl">
      <button onClick={() => navigate('/projects')} className="flex items-center gap-1.5 text-xs font-semibold text-[#8FA99E] hover:text-[#7EB6FF] mb-5">
        <ArrowLeft size={14} /> Back to Projects
      </button>

      <div className="mb-6">
        <h1 className="text-xl font-bold text-[#F0EDE4]">{isEdit ? 'Edit Project' : 'Add Project'}</h1>
        <p className="text-sm text-[#8FA99E] mt-1">Projects sit under a client. SOWs stay read-only here once the project exists.</p>
      </div>

      {success && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-[rgba(76,175,135,0.3)] bg-[rgba(76,175,135,0.08)] px-4 py-3 text-sm text-[#4CAF87]">
          <CheckCircle2 size={16} /> {success}
        </div>
      )}
      {errors.form && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-[rgba(226,114,91,0.3)] bg-[rgba(226,114,91,0.08)] px-4 py-3 text-sm text-[#E2725B]">
          <AlertCircle size={16} /> {errors.form}
        </div>
      )}

      <div className="glass-card p-6 space-y-5">
        <div>
          <label className="block text-xs font-semibold text-[#BCC5BF] mb-1.5">Client <span className="text-[#E2725B]">*</span></label>
          <select value={form.clientId} onChange={e => set('clientId', e.target.value)} className="fi-input w-full h-10 px-3 text-sm">
            <option value="">Select client...</option>
            {clients.map(c => <option key={c.clientId} value={c.clientId}>{c.name} ({c.clientId})</option>)}
          </select>
          {clients.length === 0 && (
            <p className="text-[11px] text-[#E0A84D] mt-1.5">
              No clients yet.{' '}
              <button type="button" className="text-[#7EB6FF] font-semibold underline" onClick={() => navigate('/clients')}>Add a client first</button>
            </p>
          )}
          {errors.clientId && <p className="text-[11px] text-[#E2725B] mt-1">{errors.clientId}</p>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-[#BCC5BF] mb-1.5">Project name <span className="text-[#E2725B]">*</span></label>
            <input value={form.name} onChange={e => set('name', e.target.value)} className="fi-input w-full h-10 px-3 text-sm" placeholder="Engagement name" />
            {errors.name && <p className="text-[11px] text-[#E2725B] mt-1">{errors.name}</p>}
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#BCC5BF] mb-1.5">Project ID</label>
            <input
              disabled
              value={project?.projectId || 'IQA-Proj-XXXXXX (generated on save)'}
              className="fi-input w-full h-10 px-3 text-sm opacity-70 cursor-not-allowed font-mono"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-[#BCC5BF] mb-1.5">Status</label>
            <select value={form.status} onChange={e => set('status', e.target.value as ProjectStatus)} className="fi-input w-full h-10 px-3 text-sm">
              <option value="Active">Active</option>
              <option value="On Hold">On Hold</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#BCC5BF] mb-1.5">Start Date <span className="text-[#E2725B]">*</span></label>
            <DatePicker value={form.startDate} rangeStart={form.startDate} rangeEnd={form.endDate} onChange={v => set('startDate', v)} />
            {errors.startDate && <p className="text-[11px] text-[#E2725B] mt-1">{errors.startDate}</p>}
          </div>
          {form.status !== 'Active' && (
            <div>
              <label className="block text-xs font-semibold text-[#BCC5BF] mb-1.5">End Date <span className="text-[#E2725B]">*</span></label>
              <DatePicker value={form.endDate} rangeStart={form.startDate} rangeEnd={form.endDate} onChange={v => set('endDate', v)} />
              {errors.endDate && <p className="text-[11px] text-[#E2725B] mt-1">{errors.endDate}</p>}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-[#BCC5BF] mb-1.5">Project Manager</label>
            <ManagerSelect type="Project Manager" value={form.projectManager} onChange={v => set('projectManager', v)} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#BCC5BF] mb-1.5">Delivery Manager</label>
            <ManagerSelect type="Delivery Manager" value={form.deliveryManager} onChange={v => set('deliveryManager', v)} />
          </div>
        </div>

        <FileAttach
          label="MSA (optional)"
          value={form.msaOriginalName}
          onChange={v => set('msaOriginalName', v)}
          hint="Attach the master service agreement if available."
        />

        {isEdit && (
          <div className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] p-4">
            <div className="flex items-center gap-2 mb-2">
              <FileText size={15} className="text-[#7EB6FF]" />
              <h3 className="text-sm font-semibold text-[#F0EDE4]">SOWs</h3>
            </div>
            {linkedSows.length === 0 ? (
              <p className="text-sm text-[#8FA99E]">No SOWs linked yet. Create them from the SOWs tab.</p>
            ) : (
              <ul className="space-y-1.5">
                {linkedSows.map(s => (
                  <li key={s.id} className="text-sm text-[#C7D2E0] flex justify-between gap-3">
                    <span className="font-mono text-[#7EB6FF]">{s.sowNumber}</span>
                    <span className="truncate">{s.title}</span>
                    <span className="text-[#8FA99E]">{s.status}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button type="button" disabled={saving} onClick={submit} className="btn-imanage px-6 py-2.5 text-sm">
            {isEdit ? 'Save Project' : 'Create Project'}
          </button>
          <button type="button" onClick={() => navigate('/projects')} className="btn-ghost px-6 py-2.5 text-sm">Cancel</button>
        </div>
      </div>
    </div>
  );
}
