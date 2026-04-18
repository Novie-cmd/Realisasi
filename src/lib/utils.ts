import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatIDR(amount: number | string) {
  const val = typeof amount === 'number' ? amount : Number(amount);
  if (isNaN(val)) return 'Rp 0';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(val);
}

export function formatPercent(value: number | string) {
  const val = typeof value === 'number' ? value : Number(value);
  if (isNaN(val)) return '0%';
  return new Intl.NumberFormat('id-ID', {
    style: 'percent',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val);
}

export const generateId = () => {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
  } catch (e) {
    // Fallback if crypto is not available in non-secure context
  }
  return Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
};
