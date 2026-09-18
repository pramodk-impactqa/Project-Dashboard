/**
 * AppContext — Application data state management.
 *
 * SECURITY NOTES:
 * - All data is fetched from and persisted to the backend API.
 * - NO sensitive data is stored in localStorage or sessionStorage.
 * - The backend enforces all authorization — this context only manages UI state.
 * - IDs are generated server-side, never by the client.
 */
import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import {
  clientApi, projectApi, sowApi, invoiceApi, paymentApi,
  managerApi, notificationApi, auditApi,
} from '../services/api';
import { useAuth } from './AuthContext';
import type {
  Project, SOW, Invoice, Payment, Manager, Notification, AuditEntry, Client,
} from '../types';

// ── Mapper helpers (API snake_case → frontend camelCase) ───

function mapProject(p: any): Project {
  return {
    id: p.id,
    projectId: p.project_id,
    name: p.name,
    description: p.description || '',
    domain: p.domain,
    entity: p.entity,
    currency: p.currency,
    status: p.status,
    startDate: p.start_date,
    endDate: p.end_date || '',
    clientName: p.client_name,
    clientId: p.client_id || '',
    clientAddress: p.client_address || '',
    clientTaxId: p.client_tax_id || '',
    projectManager: p.project_manager || '',
    deliveryManager: p.delivery_manager || '',
    department: p.department || 'Engineering',
    billingId: p.billing_id || '',
    billingModel: p.billing_model || 'FTE',
    billingFrequency: p.billing_frequency || 'Monthly',
    billingContact: p.billing_contact || '',
    billingAddress: p.billing_address || '',
    paymentTerms: p.payment_terms || 'FTE',
    msaOriginalName: p.msa_original_name || '',
    createdAt: p.created_at,
    updatedAt: p.updated_at,
    sowCount: p.sow_count,
    invoiceCount: p.invoice_count,
    paymentCount: p.payment_count,
    totalInvoiced: p.total_invoiced,
    totalPaid: p.total_paid,
  };
}

function mapSOW(s: any): SOW {
  return {
    id: s.id,
    sowNumber: s.sow_number,
    projectId: s.project_id,
    projectName: s.project_name || '',
    clientName: s.client_name || '',
    title: s.title,
    description: s.description || '',
    version: s.version || '1.0',
    startDate: s.start_date,
    endDate: s.end_date,
    renewalDate: s.renewal_date || '',
    contractType: s.contract_type,
    sowType: s.sow_type || (s.contract_type === 'Fixed Price' ? 'Fixed' : s.contract_type) || 'T&M',
    basis: s.basis || 'Monthly',
    contractValue: s.contract_value,
    monthlyBilling: s.monthly_billing || 0,
    billingFrequency: s.billing_frequency || 'Monthly',
    currency: s.currency,
    status: s.status,
    remarks: s.remarks || '',
    projectManager: s.project_manager || '',
    deliveryManager: s.delivery_manager || '',
    poNumber: s.po_number || '',
    sowOriginalName: s.sow_original_name || '',
    poOriginalName: s.po_original_name || '',
    createdAt: s.created_at,
    updatedAt: s.updated_at,
  };
}

function mapInvoice(i: any): Invoice {
  return {
    id: i.id,
    invoiceNumber: i.invoice_number,
    entity: i.entity,
    projectId: i.project_id,
    projectName: i.project_name || '',
    clientName: i.client_name || '',
    billingId: i.billing_id || '',
    sowId: i.sow_id || '',
    sowNumber: i.sow_number || '',
    billingPeriod: i.billing_period || '',
    invoiceDate: i.invoice_date,
    dueDate: i.due_date,
    amount: i.amount,
    currency: i.currency,
    taxAmount: i.tax_amount || 0,
    totalAmount: i.total_amount,
    status: i.status,
    createdAt: i.created_at,
  };
}

function mapPayment(p: any): Payment {
  return {
    id: p.id,
    invoiceId: p.invoice_id || '',
    invoiceNumber: p.invoice_number || '',
    projectId: p.project_id,
    projectName: p.project_name || '',
    amountReceived: p.amount_received,
    paymentDate: p.payment_date,
    currency: p.currency,
    exchangeRate: p.exchange_rate || 1,
    bank: p.bank || '',
    tdsWithholding: p.tds_withholding || 0,
    shortPayment: p.short_payment || 0,
    outstandingBalance: p.outstanding_balance || 0,
    remarks: p.remarks || '',
    status: p.status,
    createdAt: p.created_at,
  };
}

