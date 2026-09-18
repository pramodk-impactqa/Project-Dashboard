/**
 * Zod Validation Schemas — validate ALL untrusted input server-side.
 * Never trust frontend validation.
 */
import { z } from 'zod';

// ── Auth ─────────────────────────────────────────────────────

export const loginSchema = z.object({
  username: z.string().trim().min(1, 'Username is required').max(100),
  password: z.string().min(1, 'Password is required').max(128),
});

export const mfaVerifySchema = z.object({
  token: z.string().trim().length(6, 'OTP must be 6 digits').regex(/^\d{6}$/, 'OTP must be 6 digits'),
});

export const mfaRecoverySchema = z.object({
  code: z.string().trim().min(5, 'Recovery code is required').max(30),
});

export const passwordResetRequestSchema = z.object({
  email: z.string().trim().email('Valid email required').max(255),
});

export const passwordResetSchema = z.object({
  token: z.string().trim().min(1, 'Token is required'),
  password: z.string().min(1, 'Password is required').max(128),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(1, 'New password is required').max(128),
});

// ── Users ────────────────────────────────────────────────────

export const createUserSchema = z.object({
  employeeId: z.string().trim().min(1).max(50),
  firstName: z.string().trim().min(1, 'First name is required').max(100),
  lastName: z.string().trim().min(1, 'Last name is required').max(100),
  email: z.string().trim().email('Valid email required').max(255),
  username: z.string().trim().min(3, 'Username must be at least 3 characters').max(50)
    .regex(/^[a-zA-Z0-9._-]+$/, 'Username can only contain letters, numbers, dots, hyphens, underscores'),
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'PROJECT_MANAGER', 'DELIVERY_MANAGER', 'VIEWER']),
  department: z.string().trim().min(1).max(100).default('Engineering'),
});

export const updateUserSchema = z.object({
  firstName: z.string().trim().min(1).max(100).optional(),
  lastName: z.string().trim().min(1).max(100).optional(),
  email: z.string().trim().email().max(255).optional(),
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'PROJECT_MANAGER', 'DELIVERY_MANAGER', 'VIEWER']).optional(),
  department: z.string().trim().min(1).max(100).optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'INACTIVE']).optional(),
});

// ── Projects ─────────────────────────────────────────────────

const projectDomains = [
  'BFSI – Banking, Financial Services & Insurance',
  'Healthcare & Life Sciences',
  'Pharmaceuticals',
  'Retail & E-commerce',
  'Telecommunications',
  'Media & Entertainment',
  'Travel & Hospitality',
  'Transportation & Logistics',
  'Automotive',
  'Manufacturing',
  'Energy & Utilities',
  'Oil & Gas',
  'Government & Public Sector',
  'Education & EdTech',
  'Real Estate & PropTech',
  'Construction & Engineering',
  'Agriculture & AgriTech',
  'Food & Beverage',
  'Insurance / InsurTech',
  'FinTech',
  'LegalTech',
  'HRTech',
  'MarTech',
  'AdTech',
  'Cybersecurity',
  'IT Infrastructure & Managed Services',
  'Cloud Computing',
  'SaaS / Enterprise Software',
  'AI / Machine Learning',
  'Data & Analytics',
  'Blockchain / Web3',
  'IoT / Connected Devices',
  'Gaming',
  'Semiconductor & Electronics',
  'Aerospace & Defense',
  'Supply Chain & Procurement',
  'CRM / Customer Experience',
  'ERP / Enterprise Applications',
  'DevOps / Platform Engineering',
  'Digital Transformation',
] as const;

