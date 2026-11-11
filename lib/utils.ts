import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number | string | undefined | null): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (num === undefined || num === null || isNaN(num)) return 'R$ 0,00';
  
  return 'R$ ' + new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(num);
}

export function formatNumber(value: number | string | undefined | null, decimals: number = 2): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (num === undefined || num === null || isNaN(num)) {
    if (decimals === 0) return '0';
    return '0,' + '0'.repeat(decimals);
  }
  
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(num);
}

export function parseBankingInput(value: string, decimals: number = 2): number {
  const cleanValue = value.replace(/\D/g, '');
  if (cleanValue === '') return 0;
  return parseFloat(cleanValue) / Math.pow(10, decimals);
}
