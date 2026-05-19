import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma-clients/lovable';
import { LovablePrismaService } from '../prisma/lovable-prisma.service';
import {
  STATUS_AGENDADO,
  STATUS_CANCELADO,
  STATUS_REAGENDADO,
  VAGA_WHERE,
  VISIVEL_WHERE,
  isAtivo,
  isPendenteMulta,
} from './status.constants';

const DIAS_LIMITE = 15;

export interface ImersaoDisponivel {
  idImersao: number;
  tipo: { idTipo: number; nome: string };
  dataImersao: Date;
  dataAbertura: Date;
  vagasTotal: number;
  vagasOcupadas: number;
  vagasRestantes: number;
}

@Injectable()
export class ImersoesService {
  constructor(private readonly prisma: LovablePrismaService) {}

  async listarDisponiveis(matricula: string): Promise<ImersaoDisponivel[]> {
    const agora = new Date();

    const tiposParticipadosRaw = await this.prisma.pfImersoesAgendamento.findMany({
      where: {
        matricula,
        OR: [
          { presencaSabadoManha: true },
          { presencaSabadoTarde: true },
          { presencaDomingoManha: true },
          { presencaDomingoTarde: true },
        ],
      },
      select: { imersao: { select: { tipo: true } } },
    });
    const tiposBloqueados = new Set(tiposParticipadosRaw.map((a) => a.imersao.tipo));

    const inscritasRaw = await this.prisma.pfImersoesAgendamento.findMany({
      where: { matricula, ...VISIVEL_WHERE },
      select: { idImersao: true },
    });
    const idsInscritos = new Set(inscritasRaw.map((a) => a.idImersao));

    const imersoes = await this.prisma.pfImersoes1.findMany({
      where: {
        dataImersao: { gt: agora },
        dataAbertura: { lte: agora },
      },
      include: {
        tipoRef: true,
        _count: { select: { agendamentos: { where: VAGA_WHERE } } },
      },
      orderBy: { dataImersao: 'asc' },
    });

    const resultado: ImersaoDisponivel[] = [];
    for (const im of imersoes) {
      const ocupadas = im._count.agendamentos;
      if (ocupadas >= im.vagas) continue;
      if (tiposBloqueados.has(im.tipo)) continue;
      if (idsInscritos.has(im.idImersao)) continue;

      resultado.push({
        idImersao: im.idImersao,
        tipo: { idTipo: im.tipoRef.idTipo, nome: im.tipoRef.tipo },
        dataImersao: im.dataImersao,
        dataAbertura: im.dataAbertura,
        vagasTotal: im.vagas,
        vagasOcupadas: ocupadas,
        vagasRestantes: im.vagas - ocupadas,
      });
    }
    return resultado;
  }

  async detalhar(idImersao: number) {
    const im = await this.prisma.pfImersoes1.findUnique({
      where: { idImersao },
      include: {
        tipoRef: true,
        _count: { select: { agendamentos: { where: VAGA_WHERE } } },
      },
    });
    if (!im) throw new NotFoundException('Imersão não encontrada');
    return {
      idImersao: im.idImersao,
      tipo: { idTipo: im.tipoRef.idTipo, nome: im.tipoRef.tipo },
      dataImersao: im.dataImersao,
      dataAbertura: im.dataAbertura,
      vagasTotal: im.vagas,
      vagasOcupadas: im._count.agendamentos,
      vagasRestantes: im.vagas - im._count.agendamentos,
    };
  }

