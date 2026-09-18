/**
 * Secure API Client
 * All API communication goes through this module.
 * Authentication is handled via HttpOnly cookies — no tokens in JS.
 * NEVER stores auth tokens in localStorage or sessionStorage.
 */

const API_BASE = '/api';

export class ApiError extends Error {
  status: number;
  code: string;
  details?: { field: string; message: string }[];

  constructor(
    status: number,
    code: string,
    message: string,
    details?: { field: string; message: string }[],
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const url = `${API_BASE}${path}`;
  const headers: Record<string, string> = {};

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: 'same-origin',
    signal,
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(
      res.status,
      data.code || 'UNKNOWN_ERROR',
      data.error || `Request failed with status ${res.status}`,
      data.details,
    );
  }

  return res.json() as Promise<T>;
}

// ── Auth ──────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  username: string;
  role: string;
  department: string;
  mfaEnabled: boolean;
  permissions: string[];
  forcePasswordChange: boolean;
}

export interface LoginResponse {
  user?: AuthUser;
  requireMFA?: boolean;
  message?: string;
}

export const authApi = {
  login: (username: string, password: string) =>
    request<LoginResponse>('POST', '/auth/login', { username, password }),

  logout: () =>
    request<{ message: string }>('POST', '/auth/logout'),

  logoutAll: () =>
    request<{ message: string }>('POST', '/auth/logout-all'),

  getSession: () =>
    request<{ user: AuthUser }>('GET', '/auth/session'),

  verifyMFA: (token: string) =>
    request<{ user: AuthUser }>('POST', '/auth/mfa/verify', { token }),

  recoveryMFA: (code: string) =>
    request<{ user: AuthUser }>('POST', '/auth/mfa/recovery', { code }),

  setupMFA: () =>
    request<{ qrCode: string; secret: string; recoveryCodes: string[] }>('POST', '/auth/mfa/setup'),

  enableMFA: (token: string) =>
    request<{ message: string }>('POST', '/auth/mfa/enable', { token }),

  disableMFA: () =>
    request<{ message: string }>('POST', '/auth/mfa/disable'),

  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ message: string }>('POST', '/auth/change-password', { currentPassword, newPassword }),

  forgotPassword: (email: string) =>
    request<{ message: string }>('POST', '/auth/forgot-password', { email }),

  resetPassword: (token: string, password: string) =>
    request<{ message: string }>('POST', '/auth/reset-password', { token, password }),
};

// ── Users ─────────────────────────────────────────────────

export const userApi = {
  list: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<{ users: any[]; total: number; page: number; limit: number }>('GET', `/users${qs}`);
  },
  get: (id: string) => request<{ user: any }>('GET', `/users/${encodeURIComponent(id)}`),
  create: (data: any) => request<{ user: any; message: string }>('POST', '/users', data),
  update: (id: string, data: any) => request<{ user: any }>('PUT', `/users/${encodeURIComponent(id)}`, data),
  suspend: (id: string) => request<{ message: string }>('POST', `/users/${encodeURIComponent(id)}/suspend`),
  activate: (id: string) => request<{ message: string }>('POST', `/users/${encodeURIComponent(id)}/activate`),
  resetPassword: (id: string) => request<{ message: string }>('POST', `/users/${encodeURIComponent(id)}/reset-password`),
  resetMFA: (id: string) => request<{ message: string }>('POST', `/users/${encodeURIComponent(id)}/reset-mfa`),
};

// ── Clients ───────────────────────────────────────────────

export const clientApi = {
  list: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<{ clients: any[]; total: number }>('GET', `/clients${qs}`);
  },
  get: (clientId: string) => request<{ client: any; projects: any[] }>('GET', `/clients/${encodeURIComponent(clientId)}`),
  create: (data: any) => request<{ client: any }>('POST', '/clients', data),
  update: (clientId: string, data: any) => request<{ client: any }>('PUT', `/clients/${encodeURIComponent(clientId)}`, data),
};

export const fxApi = {
  rates: (from: string) => request<{ base: string; date: string; rates: Record<string, number> }>('GET', `/fx?from=${encodeURIComponent(from)}`),
};

