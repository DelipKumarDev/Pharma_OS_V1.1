export function formatCurrency(amount: number, currency = 'INR'): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-IN').format(value);
}

export function calculateGst(amount: number, rate: number): number {
  return Math.round(((amount * rate) / 100) * 100) / 100;
}

export function calculateDiscount(amount: number, discountPercent: number): number {
  return Math.round(((amount * discountPercent) / 100) * 100) / 100;
}

export function roundTo(value: number, decimals = 2): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}