function mapClient(c: any): Client {
  return {
    id: c.id,
    clientId: c.client_id,
    name: c.name,
    address: c.address || '',
    domain: c.domain,
    entity: c.entity,
    status: c.status,
    taxId: c.tax_id || '',
    projectCount: c.project_count,
    createdAt: c.created_at,
    updatedAt: c.updated_at,
  };
}

function mapManager(m: any): Manager {
  return { id: m.id, name: m.name, type: m.type, email: m.email || '' };
}

function mapNotification(n: any): Notification {
  return {
    id: n.id, type: n.type, title: n.title, message: n.message,
    date: n.date, read: !!n.read, severity: n.severity || 'info',
  };
}

function mapAudit(a: any): AuditEntry {
  return {
    id: a.id,
    action: a.event_type,
    entityType: a.target_entity || 'System',
    entityId: a.target_id || '',
    entityName: a.target_name || '',
    user: a.actor_username || 'System',
    timestamp: a.created_at,
    details: a.details || '',
    previousValue: a.previous_value,
    newValue: a.new_value,
  };
}

// ── Reverse mapper (frontend camelCase → API snake_case) ───

function toProjectApi(p: Partial<Project>): Record<string, unknown> {
  const m: Record<string, unknown> = {};
  if (p.name !== undefined) m.name = p.name;
  if (p.description !== undefined) m.description = p.description;
  if (p.domain !== undefined) m.domain = p.domain;
  if (p.entity !== undefined) m.entity = p.entity;
  if (p.currency !== undefined) m.currency = p.currency;
  if (p.status !== undefined) m.status = p.status;
  if (p.startDate !== undefined) m.startDate = p.startDate;
  if (p.endDate !== undefined) m.endDate = p.endDate;
  if (p.clientId !== undefined) m.clientId = p.clientId;
  if (p.clientName !== undefined) m.clientName = p.clientName;
  if (p.clientAddress !== undefined) m.clientAddress = p.clientAddress;
  if (p.clientTaxId !== undefined) m.clientTaxId = p.clientTaxId;
  if (p.projectManager !== undefined) m.projectManager = p.projectManager;
  if (p.deliveryManager !== undefined) m.deliveryManager = p.deliveryManager;
  if (p.department !== undefined) m.department = p.department;
  if (p.billingModel !== undefined) m.billingModel = p.billingModel;
  if (p.billingFrequency !== undefined) m.billingFrequency = p.billingFrequency;
  if (p.billingContact !== undefined) m.billingContact = p.billingContact;
  if (p.billingAddress !== undefined) m.billingAddress = p.billingAddress;
  if (p.paymentTerms !== undefined) m.paymentTerms = p.paymentTerms;
  if (p.msaOriginalName !== undefined) m.msaOriginalName = p.msaOriginalName;
  return m;
}

function toSOWApi(s: Partial<SOW>): Record<string, unknown> {
  const m: Record<string, unknown> = {};
  if (s.projectId !== undefined) m.projectId = s.projectId;
  if (s.title !== undefined) m.title = s.title;
  if (s.description !== undefined) m.description = s.description;
  if (s.version !== undefined) m.version = s.version;
  if (s.startDate !== undefined) m.startDate = s.startDate;
  if (s.endDate !== undefined) m.endDate = s.endDate;
  if (s.renewalDate !== undefined) m.renewalDate = s.renewalDate;
  if (s.contractType !== undefined) m.contractType = s.contractType;
  if (s.sowType !== undefined) m.sowType = s.sowType;
  if (s.basis !== undefined) m.basis = s.basis;
  if (s.contractValue !== undefined) m.contractValue = s.contractValue;
  if (s.monthlyBilling !== undefined) m.monthlyBilling = s.monthlyBilling;
  if (s.billingFrequency !== undefined) m.billingFrequency = s.billingFrequency;
  if (s.currency !== undefined) m.currency = s.currency;
  if (s.status !== undefined) m.status = s.status;
  if (s.remarks !== undefined) m.remarks = s.remarks;
  if (s.projectManager !== undefined) m.projectManager = s.projectManager;
  if (s.deliveryManager !== undefined) m.deliveryManager = s.deliveryManager;
  if (s.poNumber !== undefined) m.poNumber = s.poNumber;
  if (s.sowOriginalName !== undefined) m.sowOriginalName = s.sowOriginalName;
  if (s.poOriginalName !== undefined) m.poOriginalName = s.poOriginalName;
  return m;
}

