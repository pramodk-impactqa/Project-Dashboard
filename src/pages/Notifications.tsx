import { Bell, AlertTriangle, Clock, CreditCard, RefreshCw, Check, X } from 'lucide-react';
import { clsx } from 'clsx';
import { useAppContext } from '../context/AppContext';
import { useState } from 'react';
import { formatDate } from '../utils/format';
import PageHeader from '../components/PageHeader';

const iconMap: Record<string, typeof AlertTriangle> = { overdue_invoice: AlertTriangle, sow_expiry: Clock, pending_payment: CreditCard, renewal: RefreshCw, status_change: Bell };
const severityStyles = {
  critical: 'border-l-[#F43F5E] bg-[rgba(244,63,94,0.04)]',
  warning: 'border-l-[#F59E0B] bg-[rgba(245,158,11,0.04)]',
  info: 'border-l-[#A855F7] bg-[rgba(168,85,247,0.06)]',
};
const severityIcon = {
  critical: 'bg-[rgba(244,63,94,0.12)] text-[#F43F5E]',
  warning: 'bg-[rgba(245,158,11,0.12)] text-[#F59E0B]',
  info: 'bg-[rgba(123,44,255,0.14)] text-[#C4B5FD]',
};

export default function Notifications() {
  const { notifications, markNotificationRead, markAllNotificationsRead } = useAppContext();
  const [filter, setFilter] = useState<string>('all');

  const filtered = filter === 'all' ? notifications : filter === 'unread' ? notifications.filter(n => !n.read) : notifications.filter(n => n.type === filter);
  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="p-5 lg:p-8 space-y-6">
      <PageHeader
        icon={Bell}
        title="Notifications"
        description={`${unreadCount} unread ${unreadCount === 1 ? 'alert' : 'alerts'} across collections and delivery.`}
        actions={unreadCount > 0 ? (
          <button onClick={markAllNotificationsRead} className="btn-ghost flex items-center gap-1.5 px-3 py-2 text-xs font-medium"><Check size={14} /> Mark all as read</button>
        ) : undefined}
      />

      <div className="flex items-center gap-1.5 flex-wrap">
        {[{ key: 'all', label: 'All' }, { key: 'unread', label: `Unread (${unreadCount})` }, { key: 'overdue_invoice', label: 'Overdue' }, { key: 'sow_expiry', label: 'SOW Expiry' }, { key: 'pending_payment', label: 'Payments' }, { key: 'renewal', label: 'Renewals' }].map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)} className={filter === f.key ? 'fi-pill-active' : 'fi-pill'}>{f.label}</button>
        ))}
        {filter !== 'all' && (
          <button onClick={() => setFilter('all')} className="flex items-center gap-1 ml-2 text-xs font-semibold text-[#D4AF37] hover:text-[#F0EDE4] transition-colors">
            <X size={13} /> Clear Filter
          </button>
        )}
      </div>
      {filter !== 'all' && (
        <div className="text-xs text-[#8FA99E]">
          {filtered.length} notification{filtered.length !== 1 ? 's' : ''} found
          <span className="ml-1">• Filter: <span className="text-[#D4AF37]">{filter === 'unread' ? 'Unread' : filter === 'overdue_invoice' ? 'Overdue' : filter === 'sow_expiry' ? 'SOW Expiry' : filter === 'pending_payment' ? 'Payments' : 'Renewals'}</span></span>
        </div>
      )}

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="glass-card p-16 text-center"><Bell size={32} className="mx-auto text-[#8FA99E] mb-3" /><p className="text-sm text-[#BCC5BF] font-medium">No notifications to display.</p><p className="text-xs text-[#8FA99E] mt-1">Alerts will appear here as system events occur.</p></div>
        ) : (
          filtered.map(n => {
            const Icon = iconMap[n.type];
            return (
              <div key={n.id} onClick={() => markNotificationRead(n.id)} className={clsx('flex items-start gap-3 rounded-lg border-l-4 border border-[rgba(255,255,255,0.06)] p-4 cursor-pointer transition-all hover:bg-[rgba(255,255,255,0.03)]', severityStyles[n.severity])}>
                <div className={clsx('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', severityIcon[n.severity])}><Icon size={15} /></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2"><h3 className={clsx('text-sm', !n.read ? 'font-bold text-[#F0EDE4]' : 'font-medium text-[#BCC5BF]')}>{n.title}</h3>{!n.read && <span className="h-1.5 w-1.5 rounded-full bg-[#D4AF37] shrink-0" />}</div>
                  <p className="text-xs text-[#8FA99E] mt-0.5">{n.message}</p>
                  <p className="text-[11px] text-[#8FA99E] mt-2">{formatDate(n.date)}</p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
