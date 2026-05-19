export function normalizeCpf(input: string): string {
  return (input ?? '').replace(/\D/g, '').slice(0, 11);
}

export function formatCpfMask(input: string): string {
  const digits = normalizeCpf(input);
  const p1 = digits.slice(0, 3);
  const p2 = digits.slice(3, 6);
  const p3 = digits.slice(6, 9);
  const p4 = digits.slice(9, 11);
  let out = p1;
  if (p2) out += `.${p2}`;
  if (p3) out += `.${p3}`;
  if (p4) out += `-${p4}`;
  return out;
}

export function isValidCpfFormat(value: string): boolean {
  return /^\d{11}$/.test(normalizeCpf(value));
}