function toClientApi(c: Partial<Client>): Record<string, unknown> {
  const m: Record<string, unknown> = {};
  if (c.name !== undefined) m.name = c.name;
  if (c.address !== undefined) m.address = c.address;
  if (c.domain !== undefined) m.domain = c.domain;
  if (c.entity !== undefined) m.entity = c.entity;
  if (c.status !== undefined) m.status = c.status;
  if (c.taxId !== undefined) m.taxId = c.taxId;
  return m;
}

function toInvoiceApi(i: Partial<Invoice>): Record<string, unknown> {
  const m: Record<string, unknown> = {};
  if (i.entity !== undefined) m.entity = i.entity;
  if (i.projectId !== undefined) m.projectId = i.projectId;
  if (i.sowId !== undefined) m.sowId = i.sowId;
  if (i.sowNumber !== undefined) m.sowNumber = i.sowNumber;
  if (i.billingPeriod !== undefined) m.billingPeriod = i.billingPeriod;
  if (i.invoiceDate !== undefined) m.invoiceDate = i.invoiceDate;
  if (i.dueDate !== undefined) m.dueDate = i.dueDate;
  if (i.amount !== undefined) m.amount = i.amount;
  if (i.currency !== undefined) m.currency = i.currency;
  if (i.taxAmount !== undefined) m.taxAmount = i.taxAmount;
  if (i.totalAmount !== undefined) m.totalAmount = i.totalAmount;
  if (i.status !== undefined) m.status = i.status;
  return m;
}

function toPaymentApi(p: Partial<Payment>): Record<string, unknown> {
  const m: Record<string, unknown> = {};
  if (p.invoiceId !== undefined) m.invoiceId = p.invoiceId;
  if (p.invoiceNumber !== undefined) m.invoiceNumber = p.invoiceNumber;
  if (p.projectId !== undefined) m.projectId = p.projectId;
  if (p.amountReceived !== undefined) m.amountReceived = p.amountReceived;
  if (p.paymentDate !== undefined) m.paymentDate = p.paymentDate;
  if (p.currency !== undefined) m.currency = p.currency;
  if (p.exchangeRate !== undefined) m.exchangeRate = p.exchangeRate;
  if (p.bank !== undefined) m.bank = p.bank;
  if (p.tdsWithholding !== undefined) m.tdsWithholding = p.tdsWithholding;
  if (p.shortPayment !== undefined) m.shortPayment = p.shortPayment;
  if (p.outstandingBalance !== undefined) m.outstandingBalance = p.outstandingBalance;
  if (p.remarks !== undefined) m.remarks = p.remarks;
  if (p.status !== undefined) m.status = p.status;
  return m;
}

// ── Context Types ─────────────────────────────────────────

interface AppState {
  // Data
  clients: Client[];
  projects: Project[];
  sows: SOW[];
  invoices: Invoice[];
  payments: Payment[];
  managers: Manager[];
  notifications: Notification[];
  auditLog: AuditEntry[];

  // State
  isLoading: boolean;
  error: string | null;

  // Refresh
  refreshClients: () => Promise<void>;
  refreshProjects: () => Promise<void>;
  refreshSOWs: () => Promise<void>;
  refreshInvoices: () => Promise<void>;
  refreshPayments: () => Promise<void>;
  refreshManagers: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
  refreshAuditLog: () => Promise<void>;
  refreshAll: () => Promise<void>;

  // Client CRUD
  addClient: (data: Partial<Client>) => Promise<Client>;
  updateClient: (clientId: string, data: Partial<Client>) => Promise<void>;

  // Project CRUD
  addProject: (data: Partial<Project>) => Promise<Project>;
  updateProject: (projectId: string, data: Partial<Project>) => Promise<void>;
  deleteProject: (projectId: string) => Promise<void>;
  getProject: (projectId: string) => Project | undefined;

  // SOW CRUD
  addSOW: (data: Partial<SOW>) => Promise<SOW>;
  updateSOW: (sowNumber: string, data: Partial<SOW>) => Promise<void>;
  cancelSOW: (sowNumber: string) => Promise<void>;

