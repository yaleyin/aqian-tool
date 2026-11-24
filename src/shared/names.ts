export function normalizeName(raw: string): string {
  return raw.normalize('NFKC').trim().replace(/\s+/g, ' ');
}

export function nameKey(raw: string): string {
  return normalizeName(raw).toLocaleLowerCase('zh-CN');
}
