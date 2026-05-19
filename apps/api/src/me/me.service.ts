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
}
