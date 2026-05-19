export function normalizeCpf(input: string): string {
  return (input ?? '').replace(/\D/g, '');
}

export function isValidCpfFormat(digits: string): boolean {
  return /^\d{11}$/.test(digits);
}

export function firstName(fullName: string | null | undefined): string {
  if (!fullName) return 'aluno(a)';
  const trimmed = fullName.trim().split(/\s+/)[0] ?? '';
  if (!trimmed) return 'aluno(a)';
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
}

export function maskEmail(email: string | null | undefined): string {
  if (!email) return '';
  const [user, domain] = email.split('@');
  if (!domain || !user) return email;
  if (user.length <= 4) {
    const head = user.charAt(0);
    const tail = user.charAt(user.length - 1);
    const mid = '*'.repeat(Math.max(1, user.length - 2));
    return `${head}${mid}${tail}@${domain}`;
  }
  const head = user.slice(0, 2);
  const tail = user.slice(-2);
  const mid = '*'.repeat(user.length - 4);
  return `${head}${mid}${tail}@${domain}`;
}
