export const MAX_AMOUNT_CENTS = 999_999_999;

export function parseMoneyToCents(raw: string): number | null {
  if (typeof raw !== 'string') {
    return null;
  }

  const normalized = raw.normalize('NFKC').replace(/[¥￥,\s]/g, '');
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) {
    return null;
  }

  const [yuan, fraction = ''] = normalized.split('.');
  const cents = Number(yuan) * 100 + Number(fraction.padEnd(2, '0'));

  if (!Number.isSafeInteger(cents) || cents > MAX_AMOUNT_CENTS) {
    return null;
  }

  return cents;
}

export function formatCents(cents: number): string {
  return new Intl.NumberFormat('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

export function formatYuan(cents: number): string {
  return `¥${formatCents(cents)}`;
}

export function splitEqual(totalCents: number, count: number): number[] {
  if (!Number.isInteger(count) || count <= 0) {
    return [];
  }

  const base = Math.floor(totalCents / count);
  const remainder = totalCents % count;

  return Array.from({ length: count }, (_, index) => base + (index < remainder ? 1 : 0));
}
