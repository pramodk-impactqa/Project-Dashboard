import { Paperclip, X } from 'lucide-react';

interface FileAttachProps {
  label: string;
  value: string;
  onChange: (filename: string) => void;
  hint?: string;
}

export default function FileAttach({ label, value, onChange, hint }: FileAttachProps) {
  return (
    <div>
      <label className="block text-xs font-semibold text-[#BCC5BF] mb-1.5">{label}</label>
      <label className="flex items-center gap-3 rounded-xl border border-dashed border-[rgba(126,182,255,0.28)] bg-[rgba(75,140,255,0.04)] px-3 py-3 cursor-pointer hover:border-[rgba(126,182,255,0.5)] transition-colors">
        <Paperclip size={16} className="text-[#7EB6FF] shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-[#F0EDE4] truncate">{value || 'Choose a file to attach'}</p>
          {hint && <p className="text-[11px] text-[#8FA3B8]">{hint}</p>}
        </div>
        <input
          type="file"
          className="hidden"
          onChange={e => onChange(e.target.files?.[0]?.name || '')}
        />
      </label>
      {value && (
        <button type="button" onClick={() => onChange('')} className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-[#E2725B]">
          <X size={11} /> Remove attachment
        </button>
      )}
    </div>
  );
}
