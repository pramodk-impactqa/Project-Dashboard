import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppProvider, useAppContext } from './context/AppContext';
import Loader from './components/Loader';
import Layout from './components/Layout';
import Login from './pages/Login';
import type { ReactNode } from 'react';
import { lazy, Suspense, Component } from 'react';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Clients = lazy(() => import('./pages/Clients'));
const AllProjects = lazy(() => import('./pages/AllProjects'));
const ProjectDetail = lazy(() => import('./pages/ProjectDetail'));
const AddProject = lazy(() => import('./pages/AddProject'));
const SOWs = lazy(() => import('./pages/SOWs'));
const Invoices = lazy(() => import('./pages/Invoices'));
const Payments = lazy(() => import('./pages/Payments'));
const Reports = lazy(() => import('./pages/Reports'));
const Notifications = lazy(() => import('./pages/Notifications'));
const Settings = lazy(() => import('./pages/Settings'));
const Managers = lazy(() => import('./pages/Managers'));

class RouteErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-[60vh] p-8">
          <div className="text-center max-w-md">
            <h1 className="text-xl font-bold text-[#F0EDE4] mb-2">This page failed to load</h1>
            <p className="text-sm text-[#8B949E] mb-4">Refresh the browser, or go back to the dashboard.</p>
            <a href="/" className="btn-primary inline-flex px-4 py-2 text-sm">Back to Dashboard</a>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

/**
 * ProtectedRoute — Requires authenticated session.
 * Note: The BACKEND is the authoritative source of truth for auth/RBAC.
 * This frontend guard is purely for UX (showing appropriate pages).
 */
function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { isLoading: dataLoading } = useAppContext();

  if (authLoading) return <Loader message="Checking session..." />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (dataLoading) return <Loader message="Loading your data..." />;
  return <>{children}</>;
}

/**
 * PermissionRoute — Requires specific permission.
 * If user lacks permission, show access denied.
 */
function PermissionRoute({ permission, children }: { permission: string; children: ReactNode }) {
  const { hasPermission } = useAuth();

  if (!hasPermission(permission)) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-[#F0EDE4] mb-2">Access Denied</h1>
          <p className="text-[#8FA99E]">You do not have permission to view this page.</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

function AuthGate() {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <Loader message="Starting up..." />;
  if (isAuthenticated) return <Navigate to="/" replace />;
  return <Login />;
}

function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<AuthGate />} />
        <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route path="/" element={<RouteErrorBoundary><Suspense fallback={<Loader message="Loading dashboard..." />}><Dashboard /></Suspense></RouteErrorBoundary>} />
          <Route path="/clients" element={<PermissionRoute permission="CLIENT_VIEW"><RouteErrorBoundary><Suspense fallback={<Loader message="Loading clients..." />}><Clients /></Suspense></RouteErrorBoundary></PermissionRoute>} />
          <Route path="/projects" element={<PermissionRoute permission="PROJECT_VIEW"><RouteErrorBoundary><Suspense fallback={<Loader message="Loading projects..." />}><AllProjects /></Suspense></RouteErrorBoundary></PermissionRoute>} />
          <Route path="/projects/new" element={<PermissionRoute permission="PROJECT_CREATE"><RouteErrorBoundary><Suspense fallback={<Loader message="Loading form..." />}><AddProject /></Suspense></RouteErrorBoundary></PermissionRoute>} />
          <Route path="/projects/:id" element={<PermissionRoute permission="PROJECT_VIEW"><RouteErrorBoundary><Suspense fallback={<Loader message="Loading project..." />}><ProjectDetail /></Suspense></RouteErrorBoundary></PermissionRoute>} />
          <Route path="/projects/:id/edit" element={<PermissionRoute permission="PROJECT_UPDATE"><RouteErrorBoundary><Suspense fallback={<Loader message="Loading form..." />}><AddProject /></Suspense></RouteErrorBoundary></PermissionRoute>} />
          <Route path="/sows" element={<PermissionRoute permission="SOW_VIEW"><RouteErrorBoundary><Suspense fallback={<Loader message="Loading SOWs..." />}><SOWs /></Suspense></RouteErrorBoundary></PermissionRoute>} />
          <Route path="/invoices" element={<PermissionRoute permission="INVOICE_VIEW"><RouteErrorBoundary><Suspense fallback={<Loader message="Loading invoices..." />}><Invoices /></Suspense></RouteErrorBoundary></PermissionRoute>} />
          <Route path="/payments" element={<PermissionRoute permission="PAYMENT_VIEW"><RouteErrorBoundary><Suspense fallback={<Loader message="Loading payments..." />}><Payments /></Suspense></RouteErrorBoundary></PermissionRoute>} />
          <Route path="/reports" element={<PermissionRoute permission="REPORT_VIEW"><RouteErrorBoundary><Suspense fallback={<Loader message="Loading reports..." />}><Reports /></Suspense></RouteErrorBoundary></PermissionRoute>} />
          <Route path="/managers" element={<PermissionRoute permission="MANAGER_VIEW"><RouteErrorBoundary><Suspense fallback={<Loader message="Loading managers..." />}><Managers /></Suspense></RouteErrorBoundary></PermissionRoute>} />
          <Route path="/notifications" element={<RouteErrorBoundary><Suspense fallback={<Loader message="Loading notifications..." />}><Notifications /></Suspense></RouteErrorBoundary>} />
          <Route path="/settings" element={<PermissionRoute permission="SETTINGS_VIEW"><RouteErrorBoundary><Suspense fallback={<Loader message="Loading settings..." />}><Settings /></Suspense></RouteErrorBoundary></PermissionRoute>} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppProvider>
        <AppRoutes />
      </AppProvider>
    </AuthProvider>
  );
}