// ── Projects ──────────────────────────────────────────────

export const projectApi = {
  list: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<{ projects: any[]; total: number }>('GET', `/projects${qs}`);
  },
  get: (projectId: string) => request<{ project: any }>('GET', `/projects/${encodeURIComponent(projectId)}`),
  create: (data: any) => request<{ project: any }>('POST', '/projects', data),
  update: (projectId: string, data: any) => request<{ project: any }>('PUT', `/projects/${encodeURIComponent(projectId)}`, data),
  changeStatus: (projectId: string, status: string) =>
    request<{ message: string }>('PATCH', `/projects/${encodeURIComponent(projectId)}/status`, { status }),
  delete: (projectId: string) => request<{ message: string }>('DELETE', `/projects/${encodeURIComponent(projectId)}`),
};

// ── SOWs ──────────────────────────────────────────────────

export const sowApi = {
  list: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<{ sows: any[]; total: number }>('GET', `/sows${qs}`);
  },
  get: (sowNumber: string) => request<{ sow: any }>('GET', `/sows/${encodeURIComponent(sowNumber)}`),
  create: (data: any) => request<{ sow: any }>('POST', '/sows', data),
  update: (sowNumber: string, data: any) => request<{ sow: any }>('PUT', `/sows/${encodeURIComponent(sowNumber)}`, data),
  changeStatus: (sowNumber: string, status: string) =>
    request<{ message: string }>('PATCH', `/sows/${encodeURIComponent(sowNumber)}/status`, { status }),
};

// ── Invoices ──────────────────────────────────────────────

export const invoiceApi = {
  list: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<{ invoices: any[]; total: number }>('GET', `/invoices${qs}`);
  },
  get: (invoiceNumber: string) => request<{ invoice: any }>('GET', `/invoices/${encodeURIComponent(invoiceNumber)}`),
  create: (data: any) => request<{ invoice: any }>('POST', '/invoices', data),
  update: (invoiceNumber: string, data: any) => request<{ invoice: any }>('PUT', `/invoices/${encodeURIComponent(invoiceNumber)}`, data),
  cancel: (invoiceNumber: string) =>
    request<{ message: string }>('PATCH', `/invoices/${encodeURIComponent(invoiceNumber)}/status`, { status: 'Cancelled' }),
};

// ── Payments ──────────────────────────────────────────────

export const paymentApi = {
  list: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<{ payments: any[]; total: number }>('GET', `/payments${qs}`);
  },
  create: (data: any) => request<{ payment: any }>('POST', '/payments', data),
  update: (id: string, data: any) => request<{ payment: any }>('PUT', `/payments/${encodeURIComponent(id)}`, data),
};

// ── Managers ──────────────────────────────────────────────

export const managerApi = {
  list: () => request<{ managers: any[] }>('GET', '/managers'),
  create: (data: any) => request<{ manager: any }>('POST', '/managers', data),
  delete: (id: string) => request<{ message: string }>('DELETE', `/managers/${encodeURIComponent(id)}`),
};

// ── Notifications ─────────────────────────────────────────

export const notificationApi = {
  list: () => request<{ notifications: any[]; unreadCount: number }>('GET', '/notifications'),
  markRead: (id: string) => request<{ message: string }>('PATCH', `/notifications/${encodeURIComponent(id)}/read`),
  markAllRead: () => request<{ message: string }>('POST', '/notifications/mark-all-read'),
};

// ── Reports ───────────────────────────────────────────────

export const reportApi = {
  summary: () => request<any>('GET', '/reports/summary'),
  revenueByProject: () => request<any>('GET', '/reports/revenue-by-project'),
  revenueByMonth: () => request<any>('GET', '/reports/revenue-by-month'),
};

// ── Audit ─────────────────────────────────────────────────

export const auditApi = {
  list: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<{ entries: any[]; total: number }>('GET', `/audit${qs}`);
  },
  securityEvents: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<{ events: any[]; total: number }>('GET', `/audit/security-events${qs}`);
  },
};
