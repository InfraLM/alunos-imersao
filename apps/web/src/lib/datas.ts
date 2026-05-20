const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const MESES = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

export function formatarDataLonga(dateInput: string | Date): string {
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (Number.isNaN(d.getTime())) return '—';
  return `${DIAS[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
}

/**
 * Imersões ocupam o fim de semana inteiro (sábado + domingo). Recebe o sábado
 * e devolve `Sábado e domingo · 13 e 14 de maio de 2026`, tratando virada de
 * mês/ano.
 */
export function formatarFimDeSemana(dateInput: string | Date): string {
  const sab = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (Number.isNaN(sab.getTime())) return '—';
  const dom = new Date(sab.getTime() + 86_400_000);
  const mesmoMes =
    sab.getMonth() === dom.getMonth() && sab.getFullYear() === dom.getFullYear();
  const parteSab = mesmoMes
    ? `${sab.getDate()}`
    : `${sab.getDate()} de ${MESES[sab.getMonth()]}` +
      (sab.getFullYear() !== dom.getFullYear() ? ` de ${sab.getFullYear()}` : '');
  const parteDom = `${dom.getDate()} de ${MESES[dom.getMonth()]} de ${dom.getFullYear()}`;
  return `Sábado e domingo · ${parteSab} e ${parteDom}`;
}

export function formatarDataCurta(dateInput: string | Date): string {
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (Number.isNaN(d.getTime())) return '—';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

export function diasRestantes(dataImersao: string | Date): number {
  const d = typeof dataImersao === 'string' ? new Date(dataImersao) : dataImersao;
  return Math.floor((d.getTime() - Date.now()) / 86_400_000);
}