  // Invoice CRUD
  addInvoice: (data: Partial<Invoice>) => Promise<Invoice>;
  updateInvoice: (invoiceNumber: string, data: Partial<Invoice>) => Promise<void>;
  cancelInvoice: (invoiceNumber: string) => Promise<void>;

  // Payment CRUD
  addPayment: (data: Partial<Payment>) => Promise<Payment>;
  updatePayment: (id: string, data: Partial<Payment>) => Promise<void>;

  // Managers
  addManager: (data: { name: string; type: string; email?: string }) => Promise<void>;
  deleteManager: (id: string) => Promise<void>;

  // Notifications
  markNotificationRead: (id: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;

  // Audit
  addAuditEntry: (entry: Omit<AuditEntry, 'id' | 'timestamp' | 'user'>) => void;
}

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();

  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [sows, setSOWs] = useState<SOW[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [managers, setManagers] = useState<Manager[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Data fetching ────────────────────────────────────────

  const refreshClients = useCallback(async () => {
    try {
      const data = await clientApi.list();
      setClients((data.clients || []).map(mapClient));
    } catch (err) { console.error('Failed to fetch clients:', err); }
  }, []);

  const refreshProjects = useCallback(async () => {
    try {
      const data = await projectApi.list({ limit: '500' });
      setProjects((data.projects || []).map(mapProject));
    } catch (err) { console.error('Failed to fetch projects:', err); }
  }, []);

  const refreshSOWs = useCallback(async () => {
    try {
      const data = await sowApi.list({ limit: '500' });
      setSOWs((data.sows || []).map(mapSOW));
    } catch (err) { console.error('Failed to fetch SOWs:', err); }
  }, []);

  const refreshInvoices = useCallback(async () => {
    try {
      const data = await invoiceApi.list({ limit: '500' });
      setInvoices((data.invoices || []).map(mapInvoice));
    } catch (err) { console.error('Failed to fetch invoices:', err); }
  }, []);

  const refreshPayments = useCallback(async () => {
    try {
      const data = await paymentApi.list({ limit: '500' });
      setPayments((data.payments || []).map(mapPayment));
    } catch (err) { console.error('Failed to fetch payments:', err); }
  }, []);

  const refreshManagers = useCallback(async () => {
    try {
      const data = await managerApi.list();
      setManagers((data.managers || []).map(mapManager));
    } catch (err) { console.error('Failed to fetch managers:', err); }
  }, []);

  const refreshNotifications = useCallback(async () => {
    try {
      const data = await notificationApi.list();
      setNotifications((data.notifications || []).map(mapNotification));
    } catch (err) { console.error('Failed to fetch notifications:', err); }
  }, []);

  const refreshAuditLog = useCallback(async () => {
    try {
      const data = await auditApi.list({ limit: '200' });
      setAuditLog((data.entries || []).map(mapAudit));
    } catch (err) { console.error('Failed to fetch audit log:', err); }
  }, []);

  const refreshAll = useCallback(async () => {
    setIsLoading(true);
    try {
      await Promise.race([
        Promise.all([
          refreshClients(),
          refreshProjects(),
          refreshSOWs(),
          refreshInvoices(),
          refreshPayments(),
          refreshManagers(),
          refreshNotifications(),
          refreshAuditLog(),
        ]),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Data load timed out')), 15000)),
      ]);
    } catch (err) {
      console.error('Failed to refresh application data:', err);
      setError('Some data could not be loaded. You can keep using the portal.');
    } finally {
      setIsLoading(false);
    }
  }, [refreshClients, refreshProjects, refreshSOWs, refreshInvoices, refreshPayments, refreshManagers, refreshNotifications, refreshAuditLog]);

  // Load all data when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      refreshAll();
    } else {
      setClients([]);
      setProjects([]);
      setSOWs([]);
      setInvoices([]);
      setPayments([]);
      setManagers([]);
      setNotifications([]);
      setAuditLog([]);
      setIsLoading(false);
    }
  }, [isAuthenticated, refreshAll]);

  // ── CRUD Operations ──────────────────────────────────────

  const addClient = useCallback(async (data: Partial<Client>) => {
    const result = await clientApi.create(toClientApi(data));
    const client = mapClient(result.client);
    setClients(prev => [client, ...prev]);
    return client;
  }, []);

  const updateClient = useCallback(async (clientId: string, data: Partial<Client>) => {
    await clientApi.update(clientId, toClientApi(data));
    await refreshClients();
    await refreshProjects();
  }, [refreshClients, refreshProjects]);

  const addProject = useCallback(async (data: Partial<Project>) => {
    const result = await projectApi.create(toProjectApi(data));
    const project = mapProject(result.project);
    setProjects(prev => [...prev, project]);
    return project;
  }, []);

  const updateProject = useCallback(async (projectId: string, data: Partial<Project>) => {
    await projectApi.update(projectId, toProjectApi(data));
    await refreshProjects();
  }, [refreshProjects]);

  const deleteProject = useCallback(async (projectId: string) => {
    await projectApi.delete(projectId);
    await refreshProjects();
  }, [refreshProjects]);

  const getProject = useCallback((projectId: string) => {
    return projects.find(p => p.projectId === projectId);
  }, [projects]);

  const addSOW = useCallback(async (data: Partial<SOW>) => {
    const result = await sowApi.create(toSOWApi(data));
    const sow = mapSOW(result.sow);
    setSOWs(prev => [...prev, sow]);
    return sow;
  }, []);

  const updateSOW = useCallback(async (sowNumber: string, data: Partial<SOW>) => {
    await sowApi.update(sowNumber, toSOWApi(data));
    await refreshSOWs();
  }, [refreshSOWs]);

  const cancelSOW = useCallback(async (sowNumber: string) => {
    await sowApi.changeStatus(sowNumber, 'Cancelled');
    await refreshSOWs();
  }, [refreshSOWs]);

  const addInvoice = useCallback(async (data: Partial<Invoice>) => {
    const result = await invoiceApi.create(toInvoiceApi(data));
    const invoice = mapInvoice(result.invoice);
    setInvoices(prev => [...prev, invoice]);
    return invoice;
  }, []);

  const updateInvoice = useCallback(async (invoiceNumber: string, data: Partial<Invoice>) => {
    await invoiceApi.update(invoiceNumber, toInvoiceApi(data));
    await refreshInvoices();
  }, [refreshInvoices]);

  const cancelInvoice = useCallback(async (invoiceNumber: string) => {
    await invoiceApi.cancel(invoiceNumber);
    await refreshInvoices();
  }, [refreshInvoices]);

  const addPayment = useCallback(async (data: Partial<Payment>) => {
    const result = await paymentApi.create(toPaymentApi(data));
    const payment = mapPayment(result.payment);
    setPayments(prev => [...prev, payment]);
    return payment;
  }, []);

  const updatePayment = useCallback(async (id: string, data: Partial<Payment>) => {
    await paymentApi.update(id, toPaymentApi(data));
    await refreshPayments();
  }, [refreshPayments]);

  const addManager = useCallback(async (data: { name: string; type: string; email?: string }) => {
    await managerApi.create(data);
    await refreshManagers();
  }, [refreshManagers]);

  const deleteManager = useCallback(async (id: string) => {
    await managerApi.delete(id);
    await refreshManagers();
  }, [refreshManagers]);

  const markNotificationRead = useCallback(async (id: string) => {
    await notificationApi.markRead(id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }, []);

  const markAllNotificationsRead = useCallback(async () => {
    await notificationApi.markAllRead();
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const addAuditEntry = useCallback((_entry: Omit<AuditEntry, 'id' | 'timestamp' | 'user'>) => {
    // Audit entries are now created server-side automatically.
    // This function is kept for backward compatibility but is a no-op.
  }, []);

  return (
    <AppContext.Provider value={{
      clients, projects, sows, invoices, payments, managers, notifications, auditLog,
      isLoading, error,
      refreshClients, refreshProjects, refreshSOWs, refreshInvoices, refreshPayments,
      refreshManagers, refreshNotifications, refreshAuditLog, refreshAll,
      addClient, updateClient,
      addProject, updateProject, deleteProject, getProject,
      addSOW, updateSOW, cancelSOW,
      addInvoice, updateInvoice, cancelInvoice,
      addPayment, updatePayment,
      addManager, deleteManager,
      markNotificationRead, markAllNotificationsRead,
      addAuditEntry,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used within AppProvider');
  return ctx;
}
