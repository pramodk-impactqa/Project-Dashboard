import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Building2, FolderKanban, FileText, Receipt,
  CreditCard, BarChart3, Bell, ChevronLeft, ChevronRight, Menu, LogOut, Shield,
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { clsx } from 'clsx';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/clients', icon: Building2, label: 'Clients' },
  { to: '/projects', icon: FolderKanban, label: 'Projects' },
  { to: '/sows', icon: FileText, label: 'SOWs' },
  { to: '/invoices', icon: Receipt, label: 'Invoices' },
  { to: '/payments', icon: CreditCard, label: 'Payments' },
  { to: '/reports', icon: BarChart3, label: 'Reports' },
  { to: '/notifications', icon: Bell, label: 'Notifications' },
];

const titles: Record<string, string> = {
  '/': 'Dashboard',
  '/clients': 'Clients',
  '/projects': 'Projects',
  '/sows': 'SOWs',
  '/invoices': 'Invoices',
  '/payments': 'Payments',
  '/reports': 'Reports',
  '/notifications': 'Notifications',
};

function formatRole(role?: string) {
  if (!role) return 'Viewer';
  return role.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function formatStamp(d: Date) {
  return d.toLocaleString('en-GB', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const { notifications } = useAppContext();
  const { user, logout } = useAuth();
  const location = useLocation();
  const unread = notifications.filter(n => !n.read).length;
  const page = titles[location.pathname]
    || (location.pathname.startsWith('/projects/') && location.pathname.includes('/edit') ? 'Edit Project'
    : location.pathname.startsWith('/projects/') && location.pathname.endsWith('/new') ? 'Add Project'
    : location.pathname.startsWith('/projects/') ? 'Project Details'
    : 'Dashboard');

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-[#090B1F]">
      {mobileOpen && <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden" onClick={() => setMobileOpen(false)} />}

      <aside className={clsx(
        'fixed inset-y-0 left-0 z-50 flex flex-col transition-all duration-300 lg:relative',
        'bg-[#0C0F24] border-r border-white/[0.07]',
        collapsed ? 'w-[72px]' : 'w-60',
        mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
      )}>
        <div className={clsx('h-[68px] flex items-center border-b border-white/[0.07] shrink-0', collapsed ? 'justify-center px-2' : 'px-4 gap-3')}>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#7B2CFF] to-[#A855F7] text-white text-xs font-black shadow-[0_0_20px_rgba(123,44,255,0.28)]">
            I
          </div>
          {!collapsed && (
            <div>
              <p className="text-sm font-bold leading-none tracking-tight">
                <span className="text-white">IQA-</span>
                <span className="bg-gradient-to-r from-[#C4B5FD] to-[#A855F7] bg-clip-text text-transparent">iManage</span>
              </p>
              <p className="text-[9px] font-semibold tracking-[0.16em] uppercase text-[#A7A9C0] mt-1.5">Finance Portal</p>
            </div>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-2.5" aria-label="Primary">
          {!collapsed && (
            <p className="px-2.5 mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#6B6E88]">Operations</p>
          )}
          <div className="space-y-0.5">
            {navItems.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) => clsx(
                  'flex items-center gap-2.5 rounded-xl min-h-11 px-2.5 text-[13px] font-medium transition-colors',
                  collapsed && 'justify-center px-2',
                  isActive
                    ? 'bg-[rgba(123,44,255,0.16)] text-white shadow-[inset_3px_0_0_#A855F7] [&>svg]:text-[#C4B5FD]'
                    : 'text-[#A7A9C0] hover:bg-white/[0.04] hover:text-white',
                )}
                title={collapsed ? label : undefined}
              >
                <span className="relative shrink-0">
                  <Icon size={18} />
                  {label === 'Notifications' && unread > 0 && (
                    <span className="absolute -top-1 -right-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#F43F5E] text-[8px] font-bold text-white">
                      {unread > 9 ? '9+' : unread}
                    </span>
                  )}
                </span>
                {!collapsed && <span>{label}</span>}
              </NavLink>
            ))}
          </div>
        </nav>

        {!collapsed && (
          <div className="px-3 pb-3">
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6B6E88]">Session</p>
              <p className="mt-1 text-xs font-semibold text-white truncate">{user ? `${user.firstName} ${user.lastName}` : 'Signed in'}</p>
              <p className="text-[11px] text-[#A7A9C0]">{formatRole(user?.role)}</p>
            </div>
          </div>
        )}

        <button type="button" onClick={() => setCollapsed(!collapsed)} className="hidden lg:flex items-center justify-center min-h-11 border-t border-white/[0.07] text-[#A7A9C0] hover:text-white" aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </aside>

      <div className="flex flex-1 flex-col min-w-0">
        <header className="sticky top-0 z-30 flex h-[68px] items-center justify-between gap-4 border-b border-white/[0.07] bg-[rgba(9,11,31,0.78)] backdrop-blur-xl px-4 lg:px-6">
          <div className="flex items-center gap-3 min-w-0">
            <button type="button" onClick={() => setMobileOpen(true)} className="lg:hidden min-h-11 min-w-11 inline-flex items-center justify-center rounded-xl text-[#A7A9C0]" aria-label="Open menu">
              <Menu size={20} />
            </button>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.16em] text-[#A7A9C0]">IQA-iManage · Internal</p>
              <p className="text-sm font-semibold text-white truncate">{page}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="trust-chip hidden md:inline-flex">
              <Shield size={11} className="text-[#34D399]" />
              Secure session
            </span>
            <span className="hidden xl:block text-[11px] tabular-nums text-[#A7A9C0]">{formatStamp(now)}</span>
            <div className="hidden sm:flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] pl-1 pr-3 py-1">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#7B2CFF] to-[#A855F7] text-xs font-bold text-white">
                {user?.firstName?.charAt(0) || 'U'}
              </div>
              <div className="hidden md:block">
                <p className="text-[13px] font-semibold text-white leading-none">{user ? `${user.firstName} ${user.lastName}` : 'User'}</p>
                <p className="text-[10px] text-[#A7A9C0] mt-1">{formatRole(user?.role)}</p>
              </div>
            </div>
            <button type="button" onClick={logout} className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-xl text-[#A7A9C0] hover:text-[#F43F5E] hover:bg-white/[0.04]" aria-label="Sign out">
              <LogOut size={17} />
            </button>
          </div>
        </header>

        <main className="app-workspace flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