export const createClientSchema = z.object({
  name: z.string().trim().min(1, 'Client name is required').max(200),
  address: z.string().trim().max(500).regex(/^[a-zA-Z0-9\s,.\-/#]*$/, 'Address must be alphanumeric').default(''),
  domain: z.enum(projectDomains),
  entity: z.enum(['US', 'UK', 'India']),
  status: z.enum(['Active', 'On Hold', 'Inactive']).default('Active'),
  taxId: z.string().trim().max(50).default(''),
});

export const updateClientSchema = createClientSchema.partial();

export const createProjectSchema = z.object({
  name: z.string().trim().min(1, 'Project name is required').max(200),
  description: z.string().trim().max(2000).default(''),
  domain: z.enum(projectDomains).optional(),
  entity: z.enum(['US', 'UK', 'India']).optional(),
  currency: z.enum(['USD', 'GBP', 'INR']).default('USD'),
  status: z.enum(['Active', 'On Hold', 'Inactive']).default('Active'),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'Valid date required'),
  endDate: z.string().default(''),
  clientId: z.string().trim().max(100).default(''),
  clientName: z.string().trim().max(200).default(''),
  clientAddress: z.string().trim().max(500).default(''),
  clientTaxId: z.string().trim().max(50).default(''),
  projectManager: z.string().trim().max(100).default(''),
  deliveryManager: z.string().trim().max(100).default(''),
  department: z.string().trim().max(100).default('Engineering'),
  billingModel: z.enum(['FTE', 'Fixed Price', 'T&M', 'Milestone', 'Retainer', 'Other']).default('FTE'),
  billingFrequency: z.enum(['Monthly', 'Quarterly', 'Milestone', 'One-time']).default('Monthly'),
  billingContact: z.string().trim().max(200).default(''),
  billingAddress: z.string().trim().max(500).default(''),
  paymentTerms: z.enum(['FTE', 'TNM']).default('FTE'),
  msaOriginalName: z.string().trim().max(255).default(''),
});

export const updateProjectSchema = createProjectSchema.partial();

// ── SOWs ─────────────────────────────────────────────────────

export const createSOWSchema = z.object({
  projectId: z.string().trim().min(1, 'Project ID is required'),
  title: z.string().trim().min(1, 'Title is required').max(300),
  description: z.string().trim().max(2000).default(''),
  version: z.string().trim().max(20).default('1.0'),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'Valid date required'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'Valid date required'),
  renewalDate: z.string().default(''),
  sowType: z.enum(['T&M', 'FTE', 'Fixed']).default('T&M'),
  contractType: z.enum(['Fixed Price', 'T&M', 'FTE', 'Fixed']).default('T&M'),
  contractValue: z.number().min(0, 'Contract value must be positive'),
  monthlyBilling: z.number().min(0).default(0),
  billingFrequency: z.enum(['Monthly', 'Quarterly', 'Milestone', 'One-time', 'Hourly']).default('Monthly'),
  basis: z.enum(['Hourly', 'Monthly', 'Milestone']).default('Monthly'),
  currency: z.enum(['USD', 'GBP', 'INR']).default('USD'),
  status: z.enum(['Draft', 'In Review', 'Approved', 'Active', 'Expired', 'Cancelled']).default('Draft'),
  remarks: z.string().trim().max(2000).default(''),
  projectManager: z.string().trim().max(100).default(''),
  deliveryManager: z.string().trim().max(100).default(''),
  poNumber: z.string().trim().max(100).default(''),
  sowOriginalName: z.string().trim().max(255).default(''),
  poOriginalName: z.string().trim().max(255).default(''),
});

export const updateSOWSchema = createSOWSchema.partial();

// ── Invoices ─────────────────────────────────────────────────

export const createInvoiceSchema = z.object({
  entity: z.enum(['US', 'UK', 'India']),
  projectId: z.string().trim().min(1, 'Project ID is required'),
  sowId: z.string().trim().default(''),
  sowNumber: z.string().trim().default(''),
  billingPeriod: z.string().trim().max(100).default(''),
  invoiceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'Valid date required'),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'Valid date required'),
  amount: z.number().min(0, 'Amount must be positive'),
  currency: z.enum(['USD', 'GBP', 'INR']).default('USD'),
  taxAmount: z.number().min(0).default(0),
  totalAmount: z.number().min(0, 'Total amount must be positive'),
  status: z.enum(['Draft', 'Sent', 'Paid', 'Partially Paid', 'Overdue', 'Cancelled']).default('Draft'),
});

export const updateInvoiceSchema = createInvoiceSchema.partial();

// ── Payments ─────────────────────────────────────────────────

export const createPaymentSchema = z.object({
  invoiceId: z.string().trim().default(''),
  invoiceNumber: z.string().trim().default(''),
  projectId: z.string().trim().min(1, 'Project ID is required'),
  amountReceived: z.number().min(0, 'Amount must be positive'),
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'Valid date required'),
  currency: z.enum(['USD', 'GBP', 'INR']).default('USD'),
  exchangeRate: z.number().min(0).default(1),
  bank: z.string().trim().max(200).default(''),
  tdsWithholding: z.number().min(0).default(0),
  shortPayment: z.number().min(0).default(0),
  outstandingBalance: z.number().min(0).default(0),
  remarks: z.string().trim().max(500).default(''),
  status: z.enum(['Received', 'Partial', 'Pending']).default('Pending'),
});

export const updatePaymentSchema = createPaymentSchema.partial();

// ── Managers ─────────────────────────────────────────────────

export const createManagerSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  type: z.enum(['Project Manager', 'Delivery Manager']),
  email: z.string().trim().email().max(255).or(z.literal('')).default(''),
});

// ── Notifications ────────────────────────────────────────────

export const createNotificationSchema = z.object({
  type: z.string().trim().min(1).max(50),
  title: z.string().trim().min(1).max(200),
  message: z.string().trim().min(1).max(2000),
  severity: z.enum(['info', 'warning', 'error', 'success']).default('info'),
});

// ── Generic ──────────────────────────────────────────────────

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  search: z.string().trim().max(200).default(''),
  sortBy: z.string().trim().max(50).default(''),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const idParamSchema = z.object({
  id: z.string().trim().min(1, 'ID is required').max(100),
});
