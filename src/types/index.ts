// ─── Enums / Union Types ─────────────────────────────────────────────────────

export type Entity = 'US' | 'UK' | 'India';
export type Currency = 'USD' | 'GBP' | 'INR';
export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'FINANCE' | 'PROJECT_MANAGER' | 'DELIVERY_MANAGER' | 'VIEWER';
export type ContractType = 'Fixed Price' | 'T&M' | 'FTE' | 'Fixed';
export type SowType = 'T&M' | 'FTE' | 'Fixed';
export type SowBasis = 'Hourly' | 'Monthly' | 'Milestone';
export type BillingFrequency = 'Monthly' | 'Quarterly' | 'Milestone' | 'One-time';
export type PaymentTerms = 'FTE' | 'TNM';
export type BillingModel = 'FTE' | 'Fixed Price' | 'T&M' | 'Milestone' | 'Retainer' | 'Other';

export type { ProjectDomain } from '../constants/domains';
export { PROJECT_DOMAINS } from '../constants/domains';

export type ProjectStatus = 'Active' | 'On Hold' | 'Inactive';
export type SOWStatus = 'Draft' | 'In Review' | 'Approved' | 'Active' | 'Expired' | 'Cancelled';
export type InvoiceStatus = 'Draft' | 'Sent' | 'Paid' | 'Partially Paid' | 'Overdue' | 'Cancelled';
export type PaymentStatus = 'Received' | 'Partial' | 'Pending';

// ─── Entities ────────────────────────────────────────────────────────────────

export interface Manager {
  id: string;
  name: string;
  type: 'Project Manager' | 'Delivery Manager';
  email?: string;
}

/**
 * Project is the PRIMARY business entity.
 * Client info is embedded within the project (no separate Client page).
 * Billing info is also embedded for simplicity (single billing per project).
 */
export interface Project {
  id: string;
  projectId: string;          // Readable: IQA-Proj-000001

  // ── Project Info ──
  name: string;
  description: string;
  domain: ProjectDomain;
  entity: Entity;
  currency: Currency;
  status: ProjectStatus;
  startDate: string;
  endDate: string;

  // ── Client Info (embedded) ──
  clientName: string;
  clientId: string;           // Readable: CLT-000001
  clientAddress: string;
  clientTaxId: string;

  // ── Ownership ──
  projectManager: string;
  deliveryManager: string;
  department: string;

  // ── Billing (embedded) ──
  billingId: string;          // Readable: BIL-000001
  billingModel: BillingModel;
  billingFrequency: BillingFrequency;
  billingContact: string;
  billingAddress: string;
  paymentTerms: PaymentTerms;

  msaOriginalName: string;

  // ── Metadata ──
  createdAt: string;
  updatedAt: string;

  // ── Aggregates (from API) ──
  sowCount?: number;
  invoiceCount?: number;
  paymentCount?: number;
  totalInvoiced?: number;
  totalPaid?: number;
}

export interface SOW {
  id: string;
  sowNumber: string;          // Readable: SOW-000001
  projectId: string;
  projectName: string;
  clientName: string;
  title: string;
  description: string;
  version: string;
  startDate: string;
  endDate: string;
  renewalDate: string;
  contractType: ContractType;
  sowType: SowType;
  basis: SowBasis;
  contractValue: number;
  monthlyBilling: number;
  billingFrequency: BillingFrequency;
  currency: Currency;
  status: SOWStatus;
  remarks: string;
  projectManager: string;
  deliveryManager: string;
  poNumber: string;
  sowOriginalName: string;
  poOriginalName: string;
  createdAt: string;
  updatedAt: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;      // Readable: INV-2026-000001
  entity: Entity;
  projectId: string;
  projectName: string;
  clientName: string;
  billingId: string;
  sowId: string;
  sowNumber: string;
  billingPeriod: string;
  invoiceDate: string;
  dueDate: string;
  amount: number;
  currency: Currency;
  taxAmount: number;
  totalAmount: number;
  status: InvoiceStatus;
  createdAt: string;
}

export interface Payment {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  projectId: string;
  projectName: string;
  amountReceived: number;
  paymentDate: string;
  currency: Currency;
  exchangeRate: number;
  bank: string;
  tdsWithholding: number;
  shortPayment: number;
  outstandingBalance: number;
  remarks: string;
  status: PaymentStatus;
  createdAt: string;
}

export interface AuditEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  entityName: string;
  user: string;
  timestamp: string;
  details: string;
  previousValue?: string;
  newValue?: string;
}

export interface Notification {
  id: string;
  type: 'sow_expiry' | 'overdue_invoice' | 'pending_payment' | 'renewal' | 'status_change';
  title: string;
  message: string;
  date: string;
  read: boolean;
  severity: 'info' | 'warning' | 'critical';
}

export interface DateFilter {
  from: string;
  to: string;
}

export type ClientStatus = 'Active' | 'On Hold' | 'Inactive';
export interface Client {
  id: string;
  clientId: string;
  name: string;
  address: string;
  domain: ProjectDomain;
  entity: Entity;
  status: ClientStatus;
  taxId: string;
  projectCount?: number;
  createdAt: string;
  updatedAt: string;
}
