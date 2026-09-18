import { clsx } from 'clsx';
import { CheckCircle2, Clock, AlertTriangle, XCircle, FileText, Send, Loader2, Ban } from 'lucide-react';

const config: Record<string, { bg: string; text: string; icon?: typeof CheckCircle2 }> = {
  Active:             { bg: 'bg-[rgba(76,175,135,0.15)] border-[rgba(76,175,135,0.3)]', text: 'text-[#5CD4A0]', icon: CheckCircle2 },
  Paid:               { bg: 'bg-[rgba(76,175,135,0.15)] border-[rgba(76,175,135,0.3)]', text: 'text-[#5CD4A0]', icon: CheckCircle2 },
  Received:           { bg: 'bg-[rgba(76,175,135,0.15)] border-[rgba(76,175,135,0.3)]', text: 'text-[#5CD4A0]', icon: CheckCircle2 },
  Approved:           { bg: 'bg-[rgba(76,175,135,0.15)] border-[rgba(76,175,135,0.3)]', text: 'text-[#5CD4A0]', icon: CheckCircle2 },
  Completed:          { bg: 'bg-[rgba(30,138,110,0.18)] border-[rgba(30,138,110,0.3)]', text: 'text-[#3CC9A0]', icon: CheckCircle2 },
  Renewed:            { bg: 'bg-[rgba(30,138,110,0.18)] border-[rgba(30,138,110,0.3)]', text: 'text-[#3CC9A0]', icon: CheckCircle2 },
  Sent:               { bg: 'bg-[rgba(212,175,55,0.14)] border-[rgba(212,175,55,0.25)]', text: 'text-[#E4C44F]', icon: Send },
  Draft:              { bg: 'bg-[rgba(255,255,255,0.06)] border-[rgba(255,255,255,0.12)]', text: 'text-[#BCC5BF]', icon: FileText },
  Prospect:           { bg: 'bg-[rgba(167,139,250,0.14)] border-[rgba(167,139,250,0.25)]', text: 'text-[#C4B5FC]' },
  'On Hold':          { bg: 'bg-[rgba(224,168,77,0.14)] border-[rgba(224,168,77,0.25)]', text: 'text-[#F0C060]', icon: Clock },
  'Partially Paid':   { bg: 'bg-[rgba(224,168,77,0.14)] border-[rgba(224,168,77,0.25)]', text: 'text-[#F0C060]', icon: Clock },
  Partial:            { bg: 'bg-[rgba(224,168,77,0.14)] border-[rgba(224,168,77,0.25)]', text: 'text-[#F0C060]', icon: Clock },
  Pending:            { bg: 'bg-[rgba(224,168,77,0.14)] border-[rgba(224,168,77,0.25)]', text: 'text-[#F0C060]', icon: Clock },
  'Pending Signature':{ bg: 'bg-[rgba(224,168,77,0.14)] border-[rgba(224,168,77,0.25)]', text: 'text-[#F0C060]', icon: Clock },
  Processing:         { bg: 'bg-[rgba(30,138,110,0.14)] border-[rgba(30,138,110,0.25)]', text: 'text-[#3CC9A0]', icon: Loader2 },
  'In Review':        { bg: 'bg-[rgba(212,175,55,0.14)] border-[rgba(212,175,55,0.25)]', text: 'text-[#E4C44F]', icon: Clock },
  Overdue:            { bg: 'bg-[rgba(226,114,91,0.14)] border-[rgba(226,114,91,0.25)]', text: 'text-[#F0876C]', icon: AlertTriangle },
  Expired:            { bg: 'bg-[rgba(226,114,91,0.14)] border-[rgba(226,114,91,0.25)]', text: 'text-[#F0876C]', icon: XCircle },
  Failed:             { bg: 'bg-[rgba(226,114,91,0.14)] border-[rgba(226,114,91,0.25)]', text: 'text-[#F0876C]', icon: XCircle },
  Cancelled:          { bg: 'bg-[rgba(255,255,255,0.05)] border-[rgba(255,255,255,0.1)]', text: 'text-[#8FA99E]', icon: Ban },
  Inactive:           { bg: 'bg-[rgba(255,255,255,0.05)] border-[rgba(255,255,255,0.1)]', text: 'text-[#8FA99E]', icon: Ban },
  Rejected:           { bg: 'bg-[rgba(226,114,91,0.14)] border-[rgba(226,114,91,0.25)]', text: 'text-[#F0876C]', icon: XCircle },
};

const fallback = { bg: 'bg-[rgba(255,255,255,0.06)] border-[rgba(255,255,255,0.12)]', text: 'text-[#BCC5BF]' };

export default function StatusBadge({ status }: { status: string }) {
  const c = config[status] || fallback;
  const Icon = c.icon;
  return (
    <span className={clsx('inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide leading-5', c.bg, c.text)}>
      {Icon && <Icon size={12} className="shrink-0" />}
      {status}
    </span>
  );
}
