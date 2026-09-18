import { format as fnsFormat, formatDistanceToNow, isValid, parseISO } from 'date-fns';
import type { Currency } from '../types';

// ─── Date Formatting ─────────────────────────────────────────────────────────

export function formatDate(dateStr: string | undefined | null): string {
  if (!dateStr) return '—';
  const d = typeof dateStr === 'string' ? parseISO(dateStr) : dateStr;
  if (!isValid(d)) return '—';
  return fnsFormat(d, 'dd MMM yyyy');
}

export function formatDateShort(dateStr: string | undefined | null): string {
  if (!dateStr) return '—';
  const d = parseISO(dateStr);
  if (!isValid(d)) return '—';
  return fnsFormat(d, 'dd/MM/yyyy');
}

export function formatMonthYear(dateStr: string | undefined | null): string {
  if (!dateStr) return '—';
  const d = parseISO(dateStr);
  if (!isValid(d)) return '—';
  return fnsFormat(d, 'MMM yyyy');
}

export function formatRelative(dateStr: string | undefined | null): string {
  if (!dateStr) return '—';
  const d = parseISO(dateStr);
  if (!isValid(d)) return '—';
  return formatDistanceToNow(d, { addSuffix: true });
}

export function daysBetween(dateStr1: string, dateStr2: string): number {
  const d1 = parseISO(dateStr1);
  const d2 = parseISO(dateStr2);
  if (!isValid(d1) || !isValid(d2)) return 0;
  return Math.floor(Math.abs(d2.getTime() - d1.getTime()) / 86400000);
}

export function daysOverdue(dueDateStr: string): number {
  const due = parseISO(dueDateStr);
  if (!isValid(due)) return 0;
  return Math.max(0, Math.floor((Date.now() - due.getTime()) / 86400000));
}

// ─── Currency Formatting ─────────────────────────────────────────────────────

const currencyConfig: Record<Currency, { locale: string; code: string }> = {
  USD: { locale: 'en-US', code: 'USD' },
  GBP: { locale: 'en-GB', code: 'GBP' },
  INR: { locale: 'en-IN', code: 'INR' },
};

export function formatCurrency(amount: number, currency: Currency = 'USD'): string {
  const cfg = currencyConfig[currency] || currencyConfig.USD;
  return new Intl.NumberFormat(cfg.locale, {
    style: 'currency',
    currency: cfg.code,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatCurrencyCompact(amount: number, currency: Currency = 'USD'): string {
  const cfg = currencyConfig[currency] || currencyConfig.USD;
  if (Math.abs(amount) >= 10_000_000) {
    return new Intl.NumberFormat(cfg.locale, { style: 'currency', currency: cfg.code, notation: 'compact', maximumFractionDigits: 1 }).format(amount);
  }
  if (Math.abs(amount) >= 100_000) {
    return new Intl.NumberFormat(cfg.locale, { style: 'currency', currency: cfg.code, notation: 'compact', maximumFractionDigits: 1 }).format(amount);
  }
  return formatCurrency(amount, currency);
}

// ─── Number Formatting ───────────────────────────────────────────────────────

export function formatNumber(n: number): string {
  return new Intl.NumberFormat('en-IN').format(n);
}

export function formatPercent(n: number, decimals = 1): string {
  return `${n >= 0 ? '+' : ''}${n.toFixed(decimals)}%`;
}