  async inscrever(matricula: string, idImersao: number) {
    await this.checarBloqueiosOuLancar(matricula);
    return this.prisma.$transaction(
      async (tx) => {
        const im = await tx.pfImersoes1.findUnique({
          where: { idImersao },
          include: { tipoRef: true },
        });
        if (!im) throw new NotFoundException('Imersão não encontrada');

        const agora = new Date();
        if (im.dataAbertura > agora) {
          throw new BadRequestException('Inscrições para esta imersão ainda não estão abertas');
        }
        if (im.dataImersao < agora) {
          throw new BadRequestException('Esta imersão já ocorreu');
        }

        const jaFezTipo = await tx.pfImersoesAgendamento.findFirst({
          where: {
            matricula,
            imersao: { tipo: im.tipo },
            OR: [
              { presencaSabadoManha: true },
              { presencaSabadoTarde: true },
              { presencaDomingoManha: true },
              { presencaDomingoTarde: true },
            ],
          },
        });
        if (jaFezTipo) {
          throw new ConflictException(
            `Você já participou de uma imersão de "${im.tipoRef.tipo}". Não é possível repetir o mesmo tipo.`,
          );
        }

        const ocupadas = await tx.pfImersoesAgendamento.count({
          where: { idImersao, ...VAGA_WHERE },
        });
        if (ocupadas >= im.vagas) {
          throw new BadRequestException('Não há mais vagas disponíveis nesta imersão.');
        }

        const agendamento = await this.upsertAgendamentoAtivo(tx, matricula, idImersao);
        return {
          status: 'inscrito',
          agendamento: {
            matricula: agendamento.matricula,
            idImersao: agendamento.idImersao,
            dataSolicitacao: agendamento.dataSolicitacao,
            status: agendamento.status,
          },
          imersao: {
            idImersao: im.idImersao,
            tipo: im.tipoRef.tipo,
            dataImersao: im.dataImersao,
          },
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async cancelar(matricula: string, idImersao: number) {
    await this.checarBloqueiosOuLancar(matricula);

    const agendamento = await this.prisma.pfImersoesAgendamento.findUnique({
      where: { matricula_idImersao: { matricula, idImersao } },
      include: { imersao: { include: { tipoRef: true } } },
    });
    if (!agendamento) throw new NotFoundException('Inscrição não encontrada');
    if (isPendenteMulta(agendamento.status)) {
      throw new ConflictException(
        'Você tem uma pendência de pagamento nesta imersão. Resolva com o suporte antes de fazer um novo pedido.',
      );
    }
    if (!isAtivo(agendamento.status)) {
      throw new NotFoundException('Inscrição não encontrada');
    }

    const dias = diasAteImersao(agendamento.imersao.dataImersao);
    if (dias < DIAS_LIMITE) {
      throw new ConflictException({
        direcionarCx: true,
        motivo: 'prazo',
        diasRestantes: dias,
        mensagem:
          'O prazo para cancelamento pelo app expirou (limite de 15 dias antes do evento). Entre em contato com o suporte agora mesmo para que possamos te ajudar.',
      });
    }

    await this.prisma.pfImersoesAgendamento.update({
      where: { matricula_idImersao: { matricula, idImersao } },
      data: { status: STATUS_CANCELADO, statusTimestamp: new Date() },
    });
    return { status: 'cancelado' };
  }

  async reagendar(matricula: string, idAtual: number, idNova: number) {
    if (idAtual === idNova) {
      throw new BadRequestException('A nova imersão precisa ser diferente da atual.');
    }
    await this.checarBloqueiosOuLancar(matricula);

    return this.prisma.$transaction(
      async (tx) => {
        const atual = await tx.pfImersoesAgendamento.findUnique({
          where: { matricula_idImersao: { matricula, idImersao: idAtual } },
          include: { imersao: true },
        });
        if (!atual) throw new NotFoundException('Inscrição atual não encontrada');
        if (isPendenteMulta(atual.status)) {
          throw new ConflictException(
            'Você tem uma pendência de pagamento nesta imersão. Resolva com o suporte antes de fazer um novo pedido.',
          );
        }
        if (!isAtivo(atual.status)) {
          throw new NotFoundException('Inscrição atual não encontrada');
        }

        const dias = diasAteImersao(atual.imersao.dataImersao);
        if (dias < DIAS_LIMITE) {
          throw new ConflictException({
            direcionarCx: true,
            motivo: 'prazo',
            diasRestantes: dias,
            mensagem:
              'O prazo para reagendamento pelo app expirou (limite de 15 dias antes do evento). Entre em contato com o suporte agora mesmo para que possamos te ajudar.',
          });
        }

        const nova = await tx.pfImersoes1.findUnique({
          where: { idImersao: idNova },
          include: { tipoRef: true },
        });
        if (!nova) throw new NotFoundException('Nova imersão não encontrada');

        if (nova.tipo !== atual.imersao.tipo) {
          throw new ConflictException(
            'Reagendamentos só são permitidos dentro do mesmo tipo de imersão.',
          );
        }

        const agora = new Date();
        if (nova.dataAbertura > agora) {
          throw new BadRequestException('A nova imersão ainda não está aberta para inscrição.');
        }
        if (nova.dataImersao < agora) {
          throw new BadRequestException('A nova imersão já ocorreu.');
        }

        const jaFezTipo = await tx.pfImersoesAgendamento.findFirst({
          where: {
            matricula,
            idImersao: { not: idAtual },
            imersao: { tipo: nova.tipo },
            OR: [
              { presencaSabadoManha: true },
              { presencaSabadoTarde: true },
              { presencaDomingoManha: true },
              { presencaDomingoTarde: true },
            ],
          },
        });
        if (jaFezTipo) {
          throw new ConflictException(
            `Você já participou de uma imersão de "${nova.tipoRef.tipo}".`,
          );
        }

        const ocupadasNova = await tx.pfImersoesAgendamento.count({
          where: { idImersao: idNova, ...VAGA_WHERE },
        });
        if (ocupadasNova >= nova.vagas) {
          throw new BadRequestException('Não há mais vagas na imersão escolhida.');
        }

        // Marca a atual como reagendada
        await tx.pfImersoesAgendamento.update({
          where: { matricula_idImersao: { matricula, idImersao: idAtual } },
          data: { status: STATUS_REAGENDADO, statusTimestamp: new Date() },
        });

        const novoAgendamento = await this.upsertAgendamentoAtivo(tx, matricula, idNova);

        return {
          status: 'reagendado',
          agendamento: {
            matricula: novoAgendamento.matricula,
            idImersao: novoAgendamento.idImersao,
            dataSolicitacao: novoAgendamento.dataSolicitacao,
            status: novoAgendamento.status,
          },
          imersao: {
            idImersao: nova.idImersao,
            tipo: nova.tipoRef.tipo,
            dataImersao: nova.dataImersao,
          },
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  /**
   * Cria um agendamento ativo OU reativa um registro existente que estava
   * cancelado/reagendado. Lança ConflictException se já existe ativo.
   * Deve ser chamado dentro de uma transação serializable (passar o tx).
   */
  private async upsertAgendamentoAtivo(
    tx: Prisma.TransactionClient,
    matricula: string,
    idImersao: number,
  ) {
    const agora = new Date();
    const existente = await tx.pfImersoesAgendamento.findUnique({
      where: { matricula_idImersao: { matricula, idImersao } },
    });

    if (existente) {
      if (isPendenteMulta(existente.status)) {
        throw new ConflictException(
          'Você tem uma pendência de pagamento de multa nesta imersão. Resolva com o suporte antes de fazer um novo pedido.',
        );
      }
      if (isAtivo(existente.status)) {
        throw new ConflictException('Você já está inscrito nesta imersão.');
      }
      // Reativação a partir de status 2 (Cancelado) ou 3 (Reagendado).
      // Limpa pagouMulta e os 4 campos de presença para evitar herança
      // de estado de inscrições anteriores (D5 do plano de sintonia
      // com o admin-plantao-flexivel — ver SINTONIA_IMERSOES.md §C1).
      return tx.pfImersoesAgendamento.update({
        where: { matricula_idImersao: { matricula, idImersao } },
        data: {
          status: STATUS_AGENDADO,
          statusTimestamp: agora,
          dataSolicitacao: agora,
          pagouMulta: false,
          presencaSabadoManha: null,
          presencaSabadoTarde: null,
          presencaDomingoManha: null,
          presencaDomingoTarde: null,
        },
      });
    }

    return tx.pfImersoesAgendamento.create({
      data: {
        matricula,
        idImersao,
        status: STATUS_AGENDADO,
        statusTimestamp: agora,
      },
    });
  }

  private async checarBloqueiosOuLancar(matricula: string): Promise<void> {
    const aluno = await this.prisma.pfAlunos.findUnique({
      where: { matricula },
      select: { statusFinanceiro: true },
    });
    if (/inadimplent/i.test(aluno?.statusFinanceiro ?? '')) {
      throw new ConflictException({
        direcionarCx: true,
        motivo: 'inadimplente',
        mensagem:
          'Sua situação financeira pode estar pendente. Para verificar sua situação ou regularizar, entre em contato com o suporte.',
      });
    }
    const punicao = await this.prisma.pfPunicoes.findFirst({
      where: { matricula, punicaoFim: { gte: new Date() } },
    });
    if (punicao) {
      throw new ConflictException({
        direcionarCx: true,
        motivo: 'punicao',
        mensagem:
          'Você possui uma restrição vigente. Para essa ação, entre em contato com o suporte.',
      });
    }
  }
}

function diasAteImersao(dataImersao: Date): number {
  const ms = dataImersao.getTime() - Date.now();
  return Math.floor(ms / 86_400_000);
}

// Re-export para uso interno (silenciar unused warning de STATUS_REAGENDADO_MULTA)
void STATUS_REAGENDADO_MULTA;
