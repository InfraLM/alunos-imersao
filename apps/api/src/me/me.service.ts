import { Injectable } from '@nestjs/common';
import { LovablePrismaService } from '../prisma/lovable-prisma.service';
import {
  STATUS_AGENDADO,
  STATUS_CANCELADO,
  STATUS_CANCELADO_MULTA,
  STATUS_REAGENDADO,
  STATUS_REAGENDADO_MULTA,
  isPendenteMulta,
} from '../imersoes/status.constants';

const DIAS_LIMITE = 15;

@Injectable()
export class MeService {
  constructor(private readonly prisma: LovablePrismaService) {}

  /**
   * Reconcilia linhas pendentes de multa quando o admin externo marca
   * `pagou_multa=true`. Idempotente — pode ser chamada antes de qualquer
   * listagem.
   *   status=4 + pagou_multa=true → status=3 (Reagendado)
   *   status=5 + pagou_multa=true → status=2 (Cancelado)
   * A nova linha (status=1) do reagendamento já foi criada pelo admin no
   * momento do pedido — nada a fazer aqui além de mudar o status da antiga.
   */
  async reconciliarMultaPaga(matricula: string): Promise<void> {
    const agora = new Date();
    await this.prisma.pfImersoesAgendamento.updateMany({
      where: { matricula, status: STATUS_REAGENDADO_MULTA, pagouMulta: true },
      data: { status: STATUS_REAGENDADO, statusTimestamp: agora },
    });
    await this.prisma.pfImersoesAgendamento.updateMany({
      where: { matricula, status: STATUS_CANCELADO_MULTA, pagouMulta: true },
      data: { status: STATUS_CANCELADO, statusTimestamp: agora },
    });
  }

  async listarInscricoes(matricula: string) {
    await this.reconciliarMultaPaga(matricula);

    const agora = new Date();
    const ags = await this.prisma.pfImersoesAgendamento.findMany({
      where: {
        matricula,
        imersao: { dataImersao: { gte: agora } },
        OR: [
          {
            status: {
              in: [STATUS_AGENDADO, STATUS_REAGENDADO_MULTA, STATUS_CANCELADO_MULTA],
            },
          },
          { status: null },
        ],
      },
      include: { imersao: { include: { tipoRef: true } } },
      orderBy: { imersao: { dataImersao: 'asc' } },
    });

    return ags.map((a) => {
      const dias = Math.floor((a.imersao.dataImersao.getTime() - Date.now()) / 86_400_000);
      return {
        idImersao: a.idImersao,
        tipo: a.imersao.tipoRef.tipo,
        tipoId: a.imersao.tipo,
        dataImersao: a.imersao.dataImersao,
        diasRestantes: dias,
        podeAlterarSemFinanceiro: dias >= DIAS_LIMITE,
        dataSolicitacao: a.dataSolicitacao,
        status: a.status,
        pagouMulta: a.pagouMulta,
        pendenteMulta: isPendenteMulta(a.status),
        local: a.imersao.local,
        cidade: a.imersao.cidade,
        estado: a.imersao.estado,
      };
    });
  }

  async listarHistorico(matricula: string) {
    await this.reconciliarMultaPaga(matricula);

    const agora = new Date();
    const ags = await this.prisma.pfImersoesAgendamento.findMany({
      where: {
        matricula,
        imersao: { dataImersao: { lt: agora } },
        OR: [
          { status: { in: [STATUS_AGENDADO, STATUS_REAGENDADO_MULTA] } },
          { status: null },
        ],
      },
      include: { imersao: { include: { tipoRef: true } } },
      orderBy: { imersao: { dataImersao: 'desc' } },
    });

    return ags.map((a) => {
      const presencas = [
        a.presencaSabadoManha,
        a.presencaSabadoTarde,
        a.presencaDomingoManha,
        a.presencaDomingoTarde,
      ];
      let statusPresenca: 'presente' | 'faltou' | 'pendente';
      if (presencas.some((p) => p === true)) statusPresenca = 'presente';
      else if (presencas.every((p) => p === false)) statusPresenca = 'faltou';
      else statusPresenca = 'pendente';

      return {
        idImersao: a.idImersao,
        tipo: a.imersao.tipoRef.tipo,
        tipoId: a.imersao.tipo,
        dataImersao: a.imersao.dataImersao,
        statusPresenca,
      };
    });
  }

  /**
   * Registro acadêmico do aluno: plantões realizados, imersões com presença e
   * checkpoints. Devolve dados crus — a conversão em horas é feita no front
   * (mesma regra do admin-plantao-flexivel). `pf_plantoes` e `pf_checkpoints`
   * não estão no schema Prisma, então são lidos via SQL cru.
   */
  async getHoras(matricula: string) {
    const aluno = await this.prisma.pfAlunos.findUnique({
      where: { matricula },
      select: { nome: true, matricula: true, criadoEm: true },
    });

    const plantoes = await this.prisma.$queryRawUnsafe<
      Array<{ data_plantao: string | null; status: string | null; hospital_nome: string | null }>
    >(
      `SELECT p.data_plantao, p.status, h.nome AS hospital_nome
         FROM lovable.pf_plantoes p
         LEFT JOIN lovable.pf_hospital h ON h.codigo_hospital = p.hospital
        WHERE p.matricula = $1`,
      matricula,
    );

    const ags = await this.prisma.pfImersoesAgendamento.findMany({
      where: { matricula },
      include: { imersao: { include: { tipoRef: true } } },
    });
    const agendamentos = ags.map((a) => ({
      id_imersao: a.idImersao,
      data_imersao: a.imersao.dataImersao,
      tipo_nome: a.imersao.tipoRef.tipo,
      presenca_sabado_manha: a.presencaSabadoManha,
      presenca_sabado_tarde: a.presencaSabadoTarde,
      presenca_domingo_manha: a.presencaDomingoManha,
      presenca_domingo_tarde: a.presencaDomingoTarde,
    }));

    // Presença em checkpoint só conta se o registro (data_hora) cair entre
    // 18h e 22h no horário de Brasília; e no máximo 1 por dia (deduplicação
    // por matrícula+dia, mantendo o registro mais antigo). Regra idêntica ao
    // admin-plantao-flexivel (checkpoints.controller.js, commit 9148a71).
    const checkpoints = await this.prisma.$queryRawUnsafe<
      Array<{ data: string | null; hora: string | null; data_hora: Date | null }>
    >(
      `WITH presencas_validas AS (
         SELECT DISTINCT ON (
                  c.matricula,
                  COALESCE(c."data", to_char(c.data_hora AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY'))
                )
                c.matricula, c."data", c.hora, c.data_hora
           FROM lovable.pf_checkpoints c
          WHERE c.data_hora IS NOT NULL
            AND (c.data_hora AT TIME ZONE 'America/Sao_Paulo')::time
                BETWEEN TIME '18:00:00' AND TIME '22:00:00'
          ORDER BY c.matricula,
                   COALESCE(c."data", to_char(c.data_hora AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY')),
                   c.data_hora ASC
       )
       SELECT "data", hora, data_hora FROM presencas_validas WHERE matricula = $1`,
      matricula,
    );

    return {
      aluno: {
        nome: aluno?.nome ?? null,
        matricula: aluno?.matricula ?? matricula,
        criado_em: aluno?.criadoEm ?? null,
      },
      plantoes,
      agendamentos,
      checkpoints,
    };
  }
}
