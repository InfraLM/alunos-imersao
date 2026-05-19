import { Prisma } from '@prisma-clients/lovable';

export const STATUS_AGENDADO = 1;
export const STATUS_CANCELADO = 2;
export const STATUS_REAGENDADO = 3;
export const STATUS_REAGENDADO_MULTA = 4;
export const STATUS_CANCELADO_MULTA = 5;

export const STATUS_PENDENTES_MULTA: number[] = [
  STATUS_REAGENDADO_MULTA,
  STATUS_CANCELADO_MULTA,
];

/** "Ativo" = ocupa vaga. Apenas status=1 e legado NULL. */
export function isAtivo(status: number | null | undefined): boolean {
  return status === null || status === undefined || status === STATUS_AGENDADO;
}

/** Pendência de multa = aguardando pagamento (status 4 ou 5). */
export function isPendenteMulta(status: number | null | undefined): boolean {
  return status === STATUS_REAGENDADO_MULTA || status === STATUS_CANCELADO_MULTA;
}

/** Where Prisma: linhas que OCUPAM vaga (apenas status=1 ou NULL). */
export const VAGA_WHERE: Prisma.PfImersoesAgendamentoWhereInput = {
  OR: [{ status: STATUS_AGENDADO }, { status: null }],
};

/** Where Prisma: linhas VISÍVEIS para o aluno (ativas + pendentes de multa + NULL). */
export const VISIVEL_WHERE: Prisma.PfImersoesAgendamentoWhereInput = {
  OR: [
    { status: { in: [STATUS_AGENDADO, STATUS_REAGENDADO_MULTA, STATUS_CANCELADO_MULTA] } },
    { status: null },
  ],
};

/**
 * Compat: `ATIVO_WHERE` agora é alias para `VAGA_WHERE` (só status=1).
 * Mantém para não quebrar imports existentes — quem precisa de visibilidade
 * ampla usa `VISIVEL_WHERE` explicitamente.
 */
export const ATIVO_WHERE = VAGA_WHERE;

/** STATUS_ATIVOS legacy — mantido para o que era usado em me.service. */
export const STATUS_ATIVOS: number[] = [STATUS_AGENDADO];
